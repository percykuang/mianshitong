import { processSessionMessage, shouldStartInterview } from '@mianshitong/interview-engine';
import type { ChatTurn, StreamChatProvider } from '@mianshitong/llm';
import { MODEL_OPTIONS, type ChatSession } from '@mianshitong/shared';
import {
  normalizeAssistantMarkdown,
  prependChatReplyFormattingInstruction,
} from '@/lib/server/chat-response-format';
import { listActiveQuestionBank } from '@/lib/server/question-bank-repository';
import { resolveQuestionRetriever } from '@/lib/server/question-retriever';
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

function isChatSession(value: unknown): value is ChatSession {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.status === 'string' &&
    Array.isArray(value.messages) &&
    isRecord(value.runtime) &&
    isRecord(value.config)
  );
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const input = isRecord(body) ? body : {};
  const modelId = isModelId(input.modelId) ? input.modelId : 'deepseek-chat';
  const rawMessages = Array.isArray(input.messages) ? input.messages : [];
  const localSession = isChatSession(input.session) ? input.session : null;
  const messages = prependChatReplyFormattingInstruction(
    rawMessages.filter(isChatTurn).map((item) => ({
      role: item.role,
      content: item.content.trim(),
    })),
  );

  if (messages.length === 0 || messages.at(-1)?.role !== 'user') {
    return Response.json({ message: 'messages is invalid' }, { status: 400 });
  }

  const latestUserContent = messages.at(-1)?.content.trim() ?? '';
  const shouldUseInterviewEngine =
    localSession !== null &&
    latestUserContent &&
    (localSession.status !== 'idle' || shouldStartInterview(latestUserContent));

  if (shouldUseInterviewEngine && localSession) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const run = async () => {
          let hasError = false;

          try {
            controller.enqueue(formatSseEvent('start', { ok: true }));

            const questionBank =
              localSession.status === 'idle' ? await listActiveQuestionBank() : [];
            const retriever =
              localSession.status === 'idle' ? await resolveQuestionRetriever(questionBank) : null;

            const result = await processSessionMessage({
              session: localSession,
              content: latestUserContent,
              questionBank: localSession.status === 'idle' ? questionBank : undefined,
              questionRetriever: retriever?.questionRetriever,
              retrievalStrategy: retriever?.retrievalStrategy,
            });

            controller.enqueue(formatSseEvent('done', { session: result.session }));
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

          const normalizedAssistantText = normalizeAssistantMarkdown(assistantText);
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
