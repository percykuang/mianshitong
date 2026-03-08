import { MODEL_OPTIONS, type ModelId } from '@mianshitong/shared';
import type { StreamChatProvider } from '@mianshitong/llm';
import { getCurrentUserId } from '@/lib/server/auth-session';
import { normalizeAssistantMarkdown } from '@/lib/server/chat-response-format';
import { appendUserSessionExchange, getUserSession } from '@/lib/server/chat-session-repository';
import { createDraftSession } from '@/lib/server/chat-session-model';
import {
  createStreamProvider,
  formatSseEvent,
  isRecord,
  resolveErrorMessage,
  toChatTurns,
} from './stream-utils';

export const runtime = 'nodejs';

function isModelId(value: unknown): value is ModelId {
  return MODEL_OPTIONS.some((item) => item.id === value);
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
  const requestedModelId = isModelId(input.modelId) ? input.modelId : undefined;

  if (!content) {
    return Response.json({ message: 'content is required' }, { status: 400 });
  }

  const session =
    (await getUserSession(userId, sessionId)) ??
    createDraftSession({ modelId: requestedModelId }, sessionId);

  let provider: StreamChatProvider;
  let model: string;
  try {
    const result = createStreamProvider(session.modelId);
    provider = result.provider;
    model = result.model;
  } catch (error) {
    return Response.json({ message: resolveErrorMessage(error) }, { status: 400 });
  }

  const turns = toChatTurns(session, content);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const run = async () => {
        let assistantText = '';
        let hasError = false;

        try {
          controller.enqueue(formatSseEvent('start', { sessionId }));

          for await (const delta of provider.streamChat({
            messages: turns,
            model,
            signal: request.signal,
          })) {
            assistantText += delta;
            controller.enqueue(formatSseEvent('delta', { delta }));
          }

          const normalizedAssistantText = normalizeAssistantMarkdown(assistantText);
          if (!normalizedAssistantText) {
            throw new Error('模型没有返回可用内容');
          }

          const updatedSession = await appendUserSessionExchange(userId, sessionId, {
            userContent: content,
            assistantContent: normalizedAssistantText,
            modelId: session.modelId,
          });
          if (!updatedSession) {
            throw new Error('会话不存在或已失效');
          }

          controller.enqueue(formatSseEvent('done', { session: updatedSession }));
        } catch (error) {
          hasError = true;
          const normalizedAssistantText = normalizeAssistantMarkdown(assistantText);
          if (normalizedAssistantText) {
            await appendUserSessionExchange(userId, sessionId, {
              userContent: content,
              assistantContent: normalizedAssistantText,
              modelId: session.modelId,
            });
          }
          controller.enqueue(formatSseEvent('error', { message: resolveErrorMessage(error) }));
        } finally {
          controller.enqueue(formatSseEvent('end', { ok: !hasError }));
          controller.close();
        }
      };

      void run();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
