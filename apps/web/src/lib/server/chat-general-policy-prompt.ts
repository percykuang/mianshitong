import type { ChatTurn } from '@mianshitong/llm';
import { CHAT_REPLY_POLICY_INSTRUCTION } from './chat-general-policy.constants';
import { buildGeneralChatIntentExamples } from './chat-general-policy-examples';
import { buildGeneralChatIntentInstruction } from './chat-general-policy-instruction';
import type { GeneralChatIntent } from './chat-general-policy.types';

export function prependChatReplyFormattingInstruction(messages: ChatTurn[]): ChatTurn[] {
  if (
    messages[0]?.role === 'system' &&
    messages[0].content.includes(CHAT_REPLY_POLICY_INSTRUCTION)
  ) {
    return messages;
  }

  return [
    {
      role: 'system',
      content: CHAT_REPLY_POLICY_INSTRUCTION,
    },
    ...messages,
  ];
}

export function prependGeneralChatIntentInstruction(
  messages: ChatTurn[],
  intent: GeneralChatIntent | null,
): ChatTurn[] {
  if (!intent) {
    return messages;
  }

  const instruction = buildGeneralChatIntentInstruction(intent);
  const examples = buildGeneralChatIntentExamples(intent);

  return [
    {
      role: 'system',
      content: instruction,
    },
    ...examples,
    ...messages,
  ];
}
