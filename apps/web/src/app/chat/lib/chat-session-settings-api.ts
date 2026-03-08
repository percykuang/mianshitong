import type { ChatSession, ChatSessionResponse } from '@mianshitong/shared';

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || '请求失败');
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
