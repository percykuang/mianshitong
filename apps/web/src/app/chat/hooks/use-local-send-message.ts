import type { ChatSession } from '@mianshitong/shared';
import { useCallback } from 'react';
import { isAbortError, openGuestStreamRequest, readSseStream } from '../lib/chat-api';
import { createLocalStreamHandler } from '../lib/chat-local-stream-handler';
import {
  appendOptimisticMessages,
  buildStoredLocalSession,
  removeOptimisticMessages,
} from '../lib/chat-message-mutations';
import { clearRouteBootstrapBypass } from '../lib/chat-route-bootstrap-bypass';
import { createMessage, toStreamTurns } from '../lib/chat-local-session';
import { saveLocalSession } from '../lib/chat-local-storage';

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
      let sessionIdToClear: string | null = null;
      let streamHandler: ReturnType<typeof createLocalStreamHandler> | null = null;

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
        streamHandler = createLocalStreamHandler({
          optimisticAssistantId: optimisticAssistant.id,
          setActiveSession,
          setNotice,
        });

        setActiveSession((previous) =>
          appendOptimisticMessages(
            previous ?? baseSession,
            [optimisticUser!, optimisticAssistant!],
            now,
          ),
        );

        const turns = toStreamTurns([...baseSession.messages, optimisticUser]);
        const response = await openGuestStreamRequest(
          {
            modelId: baseSession.modelId,
            messages: turns,
          },
          abortController.signal,
        );

        await readSseStream(response, streamHandler.handleEvent);

        const assistantContent = streamHandler.getAssistantContent().trim();
        if (!assistantContent) {
          throw new Error('模型没有返回可用内容');
        }

        const updated = buildStoredLocalSession({
          session,
          optimisticUser,
          optimisticAssistant,
          assistantContent,
          now,
          submittedContent: trimmed,
        });
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
          const updated = buildStoredLocalSession({
            session,
            optimisticUser,
            optimisticAssistant,
            assistantContent: streamHandler?.getAssistantContent() ?? '',
            now,
            submittedContent: trimmed,
          });
          if (updated) {
            await saveLocalSession(updated);
            setActiveSession(updated);
            setActiveSessionId(updated.id);
            replaceSession(updated.id);
            await refreshSessions();
          } else {
            setActiveSession((previous) =>
              removeOptimisticMessages(previous, [optimisticUser?.id, optimisticAssistant?.id]),
            );
          }
          return;
        }

        if (readInputValue() === '') {
          setInputValue(content);
        }
        setActiveSession((previous) =>
          removeOptimisticMessages(previous, [optimisticUser?.id, optimisticAssistant?.id]),
        );
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
