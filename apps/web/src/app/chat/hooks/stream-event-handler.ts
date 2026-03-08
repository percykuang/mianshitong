import type { ChatSession } from '@mianshitong/shared';
import type { SseEventHandler } from '../lib/chat-api';
import { parseSsePayload } from '../lib/chat-helpers';

interface StreamEventHandlerInput {
  optimisticAssistantId: string;
  setActiveSession: (
    value: ChatSession | null | ((previous: ChatSession | null) => ChatSession | null),
  ) => void;
  setNotice: (value: string | null) => void;
  setSyncedSession: (session: ChatSession) => void;
}

export function createStreamEventHandler(input: StreamEventHandlerInput): SseEventHandler {
  return (eventName, payload) => {
    const parsed = parseSsePayload(payload);

    if (eventName === 'delta') {
      const delta = typeof parsed.delta === 'string' ? parsed.delta : '';
      if (!delta) {
        return;
      }

      input.setActiveSession((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          messages: previous.messages.map((message) =>
            message.id === input.optimisticAssistantId
              ? { ...message, content: message.content + delta }
              : message,
          ),
        };
      });
      return;
    }

    if (eventName === 'done') {
      const maybeSession = parsed.session as ChatSession | undefined;
      if (maybeSession) {
        input.setSyncedSession(maybeSession);
      }
      return;
    }

    if (eventName === 'error') {
      input.setNotice(
        typeof parsed.message === 'string' ? parsed.message : '模型调用失败，请稍后重试',
      );
    }
  };
}
