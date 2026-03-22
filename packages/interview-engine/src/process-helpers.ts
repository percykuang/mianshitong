import type { LlmProvider } from '@mianshitong/llm';
import type { QuestionRetriever } from '@mianshitong/retrieval';
import type {
  ChatMessage,
  ChatSession,
  InterviewFollowUpTrace,
  InterviewPlanningStrategy,
  InterviewQuestion,
  PostMessageResult,
} from '@mianshitong/shared';
import { planInterviewFromSource } from './interview-planning';
import { buildInterviewReportResult } from './scoring';
import {
  extractInterviewPlanningText,
  includesKeyword,
  pushAssistantMessage,
  shouldStartInterview,
} from './session-core';

function buildAnswerPreview(answer: string): string {
  const normalized = answer.replace(/\s+/g, ' ').trim();
  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized;
}

function buildFollowUpTrace(input: {
  session: ChatSession;
  currentQuestion: ChatSession['runtime']['questionPlan'][number];
  now: string;
}): InterviewFollowUpTrace {
  const keyPoints = input.currentQuestion.keyPoints ?? [];
  const mergedAnswer = input.session.runtime.activeQuestionAnswers.join('\n');
  const matchedPoints = keyPoints.filter((item) => includesKeyword(mergedAnswer, item));
  const missingPoints = keyPoints.filter((item) => !includesKeyword(mergedAnswer, item));
  const coverage = keyPoints.length > 0 ? matchedPoints.length / keyPoints.length : 0;

  let decision: InterviewFollowUpTrace['decision'] = 'ask_follow_up';
  let askedMissingPoint: string | null = missingPoints[0] ?? null;

  if (keyPoints.length === 0) {
    decision = 'skip_no_key_points';
    askedMissingPoint = null;
  } else if (input.session.runtime.followUpRound >= 1) {
    decision = 'skip_max_round';
    askedMissingPoint = null;
  } else if (missingPoints.length === 0) {
    decision = 'skip_all_points_covered';
    askedMissingPoint = null;
  } else if (coverage >= 0.55) {
    decision = 'skip_coverage_sufficient';
    askedMissingPoint = null;
  }

  return {
    questionId: input.currentQuestion.id,
    questionTitle: input.currentQuestion.title,
    round: input.session.runtime.followUpRound + 1,
    answerPreview: buildAnswerPreview(mergedAnswer),
    answerLength: mergedAnswer.length,
    keyPointCount: keyPoints.length,
    matchedPoints,
    missingPoints,
    coverage: Number(coverage.toFixed(3)),
    decision,
    askedMissingPoint,
    createdAt: input.now,
  };
}

export function handleEmptyInput(
  session: ChatSession,
  assistantMessages: ChatMessage[],
  now: string,
): PostMessageResult {
  pushAssistantMessage(session, assistantMessages, {
    kind: 'text',
    content: '我还没收到具体问题，你可以继续输入。',
    now,
  });
  session.updatedAt = now;
  return { session, assistantMessages };
}

export function handleCompletedSession(
  session: ChatSession,
  assistantMessages: ChatMessage[],
  now: string,
): PostMessageResult {
  pushAssistantMessage(session, assistantMessages, {
    kind: 'text',
    content: '这场面试已经结束啦。你可以点 New Chat 开始下一场模拟。',
    now,
  });
  session.updatedAt = now;
  return { session, assistantMessages };
}

function buildPlanningSourceText(session: ChatSession, content: string): string {
  const previousUserMessages = session.messages
    .filter((item) => item.role === 'user')
    .map((item) => item.content.trim())
    .filter(Boolean);
  const currentPlanningText = extractInterviewPlanningText(content);

  return [...previousUserMessages, currentPlanningText].filter(Boolean).join('\n');
}

export async function handleIdleSession(input: {
  session: ChatSession;
  provider: LlmProvider;
  content: string;
  now: string;
  assistantMessages: ChatMessage[];
  questionBank: InterviewQuestion[];
  questionRetriever?: QuestionRetriever;
  retrievalStrategy?: InterviewPlanningStrategy;
}): Promise<PostMessageResult> {
  if (!shouldStartInterview(input.content)) {
    pushAssistantMessage(input.session, input.assistantMessages, {
      kind: 'text',
      content: input.provider.generateGeneralReply({
        content: input.content,
        modelId: input.session.modelId,
      }),
      now: input.now,
    });
    input.session.updatedAt = input.now;
    return { session: input.session, assistantMessages: input.assistantMessages };
  }

  const planningResult = await planInterviewFromSource({
    sourceText: buildPlanningSourceText(input.session, input.content),
    config: input.session.config,
    questionBank: input.questionBank,
    threadId: input.session.id,
    questionRetriever: input.questionRetriever,
    retrievalStrategy: input.retrievalStrategy,
  });

  input.session.runtime.questionPlan = planningResult.questionPlan;
  input.session.runtime.resumeProfile = planningResult.resumeProfile;
  input.session.runtime.interviewBlueprint = planningResult.interviewBlueprint;
  input.session.runtime.planningSummary = planningResult.planningSummary;
  input.session.runtime.planGeneratedAt = input.now;
  input.session.runtime.planningTrace = planningResult.planningTrace;
  input.session.runtime.currentQuestionIndex = 0;
  input.session.runtime.followUpRound = 0;
  input.session.runtime.activeQuestionAnswers = [];
  input.session.runtime.assessments = [];
  input.session.runtime.followUpTrace = [];
  input.session.runtime.assessmentTrace = [];
  input.session.runtime.reportTrace = null;
  input.session.report = null;

  if (planningResult.questionPlan.length === 0) {
    pushAssistantMessage(input.session, input.assistantMessages, {
      kind: 'text',
      content: '当前题库里没有匹配你画像的可用题目，暂时还无法开始这场模拟面试。',
      now: input.now,
    });
    input.session.updatedAt = input.now;
    return { session: input.session, assistantMessages: input.assistantMessages };
  }

  input.session.status = 'interviewing';
  pushAssistantMessage(input.session, input.assistantMessages, {
    kind: 'system',
    content: planningResult.planningSummary,
    now: input.now,
  });
  pushAssistantMessage(input.session, input.assistantMessages, {
    kind: 'text',
    content: input.provider.generateInterviewKickoff(input.session.config),
    now: input.now,
  });

  const firstQuestion =
    input.session.runtime.questionPlan[input.session.runtime.currentQuestionIndex];
  if (firstQuestion) {
    pushAssistantMessage(input.session, input.assistantMessages, {
      kind: 'question',
      content: input.provider.generateQuestionMessage({
        question: firstQuestion,
        index: 1,
        total: input.session.runtime.questionPlan.length,
      }),
      now: input.now,
    });
  }

  input.session.updatedAt = input.now;
  return { session: input.session, assistantMessages: input.assistantMessages };
}

export function maybeAskFollowUp(input: {
  session: ChatSession;
  currentQuestion: ChatSession['runtime']['questionPlan'][number];
  provider: LlmProvider;
  assistantMessages: ChatMessage[];
  now: string;
}): boolean {
  const trace = buildFollowUpTrace(input);
  input.session.runtime.followUpTrace.push(trace);

  if (trace.decision !== 'ask_follow_up') {
    return false;
  }

  input.session.runtime.followUpRound += 1;
  pushAssistantMessage(input.session, input.assistantMessages, {
    kind: 'question',
    content: input.provider.generateFollowUpMessage({
      question: input.currentQuestion,
      missingPoint: trace.askedMissingPoint ?? '',
    }),
    now: input.now,
  });
  input.session.updatedAt = input.now;
  return true;
}

export function completeInterview(input: {
  session: ChatSession;
  provider: LlmProvider;
  assistantMessages: ChatMessage[];
  now: string;
}): PostMessageResult {
  input.session.status = 'completed';
  const { report, trace } = buildInterviewReportResult(
    input.session.runtime.assessments,
    input.now,
  );
  input.session.report = report;
  input.session.runtime.reportTrace = trace;

  if (
    input.session.config.feedbackMode === 'end_summary' &&
    input.session.runtime.assessments.length > 0
  ) {
    const latestAssessment = input.session.runtime.assessments.at(-1);
    if (latestAssessment) {
      pushAssistantMessage(input.session, input.assistantMessages, {
        kind: 'feedback',
        content: input.provider.generateQuestionFeedback(latestAssessment),
        now: input.now,
      });
    }
  }

  pushAssistantMessage(input.session, input.assistantMessages, {
    kind: 'report',
    content: input.provider.generateReportMessage(input.session.report),
    now: input.now,
  });
  input.session.updatedAt = input.now;
  return { session: input.session, assistantMessages: input.assistantMessages };
}
