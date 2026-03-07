import type { ChatSessionResponse } from '@mianshitong/shared';
import { getCurrentUserId } from '@/lib/server/auth-session';
import { deleteUserSession, getUserSession } from '@/lib/server/chat-session-repository';

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const session = await getUserSession(userId, sessionId);

  if (!session) {
    return Response.json({ message: 'Session not found' }, { status: 404 });
  }

  const payload: ChatSessionResponse = { session };
  return Response.json(payload);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const deleted = await deleteUserSession(userId, sessionId);
  if (!deleted) {
    return Response.json({ message: 'Session not found' }, { status: 404 });
  }

  return Response.json({ ok: true });
}
