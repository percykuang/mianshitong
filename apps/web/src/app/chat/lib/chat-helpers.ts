import type { ChatMessage } from '@mianshitong/shared';

function createTemporaryId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createTemporaryMessage(input: {
  role: ChatMessage['role'];
  content: string;
  kind?: ChatMessage['kind'];
}): ChatMessage {
  return {
    id: createTemporaryId('tmp'),
    role: input.role,
    kind: input.kind ?? 'text',
    content: input.content,
    createdAt: new Date().toISOString(),
  };
}

export function parseSsePayload(payload: string): Record<string, unknown> {
  if (!payload) {
    return {};
  }

  try {
    const parsed = JSON.parse(payload);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}
