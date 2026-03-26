import type { ChatSession, ModelId } from '@mianshitong/shared';
import {
  DeepSeekStreamChatProvider,
  OllamaStreamChatProvider,
  type ChatTurn,
  type StreamChatInput,
  type StreamChatProvider,
} from '@mianshitong/llm';
import type { GeneralChatIntent } from '@/lib/server/chat-general-policy';
import { prependGeneralChatIntentInstruction } from '@/lib/server/chat-general-policy';
import { prependChatReplyFormattingInstruction } from '@/lib/server/chat-response-format';

export const encoder = new TextEncoder();
const SHORTCUT_STREAM_MIN_DURATION_MS = 320;
const SHORTCUT_STREAM_MAX_DURATION_MS = 960;
const SHORTCUT_STREAM_MIN_DELAY_MS = 14;
const SHORTCUT_STREAM_MAX_CHUNK_LENGTH = 18;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function toChatTurns(
  session: ChatSession,
  nextUserContent: string,
  intent: GeneralChatIntent | null = null,
): ChatTurn[] {
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

  return prependChatReplyFormattingInstruction(
    prependGeneralChatIntentInstruction(history, intent),
  );
}

class MockStreamChatProvider implements StreamChatProvider {
  public readonly name = 'mock-stream-provider';

  async *streamChat(input: StreamChatInput): AsyncGenerator<string> {
    const lastUserMessage =
      [...input.messages]
        .reverse()
        .find((message) => message.role === 'user')
        ?.content.trim() ?? '';
    const prefix = process.env.MOCK_STREAM_CHAT_PREFIX?.trim() || '[mock-stream]';
    const reply = `${prefix} 已按真实模型链路处理：${lastUserMessage || '空消息'}`;

    for (const delta of splitShortcutReplyIntoDeltas(reply)) {
      if (input.signal?.aborted) {
        throw createAbortError();
      }

      yield delta;
      await wait(18, input.signal);
    }
  }
}

function resolveOllamaModel(modelId: ModelId): string {
  const chatModel = process.env.OLLAMA_MODEL ?? 'deepseek-r1:8b';
  const reasonerModel = process.env.OLLAMA_REASONER_MODEL ?? process.env.OLLAMA_MODEL ?? chatModel;
  return modelId === 'deepseek-reasoner' ? reasonerModel : chatModel;
}

function resolveDeepSeekModel(modelId: ModelId): string {
  const chatModel = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
  const reasonerModel =
    process.env.DEEPSEEK_REASONER_MODEL ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-reasoner';
  return modelId === 'deepseek-reasoner' ? reasonerModel : chatModel;
}

export function createStreamProvider(modelId: ModelId): {
  provider: StreamChatProvider;
  model: string;
} {
  const llmProvider = (process.env.LLM_PROVIDER ?? 'ollama').toLowerCase();

  if (llmProvider === 'mock') {
    return {
      provider: new MockStreamChatProvider(),
      model: 'mock-stream-model',
    };
  }

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

  throw new Error(`不支持的 LLM_PROVIDER: ${llmProvider}，可选值为 ollama、deepseek 或 mock`);
}

export function formatSseEvent(type: string, payload: unknown): Uint8Array {
  return encoder.encode(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function createAbortError(): Error {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', handleAbort);
    };

    const handleAbort = () => {
      cleanup();
      reject(createAbortError());
    };

    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

export function splitShortcutReplyIntoDeltas(content: string): string[] {
  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    if (!current) {
      return;
    }

    chunks.push(current);
    current = '';
  };

  for (const char of Array.from(content)) {
    current += char;

    const shouldFlush =
      char === '\n' ||
      /[，。！？；：]/.test(char) ||
      current.length >= SHORTCUT_STREAM_MAX_CHUNK_LENGTH;

    if (shouldFlush) {
      flush();
    }
  }

  flush();

  return chunks.filter((chunk) => chunk.length > 0);
}

export async function emitShortcutReplyAsStream(input: {
  controller: ReadableStreamDefaultController<Uint8Array>;
  content: string;
  signal?: AbortSignal;
}): Promise<string> {
  const deltas = splitShortcutReplyIntoDeltas(input.content);
  if (deltas.length === 0) {
    return '';
  }

  const targetDuration = Math.min(
    SHORTCUT_STREAM_MAX_DURATION_MS,
    Math.max(SHORTCUT_STREAM_MIN_DURATION_MS, deltas.length * 36),
  );
  const delayMs =
    deltas.length > 1
      ? Math.max(SHORTCUT_STREAM_MIN_DELAY_MS, Math.round(targetDuration / deltas.length))
      : 0;

  let emitted = '';

  for (let index = 0; index < deltas.length; index += 1) {
    if (input.signal?.aborted) {
      throw createAbortError();
    }

    const delta = deltas[index]!;
    emitted += delta;
    input.controller.enqueue(formatSseEvent('delta', { delta }));

    if (index < deltas.length - 1) {
      await wait(delayMs, input.signal);
    }
  }

  return emitted;
}

export function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return '模型调用失败，请稍后重试';
}
