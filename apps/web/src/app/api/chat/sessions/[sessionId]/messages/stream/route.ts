import { processSessionMessage, shouldStartInterview } from '@mianshitong/interview-engine';
import { MODEL_OPTIONS, type ModelId } from '@mianshitong/shared';
import type { StreamChatProvider } from '@mianshitong/llm';
import { getCurrentChatActor } from '@/lib/server/chat-actor';
import {
  buildGeneralChatFallbackReply,
  resolveGeneralChatIntent,
} from '@/lib/server/chat-general-policy';
import { normalizeAssistantMarkdown } from '@/lib/server/chat-response-format';
import { createDraftSession } from '@/lib/server/chat-session-model';
import {
  appendActorSessionExchange,
  getActorSession,
  saveOrCreateActorSession,
} from '@/lib/server/chat-session-repository';
import {
  consumeChatUsage,
  getChatUsageLimitMessage,
  rollbackChatUsage,
} from '@/lib/server/chat-usage';
import { listActiveQuestionBank } from '@/lib/server/question-bank-repository';
import { resolveQuestionRetriever } from '@/lib/server/question-retriever';
import {
  createStreamProvider,
  emitShortcutReplyAsStream,
  formatSseEvent,
  isRecord,
  resolveErrorMessage,
  toChatTurns,
} from './stream-utils';

export const runtime = 'nodejs';

function isModelId(value: unknown): value is ModelId {
  return MODEL_OPTIONS.some((item) => item.id === value);
}

function createUsageExceededResponse(actorType: 'guest' | 'registered'): Response {
  return new Response(getChatUsageLimitMessage(actorType), {
    status: 429,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const actor = await getCurrentChatActor({ createGuest: true });
  if (!actor) {
    return new Response('无法初始化会话身份', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
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
    (await getActorSession(actor.id, sessionId)) ??
    createDraftSession({ modelId: requestedModelId }, sessionId);
  const shouldUseInterviewEngine = session.status !== 'idle' || shouldStartInterview(content);
  const generalChatIntent = !shouldUseInterviewEngine
    ? resolveGeneralChatIntent({
        content,
        userMessageCount: session.messages.filter((message) => message.role === 'user').length,
      })
    : null;
  const fallbackAssistantText = generalChatIntent
    ? normalizeAssistantMarkdown(buildGeneralChatFallbackReply(generalChatIntent))
    : '';

  let provider: StreamChatProvider | null = null;
  let model: string | null = null;

  if (!shouldUseInterviewEngine) {
    try {
      const result = createStreamProvider(session.modelId);
      provider = result.provider;
      model = result.model;
    } catch (error) {
      if (!fallbackAssistantText) {
        return new Response(resolveErrorMessage(error), {
          status: 400,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    }
  }

  const usage = await consumeChatUsage({
    actorId: actor.id,
    actorType: actor.type,
  });
  if (!usage.allowed) {
    return createUsageExceededResponse(actor.type);
  }

  if (shouldUseInterviewEngine) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const run = async () => {
          let hasError = false;
          let shouldRollback = true;

          try {
            controller.enqueue(formatSseEvent('start', { sessionId }));

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
            const updatedSession = await saveOrCreateActorSession(
              actor.id,
              result.session,
              actor.authUserId,
            );
            if (!updatedSession) {
              throw new Error('会话不存在或已失效');
            }

            shouldRollback = false;
            controller.enqueue(formatSseEvent('done', { session: updatedSession }));
          } catch (error) {
            hasError = true;
            if (shouldRollback) {
              await rollbackChatUsage({
                actorId: actor.id,
                actorType: actor.type,
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

  const turns = toChatTurns(session, content, generalChatIntent);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const run = async () => {
        let assistantText = '';
        let hasError = false;

        try {
          controller.enqueue(formatSseEvent('start', { sessionId }));

          for await (const delta of provider!.streamChat({
            messages: turns,
            model: model!,
            signal: request.signal,
          })) {
            assistantText += delta;
            controller.enqueue(formatSseEvent('delta', { delta }));
          }

          const normalizedAssistantText = normalizeAssistantMarkdown(assistantText);
          if (!normalizedAssistantText) {
            throw new Error('模型没有返回可用内容');
          }

          const updatedSession = await appendActorSessionExchange(
            actor.id,
            sessionId,
            {
              userContent: content,
              assistantContent: normalizedAssistantText,
              modelId: session.modelId,
            },
            actor.authUserId,
          );
          if (!updatedSession) {
            throw new Error('会话不存在或已失效');
          }

          controller.enqueue(formatSseEvent('done', { session: updatedSession }));
        } catch (error) {
          const normalizedAssistantText = normalizeAssistantMarkdown(assistantText);
          if (normalizedAssistantText) {
            hasError = true;
            await appendActorSessionExchange(
              actor.id,
              sessionId,
              {
                userContent: content,
                assistantContent: normalizedAssistantText,
                modelId: session.modelId,
              },
              actor.authUserId,
            );
            controller.enqueue(formatSseEvent('error', { message: resolveErrorMessage(error) }));
          } else if (fallbackAssistantText) {
            const streamedFallbackText = await emitShortcutReplyAsStream({
              controller,
              content: fallbackAssistantText,
              signal: request.signal,
            });
            const updatedSession = await appendActorSessionExchange(
              actor.id,
              sessionId,
              {
                userContent: content,
                assistantContent: streamedFallbackText,
                modelId: session.modelId,
              },
              actor.authUserId,
            );
            if (!updatedSession) {
              throw new Error('会话不存在或已失效');
            }
            controller.enqueue(formatSseEvent('done', { session: updatedSession }));
          } else {
            hasError = true;
            await rollbackChatUsage({
              actorId: actor.id,
              actorType: actor.type,
            });
            controller.enqueue(formatSseEvent('error', { message: resolveErrorMessage(error) }));
          }
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
