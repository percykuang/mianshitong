import type {
  InterviewConfig,
  InterviewQuestion,
  InterviewReport,
  ModelId,
  QuestionAssessment,
} from '@mianshitong/shared';
import type { LlmProvider } from './contracts';

function formatLevel(level: InterviewConfig['level']): string {
  if (level === 'junior') {
    return '初级';
  }

  if (level === 'senior') {
    return '高级';
  }

  return '中级';
}

function formatQuestionOrdinal(index: number): string {
  const chineseNumbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (index >= 1 && index <= 10) {
    return chineseNumbers[index] ?? `${index}`;
  }

  return `${index}`;
}

function formatModelStyle(modelId: ModelId): string {
  if (modelId === 'deepseek-reasoner') {
    return '我会更关注你的推理路径和取舍。';
  }

  return '我会结合工程实践给你即时建议。';
}

function toQuestionFeedback(assessment: QuestionAssessment): string {
  return [
    `点评：${assessment.summary}`,
    `你这题已经覆盖到的点有：${
      assessment.matchedPoints.length > 0 ? assessment.matchedPoints.join('、') : '暂时还不够明确'
    }。`,
    `如果继续优化，我建议你重点补这几块：${
      assessment.missingPoints.length > 0 ? assessment.missingPoints.join('、') : '整体已经比较完整'
    }。`,
  ].join('\n');
}

function isProjectQuestion(question: InterviewQuestion): boolean {
  return (
    question.id === 'project_deep_dive' ||
    question.tags?.some((tag) => /project|项目/i.test(tag)) === true
  );
}

function isWarmupQuestion(question: InterviewQuestion): boolean {
  return question.id === 'warmup_self_intro' || question.tags?.includes('warmup') === true;
}

function resolveProjectFollowUpStyle(missingPoint: string): 'context' | 'tradeoff' | 'outcome' {
  if (/背景|职责|角色|目标/.test(missingPoint)) {
    return 'context';
  }

  if (/结果|收益|验证|指标|效果/.test(missingPoint)) {
    return 'outcome';
  }

  return 'tradeoff';
}

function resolveWarmupFollowUpStyle(
  missingPoint: string,
): 'career_narrative' | 'highlight_project' | 'motivation' {
  if (/经历主线|主线|方向|经历/.test(missingPoint)) {
    return 'career_narrative';
  }

  if (/求职动机|动机|机会|诉求/.test(missingPoint)) {
    return 'motivation';
  }

  return 'highlight_project';
}

function resolveTechnicalQuestionStyle(
  question: InterviewQuestion,
): 'mechanism' | 'scenario' | 'engineering' {
  const normalizedText = [
    question.title,
    question.prompt ?? '',
    ...(question.tags ?? []),
    ...(question.followUps ?? []),
  ]
    .join('\n')
    .toLowerCase();

  if (
    /场景|设计题|假设|你会怎么设计|怎么设计|商品列表|海量数据|实时搜索|筛选|排序|列表页/.test(
      normalizedText,
    )
  ) {
    return 'scenario';
  }

  if (
    /工程化|构建|打包|编译|webpack|vite|babel|swc|esbuild|monorepo|脚手架|ci\/cd|pipeline|流水线|研发效率/.test(
      normalizedText,
    )
  ) {
    return 'engineering';
  }

  return 'mechanism';
}

function buildReportLead(report: InterviewReport): string {
  if (report.level === 'strong') {
    return '今天先到这里。整体看，你的基础、项目表达和工程判断都比较扎实，有明显亮点。';
  }

  if (report.level === 'needs-work') {
    return '今天先到这里。整体看，你现在的基础和项目表达还不够稳定，后面要先把短板补扎实。';
  }

  return '今天先到这里。整体看，你的基础是过关的，也有一定项目经验，但回答完整度和取舍表达还可以再往上提一档。';
}

function takeMeaningfulItems(items: string[], limit = 2): string[] {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function buildReportBody(report: InterviewReport): string[] {
  const strengths = takeMeaningfulItems(report.strengths, 2);
  const gaps = takeMeaningfulItems(report.gaps, 2);
  const nextSteps = takeMeaningfulItems(report.nextSteps, 2);

  if (report.level === 'strong') {
    return [
      report.overallSummary,
      strengths.length > 0
        ? `这轮最能拉开区分度的，主要还是 ${strengths.join('、')}。`
        : '这轮最明显的优势在于你的基础和项目表达都有比较稳定的完成度。',
      nextSteps.length > 0
        ? `如果继续往上走一档，我建议你下一步重点盯住 ${nextSteps.join('；')}。`
        : '如果继续往上走一档，后面重点就是把复杂场景里的取舍讲得再锐一点。',
    ];
  }

  if (report.level === 'needs-work') {
    return [
      report.overallSummary,
      gaps.length > 0
        ? `当前最先要补的，不是继续铺更多新题，而是先把 ${gaps.join('、')} 这几块补稳。`
        : '当前最先要补的，是把基础原理和项目表达重新讲扎实。',
      nextSteps.length > 0
        ? `你可以先按这个顺序准备：${nextSteps.join('；')}。`
        : '你可以先把高频基础题和一个代表项目整理成稳定答法，再回来做下一轮。',
    ];
  }

  return [
    report.overallSummary,
    strengths.length > 0
      ? `这轮有亮点的部分在 ${strengths.join('、')}。`
      : '这轮能看出来你是有一定基础和实战经验的。',
    gaps.length > 0
      ? `但现在最影响说服力的，还是 ${gaps.join('、')} 这几块没有完全展开。`
      : '但现在最影响说服力的，还是回答里的取舍和量化结果不够突出。',
    nextSteps.length > 0
      ? `后面你优先按 ${nextSteps.join('；')} 这条线继续准备，会更有效。`
      : '后面你优先补项目取舍表达和高频基础题的原理层，会更有效。',
  ];
}

export class MockLlmProvider implements LlmProvider {
  public readonly name = 'mock-provider';

  generateGeneralReply(input: { content: string; modelId: ModelId }): string {
    const normalized = input.content.toLowerCase();

    if (normalized.includes('简历')) {
      return [
        '当然可以，我们先从“岗位匹配度”入手优化简历。',
        '建议你先发我目标岗位关键词，我会按项目经历、技术栈、量化结果三个维度给你修改建议。',
      ].join('\n');
    }

    if (normalized.includes('自我介绍')) {
      return [
        '前端面试自我介绍建议控制在 60-90 秒，结构可以是：背景 -> 代表项目 -> 岗位匹配。',
        '如果你愿意，我可以基于你的经历帮你生成一版可直接背诵的版本。',
      ].join('\n');
    }

    if (normalized.includes('题') || normalized.includes('算法')) {
      return [
        '可以，我们可以走“题目理解 -> 思路拆解 -> 边界条件 -> 复杂度分析”的答题框架。',
        '你把具体题目发我，我会按面试语境给出讲解。',
      ].join('\n');
    }

    return [
      `收到。${formatModelStyle(input.modelId)}`,
      '你也可以直接说“开始模拟面试”，我会立即进入结构化面试流程。',
    ].join('\n');
  }

  generateInterviewKickoff(config: InterviewConfig): string {
    return [
      `好的，我们开始这场 ${formatLevel(config.level)} 前端模拟面试。`,
      '你按真实面试的节奏回答就行，我会边听边追问。',
    ].join('\n');
  }

  generateQuestionMessage(input: {
    question: InterviewQuestion;
    index: number;
    total: number;
  }): string {
    return `**第${formatQuestionOrdinal(input.index)}个问题：** ${input.question.prompt ?? input.question.title}`;
  }

  generateFollowUpMessage(input: { question: InterviewQuestion; missingPoint: string }): string {
    const fallback = input.question.followUps?.[0] ?? '你可以补充一下这块在真实项目里的落地方式。';
    if (isWarmupQuestion(input.question)) {
      const style = resolveWarmupFollowUpStyle(input.missingPoint);

      if (style === 'career_narrative') {
        return [
          '点评：我知道你做过前端了，但最近这几段经历真正串起来的主线，我还没有完全听出来。',
          '我先确认一下：你最近这几段，主线更偏哪条？工程化、业务交付，还是性能优化？',
          input.missingPoint ? `你这次就重点把 ${input.missingPoint} 这块讲具体一点。` : null,
        ]
          .filter(Boolean)
          .join('\n');
      }

      if (style === 'motivation') {
        return [
          '点评：你的经历我大概知道了，但你这次为什么出来看机会，现在还不够具体。',
          '我再确认一下：那你这次出来看机会，最在意哪层？业务空间、技术挑战，还是团队环境？',
          input.missingPoint ? `你这次就重点把 ${input.missingPoint} 这块讲具体一点。` : null,
        ]
          .filter(Boolean)
          .join('\n');
      }

      return [
        '点评：你的背景我已经有概念了，但最该先展开讲的那个项目，现在还没有落下来。',
        '我再确认一下：那如果现在就展开一个项目，你先讲哪个？',
        input.missingPoint ? `你这次就重点把 ${input.missingPoint} 这块讲具体一点。` : null,
      ]
        .filter(Boolean)
        .join('\n');
    }

    if (isProjectQuestion(input.question)) {
      const style = resolveProjectFollowUpStyle(input.missingPoint);

      if (style === 'context') {
        return [
          '点评：你已经把项目大方向讲出来了，但项目复杂度和你个人边界还不够清楚。',
          `那背景和边界这块你讲具体一点：${fallback}`,
          input.missingPoint ? `你这次就把 ${input.missingPoint} 这块讲具体一点。` : null,
        ]
          .filter(Boolean)
          .join('\n');
      }

      if (style === 'outcome') {
        return [
          '点评：你的方案和动作已经有了，但结果到底有没有被验证出来，现在还不够扎实。',
          `那结果怎么验证，你讲具体一点：${fallback}`,
          input.missingPoint ? `你这次就把 ${input.missingPoint} 这块讲具体一点。` : null,
        ]
          .filter(Boolean)
          .join('\n');
      }

      return [
        '点评：你刚才已经把项目背景和主要动作讲出来了，但真正体现你判断力的取舍过程还不够完整。',
        `那为什么这么选，你展开一下：${fallback}`,
        input.missingPoint ? `你这次就把 ${input.missingPoint} 这块讲具体一点。` : null,
      ]
        .filter(Boolean)
        .join('\n');
    }

    const technicalStyle = resolveTechnicalQuestionStyle(input.question);
    if (technicalStyle === 'scenario') {
      return [
        '点评：你的思路方向是对的，但场景题现在还停留在原则层，真正可执行的方案还不够具体。',
        `那你往下拆一下：${fallback}`,
        input.missingPoint ? `你这次就把 ${input.missingPoint} 这块补具体一点。` : null,
      ]
        .filter(Boolean)
        .join('\n');
    }

    if (technicalStyle === 'engineering') {
      return [
        '点评：你的方案方向我大概听明白了，但工程题里最关键的约束和取舍还没有讲透。',
        `那取舍这块你展开一下：${fallback}`,
        input.missingPoint ? `你这次就把 ${input.missingPoint} 这块补具体一点。` : null,
      ]
        .filter(Boolean)
        .join('\n');
    }

    return [
      '点评：你的回答方向基本对了，但关键机制和边界还不够展开。',
      `那你把机制再往下讲一层：${fallback}`,
      input.missingPoint ? `你这次就把 ${input.missingPoint} 这块补具体一点。` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  generateQuestionFeedback(assessment: QuestionAssessment): string {
    return toQuestionFeedback(assessment);
  }

  generateReportMessage(report: InterviewReport): string {
    return [
      buildReportLead(report),
      `今天这轮我会给你 ${report.overallScore.toFixed(1)} / 5，当前更接近 ${report.level}。`,
      ...buildReportBody(report),
    ].join('\n');
  }
}

export function createMockLlmProvider(): LlmProvider {
  return new MockLlmProvider();
}
