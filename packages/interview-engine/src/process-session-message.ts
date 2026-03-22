import { createMockLlmProvider, type LlmProvider } from '@mianshitong/llm';
import type { QuestionRetriever } from '@mianshitong/retrieval';
import type {
  ChatMessage,
  ChatSession,
  InterviewPlanningStrategy,
  InterviewQuestion,
  PostMessageResult,
} from '@mianshitong/shared';
import {
  completeInterview,
  handleCompletedSession,
  handleEmptyInput,
  handleIdleSession,
  maybeAskFollowUp,
} from './process-helpers';
import { buildAssessmentResult, buildInterviewReportResult } from './scoring';
import { cloneSession, createMessage, pushAssistantMessage, toTitle } from './session-core';

function appendUserMessage(session: ChatSession, content: string, now: string): void {
  session.messages.push(
    createMessage({
      role: 'user',
      kind: 'text',
      content,
      createdAt: now,
    }),
  );
}

function ensureCompletedReport(
  session: ChatSession,
  assistantMessages: ChatMessage[],
  provider: LlmProvider,
  now: string,
): PostMessageResult {
  session.status = 'completed';
  if (!session.report) {
    const { report, trace } = buildInterviewReportResult(session.runtime.assessments, now);
    session.report = report;
    session.runtime.reportTrace = trace;
  }
  pushAssistantMessage(session, assistantMessages, {
    kind: 'report',
    content: provider.generateReportMessage(session.report),
    now,
  });
  session.updatedAt = now;
  return { session, assistantMessages };
}

function processInterviewingSession(input: {
  session: ChatSession;
  content: string;
  provider: LlmProvider;
  now: string;
  assistantMessages: ChatMessage[];
}): PostMessageResult {
  const currentQuestion =
    input.session.runtime.questionPlan[input.session.runtime.currentQuestionIndex];
  if (!currentQuestion) {
    return ensureCompletedReport(input.session, input.assistantMessages, input.provider, input.now);
  }

  input.session.runtime.activeQuestionAnswers.push(input.content);
  if (
    maybeAskFollowUp({
      session: input.session,
      currentQuestion,
      provider: input.provider,
      assistantMessages: input.assistantMessages,
      now: input.now,
    })
  ) {
    return { session: input.session, assistantMessages: input.assistantMessages };
  }

  const mergedAnswer = input.session.runtime.activeQuestionAnswers.join('\n');
  const { assessment, trace } = buildAssessmentResult(currentQuestion, mergedAnswer, input.now);
  input.session.runtime.assessments.push(assessment);
  input.session.runtime.assessmentTrace.push(trace);
  input.session.runtime.reportTrace = null;
  input.session.runtime.currentQuestionIndex += 1;
  input.session.runtime.followUpRound = 0;
  input.session.runtime.activeQuestionAnswers = [];

  if (input.session.config.feedbackMode === 'per_question') {
    pushAssistantMessage(input.session, input.assistantMessages, {
      kind: 'feedback',
      content: input.provider.generateQuestionFeedback(assessment),
      now: input.now,
    });
  }

  const nextQuestion =
    input.session.runtime.questionPlan[input.session.runtime.currentQuestionIndex];
  if (nextQuestion) {
    pushAssistantMessage(input.session, input.assistantMessages, {
      kind: 'question',
      content: input.provider.generateQuestionMessage({
        question: nextQuestion,
        index: input.session.runtime.currentQuestionIndex + 1,
        total: input.session.runtime.questionPlan.length,
      }),
      now: input.now,
    });
    input.session.updatedAt = input.now;
    return { session: input.session, assistantMessages: input.assistantMessages };
  }

  return completeInterview({
    session: input.session,
    provider: input.provider,
    assistantMessages: input.assistantMessages,
    now: input.now,
  });
}

export async function processSessionMessage(input: {
  session: ChatSession;
  content: string;
  now?: string;
  provider?: LlmProvider;
  questionBank?: InterviewQuestion[];
  questionRetriever?: QuestionRetriever;
  retrievalStrategy?: InterviewPlanningStrategy;
}): Promise<PostMessageResult> {
  const now = input.now ?? new Date().toISOString();
  const provider = input.provider ?? createMockLlmProvider();
  const session = cloneSession(input.session);
  const assistantMessages: ChatMessage[] = [];
  const content = input.content.trim();

  if (!content) {
    return handleEmptyInput(session, assistantMessages, now);
  }

  appendUserMessage(session, content, now);

  if (
    session.title === '新的对话' &&
    session.messages.filter((item) => item.role === 'user').length === 1
  ) {
    session.title = toTitle(content);
  }

  if (session.status === 'completed') {
    return handleCompletedSession(session, assistantMessages, now);
  }

  if (session.status === 'idle') {
    return handleIdleSession({
      session,
      provider,
      content,
      now,
      assistantMessages,
      questionBank: input.questionBank ?? [],
      questionRetriever: input.questionRetriever,
      retrievalStrategy: input.retrievalStrategy,
    });
  }

  return processInterviewingSession({
    session,
    content,
    provider,
    now,
    assistantMessages,
  });
}
