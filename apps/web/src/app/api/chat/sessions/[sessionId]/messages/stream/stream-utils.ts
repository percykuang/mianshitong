import type { ChatSession, ModelId } from '@mianshitong/shared';
import {
  DeepSeekStreamChatProvider,
  OllamaStreamChatProvider,
  type ChatTurn,
  type StreamChatProvider,
} from '@mianshitong/llm';
import { prependChatReplyFormattingInstruction } from '@/lib/server/chat-response-format';

export const encoder = new TextEncoder();

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function toChatTurns(session: ChatSession, nextUserContent: string): ChatTurn[] {
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

  return prependChatReplyFormattingInstruction(history);
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

export function formatSseEvent(type: string, payload: unknown): Uint8Array {
  return encoder.encode(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return '模型调用失败，请稍后重试';
}
