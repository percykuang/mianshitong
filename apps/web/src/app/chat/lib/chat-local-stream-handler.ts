import type { ChatSession } from '@mianshitong/shared';
import type { SseEventHandler } from './chat-api';
import { appendAssistantDelta } from './chat-message-mutations';
import { parseSsePayload } from './chat-helpers';

interface LocalStreamHandlerInput {
  optimisticAssistantId: string;
  setActiveSession: (
    value: ChatSession | null | ((previous: ChatSession | null) => ChatSession | null),
  ) => void;
  setNotice: (value: string | null) => void;
}

export function createLocalStreamHandler(input: LocalStreamHandlerInput): {
  handleEvent: SseEventHandler;
  getAssistantContent: () => string;
} {
  let assistantContent = '';

  return {
    handleEvent: (eventName, payload) => {
      const parsed = parseSsePayload(payload);

      if (eventName === 'delta') {
        const delta = typeof parsed.delta === 'string' ? parsed.delta : '';
        if (!delta) {
          return;
        }

        assistantContent += delta;
        input.setActiveSession((previous) =>
          appendAssistantDelta(previous, input.optimisticAssistantId, delta),
        );
        return;
      }

      if (eventName === 'done') {
        const value =
          typeof parsed.assistantContent === 'string' ? parsed.assistantContent : assistantContent;
        assistantContent = value;
        return;
      }

      if (eventName === 'error') {
        input.setNotice(
          typeof parsed.message === 'string' ? parsed.message : '模型调用失败，请稍后重试',
        );
      }
    },
    getAssistantContent: () => assistantContent,
  };
}
