import { describe, expect, it } from 'vitest';
import type { InterviewQuestion, InterviewReport } from '@mianshitong/shared';
import { MockLlmProvider } from './mock-provider';

const projectQuestion: InterviewQuestion = {
  id: 'project_deep_dive',
  level: 'mid',
  title: '项目深挖',
  prompt: '请介绍一个最能代表你水平的项目。',
  keyPoints: ['背景', '职责', '挑战', '方案', '结果', '权衡'],
  followUps: ['你当时为什么最终选了这套方案？'],
  tags: ['project', 'engineering'],
  topic: 'engineering',
};

const warmupQuestion: InterviewQuestion = {
  id: 'warmup_self_intro',
  level: 'mid',
  title: '开场破冰',
  prompt: '请先做个自我介绍。',
  keyPoints: ['经历主线', '代表项目', '求职动机'],
  followUps: ['如果现在就展开讲一个项目，你会先讲哪个？为什么先讲它？'],
  tags: ['warmup', 'self_intro'],
  topic: null,
};

const mechanismQuestion: InterviewQuestion = {
  id: 'js_event_loop',
  level: 'mid',
  title: '事件循环与任务调度',
  prompt: '请你讲一下浏览器事件循环里宏任务和微任务的执行顺序。',
  keyPoints: ['Promise', '宏任务', '微任务'],
  followUps: ['Node.js 里的 nextTick 和 Promise 微任务顺序有什么差异？'],
  tags: ['javascript'],
  topic: 'javascript',
};

const scenarioQuestion: InterviewQuestion = {
  id: 'large_list_design',
  level: 'mid',
  title: '海量商品列表页场景设计',
  prompt: '假设你现在要做一个商品列表页，同时支持海量数据、实时筛选和排序，你会怎么设计前端方案？',
  keyPoints: ['性能', '数据流', '交互'],
  followUps: ['如果接口响应不稳定，你会怎么处理搜索和筛选的请求节奏？'],
  tags: ['react'],
  topic: 'react',
};

const engineeringQuestion: InterviewQuestion = {
  id: 'build_optimization',
  level: 'mid',
  title: '构建性能优化',
  prompt: '请讲讲你做构建优化或工具链升级时，最早是怎么判断瓶颈真的出在编译链路上的？',
  keyPoints: ['瓶颈', '方案', '取舍'],
  followUps: ['为什么最终会选这套工具链，而不是另外一套更稳妥的实现？'],
  tags: ['engineering'],
  topic: 'engineering',
};

const strongReport: InterviewReport = {
  overallSummary: '整体表现优秀，继续强化系统化表达和复杂场景推理。',
  overallScore: 4.6,
  level: 'strong',
  dimensionSummary: {
    correctness: 4.5,
    depth: 4.6,
    communication: 4.4,
    engineering: 4.7,
    tradeoffs: 4.5,
  },
  strengths: ['工程判断扎实', '项目表达完整'],
  gaps: ['少数回答还可更锐利'],
  nextSteps: ['继续压缩表达并强化复杂场景取舍'],
  breakdown: [],
};

const needsWorkReport: InterviewReport = {
  overallSummary: '当前基础还不稳定，建议优先补核心概念与常见场景。',
  overallScore: 2.1,
  level: 'needs-work',
  dimensionSummary: {
    correctness: 2.2,
    depth: 2.0,
    communication: 2.3,
    engineering: 2.1,
    tradeoffs: 1.9,
  },
  strengths: ['有一定实战经验'],
  gaps: ['基础原理', '项目表达'],
  nextSteps: ['先把高频基础题和一个代表项目讲清楚'],
  breakdown: [],
};

describe('MockLlmProvider', () => {
  it('题目文案不再暴露 topic 标签', () => {
    const provider = new MockLlmProvider();

    const message = provider.generateQuestionMessage({
      question: projectQuestion,
      index: 2,
      total: 4,
    });

    expect(message).toContain('**第二个问题：**');
    expect(message).toContain('**第二个问题：** 请介绍一个最能代表你水平的项目。');
    expect(message).not.toContain('（engineering）');
  });

  it('项目追背景复杂度时会使用 context 型点评口吻', () => {
    const provider = new MockLlmProvider();

    const message = provider.generateFollowUpMessage({
      question: projectQuestion,
      missingPoint: '背景',
    });

    expect(message).toContain('项目复杂度和你个人边界还不够清楚');
    expect(message).toContain('那背景和边界这块你讲具体一点');
    expect(message).toContain('你这次就把 背景 这块讲具体一点');
    expect(message).not.toContain('这次你重点补清楚');
  });

  it('项目追收益验证时会使用 outcome 型点评口吻', () => {
    const provider = new MockLlmProvider();

    const message = provider.generateFollowUpMessage({
      question: projectQuestion,
      missingPoint: '结果',
    });

    expect(message).toContain('结果到底有没有被验证出来');
    expect(message).toContain('那结果怎么验证，你讲具体一点');
    expect(message).toContain('你这次就把 结果 这块讲具体一点');
    expect(message).not.toContain('这次你重点补清楚');
  });

  it('开场追代表项目时会使用 warmup 专用点评口吻', () => {
    const provider = new MockLlmProvider();

    const message = provider.generateFollowUpMessage({
      question: warmupQuestion,
      missingPoint: '代表项目',
    });

    expect(message).toContain('最该先展开讲的那个项目');
    expect(message).toContain('我再确认一下');
    expect(message).toContain('那如果现在就展开一个项目');
    expect(message).toContain('你先讲哪个');
    expect(message).toContain('你这次就重点把 代表项目 这块讲具体一点');
    expect(message).not.toContain('还没有立起来');
  });

  it('开场追经历主线时会使用更自然的主线追问口吻', () => {
    const provider = new MockLlmProvider();

    const message = provider.generateFollowUpMessage({
      question: warmupQuestion,
      missingPoint: '经历主线',
    });

    expect(message).toContain('真正串起来的主线');
    expect(message).toContain('我先确认一下');
    expect(message).toContain('主线更偏哪条');
    expect(message).toContain('你这次就重点把 经历主线 这块讲具体一点');
    expect(message).not.toContain('最稳定的一条主线是什么');
  });

  it('开场追求职动机时会使用 warmup 动机型点评口吻', () => {
    const provider = new MockLlmProvider();

    const message = provider.generateFollowUpMessage({
      question: warmupQuestion,
      missingPoint: '求职动机',
    });

    expect(message).toContain('为什么出来看机会');
    expect(message).toContain('我再确认一下');
    expect(message).toContain('那你这次出来看机会，最在意哪层');
    expect(message).toContain('你这次就重点把 求职动机 这块讲具体一点');
    expect(message).not.toContain('最关注的是什么');
    expect(message).not.toContain('这次你重点补清楚');
  });

  it('原理机制题追问时会使用机制型点评口吻', () => {
    const provider = new MockLlmProvider();

    const message = provider.generateFollowUpMessage({
      question: mechanismQuestion,
      missingPoint: '微任务',
    });

    expect(message).toContain('关键机制和边界还不够展开');
    expect(message).toContain('那你把机制再往下讲一层');
    expect(message).toContain('你这次就把 微任务 这块补具体一点');
    expect(message).not.toContain('场景题现在还停留在原则层');
    expect(message).not.toContain('我继续追问一下');
  });

  it('场景设计题追问时会使用场景型点评口吻', () => {
    const provider = new MockLlmProvider();

    const message = provider.generateFollowUpMessage({
      question: scenarioQuestion,
      missingPoint: '数据流',
    });

    expect(message).toContain('场景题现在还停留在原则层');
    expect(message).toContain('那你往下拆一下');
    expect(message).toContain('你这次就把 数据流 这块补具体一点');
    expect(message).not.toContain('工程题里最关键的约束和取舍');
    expect(message).not.toContain('这次你重点补充');
  });

  it('工程实践题追问时会使用工程型点评口吻', () => {
    const provider = new MockLlmProvider();

    const message = provider.generateFollowUpMessage({
      question: engineeringQuestion,
      missingPoint: '取舍',
    });

    expect(message).toContain('工程题里最关键的约束和取舍');
    expect(message).toContain('那取舍这块你展开一下');
    expect(message).toContain('你这次就把 取舍 这块补具体一点');
    expect(message).not.toContain('场景题现在还停留在原则层');
    expect(message).not.toContain('我继续追问一下');
  });

  it('高分报告会使用肯定亮点型收口', () => {
    const provider = new MockLlmProvider();

    const message = provider.generateReportMessage(strongReport);

    expect(message).toContain('基础、项目表达和工程判断都比较扎实');
    expect(message).toContain('今天这轮我会给你 4.6 / 5，当前更接近 strong');
    expect(message).toContain('这轮最能拉开区分度的');
    expect(message).not.toContain('面试结束，总分');
    expect(message).not.toContain('优势：');
  });

  it('待提升报告会使用补短板型收口', () => {
    const provider = new MockLlmProvider();

    const message = provider.generateReportMessage(needsWorkReport);

    expect(message).toContain('基础和项目表达还不够稳定');
    expect(message).toContain('今天这轮我会给你 2.1 / 5，当前更接近 needs-work');
    expect(message).toContain('当前最先要补的');
    expect(message).not.toContain('面试结束，总分');
    expect(message).not.toContain('短板：');
  });
});
