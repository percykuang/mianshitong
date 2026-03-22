import {
  type ChatMessage,
  type ChatSession,
  type CreateSessionInput,
  type InterviewQuestion,
  type InterviewRuntimeState,
  type MessageKind,
  type MessageRole,
} from '@mianshitong/shared';

const INTERVIEW_START_PATTERNS = [/模拟面试/, /开始面试/, /开始模拟/, /\binterview\b/i];
const INTERVIEW_COMMAND_PATTERNS = [
  /开始模拟面试/gi,
  /开始面试/gi,
  /开始模拟/gi,
  /\binterview\b/gi,
];

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

function cloneQuestion(question: InterviewQuestion): InterviewQuestion {
  return {
    ...question,
    keyPoints: [...(question.keyPoints ?? [])],
    followUps: [...(question.followUps ?? [])],
    tags: [...(question.tags ?? [])],
  };
}

function cloneRuntime(runtime: InterviewRuntimeState): InterviewRuntimeState {
  const questionPlan = Array.isArray(runtime.questionPlan) ? runtime.questionPlan : [];
  const activeQuestionAnswers = Array.isArray(runtime.activeQuestionAnswers)
    ? runtime.activeQuestionAnswers
    : [];
  const assessments = Array.isArray(runtime.assessments) ? runtime.assessments : [];
  const followUpTrace = Array.isArray(runtime.followUpTrace) ? runtime.followUpTrace : [];
  const assessmentTrace = Array.isArray(runtime.assessmentTrace) ? runtime.assessmentTrace : [];

  return {
    ...runtime,
    questionPlan: questionPlan.map(cloneQuestion),
    activeQuestionAnswers: [...activeQuestionAnswers],
    assessments: assessments.map((item) => ({
      ...item,
      matchedPoints: [...(item.matchedPoints ?? [])],
      missingPoints: [...(item.missingPoints ?? [])],
      scores: { ...item.scores },
    })),
    followUpTrace: followUpTrace.map((item) => ({
      ...item,
      matchedPoints: [...(item.matchedPoints ?? [])],
      missingPoints: [...(item.missingPoints ?? [])],
    })),
    assessmentTrace: assessmentTrace.map((item) => ({
      ...item,
      matchedPoints: [...(item.matchedPoints ?? [])],
      missingPoints: [...(item.missingPoints ?? [])],
      scores: { ...item.scores },
    })),
    resumeProfile: runtime.resumeProfile
      ? {
          ...runtime.resumeProfile,
          primaryTags: (runtime.resumeProfile.primaryTags ?? []).map((item) => ({ ...item })),
          secondaryTags: (runtime.resumeProfile.secondaryTags ?? []).map((item) => ({ ...item })),
          projectTags: [...(runtime.resumeProfile.projectTags ?? [])],
          strengths: [...(runtime.resumeProfile.strengths ?? [])],
          riskFlags: [...(runtime.resumeProfile.riskFlags ?? [])],
          evidence: [...(runtime.resumeProfile.evidence ?? [])],
        }
      : null,
    interviewBlueprint: runtime.interviewBlueprint
      ? {
          ...runtime.interviewBlueprint,
          difficultyDistribution: { ...runtime.interviewBlueprint.difficultyDistribution },
          tagDistribution: (runtime.interviewBlueprint.tagDistribution ?? []).map((item) => ({
            ...item,
          })),
          mustIncludeTags: [...(runtime.interviewBlueprint.mustIncludeTags ?? [])],
          optionalTags: [...(runtime.interviewBlueprint.optionalTags ?? [])],
          avoidTags: [...(runtime.interviewBlueprint.avoidTags ?? [])],
          strategyNotes: [...(runtime.interviewBlueprint.strategyNotes ?? [])],
        }
      : null,
    planningTrace: runtime.planningTrace
      ? {
          ...runtime.planningTrace,
          levelQuota: { ...runtime.planningTrace.levelQuota },
          steps: (runtime.planningTrace.steps ?? []).map((step) => ({
            ...step,
            uncoveredMustTags: [...(step.uncoveredMustTags ?? [])],
            preferredTags: (step.preferredTags ?? []).map((item) => ({ ...item })),
            candidates: (step.candidates ?? []).map((candidate) => ({
              ...candidate,
              tags: [...(candidate.tags ?? [])],
              matchedTags: [...(candidate.matchedTags ?? [])],
              matchedMustIncludeTags: [...(candidate.matchedMustIncludeTags ?? [])],
              matchedOptionalTags: [...(candidate.matchedOptionalTags ?? [])],
              lexicalOverlap: [...(candidate.lexicalOverlap ?? [])],
              breakdown: { ...candidate.breakdown },
            })),
          })),
        }
      : null,
    reportTrace: runtime.reportTrace
      ? {
          ...runtime.reportTrace,
          dimensionSummary: { ...runtime.reportTrace.dimensionSummary },
          dimensionTraces: (runtime.reportTrace.dimensionTraces ?? []).map((item) => ({
            ...item,
            sources: (item.sources ?? []).map((source) => ({ ...source })),
          })),
          strengths: (runtime.reportTrace.strengths ?? []).map((item) => ({
            ...item,
            sources: (item.sources ?? []).map((source) => ({ ...source })),
          })),
          gaps: (runtime.reportTrace.gaps ?? []).map((item) => ({
            ...item,
            sources: (item.sources ?? []).map((source) => ({ ...source })),
          })),
          nextSteps: (runtime.reportTrace.nextSteps ?? []).map((item) => ({
            ...item,
            sources: (item.sources ?? []).map((source) => ({ ...source })),
          })),
        }
      : null,
  };
}

export function createRuntimeState(
  _config: CreateSessionInput['config'],
  _questionBank?: unknown,
): InterviewRuntimeState {
  void _config;
  void _questionBank;

  return {
    questionPlan: [],
    currentQuestionIndex: 0,
    followUpRound: 0,
    activeQuestionAnswers: [],
    assessments: [],
    followUpTrace: [],
    assessmentTrace: [],
    resumeProfile: null,
    interviewBlueprint: null,
    planningSummary: null,
    planGeneratedAt: null,
    planningTrace: null,
    reportTrace: null,
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

export function extractInterviewPlanningText(content: string): string {
  return INTERVIEW_COMMAND_PATTERNS.reduce(
    (result, pattern) => result.replace(pattern, ' '),
    content,
  )
    .replace(/\s+/g, ' ')
    .trim();
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

  return normalized;
}
