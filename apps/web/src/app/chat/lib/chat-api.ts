import type {
  ChatSession,
  ChatSessionResponse,
  ChatSessionsResponse,
  ChatUsageSummary,
  ModelId,
  SessionSummary,
} from '@mianshitong/shared';
import { CHAT_ERROR_COPY } from './chat-copy';

export type SseEventHandler = (eventName: string, payload: string) => void;

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const payload = (await response.json().catch(() => null)) as { message?: unknown } | null;
    if (payload && typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message;
    }
  }

  const message = await response.text();
  return message || CHAT_ERROR_COPY.requestFailed;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as T;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  const response = await fetch('/api/chat/sessions', { cache: 'no-store' });
  const data = await readJson<ChatSessionsResponse>(response);
  return data.sessions;
}

export async function fetchSessionById(sessionId: string): Promise<ChatSession> {
  const response = await fetch(`/api/chat/sessions/${sessionId}`, { cache: 'no-store' });
  const data = await readJson<ChatSessionResponse>(response);
  return data.session;
}

export async function fetchChatUsageSummary(): Promise<ChatUsageSummary> {
  const response = await fetch('/api/chat/usage', { cache: 'no-store' });
  return readJson<ChatUsageSummary>(response);
}

export async function createSessionRequest(input: {
  modelId: ModelId;
  isPrivate?: boolean;
}): Promise<ChatSession> {
  const response = await fetch('/api/chat/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  const data = await readJson<ChatSessionResponse>(response);
  return data.session;
}

export async function renameSessionRequest(sessionId: string, title: string): Promise<ChatSession> {
  const response = await fetch(`/api/chat/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title }),
  });

  const data = await readJson<ChatSessionResponse>(response);
  return data.session;
}

export async function deleteSessionRequest(sessionId: string): Promise<void> {
  const response = await fetch(`/api/chat/sessions/${sessionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error((await readErrorMessage(response)) || CHAT_ERROR_COPY.deleteSessionFailed);
  }
}

export async function deleteAllSessionsRequest(): Promise<void> {
  const response = await fetch('/api/chat/sessions', {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error((await readErrorMessage(response)) || CHAT_ERROR_COPY.deleteAllSessionsFailed);
  }
}

export async function openStreamRequest(
  sessionId: string,
  content: string,
  modelId: ModelId,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetch(`/api/chat/sessions/${sessionId}/messages/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content, modelId }),
    signal,
  });

  if (!response.ok) {
    throw new Error((await readErrorMessage(response)) || CHAT_ERROR_COPY.sendFailed);
  }

  return response;
}

export async function openEditStreamRequest(
  sessionId: string,
  messageId: string,
  content: string,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetch(
    `/api/chat/sessions/${sessionId}/messages/${messageId}/edit/stream`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content }),
      signal,
    },
  );

  if (!response.ok) {
    throw new Error((await readErrorMessage(response)) || CHAT_ERROR_COPY.editFailed);
  }

  return response;
}

export async function persistInterruptedSessionTurn(input: {
  sessionId: string;
  userContent: string;
  assistantContent?: string;
  modelId: ModelId;
  expectedMessageCount: number;
  userCreatedAt?: string;
  assistantCreatedAt?: string;
}): Promise<ChatSession> {
  const response = await fetch(`/api/chat/sessions/${input.sessionId}/messages/interrupted`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  const data = await readJson<ChatSessionResponse>(response);
  return data.session;
}

function emitSseEvent(rawEvent: string, onEvent: SseEventHandler): void {
  const lines = rawEvent
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);
  if (lines.length === 0) {
    return;
  }

  let eventName = 'message';
  const payloadLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
      continue;
    }

    if (line.startsWith('data:')) {
      payloadLines.push(line.slice(5).trimStart());
    }
  }

  onEvent(eventName, payloadLines.join('\n'));
}

export async function readSseStream(response: Response, onEvent: SseEventHandler): Promise<void> {
  if (!response.body) {
    throw new Error(CHAT_ERROR_COPY.emptyStream);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const boundaryIndex = buffer.indexOf('\n\n');
      if (boundaryIndex < 0) {
        break;
      }

      const rawEvent = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);
      emitSseEvent(rawEvent, onEvent);
    }
  }

  const rest = buffer.trim();
  if (rest) {
    emitSseEvent(rest, onEvent);
  }
}
