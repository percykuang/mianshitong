import type { LlmProvider } from '@mianshitong/llm';
import type { ChatMessage, ChatSession, PostMessageResult } from '@mianshitong/shared';
import { buildInterviewReport } from './scoring';
import { includesKeyword, pushAssistantMessage, shouldStartInterview } from './session-core';

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

export function handleIdleSession(input: {
  session: ChatSession;
  provider: LlmProvider;
  content: string;
  now: string;
  assistantMessages: ChatMessage[];
}): PostMessageResult {
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

  input.session.status = 'interviewing';
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
  const keyPoints = input.currentQuestion.keyPoints ?? [];
  if (keyPoints.length === 0) {
    return false;
  }

  const mergedAnswer = input.session.runtime.activeQuestionAnswers.join('\n');
  const matchedPoints = keyPoints.filter((item) => includesKeyword(mergedAnswer, item));
  const missingPoints = keyPoints.filter((item) => !includesKeyword(mergedAnswer, item));
  const coverage = matchedPoints.length / keyPoints.length;

  if (input.session.runtime.followUpRound >= 1 || coverage >= 0.55 || missingPoints.length === 0) {
    return false;
  }

  input.session.runtime.followUpRound += 1;
  pushAssistantMessage(input.session, input.assistantMessages, {
    kind: 'question',
    content: input.provider.generateFollowUpMessage({
      question: input.currentQuestion,
      missingPoint: missingPoints[0],
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
  input.session.report = buildInterviewReport(input.session.runtime.assessments);

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
