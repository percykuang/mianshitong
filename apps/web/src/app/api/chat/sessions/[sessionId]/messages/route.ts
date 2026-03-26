import { processSessionMessage } from '@mianshitong/interview-engine';
import type { PostMessageResponse } from '@mianshitong/shared';
import { getCurrentChatActor } from '@/lib/server/chat-actor';
import {
  consumeChatUsage,
  getChatUsageLimitMessage,
  rollbackChatUsage,
} from '@/lib/server/chat-usage';
import { getActorSession, saveActorSession } from '@/lib/server/chat-session-repository';
import { listActiveQuestionBank } from '@/lib/server/question-bank-repository';
import { resolveQuestionRetriever } from '@/lib/server/question-retriever';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
  const content = typeof input.content === 'string' ? input.content.trim() : '';

  if (!content) {
    return Response.json({ message: 'content is required' }, { status: 400 });
  }

  const session = await getActorSession(actor.id, sessionId);
  if (!session) {
    return Response.json({ message: 'Session not found' }, { status: 404 });
  }

  const usage = await consumeChatUsage({
    actorId: actor.id,
    actorType: actor.type,
  });
  if (!usage.allowed) {
    return Response.json({ message: getChatUsageLimitMessage(actor.type) }, { status: 429 });
  }

  try {
    const questionBank = session.status === 'idle' ? await listActiveQuestionBank() : [];
    const retriever =
      session.status === 'idle' ? await resolveQuestionRetriever(questionBank) : null;

    const result = await processSessionMessage({
      session,
      content,
      questionBank: session.status === 'idle' ? questionBank : undefined,
      questionRetriever: retriever?.questionRetriever,
      retrievalStrategy: retriever?.retrievalStrategy,
    });

    const savedSession = await saveActorSession(actor.id, result.session);
    if (!savedSession) {
      await rollbackChatUsage({
        actorId: actor.id,
        actorType: actor.type,
      });
      return Response.json({ message: 'Session not found' }, { status: 404 });
    }

    const payload: PostMessageResponse = {
      session: savedSession,
      assistantMessages: result.assistantMessages,
    };
    return Response.json(payload);
  } catch (error) {
    await rollbackChatUsage({
      actorId: actor.id,
      actorType: actor.type,
    });
    return Response.json(
      { message: error instanceof Error ? error.message : '发送失败，请稍后重试' },
      { status: 500 },
    );
  }
}
