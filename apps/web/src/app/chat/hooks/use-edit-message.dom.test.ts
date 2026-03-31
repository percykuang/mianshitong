/**
 * @jest-environment jsdom
 */
import '../../../../vitest.setup';
import type { ChatSession } from '@mianshitong/shared';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appendUserAssistantMessages, createDraftChatSession } from '../lib/chat-session-draft';

const chatApiMocks = vi.hoisted(() => ({
  fetchSessionById: vi.fn(),
  isAbortError: vi.fn((error: unknown) => error instanceof Error && error.name === 'AbortError'),
  openEditStreamRequest: vi.fn(),
  readSseStream: vi.fn(),
}));

vi.mock('../lib/chat-api', () => ({
  fetchSessionById: chatApiMocks.fetchSessionById,
  isAbortError: chatApiMocks.isAbortError,
  openEditStreamRequest: chatApiMocks.openEditStreamRequest,
  readSseStream: chatApiMocks.readSseStream,
}));

const remoteSyncMocks = vi.hoisted(() => ({
  syncFetchedRemoteSession: vi.fn(),
  syncResolvedRemoteSession: vi.fn(),
}));

vi.mock('../lib/chat-remote-session-sync', () => ({
  syncFetchedRemoteSession: remoteSyncMocks.syncFetchedRemoteSession,
  syncResolvedRemoteSession: remoteSyncMocks.syncResolvedRemoteSession,
}));

import { useEditMessage } from './use-edit-message';

function createAbortError() {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
}

describe('useEditMessage', () => {
  let activeSession: ChatSession | null;

  const refreshSessions = vi.fn(async () => []);
  const refreshChatUsage = vi.fn(async () => ({
    actorType: 'guest' as const,
    used: 0,
    max: 10,
    remaining: 10,
  }));
  const registerAbortController = vi.fn();
  const clearAbortController = vi.fn();
  const setSending = vi.fn();
  const setErrorFeedback = vi.fn();
  const setActiveSessionId = vi.fn();
  const setActiveSession = vi.fn(
    (value: ChatSession | null | ((prev: ChatSession | null) => ChatSession | null)) => {
      activeSession = typeof value === 'function' ? value(activeSession) : value;
    },
  );

  beforeEach(() => {
    activeSession = appendUserAssistantMessages(createDraftChatSession('deepseek-chat', 'edit_1'), {
      userContent: '请解释一下闭包',
      assistantContent: '闭包是函数与其词法环境的组合。',
      now: '2026-03-30T01:20:00.000Z',
    });

    refreshSessions.mockClear();
    refreshChatUsage.mockClear();
    registerAbortController.mockClear();
    clearAbortController.mockClear();
    setSending.mockClear();
    setErrorFeedback.mockClear();
    setActiveSessionId.mockClear();
    setActiveSession.mockClear();
    chatApiMocks.fetchSessionById.mockReset();
    chatApiMocks.isAbortError.mockImplementation(
      (error: unknown) => error instanceof Error && error.name === 'AbortError',
    );
    chatApiMocks.openEditStreamRequest.mockReset();
    chatApiMocks.readSseStream.mockReset();
    remoteSyncMocks.syncFetchedRemoteSession.mockReset();
    remoteSyncMocks.syncResolvedRemoteSession.mockReset();
    remoteSyncMocks.syncFetchedRemoteSession.mockImplementation(async () => {
      throw new Error('should not call syncFetchedRemoteSession in these tests');
    });
    remoteSyncMocks.syncResolvedRemoteSession.mockImplementation(async (input) => {
      input.setActiveSession(input.session);
      input.setActiveSessionId(input.session.id);
      await input.refreshSessions();
      return input.session;
    });
  });

  it('空白编辑内容会沿用原消息内容重新生成', async () => {
    const userMessageId = activeSession?.messages[0]?.id;
    const originalUserContent = activeSession?.messages[0]?.content ?? '';
    const updatedSession = {
      ...activeSession!,
      updatedAt: '2026-03-30T01:20:01.000Z',
      messages: [
        {
          ...activeSession!.messages[0]!,
          content: originalUserContent,
        },
        {
          ...activeSession!.messages[1]!,
          id: 'assistant_2',
          content: '重新生成后的解释',
          completionStatus: 'completed' as const,
        },
      ],
    };
    chatApiMocks.openEditStreamRequest.mockResolvedValue(new Response(''));
    chatApiMocks.readSseStream.mockImplementation(async (_response, onEvent) => {
      onEvent('done', JSON.stringify({ session: updatedSession }));
    });
    const { result } = renderHook(() =>
      useEditMessage({
        activeSession,
        readActiveSession: () => activeSession,
        sending: false,
        refreshSessions,
        refreshChatUsage,
        registerAbortController,
        clearAbortController,
        setSending,
        setErrorFeedback,
        setActiveSession,
        setActiveSessionId,
      }),
    );

    let editResult = '';
    await act(async () => {
      editResult = await result.current(userMessageId ?? '', '   \n  ');
    });

    expect(editResult).toBe('completed');
    expect(chatApiMocks.openEditStreamRequest).toHaveBeenCalledWith(
      'edit_1',
      userMessageId,
      originalUserContent,
      expect.any(AbortSignal),
    );
    expect(activeSession).toEqual(updatedSession);
    expect(setErrorFeedback).not.toHaveBeenCalledWith('编辑内容不能为空');
    expect(setSending).toHaveBeenCalledWith(true);
    expect(refreshChatUsage).toHaveBeenCalledTimes(1);
  });

  it('编辑内容与原消息等价时会沿用原消息内容重新生成', async () => {
    const userMessageId = activeSession?.messages[0]?.id;
    const originalUserContent = activeSession?.messages[0]?.content ?? '';
    const updatedSession = {
      ...activeSession!,
      updatedAt: '2026-03-30T01:20:01.000Z',
      messages: [
        {
          ...activeSession!.messages[0]!,
          content: originalUserContent,
        },
        {
          ...activeSession!.messages[1]!,
          id: 'assistant_2',
          content: '等价编辑后的新回复',
          completionStatus: 'completed' as const,
        },
      ],
    };
    chatApiMocks.openEditStreamRequest.mockResolvedValue(new Response(''));
    chatApiMocks.readSseStream.mockImplementation(async (_response, onEvent) => {
      onEvent('done', JSON.stringify({ session: updatedSession }));
    });
    const { result } = renderHook(() =>
      useEditMessage({
        activeSession,
        readActiveSession: () => activeSession,
        sending: false,
        refreshSessions,
        refreshChatUsage,
        registerAbortController,
        clearAbortController,
        setSending,
        setErrorFeedback,
        setActiveSession,
        setActiveSessionId,
      }),
    );

    let editResult = '';
    await act(async () => {
      editResult = await result.current(userMessageId ?? '', '  请解释一下闭包  ');
    });

    expect(editResult).toBe('completed');
    expect(chatApiMocks.openEditStreamRequest).toHaveBeenCalledWith(
      'edit_1',
      userMessageId,
      originalUserContent,
      expect.any(AbortSignal),
    );
    expect(setSending).toHaveBeenCalledWith(true);
    expect(setErrorFeedback).not.toHaveBeenCalledWith(expect.stringMatching(/\S/));
    expect(refreshChatUsage).toHaveBeenCalledTimes(1);
  });

  it('编辑重生成在无任何 assistant 输出时中止，会恢复为原会话', async () => {
    const originalSession = activeSession;
    const userMessageId = activeSession?.messages[0]?.id;
    chatApiMocks.openEditStreamRequest.mockResolvedValue(new Response(''));
    chatApiMocks.readSseStream.mockRejectedValue(createAbortError());

    const { result } = renderHook(() =>
      useEditMessage({
        activeSession,
        readActiveSession: () => activeSession,
        sending: false,
        refreshSessions,
        refreshChatUsage,
        registerAbortController,
        clearAbortController,
        setSending,
        setErrorFeedback,
        setActiveSession,
        setActiveSessionId,
      }),
    );

    let editResult = '';
    await act(async () => {
      editResult = await result.current(userMessageId ?? '', '请重新解释一下闭包');
    });

    expect(editResult).toBe('aborted_without_output');
    expect(activeSession).toEqual(originalSession);
    expect(setErrorFeedback).not.toHaveBeenCalledWith(expect.any(String));
    expect(registerAbortController).toHaveBeenCalledTimes(1);
    expect(clearAbortController).toHaveBeenCalledTimes(1);
    expect(refreshChatUsage).toHaveBeenCalledTimes(1);
  });

  it('编辑重生成在已有 assistant 部分输出时中止，会保留部分内容并同步 interrupted 状态', async () => {
    const userMessageId = activeSession?.messages[0]?.id;
    const interruptedRemoteSession = {
      ...createDraftChatSession('deepseek-chat', 'edit_1'),
      title: '请重新解释一下闭包',
      updatedAt: '2026-03-30T01:20:02.000Z',
      messages: [
        {
          id: 'server_user_1',
          role: 'user' as const,
          kind: 'text' as const,
          content: '请重新解释一下闭包',
          createdAt: '2026-03-30T01:20:01.000Z',
        },
        {
          id: 'server_assistant_1',
          role: 'assistant' as const,
          kind: 'text' as const,
          content: '闭包',
          createdAt: '2026-03-30T01:20:02.000Z',
          completionStatus: 'interrupted' as const,
        },
      ],
    };

    chatApiMocks.openEditStreamRequest.mockResolvedValue(new Response(''));
    chatApiMocks.readSseStream.mockImplementation(async (_response, onEvent) => {
      onEvent('delta', JSON.stringify({ delta: '闭包' }));
      throw createAbortError();
    });
    chatApiMocks.fetchSessionById.mockResolvedValue(interruptedRemoteSession);

    const { result } = renderHook(() =>
      useEditMessage({
        activeSession,
        readActiveSession: () => activeSession,
        sending: false,
        refreshSessions,
        refreshChatUsage,
        registerAbortController,
        clearAbortController,
        setSending,
        setErrorFeedback,
        setActiveSession,
        setActiveSessionId,
      }),
    );

    let editResult = '';
    await act(async () => {
      editResult = await result.current(userMessageId ?? '', '请重新解释一下闭包');
    });

    expect(editResult).toBe('interrupted');
    expect(activeSession).toEqual(interruptedRemoteSession);
    expect(activeSession?.messages[1]?.completionStatus).toBe('interrupted');
    expect(chatApiMocks.fetchSessionById).toHaveBeenCalledWith('edit_1');
    expect(remoteSyncMocks.syncResolvedRemoteSession).toHaveBeenCalled();
    expect(setErrorFeedback).not.toHaveBeenCalledWith(expect.any(String));
  });
});
