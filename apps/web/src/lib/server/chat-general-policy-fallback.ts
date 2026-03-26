import type { GeneralChatIntent } from './chat-general-policy.types';
import { formatArithmeticExpression } from './chat-general-policy-intent';

function buildResumeOptimizationReply(): string {
  return [
    '当然可以帮你优化简历！作为资深程序员和简历优化助手，我很乐意帮你做针对性的评审和修改。',
    '',
    '不过，我还没有看到你的简历内容。请先把简历文本粘贴过来，最好是完整内容。',
    '',
    '你可以这样发我：',
    '1. 将简历正文完整粘贴到这里，尽量包含教育背景、专业技能、工作经历、项目经验等部分。',
    '2. 隐藏个人信息，把姓名、电话、邮箱、住址等敏感信息替换成 `[姓名]`、`[电话]`、`[邮箱]` 这类占位符。',
    '3. 如果你有目标岗位，也一并告诉我，例如“3 年前端 / React 方向 / To B 项目经验”。',
    '',
    '我会重点帮你看这些方面：',
    '- 岗位匹配度是否清晰',
    '- 技术栈深度有没有体现出来',
    '- 项目经历是否讲清楚你的贡献、难点和结果',
    '- 表达是否专业，是否有量化成果',
    '',
    '把简历贴过来后，我会先逐段点评，再给你一版具体修改建议。',
  ].join('\n');
}

function buildGreetingReply(): string {
  return [
    '你好！我是面试通，一名资深程序员和前端 AI 面试官，专注于前端求职、简历优化和模拟面试。',
    '',
    '我可以直接帮你做这些事：',
    '- 优化简历和项目经历表达',
    '- 进行前端模拟面试和追问',
    '- 讲解 JavaScript、React、Vue、工程化、性能、网络等技术问题',
    '',
    '如果你想开始，我建议你直接发我其中一种内容：简历正文、目标岗位，或者一个具体的前端面试问题。',
    '',
    '如果你是想让我帮你优化简历，直接把简历文本贴过来就行；如果原始文件是 PDF 或 Word，也建议先贴文本内容。',
  ].join('\n');
}

function buildArithmeticReply(
  intent: Extract<GeneralChatIntent, { kind: 'simple_arithmetic' }>,
): string {
  return [
    formatArithmeticExpression(intent.arithmetic),
    '不过，作为你的前端面试助手，我更擅长帮你解决技术问题、优化简历或进行模拟面试。如果你愿意，我可以继续帮你。',
  ].join('\n\n');
}

function buildSelfIntroductionReply(): string {
  return [
    '可以，我可以按前端面试场景帮你准备和打磨自我介绍。',
    '',
    '为了给你更贴近岗位的建议，你可以先告诉我这 3 件事：',
    '1. 你目前是应届、在职还是离职状态。',
    '2. 你要面试的岗位和级别，比如前端开发工程师 / 高级前端工程师。',
    '3. 你的前端年限和核心技术栈，例如 React、Vue、TypeScript、工程化。',
    '',
    '在你补充这些信息之前，先给你一个比较稳的结构：',
    '1. 先用一句话说明你的年限、方向和核心技术栈。',
    '2. 再讲 1 到 2 个最能代表你的项目，重点说业务场景、你的职责和可量化结果。',
    '3. 最后补一句你为什么适合这个岗位，比如技术匹配度、项目经验或成长动机。',
    '',
    '建议控制在 60 到 90 秒，不要把简历逐条念一遍。',
    '',
    '如果你愿意，我可以继续做两件事：',
    '- 你先发一版自我介绍，我按面试官视角帮你点评',
    '- 或者你把经历发我，我直接帮你写一版前端面试自我介绍',
  ].join('\n');
}

function buildProjectHighlightReply(): string {
  return [
    '可以，简历里的项目亮点不要只写“做了什么”，而要重点写“为什么重要、你解决了什么问题、最后带来了什么结果”。',
    '',
    '你可以优先从这 4 个角度挖：',
    '1. 业务价值：这个项目解决了什么业务问题，服务了什么场景。',
    '2. 技术难点：你处理过哪些复杂问题，例如性能、稳定性、工程化、跨端适配、协作效率。',
    '3. 个人贡献：哪些关键方案是你主导或独立完成的。',
    '4. 量化结果：有没有性能指标、效率提升、转化率、成本优化、线上故障下降等结果。',
    '',
    '如果你把一段项目经历贴给我，我可以直接帮你把它改成更像前端求职简历的表达。',
  ].join('\n');
}

function buildTechnicalQuestionFallbackReply(
  intent: Extract<GeneralChatIntent, { kind: 'technical_question' }>,
): string {
  const question = intent.question.replace(/[？?]+$/u, '');

  if (intent.style === 'comparison') {
    return [
      `## 一句话区别`,
      `\`${question}\` 这类题，面试里最重要的是先把“比较维度”说清楚，再给使用场景，避免只背概念名词。`,
      '',
      `## 建议按这个顺序回答`,
      `1. 先用一句话概括两者的核心区别。`,
      `2. 再按“作用对象、返回值、使用场景、常见误用”逐项对比。`,
      `3. 最后补一个最小代码示例，说明什么时候该选哪一个。`,
      '',
      `## 你可以继续这样追问`,
      `- 先给我一句话版本`,
      `- 再给我一个最小示例`,
      `- 最后补 2 个面试追问和易错点`,
    ].join('\n');
  }

  if (intent.style === 'mechanism') {
    return [
      `## 核心结论`,
      `\`${question}\` 这类题更适合按“先结论，再流程，再示例”的方式来答，面试官通常更看重你是否能把执行链路讲清楚。`,
      '',
      `## 建议按这个顺序回答`,
      `1. 先用一句话解释它的作用。`,
      `2. 再拆成 3 到 5 步讲执行流程或工作原理。`,
      `3. 配一个最小示例，说明执行顺序或运行结果。`,
      `4. 最后补常见追问，例如边界条件、浏览器与 Node 差异、性能影响。`,
      '',
      `## 你可以继续这样追问`,
      `- 给我一版面试回答稿`,
      `- 再补一个最小代码示例`,
      `- 最后讲常见误区`,
    ].join('\n');
  }

  return [
    `## 定义`,
    `\`${question}\` 这类题，面试里通常先给出一句准确定义，再补核心特点和一个最小示例，回答会更稳。`,
    '',
    `## 建议按这个顺序回答`,
    `1. 先说它是什么。`,
    `2. 再提炼 2 到 4 个关键特点。`,
    `3. 配一个最小代码示例或典型场景。`,
    `4. 最后补 1 到 2 个常见误区或面试追问。`,
    '',
    `## 你可以继续这样追问`,
    `- 先给我一句话结论`,
    `- 再给我一个最小示例`,
    `- 最后补面试追问和易错点`,
  ].join('\n');
}

export function buildGeneralChatFallbackReply(intent: GeneralChatIntent): string {
  if (intent.kind === 'greeting') {
    return buildGreetingReply();
  }

  if (intent.kind === 'resume_optimize') {
    return buildResumeOptimizationReply();
  }

  if (intent.kind === 'simple_arithmetic') {
    return buildArithmeticReply(intent);
  }

  if (intent.kind === 'self_intro') {
    return buildSelfIntroductionReply();
  }

  if (intent.kind === 'technical_question') {
    return buildTechnicalQuestionFallbackReply(intent);
  }

  return buildProjectHighlightReply();
}
