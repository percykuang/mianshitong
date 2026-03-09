import { describe, expect, it } from 'vitest';
import type { ChatSession } from '@mianshitong/shared';
import {
  appendUserAssistantMessages,
  createDraftLocalSession,
  rebuildSessionAfterEdit,
  toStreamTurns,
} from './chat-local-session';

function createBaseSession(): ChatSession {
  return createDraftLocalSession('deepseek-chat', 'session_test_local');
}

describe('chat-local-session', () => {
  it('新会话会包含系统欢迎消息', () => {
    const session = createBaseSession();

    expect(session.title).toBe('新的对话');
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0]?.role).toBe('assistant');
    expect(session.messages[0]?.kind).toBe('system');
  });

  it('首次追加用户与助手消息后会更新标题与时间', () => {
    const session = createBaseSession();
    const next = appendUserAssistantMessages(session, {
      userContent: '请帮我优化一下前端简历项目描述',
      assistantContent: '可以，我先看你的项目经历。',
      now: '2026-03-09T12:30:00.000Z',
    });

    expect(next.title).toBe('请帮我优化一下前端简历项目描述');
    expect(next.updatedAt).toBe('2026-03-09T12:30:00.000Z');
    expect(next.messages.slice(-2).map((item) => item.role)).toEqual(['user', 'assistant']);
  });

  it('编辑首条用户消息后会重建后续内容并同步标题', () => {
    const session = appendUserAssistantMessages(createBaseSession(), {
      userContent: '帮我准备一下面试',
      assistantContent: '可以，我们先从自我介绍开始。',
      now: '2026-03-09T12:00:00.000Z',
    });
    const userMessageId = session.messages.find((item) => item.role === 'user')?.id;

    const rebuilt = rebuildSessionAfterEdit(session, {
      messageId: userMessageId!,
      userContent: '帮我准备一下面试中的自我介绍',
      assistantContent: '好的，我先给你一个 1 分钟版本。',
      now: '2026-03-09T12:35:00.000Z',
    });

    expect(rebuilt?.title).toBe('帮我准备一下面试中的自我介绍');
    expect(rebuilt?.messages).toHaveLength(3);
    expect(rebuilt?.messages[1]?.content).toBe('帮我准备一下面试中的自我介绍');
    expect(rebuilt?.messages[2]?.content).toBe('好的，我先给你一个 1 分钟版本。');
  });

  it('构造流式上下文时会过滤 report 类型消息', () => {
    const session = createBaseSession();
    const turns = toStreamTurns([
      ...session.messages,
      {
        id: 'user_1',
        role: 'user',
        kind: 'text',
        content: '开始模拟面试',
        createdAt: '2026-03-09T12:00:00.000Z',
      },
      {
        id: 'report_1',
        role: 'assistant',
        kind: 'report',
        content: '结构化报告',
        createdAt: '2026-03-09T12:10:00.000Z',
      },
    ]);

    expect(turns).toHaveLength(2);
    expect(turns.map((item) => item.content)).toEqual([
      '你好，我是面试通 AI 面试官。你可以直接说“开始模拟面试”，或先让我帮你优化简历/拆解面试题。',
      '开始模拟面试',
    ]);
  });
});
