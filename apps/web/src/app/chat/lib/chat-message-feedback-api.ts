import type { ChatMessageFeedback, ChatSession, ChatSessionResponse } from '@mianshitong/shared';

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || '请求失败');
  }

  return (await response.json()) as T;
}

export async function setMessageFeedbackRequest(
  sessionId: string,
  messageId: string,
  feedback: ChatMessageFeedback | null,
): Promise<ChatSession> {
  const response = await fetch(`/api/chat/sessions/${sessionId}/messages/${messageId}/feedback`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ feedback }),
  });

  const data = await readJson<ChatSessionResponse>(response);
  return data.session;
}
