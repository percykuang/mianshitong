/**
 * @jest-environment jsdom
 */
import '../../../../vitest.setup';
import type { ChatSession } from '@mianshitong/shared';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAT_ERROR_COPY } from '../lib/chat-copy';
import { appendUserAssistantMessages, createDraftChatSession } from '../lib/chat-session-draft';

const chatApiMocks = vi.hoisted(() => ({
  fetchSessionById: vi.fn(),
  isAbortError: vi.fn((error: unknown) => error instanceof Error && error.name === 'AbortError'),
  openStreamRequest: vi.fn(),
  persistInterruptedSessionTurn: vi.fn(),
  readSseStream: vi.fn(),
}));

vi.mock('../lib/chat-api', () => ({
  fetchSessionById: chatApiMocks.fetchSessionById,
  isAbortError: chatApiMocks.isAbortError,
  openStreamRequest: chatApiMocks.openStreamRequest,
  persistInterruptedSessionTurn: chatApiMocks.persistInterruptedSessionTurn,
  readSseStream: chatApiMocks.readSseStream,
}));

import { useSendMessage } from './use-send-message';

function createAbortError() {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
}

describe('useSendMessage', () => {
  let activeSession: ChatSession | null;
  let inputValue: string;

  const refreshSessions = vi.fn(async () => []);
  const refreshChatUsage = vi.fn(async () => ({
    actorType: 'guest' as const,
    used: 0,
    max: 10,
    remaining: 10,
  }));
  const setSending = vi.fn();
  const setErrorFeedback = vi.fn();
  const setActiveSessionId = vi.fn();
  const replaceSession = vi.fn();
  const registerAbortController = vi.fn();
  const clearAbortController = vi.fn();

  const setInputValue = vi.fn((value: string) => {
    inputValue = value;
  });

  const setActiveSession = vi.fn(
    (value: ChatSession | null | ((prev: ChatSession | null) => ChatSession | null)) => {
      activeSession = typeof value === 'function' ? value(activeSession) : value;
    },
  );

  beforeEach(() => {
    activeSession = null;
    inputValue = '';
    refreshSessions.mockClear();
    refreshChatUsage.mockClear();
    setSending.mockClear();
    setErrorFeedback.mockClear();
    setActiveSessionId.mockClear();
    replaceSession.mockClear();
    registerAbortController.mockClear();
    clearAbortController.mockClear();
    setInputValue.mockClear();
    setActiveSession.mockClear();
    chatApiMocks.fetchSessionById.mockReset();
    chatApiMocks.openStreamRequest.mockReset();
    chatApiMocks.persistInterruptedSessionTurn.mockReset();
    chatApiMocks.readSseStream.mockReset();
  });

  it('中止生成且远端未落库时，仍会保留已发送的用户消息', async () => {
    chatApiMocks.openStreamRequest.mockResolvedValue(new Response(''));
    chatApiMocks.readSseStream.mockRejectedValue(createAbortError());
    chatApiMocks.fetchSessionById.mockRejectedValue(new Error('not found'));
    chatApiMocks.persistInterruptedSessionTurn.mockImplementation(async (input) => ({
      ...createDraftChatSession('deepseek-chat', input.sessionId),
      title: input.userContent,
      updatedAt: input.userCreatedAt ?? '2026-03-09T15:00:00.000Z',
      messages: [
        {
          id: 'server_user_1',
          role: 'user',
          kind: 'text',
          content: input.userContent,
          createdAt: input.userCreatedAt ?? '2026-03-09T15:00:00.000Z',
        },
      ],
    }));

    const { result } = renderHook(() =>
      useSendMessage({
        sending: false,
        readActiveSession: () => activeSession,
        createOptimisticSession: () => {
          activeSession = createDraftChatSession('deepseek-chat', 'abort_session_1');
          return activeSession;
        },
        refreshSessions,
        refreshChatUsage,
        setSending,
        setErrorFeedback,
        setInputValue,
        readInputValue: () => inputValue,
        registerAbortController,
        clearAbortController,
        setActiveSession,
        setActiveSessionId,
        replaceSession,
      }),
    );

    await act(async () => {
      await result.current('请解释一下事件循环');
    });

    expect(activeSession?.title).toBe('请解释一下事件循环');
    expect(activeSession?.status).toBe('idle');
    expect(activeSession?.messages.map((message) => message.role)).toEqual(['user']);
    expect(activeSession?.messages[0]?.content).toBe('请解释一下事件循环');
    expect(chatApiMocks.persistInterruptedSessionTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'abort_session_1',
        userContent: '请解释一下事件循环',
        assistantContent: undefined,
        expectedMessageCount: 0,
      }),
    );
    expect(setErrorFeedback).not.toHaveBeenCalledWith(CHAT_ERROR_COPY.sendFailed);
  });

  it('已有远端会话时中止生成，不应被远端旧会话覆盖掉本轮用户消息', async () => {
    activeSession = appendUserAssistantMessages(
      createDraftChatSession('deepseek-chat', 'abort_session_2'),
      {
        userContent: '你好',
        assistantContent: '你好！我是面试通。',
        now: '2026-03-09T15:00:00.000Z',
      },
    );

    chatApiMocks.openStreamRequest.mockResolvedValue(new Response(''));
    chatApiMocks.readSseStream.mockRejectedValue(createAbortError());
    chatApiMocks.fetchSessionById.mockResolvedValue(activeSession);
    chatApiMocks.persistInterruptedSessionTurn.mockResolvedValue({
      ...activeSession,
      messages: [
        ...activeSession.messages,
        {
          id: 'server_user_2',
          role: 'user',
          kind: 'text',
          content: '第二条消息发送后立刻停止：请详细解释 React Fiber 的工作原理。',
          createdAt: '2026-03-09T15:10:00.000Z',
        },
      ],
      updatedAt: '2026-03-09T15:10:00.000Z',
    });

    const { result } = renderHook(() =>
      useSendMessage({
        sending: false,
        readActiveSession: () => activeSession,
        createOptimisticSession: () => {
          throw new Error('should not create session');
        },
        refreshSessions,
        refreshChatUsage,
        setSending,
        setErrorFeedback,
        setInputValue,
        readInputValue: () => inputValue,
        registerAbortController,
        clearAbortController,
        setActiveSession,
        setActiveSessionId,
        replaceSession,
      }),
    );

    await act(async () => {
      await result.current('第二条消息发送后立刻停止：请详细解释 React Fiber 的工作原理。');
    });

    expect(activeSession?.messages.map((message) => message.role)).toEqual([
      'user',
      'assistant',
      'user',
    ]);
    expect(activeSession?.messages.at(-1)?.content).toBe(
      '第二条消息发送后立刻停止：请详细解释 React Fiber 的工作原理。',
    );
    expect(activeSession?.status).toBe('idle');
    expect(chatApiMocks.persistInterruptedSessionTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'abort_session_2',
        expectedMessageCount: 2,
      }),
    );
  });

  it('中止生成时如果 assistant 已有部分内容，应持久化为 interrupted 状态', async () => {
    chatApiMocks.openStreamRequest.mockResolvedValue(new Response(''));
    chatApiMocks.readSseStream.mockImplementation(async (_response, onEvent) => {
      onEvent('delta', JSON.stringify({ delta: '闭包就是函数和其词法环境的组合。' }));
      throw createAbortError();
    });
    chatApiMocks.fetchSessionById.mockRejectedValue(new Error('not found'));
    chatApiMocks.persistInterruptedSessionTurn.mockImplementation(async (input) => ({
      ...createDraftChatSession('deepseek-chat', input.sessionId),
      title: input.userContent,
      updatedAt: input.assistantCreatedAt ?? '2026-03-09T15:00:01.000Z',
      messages: [
        {
          id: 'server_user_3',
          role: 'user',
          kind: 'text',
          content: input.userContent,
          createdAt: input.userCreatedAt ?? '2026-03-09T15:00:00.000Z',
        },
        {
          id: 'server_assistant_3',
          role: 'assistant',
          kind: 'text',
          content: input.assistantContent ?? '',
          createdAt: input.assistantCreatedAt ?? '2026-03-09T15:00:01.000Z',
          completionStatus: 'interrupted',
        },
      ],
    }));

    const { result } = renderHook(() =>
      useSendMessage({
        sending: false,
        readActiveSession: () => activeSession,
        createOptimisticSession: () => {
          activeSession = createDraftChatSession('deepseek-chat', 'abort_session_3_partial');
          return activeSession;
        },
        refreshSessions,
        refreshChatUsage,
        setSending,
        setErrorFeedback,
        setInputValue,
        readInputValue: () => inputValue,
        registerAbortController,
        clearAbortController,
        setActiveSession,
        setActiveSessionId,
        replaceSession,
      }),
    );

    await act(async () => {
      await result.current('什么是闭包');
    });

    expect(activeSession?.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(activeSession?.messages[1]?.content).toBe('闭包就是函数和其词法环境的组合。');
    expect(activeSession?.messages[1]?.completionStatus).toBe('interrupted');
    expect(chatApiMocks.persistInterruptedSessionTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'abort_session_3_partial',
        userContent: '什么是闭包',
        assistantContent: '闭包就是函数和其词法环境的组合。',
        expectedMessageCount: 0,
      }),
    );
  });

  it('如果中止前远端其实已经落库了，应优先采用远端完整结果', async () => {
    const baseSession = appendUserAssistantMessages(
      createDraftChatSession('deepseek-chat', 'abort_session_3'),
      {
        userContent: '你好',
        assistantContent: '你好！我是面试通。',
        now: '2026-03-09T15:00:00.000Z',
      },
    );
    const remoteSession = appendUserAssistantMessages(baseSession, {
      userContent: '第二条消息',
      assistantContent: '这是一条已经完整落库的回复。',
      now: '2026-03-09T15:05:00.000Z',
    });
    activeSession = baseSession;

    chatApiMocks.openStreamRequest.mockResolvedValue(new Response(''));
    chatApiMocks.readSseStream.mockRejectedValue(createAbortError());
    chatApiMocks.fetchSessionById.mockResolvedValue(remoteSession);

    const { result } = renderHook(() =>
      useSendMessage({
        sending: false,
        readActiveSession: () => activeSession,
        createOptimisticSession: () => {
          throw new Error('should not create session');
        },
        refreshSessions,
        refreshChatUsage,
        setSending,
        setErrorFeedback,
        setInputValue,
        readInputValue: () => inputValue,
        registerAbortController,
        clearAbortController,
        setActiveSession,
        setActiveSessionId,
        replaceSession,
      }),
    );

    await act(async () => {
      await result.current('第二条消息');
    });

    expect(activeSession).toEqual(remoteSession);
    expect(refreshSessions).toHaveBeenCalled();
    expect(chatApiMocks.persistInterruptedSessionTurn).not.toHaveBeenCalled();
  });

  it('如果本地已收到部分 assistant 内容，不应被远端已落草稿的 completed 消息覆盖', async () => {
    const baseSession = appendUserAssistantMessages(
      createDraftChatSession('deepseek-chat', 'abort_session_interview_partial'),
      {
        userContent: '第一轮回答',
        assistantContent: '第二个问题：请解释事件循环。',
        now: '2026-03-09T15:00:00.000Z',
      },
    );
    const remoteDraftSession = {
      ...baseSession,
      messages: [
        ...baseSession.messages,
        {
          id: 'server_user_partial',
          role: 'user' as const,
          kind: 'text' as const,
          content: '浏览器事件循环怎么执行？',
          createdAt: '2026-03-09T15:10:00.000Z',
        },
        {
          id: 'server_assistant_partial',
          role: 'assistant' as const,
          kind: 'text' as const,
          content: '点评：完整草稿。第二个问题：完整追问。',
          createdAt: '2026-03-09T15:10:01.000Z',
          completionStatus: 'completed' as const,
        },
      ],
      updatedAt: '2026-03-09T15:10:01.000Z',
    };
    const interruptedRemoteSession = {
      ...baseSession,
      messages: [
        ...baseSession.messages,
        {
          id: 'server_user_partial',
          role: 'user' as const,
          kind: 'text' as const,
          content: '浏览器事件循环怎么执行？',
          createdAt: '2026-03-09T15:10:00.000Z',
        },
        {
          id: 'server_assistant_partial',
          role: 'assistant' as const,
          kind: 'text' as const,
          content: '点评：',
          createdAt: '2026-03-09T15:10:01.000Z',
          completionStatus: 'interrupted' as const,
        },
      ],
      updatedAt: '2026-03-09T15:10:01.000Z',
    };
    activeSession = baseSession;

    chatApiMocks.openStreamRequest.mockResolvedValue(new Response(''));
    chatApiMocks.readSseStream.mockImplementation(async (_response, onEvent) => {
      onEvent('delta', JSON.stringify({ delta: '点评：' }));
      throw createAbortError();
    });
    chatApiMocks.fetchSessionById.mockResolvedValue(remoteDraftSession);
    chatApiMocks.persistInterruptedSessionTurn.mockResolvedValue(interruptedRemoteSession);

    const { result } = renderHook(() =>
      useSendMessage({
        sending: false,
        readActiveSession: () => activeSession,
        createOptimisticSession: () => {
          throw new Error('should not create session');
        },
        refreshSessions,
        refreshChatUsage,
        setSending,
        setErrorFeedback,
        setInputValue,
        readInputValue: () => inputValue,
        registerAbortController,
        clearAbortController,
        setActiveSession,
        setActiveSessionId,
        replaceSession,
      }),
    );

    await act(async () => {
      await result.current('浏览器事件循环怎么执行？');
    });

    expect(chatApiMocks.persistInterruptedSessionTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'abort_session_interview_partial',
        userContent: '浏览器事件循环怎么执行？',
        assistantContent: '点评：',
        expectedMessageCount: 2,
      }),
    );
    expect(activeSession).toEqual(interruptedRemoteSession);
  });
});
