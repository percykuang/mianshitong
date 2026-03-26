import type { ChatMessageFeedback, ChatSessionResponse } from '@mianshitong/shared';
import { getCurrentChatActor } from '@/lib/server/chat-actor';
import { setActorMessageFeedback } from '@/lib/server/chat-message-feedback-repository';

function isFeedback(value: unknown): value is ChatMessageFeedback | null {
  return value === 'like' || value === 'dislike' || value === null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string; messageId: string }> },
): Promise<Response> {
  const actor = await getCurrentChatActor({ createGuest: true });
  if (!actor) {
    return Response.json({ message: '无法初始化会话身份' }, { status: 500 });
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
  const session = await setActorMessageFeedback(actor.id, sessionId, messageId, feedback);

  if (!session) {
    return Response.json({ message: 'Session or message not found' }, { status: 404 });
  }

  const payload: ChatSessionResponse = { session };
  return Response.json(payload);
}
