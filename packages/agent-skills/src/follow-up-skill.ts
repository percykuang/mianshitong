import type { InterviewFollowUpTrace, InterviewQuestion } from '@mianshitong/shared';
import type { AgentSkill } from './contracts';

export interface FollowUpSkillInput {
  question: InterviewQuestion;
  answers: string[];
  followUpRound: number;
  now: string;
}

export interface FollowUpSkillResult {
  trace: InterviewFollowUpTrace;
  shouldAskFollowUp: boolean;
}

export type FollowUpSkill = AgentSkill<FollowUpSkillInput, FollowUpSkillResult>;

function includesKeyword(answer: string, keyword: string): boolean {
  const normalizedAnswer = answer.toLowerCase();
  const normalizedKeyword = keyword.toLowerCase();
  return normalizedAnswer.includes(normalizedKeyword);
}

function buildAnswerPreview(answer: string): string {
  const normalized = answer.replace(/\s+/g, ' ').trim();
  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized;
}

export function createFollowUpSkill(options?: {
  name?: string;
  version?: string;
  maxFollowUpRound?: number;
  sufficientCoverage?: number;
}): FollowUpSkill {
  const maxFollowUpRound = options?.maxFollowUpRound ?? 1;
  const sufficientCoverage = options?.sufficientCoverage ?? 0.55;

  return {
    name: options?.name ?? 'follow_up',
    version: options?.version ?? 'v1',
    async execute(input) {
      const keyPoints = input.question.keyPoints ?? [];
      const mergedAnswer = input.answers.join('\n');
      const matchedPoints = keyPoints.filter((item) => includesKeyword(mergedAnswer, item));
      const missingPoints = keyPoints.filter((item) => !includesKeyword(mergedAnswer, item));
      const coverage = keyPoints.length > 0 ? matchedPoints.length / keyPoints.length : 0;

      let decision: InterviewFollowUpTrace['decision'] = 'ask_follow_up';
      let askedMissingPoint: string | null = missingPoints[0] ?? null;

      if (keyPoints.length === 0) {
        decision = 'skip_no_key_points';
        askedMissingPoint = null;
      } else if (input.followUpRound >= maxFollowUpRound) {
        decision = 'skip_max_round';
        askedMissingPoint = null;
      } else if (missingPoints.length === 0) {
        decision = 'skip_all_points_covered';
        askedMissingPoint = null;
      } else if (coverage >= sufficientCoverage) {
        decision = 'skip_coverage_sufficient';
        askedMissingPoint = null;
      }

      const trace: InterviewFollowUpTrace = {
        questionId: input.question.id,
        questionTitle: input.question.title,
        round: input.followUpRound + 1,
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

      return {
        trace,
        shouldAskFollowUp: trace.decision === 'ask_follow_up',
      };
    },
  };
}

export const defaultFollowUpSkill = createFollowUpSkill();
