import { Annotation, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import {
  defaultInterviewBlueprintSkill,
  defaultResumeProfileSkill,
} from '@mianshitong/agent-skills';
import {
  createLexicalQuestionRetriever,
  type QuestionRetriever,
  type QuestionRetrievalResult,
} from '@mianshitong/retrieval';
import type {
  InterviewBlueprint,
  InterviewConfig,
  InterviewLevel,
  InterviewPlanningCandidateTrace,
  InterviewPlanningStrategy,
  InterviewPlanningStepTrace,
  InterviewPlanningTrace,
  InterviewQuestion,
  InterviewTopic,
  ResumeProfile,
  WeightedTag,
} from '@mianshitong/shared';

const LEVEL_WEIGHT: Record<InterviewLevel, number> = {
  junior: 1,
  mid: 2,
  senior: 3,
};

const TRACE_CANDIDATE_LIMIT = 5;

const PLANNING_STATE = Annotation.Root({
  sourceText: Annotation<string>,
  config: Annotation<InterviewConfig>,
  resumeProfile: Annotation<ResumeProfile | null>,
  interviewBlueprint: Annotation<InterviewBlueprint | null>,
});

type PlanningState = typeof PLANNING_STATE.State;

function normalizeTag(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s._/-]+/g, '');
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function buildSourceTextPreview(sourceText: string): string {
  const normalized = sourceText.replace(/\s+/g, ' ').trim();
  return normalized.length > 200 ? `${normalized.slice(0, 200)}...` : normalized;
}

function uniqueWeightedTags(tags: WeightedTag[]): WeightedTag[] {
  const merged = new Map<string, number>();

  for (const item of tags) {
    const normalized = normalizeTag(item.tag);
    if (!normalized) {
      continue;
    }

    merged.set(normalized, Math.max(merged.get(normalized) ?? 0, item.weight));
  }

  return [...merged.entries()]
    .map(([tag, weight]) => ({ tag, weight }))
    .sort((left, right) => right.weight - left.weight);
}

function resolveQuestionTopic(tags: string[]): InterviewTopic | null {
  const normalized = new Set(tags.map(normalizeTag));
  const topics: InterviewTopic[] = [
    'javascript',
    'react',
    'vue',
    'engineering',
    'performance',
    'network',
    'security',
    'node',
  ];

  for (const topic of topics) {
    if (normalized.has(topic)) {
      return topic;
    }
  }

  return null;
}

function buildLevelQuota(
  total: number,
  distribution: Record<InterviewLevel, number>,
): Record<InterviewLevel, number> {
  const levels: InterviewLevel[] = ['junior', 'mid', 'senior'];
  const base = {
    junior: 0,
    mid: 0,
    senior: 0,
  } satisfies Record<InterviewLevel, number>;
  let allocated = 0;

  for (const level of levels) {
    const count = Math.floor(total * distribution[level]);
    base[level] = count;
    allocated += count;
  }

  const remainder = levels
    .map((level) => ({
      level,
      remainder: total * distribution[level] - base[level],
    }))
    .sort((left, right) => right.remainder - left.remainder);

  let remaining = total - allocated;
  let index = 0;
  while (remaining > 0) {
    base[remainder[index % remainder.length].level] += 1;
    remaining -= 1;
    index += 1;
  }

  return base;
}

function resolveDominantLevel(levelQuota: Record<InterviewLevel, number>): InterviewLevel {
  return (['junior', 'mid', 'senior'] as InterviewLevel[]).sort(
    (left, right) => levelQuota[right] - levelQuota[left],
  )[0];
}

function buildLevelSequence(levelQuota: Record<InterviewLevel, number>): InterviewLevel[] {
  const remaining = { ...levelQuota };
  const dominantLevel = resolveDominantLevel(levelQuota);
  const sequence: InterviewLevel[] = [];

  while (remaining.junior + remaining.mid + remaining.senior > 0) {
    const nextLevel = (['junior', 'mid', 'senior'] as InterviewLevel[])
      .filter((level) => remaining[level] > 0)
      .sort((left, right) => {
        if (remaining[right] !== remaining[left]) {
          return remaining[right] - remaining[left];
        }

        const leftDistance = Math.abs(LEVEL_WEIGHT[left] - LEVEL_WEIGHT[dominantLevel]);
        const rightDistance = Math.abs(LEVEL_WEIGHT[right] - LEVEL_WEIGHT[dominantLevel]);
        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }

        return LEVEL_WEIGHT[left] - LEVEL_WEIGHT[right];
      })[0];

    if (!nextLevel) {
      break;
    }

    sequence.push(nextLevel);
    remaining[nextLevel] -= 1;
  }

  return sequence;
}

function finalizeQuestion(question: InterviewQuestion): InterviewQuestion {
  return {
    ...question,
    topic: question.topic ?? resolveQuestionTopic(question.tags),
  };
}

function resolveAllowedLevels(targetLevel: InterviewLevel): InterviewLevel[] {
  if (targetLevel === 'junior') {
    return ['junior', 'mid'];
  }

  if (targetLevel === 'senior') {
    return ['senior', 'mid'];
  }

  return ['mid', 'junior', 'senior'];
}

function buildBalancedTags(
  tagDistribution: WeightedTag[],
  tagCoverage: Map<string, number>,
): WeightedTag[] {
  return uniqueWeightedTags(
    tagDistribution.map((item) => {
      const coveredCount = tagCoverage.get(normalizeTag(item.tag)) ?? 0;
      return {
        tag: item.tag,
        weight: Math.max(0.18, item.weight / (1 + coveredCount * 0.85)),
      };
    }),
  );
}

function buildRetrievalQueryText(input: {
  sourceText: string;
  profile: ResumeProfile;
  blueprint: InterviewBlueprint;
  targetLevel?: InterviewLevel | null;
}): string {
  return [
    input.sourceText,
    `候选人当前画像：${input.profile.seniority} 前端。`,
    `本轮目标难度：${input.targetLevel ?? input.profile.seniority}。`,
    `核心标签：${input.profile.primaryTags.map((item) => item.tag).join('、') || '通用前端能力'}。`,
    ...input.profile.evidence,
    ...input.blueprint.strategyNotes,
  ]
    .filter(Boolean)
    .join('\n');
}

async function pickNextQuestion(input: {
  retriever: QuestionRetriever;
  blueprint: InterviewBlueprint;
  profile: ResumeProfile;
  sourceText: string;
  selectedIds: Set<string>;
  uncoveredMustTags: Set<string>;
  preferredTags: WeightedTag[];
  targetLevel?: InterviewLevel | null;
  slot: number;
}): Promise<{
  question: InterviewQuestion | null;
  stepTrace: InterviewPlanningStepTrace;
}> {
  const baseQuery = {
    queryText: buildRetrievalQueryText({
      sourceText: input.sourceText,
      profile: input.profile,
      blueprint: input.blueprint,
      targetLevel: input.targetLevel,
    }),
    targetLevel: input.targetLevel,
    preferredTags: input.preferredTags,
    mustIncludeTags: [...input.uncoveredMustTags],
    optionalTags: input.blueprint.optionalTags,
    excludeQuestionIds: [...input.selectedIds],
    limit: Math.max(input.blueprint.questionCount * 4, 8),
  };

  const strictResults = input.targetLevel
    ? await input.retriever.search({
        ...baseQuery,
        allowedLevels: resolveAllowedLevels(input.targetLevel),
      })
    : [];

  const finalResults =
    strictResults.length > 0 ? strictResults : await input.retriever.search(baseQuery);
  const retrievalMode =
    input.targetLevel !== null && input.targetLevel !== undefined && strictResults.length > 0
      ? 'target_level'
      : 'fallback_any_level';
  const selectedResult = finalResults[0] ?? null;

  return {
    question: selectedResult?.doc.question ?? null,
    stepTrace: {
      slot: input.slot,
      targetLevel: input.targetLevel ?? null,
      retrievalMode,
      uncoveredMustTags: [...input.uncoveredMustTags],
      preferredTags: input.preferredTags.map((item) => ({ ...item })),
      candidateCount: finalResults.length,
      selectedQuestionId: selectedResult?.doc.id ?? null,
      selectedQuestionTitle: selectedResult?.doc.question.title ?? null,
      selectedScore: selectedResult ? roundScore(selectedResult.score) : null,
      candidates: finalResults.slice(0, TRACE_CANDIDATE_LIMIT).map(toPlanningCandidateTrace),
    },
  };
}

async function buildQuestionPlanFromBlueprint(input: {
  questionBank: InterviewQuestion[];
  blueprint: InterviewBlueprint;
  profile: ResumeProfile;
  sourceText: string;
  retriever?: QuestionRetriever;
  retrievalStrategy?: InterviewPlanningStrategy;
}): Promise<{
  questionPlan: InterviewQuestion[];
  planningTrace: InterviewPlanningTrace;
}> {
  const finalizedQuestionBank = input.questionBank.map(finalizeQuestion);
  const retriever =
    input.retriever ??
    createLexicalQuestionRetriever({
      questionBank: finalizedQuestionBank,
    });
  const selected: InterviewQuestion[] = [];
  const selectedIds = new Set<string>();
  const uncoveredMustTags = new Set(input.blueprint.mustIncludeTags.map(normalizeTag));
  const tagCoverage = new Map<string, number>();
  const levelQuota = buildLevelQuota(
    input.blueprint.questionCount,
    input.blueprint.difficultyDistribution,
  );
  const levelSequence = buildLevelSequence(levelQuota);
  const steps: InterviewPlanningStepTrace[] = [];

  for (const targetLevel of levelSequence) {
    const nextQuestionResult = await pickNextQuestion({
      retriever,
      blueprint: input.blueprint,
      profile: input.profile,
      sourceText: input.sourceText,
      selectedIds,
      uncoveredMustTags,
      preferredTags: buildBalancedTags(input.blueprint.tagDistribution, tagCoverage),
      targetLevel,
      slot: selected.length + 1,
    });
    steps.push(nextQuestionResult.stepTrace);

    const nextQuestion = nextQuestionResult.question;

    if (!nextQuestion) {
      continue;
    }

    selected.push(nextQuestion);
    selectedIds.add(nextQuestion.id);

    for (const tag of nextQuestion.tags.map(normalizeTag)) {
      uncoveredMustTags.delete(tag);
      tagCoverage.set(tag, (tagCoverage.get(tag) ?? 0) + 1);
    }

    if (selected.length >= input.blueprint.questionCount) {
      return {
        questionPlan: selected.slice(0, input.blueprint.questionCount),
        planningTrace: {
          strategy: input.retrievalStrategy ?? 'hybrid-lexical-v1',
          sourceTextPreview: buildSourceTextPreview(input.sourceText),
          levelQuota,
          steps,
        },
      };
    }
  }

  while (selected.length < input.blueprint.questionCount) {
    const nextQuestionResult = await pickNextQuestion({
      retriever,
      blueprint: input.blueprint,
      profile: input.profile,
      sourceText: input.sourceText,
      selectedIds,
      uncoveredMustTags,
      preferredTags: buildBalancedTags(input.blueprint.tagDistribution, tagCoverage),
      targetLevel: null,
      slot: selected.length + 1,
    });
    steps.push(nextQuestionResult.stepTrace);

    const nextQuestion = nextQuestionResult.question;

    if (!nextQuestion) {
      break;
    }

    selected.push(nextQuestion);
    selectedIds.add(nextQuestion.id);

    for (const tag of nextQuestion.tags.map(normalizeTag)) {
      uncoveredMustTags.delete(tag);
      tagCoverage.set(tag, (tagCoverage.get(tag) ?? 0) + 1);
    }
  }

  return {
    questionPlan: selected.slice(0, input.blueprint.questionCount),
    planningTrace: {
      strategy: input.retrievalStrategy ?? 'hybrid-lexical-v1',
      sourceTextPreview: buildSourceTextPreview(input.sourceText),
      levelQuota,
      steps,
    },
  };
}

function buildPlanningSummary(profile: ResumeProfile, blueprint: InterviewBlueprint): string {
  const focusTags = blueprint.tagDistribution.slice(0, 3).map((item) => item.tag);
  const years = profile.yearsOfExperience
    ? `${profile.yearsOfExperience} 年经验`
    : '经验年限未明确';

  return [
    `已根据你的输入生成本场面试计划：画像判断为 ${profile.seniority} 前端候选人（${years}）。`,
    `我会优先考察 ${focusTags.join('、') || '通用前端能力'}，共 ${blueprint.questionCount} 题。`,
  ].join('\n');
}

function toPlanningCandidateTrace(
  result: QuestionRetrievalResult,
): InterviewPlanningCandidateTrace {
  return {
    questionId: result.doc.id,
    questionTitle: result.doc.question.title,
    level: result.doc.level,
    tags: [...result.doc.question.tags],
    score: roundScore(result.score),
    matchedTags: [...result.matchedTags],
    matchedMustIncludeTags: [...result.matchedMustIncludeTags],
    matchedOptionalTags: [...result.matchedOptionalTags],
    lexicalOverlap: [...result.lexicalOverlap],
    breakdown: {
      semantic: roundScore(result.breakdown.semantic),
      lexical: roundScore(result.breakdown.lexical),
      tag: roundScore(result.breakdown.tag),
      mustInclude: roundScore(result.breakdown.mustInclude),
      optional: roundScore(result.breakdown.optional),
      level: roundScore(result.breakdown.level),
      penalty: roundScore(result.breakdown.penalty),
    },
  };
}

async function profileNode(state: PlanningState) {
  const resumeProfile = await defaultResumeProfileSkill.execute({
    sourceText: state.sourceText,
    config: state.config,
  });
  return { resumeProfile };
}

async function blueprintNode(state: PlanningState) {
  if (!state.resumeProfile) {
    return { interviewBlueprint: null };
  }

  return {
    interviewBlueprint: await defaultInterviewBlueprintSkill.execute({
      profile: state.resumeProfile,
      config: state.config,
    }),
  };
}

const planningGraph = new StateGraph(PLANNING_STATE)
  .addNode('profile', profileNode)
  .addNode('blueprint', blueprintNode)
  .addEdge(START, 'profile')
  .addEdge('profile', 'blueprint')
  .compile({ checkpointer: new MemorySaver() });

export interface InterviewPlanningResult {
  resumeProfile: ResumeProfile;
  interviewBlueprint: InterviewBlueprint;
  questionPlan: InterviewQuestion[];
  planningSummary: string;
  planningTrace: InterviewPlanningTrace;
}

export async function planInterviewFromSource(input: {
  sourceText: string;
  config: InterviewConfig;
  questionBank: InterviewQuestion[];
  threadId?: string;
  questionRetriever?: QuestionRetriever;
  retrievalStrategy?: InterviewPlanningStrategy;
}): Promise<InterviewPlanningResult> {
  const result = await planningGraph.invoke(
    {
      sourceText: input.sourceText,
      config: input.config,
      resumeProfile: null,
      interviewBlueprint: null,
    },
    {
      configurable: {
        thread_id: input.threadId ?? 'planning',
      },
    },
  );

  if (!result.resumeProfile || !result.interviewBlueprint) {
    throw new Error('面试规划生成失败');
  }

  const questionPlanResult = await buildQuestionPlanFromBlueprint({
    questionBank: input.questionBank,
    blueprint: result.interviewBlueprint,
    profile: result.resumeProfile,
    sourceText: input.sourceText,
    retriever: input.questionRetriever,
    retrievalStrategy: input.retrievalStrategy,
  });

  const planningSummary = buildPlanningSummary(result.resumeProfile, result.interviewBlueprint);

  return {
    resumeProfile: result.resumeProfile,
    interviewBlueprint: result.interviewBlueprint,
    questionPlan: questionPlanResult.questionPlan,
    planningSummary,
    planningTrace: questionPlanResult.planningTrace,
  };
}
