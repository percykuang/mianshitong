/**
 * @jest-environment jsdom
 */
import '../../../../vitest.setup';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatSession } from '@mianshitong/shared';

const controllerState = vi.hoisted(() => ({
  sending: false,
}));

const sendMocks = vi.hoisted(() => ({
  remoteSendMessage: vi.fn(async () => undefined),
  remoteEditMessage: vi.fn(async () => true),
  refreshChatUsage: vi.fn(async () => ({
    actorType: 'guest' as const,
    used: 0,
    max: 10,
    remaining: 10,
  })),
  abortCurrentStream: vi.fn(),
  setSending: vi.fn(),
  setSessions: vi.fn(),
  setSessionsLoading: vi.fn(),
  setActiveSessionId: vi.fn(),
  setActiveSession: vi.fn(),
  setSelectedModelId: vi.fn(),
  setActiveSessionLoading: vi.fn(),
}));

const noopActions = vi.hoisted(() => ({
  handlePickSession: vi.fn(async () => undefined),
  handleNewChat: vi.fn(async () => undefined),
  handleDeleteSession: vi.fn(async () => undefined),
  handleDeleteAllSessions: vi.fn(async () => undefined),
  handleQuickPrompt: vi.fn(async () => undefined),
  handleCopy: vi.fn(async () => undefined),
  showNotice: vi.fn(),
  startEditingUserMessage: vi.fn(),
  cancelEditingUserMessage: vi.fn(),
  submitEditingUserMessage: vi.fn(async () => true),
}));

vi.mock('./use-chat-controller-store', () => ({
  useChatControllerStore: () => ({
    sessions: [],
    sessionsLoading: false,
    activeSessionId: 'session_1',
    activeSession: null,
    selectedModelId: 'deepseek-chat',
    sending: controllerState.sending,
    activeSessionLoading: false,
    setSessions: sendMocks.setSessions,
    setSessionsLoading: sendMocks.setSessionsLoading,
    setActiveSessionId: sendMocks.setActiveSessionId,
    setActiveSession: sendMocks.setActiveSession,
    setSelectedModelId: sendMocks.setSelectedModelId,
    setSending: sendMocks.setSending,
    setActiveSessionLoading: sendMocks.setActiveSessionLoading,
  }),
}));

vi.mock('./use-chat-navigation', () => ({
  useChatNavigation: () => ({
    routeSessionId: null,
    pushSession: vi.fn(),
    replaceSession: vi.fn(),
    pushNewChat: vi.fn(),
    replaceNewChat: vi.fn(),
  }),
}));

vi.mock('./use-chat-storage', () => ({
  useChatStorage: () => ({
    ready: true,
    isAuthenticated: false,
    chatUsage: { actorType: 'guest', used: 0, max: 10, remaining: 10 },
    usageLoading: false,
    usageError: null,
    refreshChatUsage: sendMocks.refreshChatUsage,
    fetchSessionList: vi.fn(async () => []),
    fetchSessionDetail: vi.fn(async () => null),
    deleteSessionById: vi.fn(async () => undefined),
    deleteAllSessions: vi.fn(async () => undefined),
  }),
}));

vi.mock('./use-send-message', () => ({
  useSendMessage: () => sendMocks.remoteSendMessage,
}));

vi.mock('./use-edit-message', () => ({
  useEditMessage: () => sendMocks.remoteEditMessage,
}));

vi.mock('./use-chat-controller-actions', () => ({
  useChatControllerActions: () => noopActions,
}));

vi.mock('./use-chat-controller-effects', () => ({
  useChatControllerEffects: vi.fn(),
}));

vi.mock('../stores/chat-session-cache-store', () => ({
  cacheSession: vi.fn(),
  clearCachedSessions: vi.fn(),
  readCachedSession: vi.fn((): ChatSession | null => null),
  removeCachedSession: vi.fn(),
}));

vi.mock('../lib/chat-stream-controller', () => ({
  abortCurrentStream: sendMocks.abortCurrentStream,
  clearStreamAbortController: vi.fn(),
  registerStreamAbortController: vi.fn(),
}));

import { useChatController } from './use-chat-controller';

describe('useChatController', () => {
  beforeEach(() => {
    controllerState.sending = false;
    sendMocks.remoteSendMessage.mockClear();
    sendMocks.abortCurrentStream.mockClear();
    sendMocks.setSending.mockClear();
  });

  it('发送消息时统一走远端发送', async () => {
    const { result } = renderHook(() => useChatController());

    await act(async () => {
      await result.current.sendMessage('你好');
    });

    expect(sendMocks.remoteSendMessage).toHaveBeenCalledWith('你好');
  });

  it('发送中再次发送非空内容时会阻止发送并提示 toast', async () => {
    controllerState.sending = true;
    const { result } = renderHook(() => useChatController());

    await act(async () => {
      await result.current.sendMessage('继续生成');
    });

    expect(sendMocks.remoteSendMessage).not.toHaveBeenCalled();
    expect(result.current.toast).toBe('AI 回复生成中，请先停止当前回复');
  });

  it('停止生成时会中止流并清除 sending 状态', () => {
    const { result } = renderHook(() => useChatController());

    act(() => {
      result.current.stopMessageGeneration();
    });

    expect(sendMocks.abortCurrentStream).toHaveBeenCalled();
    expect(sendMocks.setSending).toHaveBeenCalledWith(false);
  });
});
