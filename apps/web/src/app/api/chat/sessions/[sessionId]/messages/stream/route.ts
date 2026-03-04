import type { ChatSession, ModelId } from '@mianshitong/shared';
import {
  DeepSeekStreamChatProvider,
  OllamaStreamChatProvider,
  type ChatTurn,
  type StreamChatProvider,
} from '@mianshitong/llm';
import { appendChatExchange, getSession } from '@/lib/server/chat-store';

export const runtime = 'nodejs';

const encoder = new TextEncoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toChatTurns(session: ChatSession, nextUserContent: string): ChatTurn[] {
  const history: ChatTurn[] = session.messages
    .filter((message) => message.kind !== 'report')
    .map((message) => ({
      role: message.role === 'system' ? 'system' : message.role,
      content: message.content,
    }));

  history.push({
    role: 'user',
    content: nextUserContent,
  });

  return history;
}

function resolveOllamaModel(modelId: ModelId): string {
  const chatModel = process.env.OLLAMA_MODEL ?? 'llama3.2:latest';
  const reasonerModel = process.env.OLLAMA_REASONER_MODEL ?? process.env.OLLAMA_MODEL ?? chatModel;
  return modelId === 'deepseek-reasoner' ? reasonerModel : chatModel;
}

function resolveDeepSeekModel(modelId: ModelId): string {
  const chatModel = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
  const reasonerModel =
    process.env.DEEPSEEK_REASONER_MODEL ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-reasoner';
  return modelId === 'deepseek-reasoner' ? reasonerModel : chatModel;
}

function createStreamProvider(modelId: ModelId): {
  provider: StreamChatProvider;
  model: string;
} {
  const llmProvider = (process.env.LLM_PROVIDER ?? 'ollama').toLowerCase();

  if (llmProvider === 'deepseek') {
    const model = resolveDeepSeekModel(modelId);
    return {
      provider: new DeepSeekStreamChatProvider({
        baseUrl: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
        apiKey: process.env.DEEPSEEK_API_KEY,
        model,
      }),
      model,
    };
  }

  if (llmProvider === 'ollama') {
    const model = resolveOllamaModel(modelId);
    return {
      provider: new OllamaStreamChatProvider({
        baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
        model,
      }),
      model,
    };
  }

  throw new Error(`不支持的 LLM_PROVIDER: ${llmProvider}，可选值为 ollama 或 deepseek`);
}

function formatSseEvent(type: string, payload: unknown): Uint8Array {
  return encoder.encode(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return '模型调用失败，请稍后重试';
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

  const session = getSession(sessionId);
  if (!session) {
    return Response.json({ message: 'Session not found' }, { status: 404 });
  }

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
