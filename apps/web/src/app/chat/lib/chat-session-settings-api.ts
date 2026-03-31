import type { ChatSession, ChatSessionResponse } from '@mianshitong/shared';
import { CHAT_ERROR_COPY } from './chat-copy';

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || CHAT_ERROR_COPY.requestFailed);
  }

  return (await response.json()) as T;
}

export async function setSessionPinnedRequest(
  sessionId: string,
  pinned: boolean,
): Promise<ChatSession> {
  const response = await fetch(`/api/chat/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pinned }),
  });

  const data = await readJson<ChatSessionResponse>(response);
  return data.session;
}
