import type {
  ChatSession,
  ChatSessionResponse,
  ChatSessionsResponse,
  ModelId,
  SessionSummary,
} from '@mianshitong/shared';
import type { ChatTurn } from '@mianshitong/llm';

export type SseEventHandler = (eventName: string, payload: string) => void;

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || '请求失败');
  }

  return (await response.json()) as T;
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

export async function deleteSessionRequest(sessionId: string): Promise<void> {
  const response = await fetch(`/api/chat/sessions/${sessionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || '删除会话失败');
  }
}

export async function deleteAllSessionsRequest(): Promise<void> {
  const response = await fetch('/api/chat/sessions', {
    method: 'DELETE',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || '删除所有会话失败');
  }
}

export async function openStreamRequest(sessionId: string, content: string): Promise<Response> {
  const response = await fetch(`/api/chat/sessions/${sessionId}/messages/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || '发送失败，请稍后重试');
  }

  return response;
}

export async function openGuestStreamRequest(input: {
  modelId: ModelId;
  messages: ChatTurn[];
}): Promise<Response> {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || '发送失败，请稍后重试');
  }

  return response;
}

export async function openEditStreamRequest(
  sessionId: string,
  messageId: string,
  content: string,
): Promise<Response> {
  const response = await fetch(
    `/api/chat/sessions/${sessionId}/messages/${messageId}/edit/stream`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || '编辑失败，请稍后重试');
  }

  return response;
}

export async function readSseStream(response: Response, onEvent: SseEventHandler): Promise<void> {
  if (!response.body) {
    throw new Error('流式响应为空');
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
      const lines = rawEvent
        .split('\n')
        .map((line) => line.trimEnd())
        .filter(Boolean);
      if (lines.length === 0) {
        continue;
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
  }
}
