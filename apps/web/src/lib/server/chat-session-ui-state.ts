import { Prisma } from '@mianshitong/db';
import type { ChatSession } from '@mianshitong/shared';

interface PersistedChatUiState {
  pinnedAt?: string | null;
}

interface PersistedRuntimeValue extends Record<string, unknown> {
  __chatUi?: PersistedChatUiState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function decodeSessionRuntime(input: Prisma.JsonValue): {
  runtime: ChatSession['runtime'];
  pinnedAt: string | null;
} {
  if (!isRecord(input)) {
    return {
      runtime: input as unknown as ChatSession['runtime'],
      pinnedAt: null,
    };
  }

  const runtimeValue = input as PersistedRuntimeValue;
  const uiState = isRecord(runtimeValue.__chatUi) ? runtimeValue.__chatUi : null;
  const pinnedAt = typeof uiState?.pinnedAt === 'string' ? uiState.pinnedAt : null;
  const runtime = { ...runtimeValue };
  delete runtime.__chatUi;

  return {
    runtime: runtime as unknown as ChatSession['runtime'],
    pinnedAt,
  };
}

export function encodeSessionRuntime(session: Pick<ChatSession, 'runtime' | 'pinnedAt'>) {
  return {
    ...(session.runtime as unknown as Record<string, unknown>),
    __chatUi: {
      pinnedAt: session.pinnedAt,
    },
  } as Prisma.InputJsonValue;
}
