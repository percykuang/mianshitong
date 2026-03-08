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

function formatModelStyle(modelId: ModelId): string {
  if (modelId === 'deepseek-reasoner') {
    return '我会更关注你的推理路径和取舍。';
  }

  return '我会结合工程实践给你即时建议。';
}

function toQuestionFeedback(assessment: QuestionAssessment): string {
  return [
    `本题反馈（${assessment.questionTitle}）：`,
    `- 命中要点：${assessment.matchedPoints.length > 0 ? assessment.matchedPoints.join('、') : '暂无'}`,
    `- 待补充：${assessment.missingPoints.length > 0 ? assessment.missingPoints.join('、') : '覆盖完整'}`,
    `- 评分：正确性 ${assessment.scores.correctness} / 深度 ${assessment.scores.depth} / 表达 ${assessment.scores.communication}`,
    assessment.summary,
  ].join('\n');
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
      `好的，我们现在开始 ${formatLevel(config.level)} 前端模拟面试。`,
      `本场共 ${config.questionCount} 题，反馈模式：${
        config.feedbackMode === 'per_question' ? '每题反馈' : '结束统一总结'
      }。`,
      '请尽量按“结论 -> 原因 -> 例子 -> 边界”回答，我会根据你的回答继续追问。',
    ].join('\n');
  }

  generateQuestionMessage(input: {
    question: InterviewQuestion;
    index: number;
    total: number;
  }): string {
    return [
      `问题 ${input.index}/${input.total}（${input.question.topic}）`,
      input.question.prompt,
    ].join('\n\n');
  }

  generateFollowUpMessage(input: { question: InterviewQuestion; missingPoint: string }): string {
    const fallback = input.question.followUps[0] ?? '你可以补充一下这块在真实项目里的落地方式。';
    return ['我补一个追问：', fallback, `（你上一轮没有展开：${input.missingPoint}）`].join('\n');
  }

  generateQuestionFeedback(assessment: QuestionAssessment): string {
    return toQuestionFeedback(assessment);
  }

  generateReportMessage(report: InterviewReport): string {
    return [
      `面试结束，总分 ${report.overallScore.toFixed(1)} / 5（${report.level}）。`,
      report.overallSummary,
      `优势：${report.strengths.join('；') || '暂无明显优势'}`,
      `短板：${report.gaps.join('；') || '暂无明显短板'}`,
      `下一步建议：${report.nextSteps.join('；') || '保持高频实战练习'}`,
    ].join('\n');
  }
}

export function createMockLlmProvider(): LlmProvider {
  return new MockLlmProvider();
}
