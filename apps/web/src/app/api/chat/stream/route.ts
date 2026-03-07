import type { ChatTurn, StreamChatProvider } from '@mianshitong/llm';
import { MODEL_OPTIONS } from '@mianshitong/shared';
import {
  createStreamProvider,
  formatSseEvent,
  isRecord,
  resolveErrorMessage,
} from '../sessions/[sessionId]/messages/stream/stream-utils';

export const runtime = 'nodejs';

function isModelId(value: unknown): value is (typeof MODEL_OPTIONS)[number]['id'] {
  return MODEL_OPTIONS.some((item) => item.id === value);
}

function isChatTurn(value: unknown): value is ChatTurn {
  if (!isRecord(value)) {
    return false;
  }

  const role = value.role;
  return (
    (role === 'system' || role === 'assistant' || role === 'user') &&
    typeof value.content === 'string'
  );
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const input = isRecord(body) ? body : {};
  const modelId = isModelId(input.modelId) ? input.modelId : 'deepseek-chat';
  const rawMessages = Array.isArray(input.messages) ? input.messages : [];
  const messages = rawMessages.filter(isChatTurn).map((item) => ({
    role: item.role,
    content: item.content.trim(),
  }));

  if (messages.length === 0 || messages.at(-1)?.role !== 'user') {
    return Response.json({ message: 'messages is invalid' }, { status: 400 });
  }

  let provider: StreamChatProvider;
  let model: string;
  try {
    const result = createStreamProvider(modelId);
    provider = result.provider;
    model = result.model;
  } catch (error) {
    return Response.json({ message: resolveErrorMessage(error) }, { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const run = async () => {
        let assistantText = '';
        let hasError = false;

        try {
          controller.enqueue(formatSseEvent('start', { ok: true }));

          for await (const delta of provider.streamChat({
            messages,
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

          controller.enqueue(formatSseEvent('done', { assistantContent: normalizedAssistantText }));
        } catch (error) {
          hasError = true;
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
