import type { ChatMessageFeedback, ChatSessionResponse } from '@mianshitong/shared';
import { getCurrentUserId } from '@/lib/server/auth-session';
import { setUserMessageFeedback } from '@/lib/server/chat-message-feedback-repository';

function isFeedback(value: unknown): value is ChatMessageFeedback | null {
  return value === 'like' || value === 'dislike' || value === null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string; messageId: string }> },
): Promise<Response> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const feedback =
    typeof body === 'object' && body !== null && 'feedback' in body
      ? (body.feedback as unknown)
      : undefined;

  if (!isFeedback(feedback)) {
    return Response.json({ message: '请求参数无效' }, { status: 400 });
  }

  const { sessionId, messageId } = await context.params;
  const session = await setUserMessageFeedback(userId, sessionId, messageId, feedback);

  if (!session) {
    return Response.json({ message: 'Session or message not found' }, { status: 404 });
  }

  const payload: ChatSessionResponse = { session };
  return Response.json(payload);
}
