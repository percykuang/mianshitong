import type { PostMessageResponse } from '@mianshitong/shared';
import { sendMessage } from '@/lib/server/chat-store';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const { sessionId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const input = isRecord(body) ? body : {};
  const content = typeof input.content === 'string' ? input.content.trim() : '';

  if (!content) {
    return Response.json({ message: 'content is required' }, { status: 400 });
  }

  const result = sendMessage(sessionId, content);

  if (!result) {
    return Response.json({ message: 'Session not found' }, { status: 404 });
  }

  const payload: PostMessageResponse = result;
  return Response.json(payload);
}
