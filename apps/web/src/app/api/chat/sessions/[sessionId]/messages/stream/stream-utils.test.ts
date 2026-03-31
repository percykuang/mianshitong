import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createStreamProvider,
  emitShortcutReplyAsStream,
  enqueueSseEvent,
  finalizeSseStream,
  splitShortcutReplyIntoDeltas,
  toChatTurns,
} from './stream-utils';

const originalEnv = {
  ...process.env,
};

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('splitShortcutReplyIntoDeltas', () => {
  it('会把快捷回复拆成多个流式分片，且拼接后可还原原文', () => {
    const content = '你好！我是面试通，一个互联网大公司的资深程序员和面试官，专注于前端技术领域。';

    const chunks = splitShortcutReplyIntoDeltas(content);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(content);
  });

  it('会保留换行和列表结构，不破坏 Markdown 文本', () => {
    const content = [
      '你可以这样发我：',
      '1. 将简历正文完整粘贴到这里。',
      '2. 隐藏个人信息。',
      '',
      '我会先逐段点评。',
    ].join('\n');

    const chunks = splitShortcutReplyIntoDeltas(content);

    expect(chunks.join('')).toBe(content);
    expect(chunks.some((chunk) => chunk.includes('\n'))).toBe(true);
  });
});

describe('createStreamProvider', () => {
  it('在 mock provider 下会返回基于用户消息的流式回复', async () => {
    process.env.LLM_PROVIDER = 'mock';
    process.env.MOCK_STREAM_CHAT_PREFIX = '[web-e2e]';

    const { provider, model } = createStreamProvider('deepseek-chat');
    let content = '';

    for await (const delta of provider.streamChat({
      model,
      messages: [{ role: 'user', content: '可以帮我优化简历吗？' }],
    })) {
      content += delta;
    }

    expect(provider.name).toBe('mock-stream-provider');
    expect(content).toBe('[web-e2e] 已按真实模型链路处理：可以帮我优化简历吗？');
  });

  it('在开启测试开关后会回显命中的知识分类与文档标题', async () => {
    process.env.LLM_PROVIDER = 'mock';
    process.env.MOCK_STREAM_CHAT_PREFIX = '[web-e2e]';
    process.env.MOCK_STREAM_ECHO_KNOWLEDGE = '1';

    const { provider, model } = createStreamProvider('deepseek-chat');
    let content = '';

    for await (const delta of provider.streamChat({
      model,
      messages: [
        {
          role: 'system',
          content: [
            '以下是与当前问题高度相关的内部知识背景。',
            '',
            '[知识背景 1]',
            '背景分类：技术知识',
            '知识主题：React 性能优化面试手册',
            '内容：',
            '先定位，再优化。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: 'React 性能优化在面试里应该怎么回答？',
        },
      ],
    })) {
      content += delta;
    }

    expect(content).toBe(
      '[web-e2e] 已按真实模型链路处理：React 性能优化在面试里应该怎么回答？；知识命中：技术知识::React 性能优化面试手册',
    );
  });
});

describe('toChatTurns', () => {
  it('会在技术问答链路里注入知识文档上下文', () => {
    const turns = toChatTurns(
      {
        id: 'session-1',
        title: '新的对话',
        status: 'idle',
        modelId: 'deepseek-chat',
        config: {
          level: 'mid',
          topics: ['react'],
          questionCount: 5,
          feedbackMode: 'end_summary',
        },
        messages: [],
        runtime: {
          questionPlan: [],
          currentQuestionIndex: 0,
          followUpRound: 0,
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
          knowledgeRetrievalTrace: [],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        report: null,
        isPrivate: true,
        pinnedAt: null,
      },
      'React useMemo 和 useCallback 的区别',
      {
        kind: 'technical_question',
        question: 'React useMemo 和 useCallback 的区别',
        style: 'comparison',
      },
      {
        mode: 'strong',
        entries: [
          {
            documentId: 'doc-1',
            documentTitle: 'React Hooks 面试手册',
            category: 'tech_knowledge',
            contentShape: 'reference',
            headingPath: ['React', 'useMemo 和 useCallback'],
            content: 'useMemo 缓存结果，useCallback 缓存函数引用。',
            score: 6.8,
          },
        ],
      },
    );

    expect(turns[0]?.role).toBe('system');
    expect(turns.some((turn) => turn.content.includes('React Hooks 面试手册'))).toBe(true);
    expect(turns.at(-1)).toEqual({
      role: 'user',
      content: 'React useMemo 和 useCallback 的区别',
    });
  });
});

describe('emitShortcutReplyAsStream', () => {
  it('请求已中止时不会抛出未处理异常，而是返回 aborted 结果', async () => {
    const abortController = new AbortController();
    abortController.abort();
    const enqueue = vi.fn();

    await expect(
      emitShortcutReplyAsStream({
        controller: { enqueue } as unknown as ReadableStreamDefaultController<Uint8Array>,
        content: '你好，世界',
        signal: abortController.signal,
      }),
    ).resolves.toEqual({
      aborted: true,
      content: '',
    });

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('流式输出过程中被中止时会返回已输出的部分内容', async () => {
    const abortController = new AbortController();
    const enqueue = vi.fn(() => {
      abortController.abort();
    });

    const result = await emitShortcutReplyAsStream({
      controller: { enqueue } as unknown as ReadableStreamDefaultController<Uint8Array>,
      content: '你好，世界。继续输出',
      signal: abortController.signal,
    });

    expect(result.aborted).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);
    expect('你好，世界。继续输出'.startsWith(result.content)).toBe(true);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });
});

describe('finalizeSseStream', () => {
  it('控制器已关闭时会静默忽略普通 SSE enqueue 的 invalid state 错误', () => {
    const closedError = new TypeError('Invalid state: Controller is already closed');
    const enqueue = vi.fn(() => {
      throw closedError;
    });

    expect(enqueueSseEvent({ enqueue }, 'error', { message: 'aborted' })).toBe(false);
  });

  it('会在控制器仍然可写时补发 end 事件并关闭流', () => {
    const enqueue = vi.fn();
    const close = vi.fn();

    finalizeSseStream({ enqueue, close }, { ok: true });

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('控制器已关闭时会静默忽略 end enqueue / close 的 invalid state 错误', () => {
    const closedError = new TypeError('Invalid state: Controller is already closed');
    const enqueue = vi.fn(() => {
      throw closedError;
    });
    const close = vi.fn(() => {
      throw closedError;
    });

    expect(() => finalizeSseStream({ enqueue, close }, { ok: false })).not.toThrow();
  });
});
