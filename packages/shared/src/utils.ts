import { DEFAULT_INTERVIEW_CONFIG } from './defaults';
import type { DimensionScores, InterviewConfig } from './contracts';

export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

export function normalizeInterviewConfig(
  config: Partial<InterviewConfig> | undefined,
): InterviewConfig {
  const nextTopics = config?.topics?.length
    ? [...new Set(config.topics)]
    : DEFAULT_INTERVIEW_CONFIG.topics;

  return {
    topics: nextTopics,
    level: config?.level ?? DEFAULT_INTERVIEW_CONFIG.level,
    questionCount: clamp(config?.questionCount ?? DEFAULT_INTERVIEW_CONFIG.questionCount, 1, 8),
    feedbackMode: config?.feedbackMode ?? DEFAULT_INTERVIEW_CONFIG.feedbackMode,
  };
}

export function createEmptyScores(): DimensionScores {
  return {
    correctness: 0,
    depth: 0,
    communication: 0,
    engineering: 0,
    tradeoffs: 0,
  };
}
