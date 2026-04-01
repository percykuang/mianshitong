import { describe, expect, it } from 'vitest';
import type { ChatMessage, ChatSession } from '@mianshitong/shared';
import {
  buildDeterministicInterviewReplyDraft,
  buildInterviewReplyTurns,
  collapseInterviewAssistantMessages,
} from './interview-streaming';

function createAssistantMessage(input: Partial<ChatMessage> & Pick<ChatMessage, 'id' | 'content'>) {
  return {
    id: input.id,
    role: 'assistant' as const,
    kind: input.kind ?? 'text',
    content: input.content,
    createdAt: input.createdAt ?? '2026-04-01T00:00:00.000Z',
    completionStatus: input.completionStatus ?? 'completed',
  };
}

function createInterviewSession(messages: ChatMessage[]): ChatSession {
  return {
    id: 'session-1',
    title: '新的对话',
    modelId: 'deepseek-chat',
    isPrivate: true,
    status: 'interviewing',
    config: {
      level: 'mid',
      topics: ['engineering'],
      questionCount: 3,
      feedbackMode: 'per_question',
    },
    messages,
    report: null,
    runtime: {
      questionPlan: [],
      currentQuestionIndex: 0,
      followUpRound: 0,
      currentStage: 'technical',
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
      projectQuestion: null,
      knowledgeRetrievalTrace: [],
    },
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    pinnedAt: null,
  };
}

describe('interview streaming helpers', () => {
  it('会把同一回合的多个 assistant 计划片段合并成一条草案', () => {
    const draft = buildDeterministicInterviewReplyDraft([
      createAssistantMessage({ id: 'a-1', kind: 'feedback', content: '点评：方向对了。' }),
      createAssistantMessage({
        id: 'a-2',
        kind: 'question',
        content: '第二个问题：请解释事件循环。',
      }),
    ]);

    expect(draft).toBe('点评：方向对了。\n\n第二个问题：请解释事件循环。');
  });

  it('生成用户可见草案时会过滤内部 system 计划片段', () => {
    const draft = buildDeterministicInterviewReplyDraft([
      createAssistantMessage({
        id: 'a-0',
        kind: 'system',
        content: '已根据你的输入生成本场面试计划。',
      }),
      createAssistantMessage({
        id: 'a-1',
        kind: 'question',
        content: '第一个问题：请先做个自我介绍。',
      }),
    ]);

    expect(draft).toBe('第一个问题：请先做个自我介绍。');
  });

  it('会把同一回合的多个 assistant 消息折叠成一条最终消息', () => {
    const assistantMessages = [
      createAssistantMessage({ id: 'a-1', kind: 'feedback', content: '点评：方向对了。' }),
      createAssistantMessage({
        id: 'a-2',
        kind: 'question',
        content: '第二个问题：请解释事件循环。',
      }),
    ];
    const session = createInterviewSession([
      {
        id: 'u-1',
        role: 'user',
        kind: 'text',
        content: '我先讲一下自我介绍。',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      ...assistantMessages,
    ]);

    const collapsed = collapseInterviewAssistantMessages({
      session,
      assistantMessages,
      content: '点评：方向对了。第二个问题：请解释事件循环。',
      completionStatus: 'interrupted',
    });

    expect(collapsed.session.messages).toHaveLength(2);
    expect(collapsed.session.messages[1]).toMatchObject({
      id: 'a-1',
      kind: 'question',
      content: '点评：方向对了。第二个问题：请解释事件循环。',
      completionStatus: 'interrupted',
    });
    expect(collapsed.assistantMessage?.id).toBe('a-1');
  });

  it('会把可见历史和内部回合计划一起组装给真实模型', () => {
    const session = createInterviewSession([
      {
        id: 'u-1',
        role: 'user',
        kind: 'text',
        content: '这是我的简历，请开始面试。',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      createAssistantMessage({
        id: 'a-1',
        kind: 'question',
        content: '第一个问题：请先做个自我介绍。',
      }),
    ]);

    const turns = buildInterviewReplyTurns({
      session,
      userContent: '我最近主要做前端工程化和构建优化。',
      interviewStage: 'technical',
      assistantMessages: [
        createAssistantMessage({
          id: 'a-2',
          kind: 'feedback',
          content: '点评：你的开场主线是对的。',
        }),
        createAssistantMessage({
          id: 'a-3',
          kind: 'question',
          content: '第二个问题：请讲讲你做过的构建优化。',
        }),
      ],
    });

    expect(turns[0]?.role).toBe('system');
    expect(turns.some((turn) => turn.content.includes('真实的模拟面试'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('当前回合类型：进入下一道主问题'))).toBe(
      true,
    );
    expect(turns.some((turn) => turn.content.includes('当前面试阶段：技术题'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('当前关联主问题编号：第二个问题'))).toBe(
      true,
    );
    expect(turns.some((turn) => turn.content.includes('示例 1｜点评后进入工程实践题'))).toBe(true);
    expect(
      turns.some((turn) => turn.content.includes('第二个问题：请讲讲你做过的构建优化。')),
    ).toBe(true);
    expect(turns.at(-2)).toEqual({
      role: 'user',
      content: '我最近主要做前端工程化和构建优化。',
    });
  });

  it('开场破冰首题会注入 warmup 专用口吻示例', () => {
    const session = createInterviewSession([
      {
        id: 'u-1',
        role: 'user',
        kind: 'text',
        content: '这是我的简历，请开始面试。',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    ]);

    const turns = buildInterviewReplyTurns({
      session,
      userContent: '开始模拟面试，我最近主要做前端工程化。',
      interviewStage: 'warmup',
      assistantMessages: [
        createAssistantMessage({
          id: 'a-1',
          kind: 'system',
          content: '已根据你的输入生成本场面试计划。',
        }),
        createAssistantMessage({
          id: 'a-2',
          kind: 'question',
          content: '第一个问题：你先做个简短自我介绍吧。',
        }),
      ],
    });

    expect(turns.some((turn) => turn.content.includes('当前面试阶段：开场破冰'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('示例 1｜收到简历后直接进入首题'))).toBe(
      true,
    );
    expect(turns.some((turn) => turn.content.includes('本轮输出格式要求：'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('不要自行输出“**点评**：”'))).toBe(true);
    expect(
      turns.some((turn) =>
        turn.content.includes(
          '下一段必须写成“**第一个问题：** ……”；标签后直接接问题内容，不要换行',
        ),
      ),
    ).toBe(true);
    expect(
      turns.some((turn) =>
        turn.content.includes(
          '如果内部计划里已经带了括号提示，必须保留，并在最后单独一行输出“（……）”，这一行必须独占一行，不要接在问题句后面',
        ),
      ),
    ).toBe(true);
    expect(turns.some((turn) => turn.content.includes('你先做个简短自我介绍吧'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('你好，我看过你的简历了'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('现在我们开始模拟面试吧'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('我们先热个身'))).toBe(false);
    expect(turns.some((turn) => turn.content.includes('重点讲清楚最近几段经历的主线'))).toBe(false);
    expect(
      turns.some((turn) => turn.content.includes('**第一个问题：** 你先做个简短自我介绍吧。')),
    ).toBe(true);
    expect(
      turns.some((turn) =>
        turn.content.includes(
          '**第一个问题：** 你先做个简短自我介绍吧。\n\n（重点讲讲最近几段经历的主线',
        ),
      ),
    ).toBe(true);
    expect(turns.some((turn) => turn.content.includes('示例 1｜点评后进入下一道技术题'))).toBe(
      false,
    );
  });

  it('追问回合会把关联主问题编号和追问类型一起传给真实模型', () => {
    const session = createInterviewSession([
      {
        id: 'u-1',
        role: 'user',
        kind: 'text',
        content: '这是我的简历，请开始面试。',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      createAssistantMessage({
        id: 'a-1',
        kind: 'question',
        content: '第二个问题：请讲一下浏览器事件循环。',
      }),
      {
        id: 'u-2',
        role: 'user',
        kind: 'text',
        content: '我知道微任务优先级更高。',
        createdAt: '2026-04-01T00:01:00.000Z',
      },
    ]);

    const turns = buildInterviewReplyTurns({
      session,
      userContent: '我还想补充 Promise 属于微任务。',
      interviewStage: 'technical',
      assistantMessages: [
        createAssistantMessage({
          id: 'a-2',
          kind: 'follow_up',
          content:
            '点评：方向是对的，但你还没讲清楚为什么微任务会先执行。那你把机制再往下讲一层：浏览器每一轮事件循环的完整执行顺序是什么？',
        }),
      ],
    });

    expect(turns.some((turn) => turn.content.includes('当前回合类型：继续追问'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('当前面试阶段：技术题'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('当前关联主问题编号：第二个问题'))).toBe(
      true,
    );
    expect(
      turns.some((turn) =>
        turn.content.includes('最后一段直接继续追问，不要输出任何新的“**第X个问题：**”'),
      ),
    ).toBe(true);
    expect(turns.some((turn) => turn.content.includes('示例 1｜原理机制题里追底层原因'))).toBe(
      true,
    );
    expect(turns.some((turn) => turn.content.includes('那你把机制再往下讲一层'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('我继续追问一下'))).toBe(false);
    expect(turns.some((turn) => turn.content.includes('示例 1｜点评后进入工程实践题'))).toBe(false);
  });

  it('场景设计主问题会注入场景题专用口吻示例', () => {
    const session = createInterviewSession([
      {
        id: 'u-1',
        role: 'user',
        kind: 'text',
        content: '这是我的简历，请开始面试。',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      createAssistantMessage({
        id: 'a-1',
        kind: 'question',
        content: '第二个问题：请讲一下浏览器事件循环。',
      }),
    ]);

    const turns = buildInterviewReplyTurns({
      session,
      userContent: '我会从数据分层和渲染策略开始设计。',
      interviewStage: 'technical',
      assistantMessages: [
        createAssistantMessage({
          id: 'a-2',
          kind: 'feedback',
          content: '点评：基础主线是对的。',
        }),
        createAssistantMessage({
          id: 'a-3',
          kind: 'question',
          content:
            '第三个问题：假设你现在要做一个商品列表页，同时支持海量数据、实时筛选和排序，你会怎么设计前端方案？',
        }),
      ],
    });

    expect(turns.some((turn) => turn.content.includes('示例 1｜点评后切到场景设计题'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('示例 1｜点评后进入工程实践题'))).toBe(false);
  });

  it('从 warmup 进入原理机制题时会注入更自然的承接示例', () => {
    const session = createInterviewSession([
      {
        id: 'u-1',
        role: 'user',
        kind: 'text',
        content: '这是我的简历，请开始面试。',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      createAssistantMessage({
        id: 'a-1',
        kind: 'question',
        content: '第一个问题：你先做个简短自我介绍吧。',
      }),
    ]);

    const turns = buildInterviewReplyTurns({
      session,
      userContent: '我最近主要做前端工程化和构建优化，也在看新的机会。',
      interviewStage: 'technical',
      assistantMessages: [
        createAssistantMessage({
          id: 'a-2',
          kind: 'feedback',
          content: '点评：你的基本背景我大概知道了。',
        }),
        createAssistantMessage({
          id: 'a-3',
          kind: 'question',
          content: '第二个问题：请讲一下浏览器事件循环里宏任务和微任务的执行顺序。',
        }),
      ],
    });

    expect(turns.some((turn) => turn.content.includes('示例 1｜点评后进入原理机制题'))).toBe(true);
    expect(
      turns.some((turn) =>
        turn.content.includes(
          '**第二个问题：** 你讲一下浏览器事件循环里宏任务和微任务的执行顺序。为什么会这样安排？',
        ),
      ),
    ).toBe(true);
    expect(
      turns.some((turn) =>
        turn.content.includes('你输出里的题号必须完全一致，不得改写、跳号或重置'),
      ),
    ).toBe(true);
    expect(turns.some((turn) => turn.content.includes('我们直接看基础深度'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('标签后直接接问题内容，不要换行'))).toBe(
      true,
    );
    expect(turns.some((turn) => turn.content.includes('我大概知道你的背景了'))).toBe(false);
    expect(turns.some((turn) => turn.content.includes('下面我想先确认一下你的基础深度'))).toBe(
      false,
    );
    expect(turns.some((turn) => turn.content.includes('你刚才的自我介绍主线是清楚的'))).toBe(false);
  });

  it('工程实践追问不会再注入原理机制型示例', () => {
    const session = createInterviewSession([
      {
        id: 'u-1',
        role: 'user',
        kind: 'text',
        content: '这是我的简历，请开始面试。',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      createAssistantMessage({
        id: 'a-1',
        kind: 'question',
        content:
          '第二个问题：请讲讲你做构建优化或工具链升级时，最早是怎么判断瓶颈真的出在编译链路上的？',
      }),
    ]);

    const turns = buildInterviewReplyTurns({
      session,
      userContent: '我会先做构建分析和耗时拆解。',
      interviewStage: 'technical',
      currentFollowUpTrace: {
        questionId: 'build_optimization',
        questionTitle: '构建性能优化',
        round: 1,
        answerPreview: '我会先做构建分析和耗时拆解。',
        answerLength: 16,
        keyPointCount: 3,
        matchedPoints: ['瓶颈'],
        missingPoints: ['方案', '取舍'],
        coverage: 0.333,
        decision: 'ask_follow_up',
        askedMissingPoint: '取舍',
        createdAt: '2026-04-01T00:03:00.000Z',
      },
      assistantMessages: [
        createAssistantMessage({
          id: 'a-2',
          kind: 'follow_up',
          content: '点评：你的方案方向我大概听明白了，但工程题里最关键的约束和取舍还没有讲透。',
        }),
      ],
    });

    expect(turns.some((turn) => turn.content.includes('示例 1｜工程实践题里追取舍'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('那取舍这块你展开一下'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('示例 1｜原理机制题里追底层原因'))).toBe(
      false,
    );
  });

  it('开场追代表项目时会注入 warmup 专用追问示例', () => {
    const session = createInterviewSession([
      {
        id: 'u-1',
        role: 'user',
        kind: 'text',
        content: '这是我的简历，请开始面试。',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      createAssistantMessage({
        id: 'a-1',
        kind: 'question',
        content: '第一个问题：你先做个简短自我介绍吧。',
      }),
    ]);

    const turns = buildInterviewReplyTurns({
      session,
      userContent: '我做前端很多年，也想看看新的机会。',
      interviewStage: 'warmup',
      currentFollowUpTrace: {
        questionId: 'warmup_self_intro',
        questionTitle: '开场破冰：请做自我介绍',
        round: 1,
        answerPreview: '我做前端很多年，也想看看新的机会。',
        answerLength: 18,
        keyPointCount: 3,
        matchedPoints: ['求职动机'],
        missingPoints: ['经历主线', '代表项目'],
        coverage: 0.333,
        decision: 'ask_follow_up',
        askedMissingPoint: '代表项目',
        createdAt: '2026-04-01T00:03:00.000Z',
      },
      assistantMessages: [
        createAssistantMessage({
          id: 'a-2',
          kind: 'follow_up',
          content: '点评：你的背景我已经有概念了，但最该先展开讲的那个项目，现在还没有落下来。',
        }),
      ],
    });

    expect(turns.some((turn) => turn.content.includes('当前面试阶段：开场破冰'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('示例 1｜开场里追代表项目'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('最该先展开讲的那个项目'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('我再确认一下'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('那如果现在就展开一个项目'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('你先讲哪个'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('最能代表你的项目'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('先把代表作听实一点'))).toBe(false);
    expect(turns.some((turn) => turn.content.includes('还没有立起来'))).toBe(false);
    expect(turns.some((turn) => turn.content.includes('示例 1｜点评后继续追问'))).toBe(false);
  });

  it('开场追经历主线时会注入更自然的主线追问示例', () => {
    const session = createInterviewSession([
      {
        id: 'u-1',
        role: 'user',
        kind: 'text',
        content: '这是我的简历，请开始面试。',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      createAssistantMessage({
        id: 'a-1',
        kind: 'question',
        content: '第一个问题：你先做个简短自我介绍吧。',
      }),
    ]);

    const turns = buildInterviewReplyTurns({
      session,
      userContent: '我做前端很多年。',
      interviewStage: 'warmup',
      currentFollowUpTrace: {
        questionId: 'warmup_self_intro',
        questionTitle: '开场破冰：请做自我介绍',
        round: 1,
        answerPreview: '我做前端很多年。',
        answerLength: 8,
        keyPointCount: 3,
        matchedPoints: [],
        missingPoints: ['经历主线', '代表项目', '求职动机'],
        coverage: 0,
        decision: 'ask_follow_up',
        askedMissingPoint: '经历主线',
        createdAt: '2026-04-01T00:03:00.000Z',
      },
      assistantMessages: [
        createAssistantMessage({
          id: 'a-2',
          kind: 'follow_up',
          content:
            '点评：我知道你做过前端了，但最近这几段经历真正串起来的主线，我还没有完全听出来。',
        }),
      ],
    });

    expect(turns.some((turn) => turn.content.includes('示例 1｜开场里追经历主线'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('真正串起来的主线'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('我先确认一下'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('主线更偏哪条'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('我再压实一点'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('我还想再压实一点'))).toBe(false);
    expect(turns.some((turn) => turn.content.includes('最稳定的一条主线是什么'))).toBe(false);
  });

  it('开场追求职动机时会注入 warmup 动机型追问示例', () => {
    const session = createInterviewSession([
      {
        id: 'u-1',
        role: 'user',
        kind: 'text',
        content: '这是我的简历，请开始面试。',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      createAssistantMessage({
        id: 'a-1',
        kind: 'question',
        content: '第一个问题：你先做个简短自我介绍吧。',
      }),
    ]);

    const turns = buildInterviewReplyTurns({
      session,
      userContent: '我最近主要做工程化，也负责过构建优化项目。',
      interviewStage: 'warmup',
      currentFollowUpTrace: {
        questionId: 'warmup_self_intro',
        questionTitle: '开场破冰：请做自我介绍',
        round: 1,
        answerPreview: '我最近主要做工程化，也负责过构建优化项目。',
        answerLength: 23,
        keyPointCount: 3,
        matchedPoints: ['经历主线', '代表项目'],
        missingPoints: ['求职动机'],
        coverage: 0.667,
        decision: 'ask_follow_up',
        askedMissingPoint: '求职动机',
        createdAt: '2026-04-01T00:03:00.000Z',
      },
      assistantMessages: [
        createAssistantMessage({
          id: 'a-2',
          kind: 'follow_up',
          content: '点评：你的经历我大概知道了，但你这次为什么出来看机会，现在还不够具体。',
        }),
      ],
    });

    expect(turns.some((turn) => turn.content.includes('示例 1｜开场里追求职动机'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('为什么出来看机会，现在还不够具体'))).toBe(
      true,
    );
    expect(turns.some((turn) => turn.content.includes('我再确认一下'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('那你这次出来看机会，最在意哪层'))).toBe(
      true,
    );
    expect(turns.some((turn) => turn.content.includes('先不聊技术'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('我想先听清一件事'))).toBe(false);
    expect(turns.some((turn) => turn.content.includes('最关注的是什么'))).toBe(false);
    expect(turns.some((turn) => turn.content.includes('项目深挖里追方案取舍'))).toBe(false);
  });

  it('项目深挖主问题会注入更像项目复盘的口吻示例', () => {
    const session = createInterviewSession([
      {
        id: 'u-1',
        role: 'user',
        kind: 'text',
        content: '这是我的简历，请开始面试。',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      createAssistantMessage({
        id: 'a-1',
        kind: 'question',
        content: '第二个问题：请讲一下浏览器事件循环。',
      }),
      {
        id: 'u-2',
        role: 'user',
        kind: 'text',
        content: '我最近主要做 monorepo 和构建优化。',
        createdAt: '2026-04-01T00:02:00.000Z',
      },
    ]);

    const turns = buildInterviewReplyTurns({
      session,
      userContent: '我会挑一个最有代表性的工程化项目来讲。',
      interviewStage: 'project',
      assistantMessages: [
        createAssistantMessage({
          id: 'a-2',
          kind: 'question',
          content: '第三个问题：请你挑一个最能代表你水平的项目，按 STAR 结构展开。',
        }),
      ],
    });

    expect(turns.some((turn) => turn.content.includes('当前面试阶段：项目深挖'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('示例 1｜进入项目深挖'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('最能代表你的项目'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('能力上限'))).toBe(false);
    expect(turns.some((turn) => turn.content.includes('示例 1｜点评后进入下一道技术题'))).toBe(
      false,
    );
  });

  it('项目深挖追问会注入取舍型追问示例，而不是技术机制示例', () => {
    const session = createInterviewSession([
      {
        id: 'u-1',
        role: 'user',
        kind: 'text',
        content: '这是我的简历，请开始面试。',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      createAssistantMessage({
        id: 'a-1',
        kind: 'question',
        content: '第三个问题：请介绍一个最能代表你水平的项目。',
      }),
      {
        id: 'u-2',
        role: 'user',
        kind: 'text',
        content: '我最近主要做 monorepo 和构建优化。',
        createdAt: '2026-04-01T00:02:00.000Z',
      },
    ]);

    const turns = buildInterviewReplyTurns({
      session,
      userContent: '我当时主要负责方案设计和落地。',
      interviewStage: 'project',
      currentFollowUpTrace: {
        questionId: 'project_deep_dive',
        questionTitle: '项目深挖',
        round: 1,
        answerPreview: '我当时主要负责方案设计和落地。',
        answerLength: 15,
        keyPointCount: 6,
        matchedPoints: ['背景', '职责'],
        missingPoints: ['挑战', '方案', '结果', '权衡'],
        coverage: 0.333,
        decision: 'ask_follow_up',
        askedMissingPoint: '方案',
        createdAt: '2026-04-01T00:03:00.000Z',
      },
      assistantMessages: [
        createAssistantMessage({
          id: 'a-2',
          kind: 'follow_up',
          content:
            '点评：背景和结果讲到了，但方案取舍还不够展开。那为什么这么选，你展开一下：你为什么最终选了这套方案？',
        }),
      ],
    });

    expect(turns.some((turn) => turn.content.includes('当前面试阶段：项目深挖'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('示例 1｜项目深挖里追方案取舍'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('那为什么这么选，你展开一下'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('我继续追一个关键点'))).toBe(false);
    expect(
      turns.some((turn) => turn.content.includes('为什么每轮宏任务结束之后都要先清空微任务队列')),
    ).toBe(false);
  });

  it('项目深挖追背景复杂度时会注入 context 型追问示例', () => {
    const session = createInterviewSession([
      {
        id: 'u-1',
        role: 'user',
        kind: 'text',
        content: '这是我的简历，请开始面试。',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      createAssistantMessage({
        id: 'a-1',
        kind: 'question',
        content: '第三个问题：请介绍一个最能代表你水平的项目。',
      }),
    ]);

    const turns = buildInterviewReplyTurns({
      session,
      userContent: '这是一个工程化项目。',
      interviewStage: 'project',
      currentFollowUpTrace: {
        questionId: 'project_deep_dive',
        questionTitle: '项目深挖',
        round: 1,
        answerPreview: '这是一个工程化项目。',
        answerLength: 10,
        keyPointCount: 6,
        matchedPoints: ['结果'],
        missingPoints: ['背景', '职责', '挑战', '方案', '权衡'],
        coverage: 0.167,
        decision: 'ask_follow_up',
        askedMissingPoint: '背景',
        createdAt: '2026-04-01T00:03:00.000Z',
      },
      assistantMessages: [
        createAssistantMessage({
          id: 'a-2',
          kind: 'follow_up',
          content: '点评：结果先讲到了，但项目背景和你的职责边界还不够清楚。',
        }),
      ],
    });

    expect(turns.some((turn) => turn.content.includes('示例 1｜项目深挖里追背景复杂度'))).toBe(
      true,
    );
    expect(turns.some((turn) => turn.content.includes('那背景和边界这块你讲具体一点'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('我继续追一个点'))).toBe(false);
    expect(turns.some((turn) => turn.content.includes('示例 1｜项目深挖里追方案取舍'))).toBe(false);
  });

  it('项目深挖追收益验证时会注入 outcome 型追问示例', () => {
    const session = createInterviewSession([
      {
        id: 'u-1',
        role: 'user',
        kind: 'text',
        content: '这是我的简历，请开始面试。',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      createAssistantMessage({
        id: 'a-1',
        kind: 'question',
        content: '第三个问题：请介绍一个最能代表你水平的项目。',
      }),
    ]);

    const turns = buildInterviewReplyTurns({
      session,
      userContent: '我主要做了方案和落地。',
      interviewStage: 'project',
      currentFollowUpTrace: {
        questionId: 'project_deep_dive',
        questionTitle: '项目深挖',
        round: 1,
        answerPreview: '我主要做了方案和落地。',
        answerLength: 12,
        keyPointCount: 6,
        matchedPoints: ['背景', '职责', '方案'],
        missingPoints: ['结果', '权衡'],
        coverage: 0.5,
        decision: 'ask_follow_up',
        askedMissingPoint: '结果',
        createdAt: '2026-04-01T00:03:00.000Z',
      },
      assistantMessages: [
        createAssistantMessage({
          id: 'a-2',
          kind: 'follow_up',
          content: '点评：方案有了，但结果验证还不够扎实。',
        }),
      ],
    });

    expect(turns.some((turn) => turn.content.includes('示例 1｜项目深挖里追收益验证'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('那结果怎么验证，你讲具体一点'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('我继续追一个细节'))).toBe(false);
    expect(turns.some((turn) => turn.content.includes('示例 1｜项目深挖里追方案取舍'))).toBe(false);
  });

  it('总结回合会注入收口型口吻示例，避免继续追问或切题', () => {
    const session = createInterviewSession([
      {
        id: 'u-1',
        role: 'user',
        kind: 'text',
        content: '这是我的简历，请开始面试。',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      createAssistantMessage({
        id: 'a-1',
        kind: 'question',
        content: '第三个问题：请介绍一个最能代表你水平的项目。',
      }),
      {
        id: 'u-2',
        role: 'user',
        kind: 'text',
        content: '我最近主要做 monorepo 和构建优化。',
        createdAt: '2026-04-01T00:02:00.000Z',
      },
    ]);

    const turns = buildInterviewReplyTurns({
      session,
      userContent: '我会先分析构建链路里的瓶颈，再做工具替换和增量构建优化。',
      interviewStage: 'wrap_up',
      assistantMessages: [
        createAssistantMessage({
          id: 'a-2',
          kind: 'report',
          content: '面试结束，整体来看你的工程化经验比较扎实。',
        }),
      ],
    });

    expect(turns.some((turn) => turn.content.includes('当前回合类型：总结收口'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('当前面试阶段：总结收口'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('示例 1｜平衡反馈型收口'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('示例 1｜点评后继续追问'))).toBe(false);
  });

  it('高分报告会注入肯定亮点型收口示例', () => {
    const session = {
      ...createInterviewSession([
        {
          id: 'u-1',
          role: 'user' as const,
          kind: 'text' as const,
          content: '这是我的简历，请开始面试。',
          createdAt: '2026-04-01T00:00:00.000Z',
        },
      ]),
      report: {
        overallSummary: '整体表现优秀，继续强化系统化表达和复杂场景推理。',
        overallScore: 4.6,
        level: 'strong' as const,
        dimensionSummary: {
          correctness: 4.5,
          depth: 4.6,
          communication: 4.4,
          engineering: 4.7,
          tradeoffs: 4.5,
        },
        strengths: ['工程判断扎实'],
        gaps: ['少数回答还可更锐利'],
        nextSteps: ['继续压缩表达并强化复杂场景取舍'],
        breakdown: [],
      },
    };

    const turns = buildInterviewReplyTurns({
      session,
      userContent: '谢谢老师。',
      interviewStage: 'wrap_up',
      assistantMessages: [
        createAssistantMessage({
          id: 'a-2',
          kind: 'report',
          content: '面试结束，总体来看你的表现不错。',
        }),
      ],
    });

    expect(turns.some((turn) => turn.content.includes('示例 1｜肯定亮点型收口'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('示例 1｜补短板型收口'))).toBe(false);
  });

  it('待提升报告会注入补短板型收口示例', () => {
    const session = {
      ...createInterviewSession([
        {
          id: 'u-1',
          role: 'user' as const,
          kind: 'text' as const,
          content: '这是我的简历，请开始面试。',
          createdAt: '2026-04-01T00:00:00.000Z',
        },
      ]),
      report: {
        overallSummary: '当前基础还不稳定，建议优先补核心概念与常见场景。',
        overallScore: 2.1,
        level: 'needs-work' as const,
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
      },
    };

    const turns = buildInterviewReplyTurns({
      session,
      userContent: '谢谢老师。',
      interviewStage: 'wrap_up',
      assistantMessages: [
        createAssistantMessage({
          id: 'a-2',
          kind: 'report',
          content: '面试结束，建议后面继续补基础。',
        }),
      ],
    });

    expect(turns.some((turn) => turn.content.includes('示例 1｜补短板型收口'))).toBe(true);
    expect(turns.some((turn) => turn.content.includes('示例 1｜肯定亮点型收口'))).toBe(false);
  });
});
