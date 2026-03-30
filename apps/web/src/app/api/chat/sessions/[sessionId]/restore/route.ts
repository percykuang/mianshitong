import type { ChatSession, ChatSessionResponse } from '@mianshitong/shared';
import { getCurrentChatActor } from '@/lib/server/chat-actor';
import { saveActorSession } from '@/lib/server/chat-session-repository';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isChatSession(value: unknown, sessionId: string): value is ChatSession {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id === sessionId &&
    Array.isArray(value.messages) &&
    typeof value.title === 'string' &&
    typeof value.modelId === 'string' &&
    typeof value.isPrivate === 'boolean' &&
    typeof value.status === 'string' &&
    isRecord(value.config) &&
    isRecord(value.runtime)
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const actor = await getCurrentChatActor({ createGuest: true });
  if (!actor) {
    return Response.json({ message: '无法初始化会话身份' }, { status: 500 });
  }

  const { sessionId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const input = isRecord(body) ? body : {};
  const session = input.session;

  if (!isChatSession(session, sessionId)) {
    return Response.json({ message: '请求参数无效' }, { status: 400 });
  }

  const savedSession = await saveActorSession(actor.id, session);
  if (!savedSession) {
    return Response.json({ message: 'Session not found' }, { status: 404 });
  }

  const payload: ChatSessionResponse = { session: savedSession };
  return Response.json(payload);
}
