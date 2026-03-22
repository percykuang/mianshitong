import type {
  InterviewBlueprint,
  InterviewConfig,
  InterviewLevel,
  InterviewTopic,
  ResumeProfile,
  WeightedTag,
} from '@mianshitong/shared';
import type { ChatTurn } from '@mianshitong/llm';
import type { AgentSkill, SkillExecutionContext } from './contracts';
import { createDeepSeekStructuredOutputProvider } from './deepseek-skill-helpers';

const DEFAULT_TAG_ALIASES: Record<string, string[]> = {
  javascript: ['javascript', 'js', 'es6', 'esnext', '事件循环', '闭包', '原型'],
  typescript: ['typescript', 'ts', '类型体操', '泛型', '类型系统'],
  react: ['react', 'reactjs', 'hooks', 'hook', 'redux', 'zustand'],
  vue: ['vue', 'vue2', 'vue3', 'pinia', 'vuex'],
  nextjs: ['next', 'nextjs', 'next.js'],
  engineering: ['工程化', 'webpack', 'vite', 'monorepo', 'ci/cd', 'eslint', 'prettier'],
  performance: ['性能', 'performance', 'lcp', 'fcp', '首屏', '缓存', '懒加载'],
  network: ['网络', 'http', 'https', 'websocket', 'tcp', 'cdn', '请求'],
  browser: ['浏览器', 'render', '渲染', 'dom', 'bom'],
  node: ['node', 'nodejs', 'node.js', 'express', 'nestjs', '服务端'],
  css: ['css', 'scss', 'sass', 'tailwind', '样式'],
};

export interface ResumeProfileSkillInput {
  sourceText: string;
  config: InterviewConfig;
}

export interface InterviewBlueprintSkillInput {
  profile: ResumeProfile;
  config: InterviewConfig;
}

export type ResumeProfileSkill = AgentSkill<ResumeProfileSkillInput, ResumeProfile>;
export type InterviewBlueprintSkill = AgentSkill<InterviewBlueprintSkillInput, InterviewBlueprint>;

export interface ResumeProfileInference {
  targetRole?: string | null;
  seniority?: InterviewLevel;
  yearsOfExperience?: number | null;
  primaryTags?: WeightedTag[];
  secondaryTags?: WeightedTag[];
  projectTags?: string[];
  strengths?: string[];
  riskFlags?: string[];
  evidence?: string[];
  confidence?: number;
}

export type ResumeProfileInferenceRunner = (
  input: ResumeProfileSkillInput,
  context?: SkillExecutionContext,
) => Promise<ResumeProfileInference | null>;

function normalizeTag(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s._/-]+/g, '');
}

function canonicalizeTag(value: string, tagAliases: Record<string, string[]>): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const normalized = normalizeTag(trimmed);
  for (const [canonicalTag, aliases] of Object.entries(tagAliases)) {
    if (normalizeTag(canonicalTag) === normalized) {
      return canonicalTag;
    }

    if (aliases.some((alias) => normalizeTag(alias) === normalized)) {
      return canonicalTag;
    }
  }

  return /^[a-z0-9\s._/-]+$/i.test(trimmed) ? normalized : trimmed;
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

function uniqueTextItems(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }

    if (seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

function uniqueStringTags(tags: string[], tagAliases: Record<string, string[]>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of tags) {
    const canonical = canonicalizeTag(item, tagAliases);
    if (!canonical) {
      continue;
    }

    const normalized = normalizeTag(canonical);
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(canonical);
  }

  return result;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInterviewLevel(value: unknown): value is InterviewLevel {
  return value === 'junior' || value === 'mid' || value === 'senior';
}

function normalizeTextList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueTextItems(
    value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()),
  ).slice(0, limit);
}

function normalizeTagList(
  value: unknown,
  tagAliases: Record<string, string[]>,
  limit: number,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueStringTags(
    value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()),
    tagAliases,
  ).slice(0, limit);
}

function normalizeWeightedTagInput(
  value: unknown,
  tagAliases: Record<string, string[]>,
  fallbackWeight: number,
  limit: number,
): WeightedTag[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed: WeightedTag[] = [];

  for (const item of value) {
    if (typeof item === 'string') {
      const tag = canonicalizeTag(item, tagAliases);
      if (!tag) {
        continue;
      }
      parsed.push({ tag, weight: fallbackWeight });
      continue;
    }

    if (!isRecord(item) || typeof item.tag !== 'string') {
      continue;
    }

    const tag = canonicalizeTag(item.tag, tagAliases);
    if (!tag) {
      continue;
    }

    const weight =
      typeof item.weight === 'number' && Number.isFinite(item.weight)
        ? clampNumber(item.weight, 0.18, 1)
        : fallbackWeight;

    parsed.push({ tag, weight });
  }

  return uniqueWeightedTags(parsed).slice(0, limit);
}

function detectYearsOfExperience(text: string): number | null {
  const matched = text.match(/(\d+)\s*(?:年|years?|yrs?)/i);
  if (!matched) {
    return null;
  }

  const years = Number(matched[1]);
  return Number.isFinite(years) ? years : null;
}

function detectSeniority(
  text: string,
  years: number | null,
  fallback: InterviewLevel,
): InterviewLevel {
  const normalized = text.toLowerCase();

  if (
    normalized.includes('资深') ||
    normalized.includes('高级') ||
    normalized.includes('负责人') ||
    normalized.includes('架构')
  ) {
    return 'senior';
  }

  if (
    normalized.includes('应届') ||
    normalized.includes('校招') ||
    normalized.includes('实习') ||
    normalized.includes('初级')
  ) {
    return 'junior';
  }

  if (years !== null) {
    if (years >= 5) {
      return 'senior';
    }
    if (years >= 2) {
      return 'mid';
    }
    return 'junior';
  }

  return fallback;
}

function detectTagWeights(
  sourceText: string,
  config: InterviewConfig,
  tagAliases: Record<string, string[]>,
): WeightedTag[] {
  const normalized = sourceText.toLowerCase();
  const detected: WeightedTag[] = [];

  for (const [canonicalTag, aliases] of Object.entries(tagAliases)) {
    let hits = 0;
    for (const alias of aliases) {
      if (normalized.includes(alias.toLowerCase())) {
        hits += 1;
      }
    }

    if (hits > 0) {
      detected.push({ tag: canonicalTag, weight: Math.min(1, 0.25 + hits * 0.18) });
    }
  }

  if (detected.length === 0) {
    for (const topic of config.topics) {
      detected.push({ tag: topic, weight: 0.7 });
    }
  }

  return uniqueWeightedTags(detected);
}

function splitPrimaryAndSecondaryTags(tags: WeightedTag[]): {
  primaryTags: WeightedTag[];
  secondaryTags: WeightedTag[];
} {
  if (tags.length <= 2) {
    return { primaryTags: tags, secondaryTags: [] };
  }

  return {
    primaryTags: tags.slice(0, 3),
    secondaryTags: tags.slice(3, 6),
  };
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

function resolveDifficultyDistribution(level: InterviewLevel): Record<InterviewLevel, number> {
  if (level === 'junior') {
    return { junior: 0.6, mid: 0.3, senior: 0.1 };
  }

  if (level === 'senior') {
    return { junior: 0.1, mid: 0.4, senior: 0.5 };
  }

  return { junior: 0.3, mid: 0.5, senior: 0.2 };
}

function resolveMustIncludeTagCount(questionCount: number): number {
  if (questionCount <= 1) {
    return 1;
  }

  if (questionCount <= 3) {
    return 2;
  }

  return 3;
}

function buildRuleBasedResumeProfile(
  input: ResumeProfileSkillInput,
  tagAliases: Record<string, string[]>,
): ResumeProfile {
  const sourceText = input.sourceText.trim();
  const yearsOfExperience = detectYearsOfExperience(sourceText);
  const seniority = detectSeniority(sourceText, yearsOfExperience, input.config.level);
  const detectedTags = detectTagWeights(sourceText, input.config, tagAliases);
  const { primaryTags, secondaryTags } = splitPrimaryAndSecondaryTags(detectedTags);

  return {
    role: 'frontend',
    targetRole: 'frontend-engineer',
    seniority,
    yearsOfExperience,
    primaryTags,
    secondaryTags,
    projectTags: detectedTags.slice(0, 6).map((item) => item.tag),
    strengths: primaryTags.map((item) => `${item.tag} 相关经验较明确`),
    riskFlags:
      sourceText.length < 40 ? ['简历/上下文信息较少，题目匹配将更多依赖默认前端题库策略'] : [],
    evidence: [
      ...(yearsOfExperience !== null ? [`识别到 ${yearsOfExperience} 年相关经验表述`] : []),
      ...primaryTags.map((item) => `识别到 ${item.tag} 相关关键词`),
    ],
    confidence: sourceText.length >= 80 ? 0.82 : sourceText.length >= 30 ? 0.68 : 0.45,
  };
}

function mergeResumeProfileInference(
  fallbackProfile: ResumeProfile,
  inferredProfile: ResumeProfileInference,
  tagAliases: Record<string, string[]>,
): ResumeProfile {
  const primaryTags =
    inferredProfile.primaryTags && inferredProfile.primaryTags.length > 0
      ? normalizeWeightedTagInput(inferredProfile.primaryTags, tagAliases, 0.82, 3)
      : fallbackProfile.primaryTags;
  const primaryTagSet = new Set(primaryTags.map((item) => normalizeTag(item.tag)));

  const secondarySource =
    inferredProfile.secondaryTags && inferredProfile.secondaryTags.length > 0
      ? normalizeWeightedTagInput(inferredProfile.secondaryTags, tagAliases, 0.58, 3)
      : fallbackProfile.secondaryTags;
  const secondaryTags = uniqueWeightedTags(
    secondarySource.filter((item) => !primaryTagSet.has(normalizeTag(item.tag))),
  ).slice(0, 3);

  const projectTags = uniqueStringTags(
    [
      ...(inferredProfile.projectTags ?? []),
      ...primaryTags.map((item) => item.tag),
      ...secondaryTags.map((item) => item.tag),
      ...fallbackProfile.projectTags,
    ],
    tagAliases,
  ).slice(0, 6);

  return {
    role: 'frontend',
    targetRole:
      typeof inferredProfile.targetRole === 'string' && inferredProfile.targetRole.trim()
        ? inferredProfile.targetRole.trim()
        : fallbackProfile.targetRole,
    seniority: inferredProfile.seniority ?? fallbackProfile.seniority,
    yearsOfExperience:
      inferredProfile.yearsOfExperience === undefined
        ? (fallbackProfile.yearsOfExperience ?? null)
        : inferredProfile.yearsOfExperience,
    primaryTags,
    secondaryTags,
    projectTags,
    strengths:
      inferredProfile.strengths && inferredProfile.strengths.length > 0
        ? inferredProfile.strengths
        : primaryTags.map((item) => `${item.tag} 相关经验较明确`),
    riskFlags: uniqueTextItems([
      ...(fallbackProfile.riskFlags ?? []),
      ...(inferredProfile.riskFlags ?? []),
    ]).slice(0, 6),
    evidence: uniqueTextItems([
      ...(inferredProfile.evidence ?? []),
      ...(fallbackProfile.evidence ?? []),
    ]).slice(0, 8),
    confidence:
      typeof inferredProfile.confidence === 'number' && Number.isFinite(inferredProfile.confidence)
        ? clampNumber(inferredProfile.confidence, 0.1, 0.99)
        : fallbackProfile.confidence,
  };
}

function parseResumeProfileInference(
  payload: unknown,
  tagAliases: Record<string, string[]>,
): ResumeProfileInference | null {
  if (!isRecord(payload)) {
    return null;
  }

  const primaryTags = normalizeWeightedTagInput(payload.primaryTags, tagAliases, 0.82, 3);
  const primaryTagSet = new Set(primaryTags.map((item) => normalizeTag(item.tag)));
  const secondaryTags = normalizeWeightedTagInput(payload.secondaryTags, tagAliases, 0.58, 3)
    .filter((item) => !primaryTagSet.has(normalizeTag(item.tag)))
    .slice(0, 3);
  const projectTags = normalizeTagList(payload.projectTags, tagAliases, 6);
  const targetRole =
    typeof payload.targetRole === 'string' && payload.targetRole.trim()
      ? payload.targetRole.trim()
      : null;
  const seniority = isInterviewLevel(payload.seniority) ? payload.seniority : undefined;
  const yearsOfExperience =
    typeof payload.yearsOfExperience === 'number' && Number.isFinite(payload.yearsOfExperience)
      ? clampNumber(payload.yearsOfExperience, 0, 30)
      : payload.yearsOfExperience === null
        ? null
        : undefined;
  const confidence =
    typeof payload.confidence === 'number' && Number.isFinite(payload.confidence)
      ? clampNumber(payload.confidence, 0.1, 0.99)
      : undefined;

  if (!seniority && primaryTags.length === 0 && secondaryTags.length === 0 && !targetRole) {
    return null;
  }

  return {
    targetRole,
    seniority,
    yearsOfExperience,
    primaryTags,
    secondaryTags,
    projectTags,
    strengths: normalizeTextList(payload.strengths, 6),
    riskFlags: normalizeTextList(payload.riskFlags, 6),
    evidence: normalizeTextList(payload.evidence, 8),
    confidence,
  };
}

function buildResumeProfileInferenceMessages(
  input: ResumeProfileSkillInput,
  tagAliases: Record<string, string[]>,
): ChatTurn[] {
  const canonicalTags = Object.keys(tagAliases).join(', ');

  return [
    {
      role: 'system',
      content: [
        '你是一个前端候选人画像分析器，需要把简历/上下文压缩成结构化 JSON，供后续面试规划与题库检索使用。',
        '你必须只返回一个 JSON object，不要返回 Markdown、解释、代码块或额外文字。',
        '请优先把标签映射到以下 canonical tags：',
        canonicalTags,
        'JSON schema 示例：',
        '{"targetRole":"frontend-engineer","seniority":"mid","yearsOfExperience":3,"primaryTags":[{"tag":"react","weight":0.92}],"secondaryTags":[{"tag":"engineering","weight":0.63}],"projectTags":["react","engineering"],"strengths":["React 工程经验较完整"],"riskFlags":["系统设计信息较少"],"evidence":["提到 React 性能优化项目"],"confidence":0.83}',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `目标面试等级：${input.config.level}`,
        `面试关注主题：${input.config.topics.join('、') || '未指定'}`,
        `题目数量：${input.config.questionCount}`,
        '请分析以下候选人信息，并输出 JSON：',
        input.sourceText.trim(),
      ].join('\n'),
    },
  ];
}

function createDeepSeekResumeProfileInferenceRunner(options: {
  tagAliases: Record<string, string[]>;
}): ResumeProfileInferenceRunner | undefined {
  const provider = createDeepSeekStructuredOutputProvider(['DEEPSEEK_MODEL']);
  if (!provider) {
    return undefined;
  }

  return async (input, context) => {
    const payload = await provider.completeJson({
      messages: buildResumeProfileInferenceMessages(input, options.tagAliases),
      maxTokens: 800,
      temperature: 0.1,
      signal: context?.signal,
    });

    return parseResumeProfileInference(payload, options.tagAliases);
  };
}

export function createResumeProfileSkill(options?: {
  name?: string;
  version?: string;
  tagAliases?: Record<string, string[]>;
  inferProfile?: ResumeProfileInferenceRunner | null;
  fallbackOnInferenceError?: boolean;
}): ResumeProfileSkill {
  const tagAliases = options?.tagAliases ?? DEFAULT_TAG_ALIASES;
  const fallbackOnInferenceError = options?.fallbackOnInferenceError ?? true;
  const inferProfile =
    options?.inferProfile === undefined
      ? createDeepSeekResumeProfileInferenceRunner({ tagAliases })
      : (options.inferProfile ?? undefined);

  return {
    name: options?.name ?? 'resume_profile',
    version: options?.version ?? 'v1',
    async execute(input, context) {
      const fallbackProfile = buildRuleBasedResumeProfile(input, tagAliases);

      if (!inferProfile) {
        if (!fallbackOnInferenceError) {
          throw new Error('ResumeProfileSkill 未启用可用的结构化推断器。');
        }

        return fallbackProfile;
      }

      try {
        const inferredProfile = await inferProfile(input, context);
        if (!inferredProfile) {
          if (!fallbackOnInferenceError) {
            throw new Error('ResumeProfileSkill 未返回有效的结构化画像结果。');
          }

          return fallbackProfile;
        }

        return mergeResumeProfileInference(fallbackProfile, inferredProfile, tagAliases);
      } catch (error) {
        if (!fallbackOnInferenceError) {
          throw error;
        }

        return fallbackProfile;
      }
    },
  };
}

export function createInterviewBlueprintSkill(options?: {
  name?: string;
  version?: string;
}): InterviewBlueprintSkill {
  return {
    name: options?.name ?? 'interview_blueprint',
    version: options?.version ?? 'v1',
    async execute(input) {
      const tagDistribution = uniqueWeightedTags([
        ...input.profile.primaryTags,
        ...input.profile.secondaryTags.map((item) => ({
          ...item,
          weight: Math.max(0.2, item.weight - 0.15),
        })),
      ]);
      const mustIncludeTagCount = Math.min(
        resolveMustIncludeTagCount(input.config.questionCount),
        tagDistribution.length,
      );

      return {
        questionCount: input.config.questionCount,
        difficultyDistribution: resolveDifficultyDistribution(input.profile.seniority),
        tagDistribution,
        mustIncludeTags: tagDistribution.slice(0, mustIncludeTagCount).map((item) => item.tag),
        optionalTags: tagDistribution.slice(mustIncludeTagCount, 6).map((item) => item.tag),
        avoidTags: [],
        strategyNotes: [
          `优先考察 ${
            tagDistribution
              .slice(0, 3)
              .map((item) => item.tag)
              .join('、') || '通用前端能力'
          }`,
          `候选人画像判断为 ${input.profile.seniority}`,
          `题目方向映射为 ${resolveQuestionTopic(input.profile.projectTags) ?? 'frontend'}`,
        ],
      };
    },
  };
}

export const defaultResumeProfileSkill = createResumeProfileSkill();
export const defaultInterviewBlueprintSkill = createInterviewBlueprintSkill();
