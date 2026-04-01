import { defaultFollowUpSkill, defaultReportSkill } from '@mianshitong/agent-skills';
import type { LlmProvider } from '@mianshitong/llm';
import type { QuestionRetriever } from '@mianshitong/retrieval';
import type {
  ChatMessage,
  ChatSession,
  InterviewFollowUpTrace,
  InterviewPlanningStrategy,
  InterviewQuestion,
  ResumeProfile,
  PostMessageResult,
} from '@mianshitong/shared';
import { planInterviewFromSource } from './interview-planning';
import {
  extractInterviewPlanningText,
  pushAssistantMessage,
  shouldStartInterview,
} from './session-core';

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

function formatDisplayedQuestionOrdinal(index: number): string {
  const chineseNumbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (index >= 1 && index <= 10) {
    return chineseNumbers[index] ?? `${index}`;
  }

  return `${index}`;
}

function formatDisplayTag(tag: string): string {
  const normalized = tag.trim().toLowerCase();
  const tagLabelMap: Record<string, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    react: 'React',
    vue: 'Vue',
    nextjs: 'Next.js',
    engineering: '前端工程化',
    performance: '性能优化',
    network: '网络与接口',
    security: '前端安全',
    node: 'Node.js',
    browser: '浏览器原理',
    css: 'CSS 工程',
  };

  return tagLabelMap[normalized] ?? tag;
}

function formatDisplayTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of tags.map(formatDisplayTag)) {
    const normalized = tag.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(tag);
  }

  return result;
}

function buildWarmupQuestionPrompt(profile: ResumeProfile | null): string {
  void profile;

  return [
    '你好，我看过你的简历了，整体经历和技术覆盖面都比较完整。现在我们开始模拟面试吧。',
    '',
    `**第${formatDisplayedQuestionOrdinal(1)}个问题：** 你先做个简短自我介绍吧。`,
    '',
    '（重点讲讲最近几段经历的主线、最能代表你的项目，以及你这次为什么看机会。）',
  ].join('\n');
}

function buildWarmupQuestion(profile: ResumeProfile | null): InterviewQuestion {
  return {
    id: 'warmup_self_intro',
    level: profile?.seniority ?? 'mid',
    title: '开场破冰：请做自我介绍',
    prompt: buildWarmupQuestionPrompt(profile),
    keyPoints: ['经历主线', '代表项目', '求职动机'],
    followUps: [
      '你最近这几段，主线更偏哪条？工程化、业务交付，还是性能优化？',
      '那如果现在就展开一个项目，你先讲哪个？',
      '那你这次出来看机会，最在意哪层？业务空间、技术挑战，还是团队环境？',
    ],
    tags: ['warmup', 'self_intro'],
    topic: null,
  };
}

function buildWarmupFeedback(answer: string): string {
  const normalized = answer.replace(/\s+/g, ' ').trim();

  if (normalized.length < 30) {
    return [
      '点评：你这段开场还是偏概括，我还没法很快判断你的经历主线和岗位匹配度。',
      '你等会儿再补的时候，把最近主线、最能代表你的项目，以及为什么看机会这几层讲实一点，会更像一次完整的面试回答。',
    ].join('\n');
  }

  if (normalized.length < 90) {
    return [
      '点评：你的基本背景我大概知道了，但最能代表你的项目和这次看机会的判断还不够聚焦。',
      '如果你后面再补一层，直接把项目名称、你负责的关键动作和结果先拎出来，整体说服力会更强。',
    ].join('\n');
  }

  return [
    '点评：这段开场已经能让我比较快建立起对你背景的判断。',
    '后面如果你还能继续把个人角色、关键取舍和结果量化得更具体，区分度会更高。',
  ].join('\n');
}

function buildAnswerPreview(answer: string): string {
  const normalized = answer.replace(/\s+/g, ' ').trim();
  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized;
}

function containsAnySignal(sourceText: string, signals: string[]): boolean {
  return signals.some((signal) => sourceText.includes(signal));
}

function resolveWarmupMatchedPoints(answer: string): string[] {
  const normalized = answer.toLowerCase();
  const matchedPoints: string[] = [];

  if (
    containsAnySignal(normalized, [
      '主线',
      '方向',
      '最近',
      '目前',
      '这些年',
      '这几年',
      '一直',
      '主要',
      '负责',
      '经历',
    ])
  ) {
    matchedPoints.push('经历主线');
  }

  if (
    containsAnySignal(normalized, [
      '项目',
      '代表',
      '搭建',
      '优化',
      '重构',
      '推进',
      '落地',
      '主导',
      '方案',
      'monorepo',
      'swc',
      'babel',
    ])
  ) {
    matchedPoints.push('代表项目');
  }

  if (
    containsAnySignal(normalized, [
      '机会',
      '看机会',
      '想找',
      '诉求',
      '加入',
      '方向',
      '团队',
      '业务',
      '平台',
      '成长',
      '挑战',
      '岗位',
    ])
  ) {
    matchedPoints.push('求职动机');
  }

  return matchedPoints;
}

function buildWarmupFollowUpTrace(input: {
  question: InterviewQuestion;
  answers: string[];
  followUpRound: number;
  now: string;
}): { trace: InterviewFollowUpTrace; shouldAskFollowUp: boolean } {
  const mergedAnswer = input.answers.join('\n');
  const matchedPoints = resolveWarmupMatchedPoints(mergedAnswer);
  const missingPoints = (input.question.keyPoints ?? []).filter(
    (item) => !matchedPoints.includes(item),
  );
  const coverage =
    (input.question.keyPoints?.length ?? 0) > 0
      ? matchedPoints.length / (input.question.keyPoints?.length ?? 1)
      : 0;
  const normalizedAnswer = mergedAnswer.replace(/\s+/g, ' ').trim();

  let decision: InterviewFollowUpTrace['decision'] = 'ask_follow_up';
  let askedMissingPoint: string | null = missingPoints[0] ?? null;

  if ((input.question.keyPoints?.length ?? 0) === 0) {
    decision = 'skip_no_key_points';
    askedMissingPoint = null;
  } else if (input.followUpRound >= 1) {
    decision = 'skip_max_round';
    askedMissingPoint = null;
  } else if (missingPoints.length === 0) {
    decision = 'skip_all_points_covered';
    askedMissingPoint = null;
  } else if (missingPoints.length <= 1 && normalizedAnswer.length >= 30) {
    decision = 'skip_coverage_sufficient';
    askedMissingPoint = null;
  } else if (coverage >= 0.67 && normalizedAnswer.length >= 30) {
    decision = 'skip_coverage_sufficient';
    askedMissingPoint = null;
  }

  const trace: InterviewFollowUpTrace = {
    questionId: input.question.id,
    questionTitle: input.question.title,
    round: input.followUpRound + 1,
    answerPreview: buildAnswerPreview(mergedAnswer),
    answerLength: mergedAnswer.length,
    keyPointCount: input.question.keyPoints?.length ?? 0,
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
}

type ProjectDeepDiveArchetype = 'engineering' | 'performance' | 'delivery';
type PerformanceDeepDiveSubtype = 'loading' | 'rendering' | 'build';

type ProjectDeepDiveResolution = {
  archetype: ProjectDeepDiveArchetype;
  performanceSubtype: PerformanceDeepDiveSubtype | null;
};

function countIncludedSignals(sourceText: string, signals: string[]): number {
  return signals.filter((signal) => sourceText.includes(signal)).length;
}

function resolveProjectDeepDiveArchetype(
  profile: ResumeProfile,
  sourceText: string,
): ProjectDeepDiveResolution {
  const normalizedText = [
    sourceText,
    ...profile.projectTags,
    ...profile.strengths,
    ...profile.evidence,
    ...profile.primaryTags.map((item) => item.tag),
  ]
    .join('\n')
    .toLowerCase();

  const engineeringSignals = [
    'engineering',
    '工程化',
    'monorepo',
    '构建',
    'webpack',
    'vite',
    'babel',
    'swc',
    'esbuild',
    '脚手架',
    'ci/cd',
    'pipeline',
    '流水线',
    '研发效率',
  ];
  const performanceSignals = [
    'performance',
    '性能',
    '优化',
    '白屏',
    'lcp',
    'fcp',
    '首屏',
    '包体',
    '渲染',
    'prefetch',
    'preload',
    '缓存',
    '卡顿',
    '指标',
    'sentry',
    '耗时',
    '提速',
    '提效',
    '缩短',
    '秒级',
    '分钟级',
    '速度提升',
    '构建时间',
    '编译时间',
  ];
  const loadingSignals = [
    '首屏',
    '白屏',
    'fcp',
    'lcp',
    'ttfb',
    'preload',
    'prefetch',
    'cdn',
    '缓存',
    '懒加载',
    '图片',
    '请求瀑布',
  ];
  const renderingSignals = [
    '渲染',
    '卡顿',
    'fps',
    '掉帧',
    '长列表',
    '虚拟列表',
    '重渲染',
    're-render',
    'render',
    'react.memo',
    'usememo',
    'flame chart',
  ];
  const buildSignals = [
    '构建',
    '打包',
    '编译',
    'babel',
    'swc',
    'esbuild',
    'vite',
    'webpack',
    'rsbuild',
    'rollup',
    'tree shaking',
    '增量构建',
    '包体',
  ];

  const engineeringScore = countIncludedSignals(normalizedText, engineeringSignals);
  let performanceScore = countIncludedSignals(normalizedText, performanceSignals);
  const loadingScore = countIncludedSignals(normalizedText, loadingSignals);
  const renderingScore = countIncludedSignals(normalizedText, renderingSignals);
  const buildScore = countIncludedSignals(normalizedText, buildSignals);

  const buildOptimizationBoost =
    buildScore > 0 &&
    ['优化', '提升', '缩短', '降低', '分钟级', '秒级'].some((signal) =>
      normalizedText.includes(signal),
    )
      ? 2
      : 0;
  performanceScore += buildOptimizationBoost;

  if (engineeringScore === 0 && performanceScore === 0) {
    return {
      archetype: 'delivery',
      performanceSubtype: null,
    };
  }

  if (engineeringScore > performanceScore) {
    return {
      archetype: 'engineering',
      performanceSubtype: null,
    };
  }

  const subtypeScoreEntries: Array<[PerformanceDeepDiveSubtype, number]> = [
    ['loading', loadingScore],
    ['rendering', renderingScore],
    ['build', buildScore],
  ];
  const bestSubtype = [...subtypeScoreEntries].sort((left, right) => right[1] - left[1])[0];
  const performanceSubtype = bestSubtype && bestSubtype[1] > 0 ? bestSubtype[0] : 'loading';

  return {
    archetype: 'performance',
    performanceSubtype,
  };
}

function buildProjectDeepDivePrompt(input: {
  archetype: ProjectDeepDiveArchetype;
  performanceSubtype: PerformanceDeepDiveSubtype | null;
  projectHint: string | undefined;
  focusLabel: string;
}): string {
  const projectHintLabel = input.projectHint ? `（比如 ${input.projectHint} 相关）` : '';

  if (input.archetype === 'engineering') {
    return [
      '我们接下来做一轮项目深挖。',
      `请你挑一个最能代表你水平的工程化或基础设施项目${projectHintLabel}，重点围绕 ${input.focusLabel} 展开。`,
      '你就重点讲清楚三件事：为什么当时要做、你真正主导了什么、以及最后怎么证明这件事做成了。',
    ].join('\n');
  }

  if (input.archetype === 'performance') {
    if (input.performanceSubtype === 'loading') {
      return [
        '我们接下来做一轮项目深挖。',
        `请你挑一个最能代表你水平的加载性能优化项目${projectHintLabel}，重点围绕 ${input.focusLabel} 展开。`,
        '你就重点讲清楚当时暴露了什么问题、你是怎么定位瓶颈和做取舍的，以及最后怎么验证首屏和核心指标真的改善了。',
      ].join('\n');
    }

    if (input.performanceSubtype === 'rendering') {
      return [
        '我们接下来做一轮项目深挖。',
        `请你挑一个最能代表你水平的渲染性能优化项目${projectHintLabel}，重点围绕 ${input.focusLabel} 展开。`,
        '你就重点讲清楚页面当时卡在什么地方、你是怎么判断瓶颈和做取舍的，以及最后怎么确认交互和流畅度真的提上来了。',
      ].join('\n');
    }

    if (input.performanceSubtype === 'build') {
      return [
        '我们接下来做一轮项目深挖。',
        `请你挑一个最能代表你水平的构建性能优化项目${projectHintLabel}，重点围绕 ${input.focusLabel} 展开。`,
        '你就重点讲清楚团队最早是怎么意识到构建链路出了问题、你为什么会选那套方案，以及最后怎么验证速度、产物和研发体验都确实提升了。',
      ].join('\n');
    }

    return [
      '我们接下来做一轮项目深挖。',
      `请你挑一个最能代表你水平的性能优化项目${projectHintLabel}，重点围绕 ${input.focusLabel} 展开。`,
      '你就重点讲清楚问题是怎么暴露出来的、你是怎么定位和做取舍的，以及最后怎么验证优化真的有效。',
    ].join('\n');
  }

  return [
    '我们接下来做一轮项目深挖。',
    `请你挑一个最能代表你水平的业务项目${projectHintLabel}，重点围绕 ${input.focusLabel} 展开。`,
    '你就重点讲清楚业务目标是什么、你在里面真正负责了什么，以及最后怎么证明这件事做出了业务结果。',
  ].join('\n');
}

function buildProjectDeepDiveKeyPoints(
  archetype: ProjectDeepDiveArchetype,
  performanceSubtype: PerformanceDeepDiveSubtype | null,
): InterviewQuestion['keyPoints'] {
  if (archetype === 'engineering') {
    return ['背景', '职责', '挑战', '方案', '结果', '权衡'];
  }

  if (archetype === 'performance') {
    if (performanceSubtype === 'loading') {
      return ['背景', '职责', '指标', '瓶颈', '方案', '验证'];
    }

    if (performanceSubtype === 'rendering') {
      return ['背景', '职责', '卡顿', '瓶颈', '取舍', '验证'];
    }

    if (performanceSubtype === 'build') {
      return ['背景', '职责', '耗时', '方案', '兼容性', '验证'];
    }

    return ['背景', '职责', '瓶颈', '方案', '结果', '验证'];
  }

  return ['背景', '职责', '约束', '方案', '结果', '协作'];
}

function buildProjectDeepDiveFollowUps(
  archetype: ProjectDeepDiveArchetype,
  performanceSubtype: PerformanceDeepDiveSubtype | null,
): InterviewQuestion['followUps'] {
  if (archetype === 'engineering') {
    return [
      '如果让你再做一次这个工程体系，你会优先重做哪一处架构或方案，为什么？',
      '当时这套方案最大的推进阻力是什么？你是怎么把它落下去的？',
    ];
  }

  if (archetype === 'performance') {
    if (performanceSubtype === 'loading') {
      return [
        '如果第一轮优化后 FCP、LCP 还是没有明显改善，你下一步会先查哪一层，为什么？',
        '你做这些加载优化时，有没有和缓存一致性、资源更新策略发生冲突？最后怎么权衡的？',
      ];
    }

    if (performanceSubtype === 'rendering') {
      return [
        '如果页面里既有长列表又有频繁状态更新，你会先处理哪类渲染问题，为什么？',
        '为了把卡顿压下去，你有没有接受过更高的代码复杂度或维护成本？最后怎么权衡的？',
      ];
    }

    if (performanceSubtype === 'build') {
      return [
        '如果换完编译器后速度提升明显，但兼容性开始出问题，你会怎么划定回滚和继续推进的边界？',
        '你会怎么区分“构建提速”到底是冷启动受益更大，还是增量构建和研发反馈链路受益更大？',
      ];
    }

    return [
      '如果当时第一轮优化后指标没有明显改善，你下一步会怎么继续排查？',
      '你做这些优化时，牺牲了哪些开发复杂度或维护成本？',
    ];
  }

  return [
    '如果这个业务规模再扩大一倍，原方案最先扛不住的地方会在哪里？',
    '这个项目里你做过最关键的一次业务和技术权衡是什么？',
  ];
}

function buildProjectDeepDiveQuestion(
  profile: ResumeProfile | null,
  sourceText: string,
): InterviewQuestion | null {
  if (
    !profile ||
    sourceText.replace(/\s+/g, '').length < 24 ||
    (profile.projectTags.length === 0 &&
      profile.evidence.length === 0 &&
      profile.strengths.length === 0)
  ) {
    return null;
  }

  const focusTags = formatDisplayTags(profile.primaryTags.slice(0, 3).map((item) => item.tag));
  const focusLabel = focusTags.length > 0 ? focusTags.join('、') : '前端工程化和项目交付';
  const projectHint = formatDisplayTags(profile.projectTags)[0];
  const resolution = resolveProjectDeepDiveArchetype(profile, sourceText);

  return {
    id: 'project_deep_dive',
    level: profile.seniority,
    title: '项目深挖：请展开讲一个最能代表你水平的项目',
    prompt: buildProjectDeepDivePrompt({
      archetype: resolution.archetype,
      performanceSubtype: resolution.performanceSubtype,
      projectHint,
      focusLabel,
    }),
    keyPoints: buildProjectDeepDiveKeyPoints(resolution.archetype, resolution.performanceSubtype),
    followUps: buildProjectDeepDiveFollowUps(resolution.archetype, resolution.performanceSubtype),
    tags: ['project', ...focusTags],
    topic: 'engineering',
  };
}

export function getInterviewQuestionTotal(session: ChatSession): number {
  return session.runtime.questionPlan.length + (session.runtime.projectQuestion ? 1 : 0);
}

export function startProjectStage(input: {
  session: ChatSession;
  provider: LlmProvider;
  assistantMessages: ChatMessage[];
  now: string;
}): boolean {
  const projectQuestion = input.session.runtime.projectQuestion;
  if (!projectQuestion) {
    return false;
  }

  input.session.runtime.currentStage = 'project';
  input.session.runtime.followUpRound = 0;
  input.session.runtime.activeQuestionAnswers = [];
  pushAssistantMessage(input.session, input.assistantMessages, {
    kind: 'question',
    content: input.provider.generateQuestionMessage({
      question: projectQuestion,
      index: input.session.runtime.questionPlan.length + 2,
      total: getInterviewQuestionTotal(input.session),
    }),
    now: input.now,
  });
  input.session.updatedAt = input.now;
  return true;
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

  const planningSourceText = buildPlanningSourceText(input.session, input.content);
  const planningResult = await planInterviewFromSource({
    sourceText: planningSourceText,
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
  input.session.runtime.currentStage = 'warmup';
  input.session.runtime.activeQuestionAnswers = [];
  input.session.runtime.assessments = [];
  input.session.runtime.followUpTrace = [];
  input.session.runtime.assessmentTrace = [];
  input.session.runtime.reportTrace = null;
  input.session.runtime.projectQuestion = buildProjectDeepDiveQuestion(
    planningResult.resumeProfile,
    planningSourceText,
  );
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
    kind: 'question',
    content: buildWarmupQuestionPrompt(planningResult.resumeProfile),
    now: input.now,
  });

  input.session.updatedAt = input.now;
  return { session: input.session, assistantMessages: input.assistantMessages };
}

export function handleWarmupStage(input: {
  session: ChatSession;
  provider: LlmProvider;
  content: string;
  assistantMessages: ChatMessage[];
  now: string;
}): PostMessageResult {
  input.session.runtime.activeQuestionAnswers.push(input.content);
  const warmupQuestion = buildWarmupQuestion(input.session.runtime.resumeProfile);
  const warmupFollowUpResult = buildWarmupFollowUpTrace({
    question: warmupQuestion,
    answers: input.session.runtime.activeQuestionAnswers,
    followUpRound: input.session.runtime.followUpRound,
    now: input.now,
  });
  input.session.runtime.followUpTrace.push(warmupFollowUpResult.trace);

  if (warmupFollowUpResult.shouldAskFollowUp) {
    input.session.runtime.followUpRound += 1;
    pushAssistantMessage(input.session, input.assistantMessages, {
      kind: 'follow_up',
      content: input.provider.generateFollowUpMessage({
        question: warmupQuestion,
        missingPoint: warmupFollowUpResult.trace.askedMissingPoint ?? '',
      }),
      now: input.now,
    });
    input.session.updatedAt = input.now;
    return { session: input.session, assistantMessages: input.assistantMessages };
  }

  pushAssistantMessage(input.session, input.assistantMessages, {
    kind: 'feedback',
    content: buildWarmupFeedback(input.session.runtime.activeQuestionAnswers.join('\n')),
    now: input.now,
  });

  input.session.runtime.currentStage = 'technical';
  input.session.runtime.currentQuestionIndex = 0;
  input.session.runtime.followUpRound = 0;
  input.session.runtime.activeQuestionAnswers = [];

  const firstQuestion =
    input.session.runtime.questionPlan[input.session.runtime.currentQuestionIndex];

  if (firstQuestion) {
    pushAssistantMessage(input.session, input.assistantMessages, {
      kind: 'question',
      content: input.provider.generateQuestionMessage({
        question: firstQuestion,
        index: 2,
        total: getInterviewQuestionTotal(input.session),
      }),
      now: input.now,
    });
  }

  input.session.updatedAt = input.now;
  return { session: input.session, assistantMessages: input.assistantMessages };
}

export async function maybeAskFollowUp(input: {
  session: ChatSession;
  currentQuestion: InterviewQuestion;
  provider: LlmProvider;
  assistantMessages: ChatMessage[];
  now: string;
}): Promise<boolean> {
  const result = await defaultFollowUpSkill.execute({
    question: input.currentQuestion,
    answers: input.session.runtime.activeQuestionAnswers,
    followUpRound: input.session.runtime.followUpRound,
    now: input.now,
  });
  input.session.runtime.followUpTrace.push(result.trace);

  if (!result.shouldAskFollowUp) {
    return false;
  }

  input.session.runtime.followUpRound += 1;
  pushAssistantMessage(input.session, input.assistantMessages, {
    kind: 'follow_up',
    content: input.provider.generateFollowUpMessage({
      question: input.currentQuestion,
      missingPoint: result.trace.askedMissingPoint ?? '',
    }),
    now: input.now,
  });
  input.session.updatedAt = input.now;
  return true;
}

export async function completeInterview(input: {
  session: ChatSession;
  provider: LlmProvider;
  assistantMessages: ChatMessage[];
  now: string;
}): Promise<PostMessageResult> {
  input.session.status = 'completed';
  const { report, trace } = await defaultReportSkill.execute({
    assessments: input.session.runtime.assessments,
    createdAt: input.now,
  });
  input.session.report = report;
  input.session.runtime.reportTrace = trace;

  pushAssistantMessage(input.session, input.assistantMessages, {
    kind: 'report',
    content: input.provider.generateReportMessage(input.session.report),
    now: input.now,
  });
  input.session.updatedAt = input.now;
  return { session: input.session, assistantMessages: input.assistantMessages };
}
