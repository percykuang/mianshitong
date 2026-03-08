import type { ChatSession } from '@mianshitong/shared';
import { useCallback } from 'react';
import { isAbortError, openGuestStreamRequest, readSseStream } from '../lib/chat-api';
import { clearRouteBootstrapBypass } from '../lib/chat-route-bootstrap-bypass';
import { createMessage, toStreamTurns } from '../lib/chat-local-session';
import { saveLocalSession } from '../lib/chat-local-storage';
import { parseSsePayload } from '../lib/chat-helpers';

interface LocalSendMessageDeps {
  sending: boolean;
  readActiveSession: () => ChatSession | null;
  createOptimisticSession: () => ChatSession;
  refreshSessions: () => Promise<unknown>;
  setSending: (value: boolean) => void;
  setNotice: (value: string | null) => void;
  setInputValue: (value: string) => void;
  readInputValue: () => string;
  registerAbortController: (controller: AbortController) => void;
  clearAbortController: (controller: AbortController) => void;
  setActiveSession: (
    value: ChatSession | null | ((prev: ChatSession | null) => ChatSession | null),
  ) => void;
  setActiveSessionId: (value: string | null) => void;
  replaceSession: (sessionId: string) => void;
}

function toSessionTitle(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '新的对话';
  }

  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
}

export function useLocalSendMessage({
  sending,
  readActiveSession,
  createOptimisticSession,
  refreshSessions,
  setSending,
  setNotice,
  setInputValue,
  readInputValue,
  registerAbortController,
  clearAbortController,
  setActiveSession,
  setActiveSessionId,
  replaceSession,
}: LocalSendMessageDeps) {
  return useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || sending) {
        return;
      }

      const abortController = new AbortController();
      registerAbortController(abortController);
      setInputValue('');
      setSending(true);
      setNotice(null);

      let session = readActiveSession();
      let now = new Date().toISOString();
      let optimisticUser: ReturnType<typeof createMessage> | null = null;
      let optimisticAssistant: ReturnType<typeof createMessage> | null = null;
      let assistantContent = '';
      let sessionIdToClear: string | null = null;

      const buildStoredSession = (): ChatSession | null => {
        if (!session || !optimisticUser) {
          return null;
        }

        const next: ChatSession = {
          ...session,
          messages: [
            ...session.messages,
            optimisticUser,
            ...(assistantContent.trim() && optimisticAssistant
              ? [{ ...optimisticAssistant, content: assistantContent.trim() }]
              : []),
          ],
          updatedAt: now,
          status: 'idle',
        };

        const userCount = session.messages.filter((item) => item.role === 'user').length;
        if (next.title === '新的对话' && userCount === 0) {
          next.title = toSessionTitle(trimmed);
        }

        return next;
      };

      const removeOptimisticExchange = () => {
        if (!optimisticUser && !optimisticAssistant) {
          return;
        }

        setActiveSession((previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            status: 'idle',
            messages: previous.messages.filter(
              (message) =>
                message.id !== optimisticUser?.id && message.id !== optimisticAssistant?.id,
            ),
          };
        });
      };

      try {
        session = readActiveSession() ?? createOptimisticSession();
        sessionIdToClear = session.id;
        now = new Date().toISOString();
        optimisticUser = createMessage({
          role: 'user',
          kind: 'text',
          content: trimmed,
          createdAt: now,
        });
        optimisticAssistant = createMessage({
          role: 'assistant',
          kind: 'text',
          content: '',
          createdAt: now,
        });

        const baseSession = session;
        const optimisticAssistantId = optimisticAssistant.id;

        setActiveSession((previous) => {
          const base = previous ?? baseSession;
          return {
            ...base,
            messages: [...base.messages, optimisticUser!, optimisticAssistant!],
            updatedAt: now,
          };
        });

        const turns = toStreamTurns([...baseSession.messages, optimisticUser]);
        const response = await openGuestStreamRequest(
          {
            modelId: baseSession.modelId,
            messages: turns,
          },
          abortController.signal,
        );

        await readSseStream(response, (eventName, payload) => {
          const parsed = parseSsePayload(payload);

          if (eventName === 'delta') {
            const delta = typeof parsed.delta === 'string' ? parsed.delta : '';
            if (!delta) {
              return;
            }

            assistantContent += delta;
            setActiveSession((previous) => {
              if (!previous) {
                return previous;
              }

              return {
                ...previous,
                messages: previous.messages.map((item) =>
                  item.id === optimisticAssistantId
                    ? { ...item, content: item.content + delta }
                    : item,
                ),
              };
            });
            return;
          }

          if (eventName === 'done') {
            const value =
              typeof parsed.assistantContent === 'string'
                ? parsed.assistantContent
                : assistantContent;
            assistantContent = value;
            return;
          }

          if (eventName === 'error') {
            const message =
              typeof parsed.message === 'string' ? parsed.message : '模型调用失败，请稍后重试';
            setNotice(message);
          }
        });

        if (!assistantContent.trim()) {
          throw new Error('模型没有返回可用内容');
        }

        const updated = buildStoredSession();
        if (!updated) {
          throw new Error('会话保存失败');
        }

        await saveLocalSession(updated);
        setActiveSession(updated);
        setActiveSessionId(updated.id);
        replaceSession(updated.id);
        await refreshSessions();
      } catch (error) {
        if (isAbortError(error)) {
          const updated = buildStoredSession();
          if (updated) {
            await saveLocalSession(updated);
            setActiveSession(updated);
            setActiveSessionId(updated.id);
            replaceSession(updated.id);
            await refreshSessions();
          } else {
            removeOptimisticExchange();
          }
          return;
        }

        if (readInputValue() === '') {
          setInputValue(content);
        }
        removeOptimisticExchange();
        setNotice(error instanceof Error ? error.message : '发送失败，请稍后重试');
      } finally {
        if (sessionIdToClear) {
          clearRouteBootstrapBypass(sessionIdToClear);
        }
        clearAbortController(abortController);
        setSending(false);
      }
    },
    [
      sending,
      readActiveSession,
      createOptimisticSession,
      refreshSessions,
      setSending,
      setNotice,
      setInputValue,
      readInputValue,
      registerAbortController,
      clearAbortController,
      setActiveSession,
      setActiveSessionId,
      replaceSession,
    ],
  );
}
