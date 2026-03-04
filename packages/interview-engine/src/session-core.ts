import { buildQuestionPlan } from '@mianshitong/question-bank';
import {
  normalizeInterviewConfig,
  type ChatMessage,
  type ChatSession,
  type CreateSessionInput,
  type InterviewRuntimeState,
  type MessageKind,
  type MessageRole,
} from '@mianshitong/shared';

const INTERVIEW_START_PATTERNS = [/模拟面试/, /开始面试/, /开始模拟/, /\binterview\b/i];

function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function createMessage(input: {
  role: MessageRole;
  kind: MessageKind;
  content: string;
  createdAt: string;
}): ChatMessage {
  return {
    id: createId('msg'),
    role: input.role,
    kind: input.kind,
    content: input.content,
    createdAt: input.createdAt,
  };
}

function cloneReport(report: ChatSession['report']): ChatSession['report'] {
  if (!report) {
    return null;
  }

  return {
    ...report,
    dimensionSummary: { ...report.dimensionSummary },
    strengths: [...report.strengths],
    gaps: [...report.gaps],
    nextSteps: [...report.nextSteps],
    breakdown: report.breakdown.map((item) => ({
      ...item,
      matchedPoints: [...item.matchedPoints],
      missingPoints: [...item.missingPoints],
      scores: { ...item.scores },
    })),
  };
}

function cloneRuntime(runtime: InterviewRuntimeState): InterviewRuntimeState {
  return {
    ...runtime,
    questionPlan: [...runtime.questionPlan],
    activeQuestionAnswers: [...runtime.activeQuestionAnswers],
    assessments: runtime.assessments.map((item) => ({
      ...item,
      matchedPoints: [...item.matchedPoints],
      missingPoints: [...item.missingPoints],
      scores: { ...item.scores },
    })),
  };
}

export function createRuntimeState(config: CreateSessionInput['config']): InterviewRuntimeState {
  const normalizedConfig = normalizeInterviewConfig(config);

  return {
    questionPlan: buildQuestionPlan(normalizedConfig),
    currentQuestionIndex: 0,
    followUpRound: 0,
    activeQuestionAnswers: [],
    assessments: [],
  };
}

export function cloneSession(session: ChatSession): ChatSession {
  return {
    ...session,
    config: {
      ...session.config,
      topics: [...session.config.topics],
    },
    messages: [...session.messages],
    report: cloneReport(session.report),
    runtime: cloneRuntime(session.runtime),
  };
}

export function shouldStartInterview(content: string): boolean {
  return INTERVIEW_START_PATTERNS.some((pattern) => pattern.test(content));
}

export function includesKeyword(answer: string, keyword: string): boolean {
  const normalizedAnswer = answer.toLowerCase();
  const normalizedKeyword = keyword.toLowerCase();
  return normalizedAnswer.includes(normalizedKeyword);
}

export function pushAssistantMessage(
  session: ChatSession,
  assistantMessages: ChatMessage[],
  input: { kind: MessageKind; content: string; now: string },
): void {
  const message = createMessage({
    role: 'assistant',
    kind: input.kind,
    content: input.content,
    createdAt: input.now,
  });
  session.messages.push(message);
  assistantMessages.push(message);
}

export function toTitle(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '新的对话';
  }

  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
}
