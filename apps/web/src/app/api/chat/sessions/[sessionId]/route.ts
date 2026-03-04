import type { ChatSessionResponse } from '@mianshitong/shared';
import { getSession } from '@/lib/server/chat-store';

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const { sessionId } = await context.params;
  const session = getSession(sessionId);

  if (!session) {
    return Response.json({ message: 'Session not found' }, { status: 404 });
  }

  const payload: ChatSessionResponse = { session };
  return Response.json(payload);
}
