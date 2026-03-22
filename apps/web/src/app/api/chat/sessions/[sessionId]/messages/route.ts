import { processSessionMessage } from '@mianshitong/interview-engine';
import type { PostMessageResponse } from '@mianshitong/shared';
import { getCurrentUserId } from '@/lib/server/auth-session';
import { getUserSession, saveUserSession } from '@/lib/server/chat-session-repository';
import { listActiveQuestionBank } from '@/lib/server/question-bank-repository';
import { resolveQuestionRetriever } from '@/lib/server/question-retriever';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const input = isRecord(body) ? body : {};
  const content = typeof input.content === 'string' ? input.content.trim() : '';

  if (!content) {
    return Response.json({ message: 'content is required' }, { status: 400 });
  }

  const session = await getUserSession(userId, sessionId);
  if (!session) {
    return Response.json({ message: 'Session not found' }, { status: 404 });
  }

  const questionBank = session.status === 'idle' ? await listActiveQuestionBank() : [];
  const retriever = session.status === 'idle' ? await resolveQuestionRetriever(questionBank) : null;

  const result = await processSessionMessage({
    session,
    content,
    questionBank: session.status === 'idle' ? questionBank : undefined,
    questionRetriever: retriever?.questionRetriever,
    retrievalStrategy: retriever?.retrievalStrategy,
  });

  const savedSession = await saveUserSession(userId, result.session);
  if (!savedSession) {
    return Response.json({ message: 'Session not found' }, { status: 404 });
  }

  const payload: PostMessageResponse = {
    session: savedSession,
    assistantMessages: result.assistantMessages,
  };
  return Response.json(payload);
}
