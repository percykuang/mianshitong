import type { ChatMessageCompletionStatus } from '@mianshitong/shared';

const SYSTEM_WELCOME =
  '你好，我是面试通 AI 面试官。你可以直接说“开始模拟面试”，或先让我帮你优化简历/拆解面试题。';

type RawMessage = {
  id?: string;
  role?: string;
  kind?: string;
  content?: unknown;
  createdAt?: string;
  completionStatus?: unknown;
};

export interface SessionMessage {
  id: string;
  role: string;
  kind: string;
  content: string;
  createdAt: string;
  completionStatus: ChatMessageCompletionStatus | null;
}

function normalizeCompletionStatus(value: unknown): ChatMessageCompletionStatus | null {
  return value === 'completed' || value === 'interrupted' ? value : null;
}

export function isSystemMessage(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as { role?: unknown; kind?: unknown; content?: unknown };
  if (record.role === 'system' || record.kind === 'system') {
    return true;
  }

  return typeof record.content === 'string' && record.content === SYSTEM_WELCOME;
}

export function countVisibleMessages(value: unknown): number {
  if (!Array.isArray(value)) {
    return 0;
  }

  return value.filter((item) => !isSystemMessage(item)).length;
}

export function normalizeSessionMessages(value: unknown): SessionMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const message = item as RawMessage;
      const role = typeof message.role === 'string' ? message.role : 'assistant';
      if (role !== 'user' && role !== 'assistant' && role !== 'system') {
        return null;
      }
      let kind = typeof message.kind === 'string' ? message.kind : 'text';
      const content =
        typeof message.content === 'string'
          ? message.content
          : (JSON.stringify(message.content) ?? '');
      if (isSystemMessage(message)) {
        kind = 'system';
      }
      return {
        id: message.id ?? `msg-${index}`,
        role,
        kind,
        content,
        createdAt: message.createdAt ?? '',
        completionStatus: normalizeCompletionStatus(message.completionStatus),
      };
    })
    .filter((item): item is SessionMessage => Boolean(item));
}
