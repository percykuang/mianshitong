import { describe, expect, it } from 'vitest';
import { createDraftLocalSession, createMessage } from './chat-local-session';
import {
  appendAssistantDelta,
  appendOptimisticMessages,
  buildStoredLocalSession,
  getEditableUserMessageIndex,
  removeOptimisticMessages,
  toSessionTitle,
} from './chat-message-mutations';

describe('chat-message-mutations', () => {
  it('会规范化会话标题并在过长时截断', () => {
    expect(toSessionTitle('   帮我优化  简历   ')).toBe('帮我优化 简历');
    expect(toSessionTitle('请帮我优化一下前端简历项目描述和亮点表达')).toBe(
      '请帮我优化一下前端简历项目描述和亮点...',
    );
  });

  it('会追加 optimistic 消息并更新会话时间', () => {
    const session = createDraftLocalSession('deepseek-chat', 'mutation_session_1');
    const optimisticUser = createMessage({
      role: 'user',
      kind: 'text',
      content: '你好',
      createdAt: '2026-03-09T15:00:00.000Z',
    });

    const next = appendOptimisticMessages(session, [optimisticUser], '2026-03-09T15:00:00.000Z');

    expect(next.messages.at(-1)?.content).toBe('你好');
    expect(next.updatedAt).toBe('2026-03-09T15:00:00.000Z');
  });

  it('会为目标 assistant 消息追加 delta，并能移除 optimistic 消息', () => {
    const optimisticAssistant = createMessage({
      role: 'assistant',
      kind: 'text',
      content: '',
      createdAt: '2026-03-09T15:00:00.000Z',
    });
    const session = appendOptimisticMessages(
      createDraftLocalSession('deepseek-chat', 'mutation_session_2'),
      [optimisticAssistant],
      '2026-03-09T15:00:00.000Z',
    );

    const withDelta = appendAssistantDelta(session, optimisticAssistant.id, 'hello');
    const removed = removeOptimisticMessages(withDelta, [optimisticAssistant.id]);

    expect(withDelta?.messages.at(-1)?.content).toBe('hello');
    expect(removed?.messages).toHaveLength(1);
    expect(removed?.status).toBe('idle');
  });

  it('会构造用于本地持久化的会话，并在首条用户消息时更新标题', () => {
    const session = createDraftLocalSession('deepseek-chat', 'mutation_session_3');
    const optimisticUser = createMessage({
      role: 'user',
      kind: 'text',
      content: '可以帮我优化简历吗？',
      createdAt: '2026-03-09T15:00:00.000Z',
    });
    const optimisticAssistant = createMessage({
      role: 'assistant',
      kind: 'text',
      content: '',
      createdAt: '2026-03-09T15:00:00.000Z',
    });

    const stored = buildStoredLocalSession({
      session,
      optimisticUser,
      optimisticAssistant,
      assistantContent: '当然可以，我们先看项目经历。',
      now: '2026-03-09T15:00:00.000Z',
      submittedContent: optimisticUser.content,
    });

    expect(stored?.title).toBe('可以帮我优化简历吗？');
    expect(stored?.messages.slice(-2).map((message) => message.role)).toEqual([
      'user',
      'assistant',
    ]);
  });

  it('只允许编辑用户消息', () => {
    const user = createMessage({
      role: 'user',
      kind: 'text',
      content: '开始模拟面试',
      createdAt: '2026-03-09T15:00:00.000Z',
    });
    const assistant = createMessage({
      role: 'assistant',
      kind: 'text',
      content: '好的，我们开始。',
      createdAt: '2026-03-09T15:01:00.000Z',
    });

    const messages = [user, assistant];
    expect(getEditableUserMessageIndex(messages, user.id)).toBe(0);
    expect(getEditableUserMessageIndex(messages, assistant.id)).toBe(-1);
  });
});
