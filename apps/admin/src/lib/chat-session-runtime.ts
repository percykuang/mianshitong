import { Prisma } from '@mianshitong/db';
import type { ChatSession } from '@mianshitong/shared';

interface PersistedRuntimeValue extends Record<string, unknown> {
  __chatUi?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function decodeAdminSessionRuntime(input: Prisma.JsonValue): ChatSession['runtime'] {
  if (!isRecord(input)) {
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

  const runtimeValue = input as PersistedRuntimeValue;
  const runtime = { ...runtimeValue };
  delete runtime.__chatUi;

  const normalizedRuntime = runtime as Partial<ChatSession['runtime']>;

  return {
    questionPlan: Array.isArray(normalizedRuntime.questionPlan)
      ? normalizedRuntime.questionPlan
      : [],
    currentQuestionIndex:
      typeof normalizedRuntime.currentQuestionIndex === 'number'
        ? normalizedRuntime.currentQuestionIndex
        : 0,
    followUpRound:
      typeof normalizedRuntime.followUpRound === 'number' ? normalizedRuntime.followUpRound : 0,
    activeQuestionAnswers: Array.isArray(normalizedRuntime.activeQuestionAnswers)
      ? normalizedRuntime.activeQuestionAnswers
      : [],
    assessments: Array.isArray(normalizedRuntime.assessments) ? normalizedRuntime.assessments : [],
    followUpTrace: Array.isArray(normalizedRuntime.followUpTrace)
      ? normalizedRuntime.followUpTrace
      : [],
    assessmentTrace: Array.isArray(normalizedRuntime.assessmentTrace)
      ? normalizedRuntime.assessmentTrace
      : [],
    resumeProfile: isRecord(normalizedRuntime.resumeProfile)
      ? normalizedRuntime.resumeProfile
      : null,
    interviewBlueprint: isRecord(normalizedRuntime.interviewBlueprint)
      ? normalizedRuntime.interviewBlueprint
      : null,
    planningSummary:
      typeof normalizedRuntime.planningSummary === 'string'
        ? normalizedRuntime.planningSummary
        : null,
    planGeneratedAt:
      typeof normalizedRuntime.planGeneratedAt === 'string'
        ? normalizedRuntime.planGeneratedAt
        : null,
    planningTrace: isRecord(normalizedRuntime.planningTrace)
      ? normalizedRuntime.planningTrace
      : null,
    reportTrace: isRecord(normalizedRuntime.reportTrace) ? normalizedRuntime.reportTrace : null,
  };
}
