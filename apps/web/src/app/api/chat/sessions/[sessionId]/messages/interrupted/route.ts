import type { ChatSessionResponse, ModelId } from '@mianshitong/shared';
import { MODEL_OPTIONS } from '@mianshitong/shared';
import { getCurrentChatActor } from '@/lib/server/chat-actor';
import { appendActorInterruptedTurn } from '@/lib/server/chat-session-repository';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isModelId(value: unknown): value is ModelId {
  return MODEL_OPTIONS.some((item) => item.id === value);
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
  const userContent = typeof input.userContent === 'string' ? input.userContent.trim() : '';
  const assistantContent =
    typeof input.assistantContent === 'string' ? input.assistantContent.trim() : '';
  const requestedModelId = isModelId(input.modelId) ? input.modelId : undefined;
  const expectedMessageCount =
    typeof input.expectedMessageCount === 'number' && Number.isFinite(input.expectedMessageCount)
      ? input.expectedMessageCount
      : undefined;
  const userCreatedAt =
    typeof input.userCreatedAt === 'string' && input.userCreatedAt
      ? input.userCreatedAt
      : undefined;
  const assistantCreatedAt =
    typeof input.assistantCreatedAt === 'string' && input.assistantCreatedAt
      ? input.assistantCreatedAt
      : undefined;

  if (!userContent) {
    return Response.json({ message: 'userContent is required' }, { status: 400 });
  }

  const session = await appendActorInterruptedTurn(
    actor.id,
    sessionId,
    {
      userContent,
      assistantContent,
      modelId: requestedModelId,
      expectedMessageCount,
      userCreatedAt,
      assistantCreatedAt,
    },
    actor.authUserId,
  );

  if (!session) {
    return Response.json({ message: 'Session not found' }, { status: 404 });
  }

  const payload: ChatSessionResponse = { session };
  return Response.json(payload);
}
