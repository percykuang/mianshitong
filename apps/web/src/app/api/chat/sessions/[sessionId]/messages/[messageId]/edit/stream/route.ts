import type { StreamChatProvider } from '@mianshitong/llm';
import {
  appendChatExchange,
  getSession,
  truncateSessionFromUserMessage,
} from '@/lib/server/chat-store';
import {
  createStreamProvider,
  formatSseEvent,
  isRecord,
  resolveErrorMessage,
  toChatTurns,
} from '../../../stream/stream-utils';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string; messageId: string }> },
): Promise<Response> {
  const { sessionId, messageId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const input = isRecord(body) ? body : {};
  const content = typeof input.content === 'string' ? input.content.trim() : '';

  if (!content) {
    return Response.json({ message: 'content is required' }, { status: 400 });
  }

  const currentSession = getSession(sessionId);
  if (!currentSession) {
    return Response.json({ message: 'Session not found' }, { status: 404 });
  }

  const truncatedSession = truncateSessionFromUserMessage(sessionId, messageId);
  if (!truncatedSession) {
    return Response.json({ message: 'User message not found' }, { status: 404 });
  }

  let provider: StreamChatProvider;
  let model: string;
  try {
    const result = createStreamProvider(currentSession.modelId);
    provider = result.provider;
    model = result.model;
  } catch (error) {
    return Response.json({ message: resolveErrorMessage(error) }, { status: 400 });
  }

  const turns = toChatTurns(truncatedSession, content);

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

          const normalizedAssistantText = assistantText.trim();
          if (!normalizedAssistantText) {
            throw new Error('模型没有返回可用内容');
          }

          const updatedSession = appendChatExchange(sessionId, {
            userContent: content,
            assistantContent: normalizedAssistantText,
          });
          if (!updatedSession) {
            throw new Error('会话不存在或已失效');
          }

          controller.enqueue(formatSseEvent('done', { session: updatedSession }));
        } catch (error) {
          hasError = true;
          if (assistantText.trim()) {
            appendChatExchange(sessionId, {
              userContent: content,
              assistantContent: assistantText.trim(),
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
