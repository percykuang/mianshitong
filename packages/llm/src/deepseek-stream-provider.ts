import type { StreamChatInput, StreamChatProvider } from './contracts';

interface DeepSeekStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string;
    };
    finish_reason?: string | null;
  }>;
  error?: {
    message?: string;
  };
}

function resolveDeepSeekEndpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, '');
  if (normalized.endsWith('/chat/completions')) {
    return normalized;
  }

  if (normalized.endsWith('/v1')) {
    return `${normalized}/chat/completions`;
  }

  return `${normalized}/v1/chat/completions`;
}

function extractSseData(rawEvent: string): string {
  const payloadLines: string[] = [];

  for (const line of rawEvent.split('\n')) {
    const trimmed = line.trimEnd();
    if (!trimmed || !trimmed.startsWith('data:')) {
      continue;
    }
    payloadLines.push(trimmed.slice(5).trimStart());
  }

  return payloadLines.join('\n').trim();
}

export class DeepSeekStreamChatProvider implements StreamChatProvider {
  public readonly name = 'deepseek-stream-provider';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(config: { baseUrl?: string; apiKey?: string; model?: string }) {
    this.baseUrl = config.baseUrl ?? 'https://api.deepseek.com';
    this.apiKey = config.apiKey?.trim() ?? '';
    this.defaultModel = config.model ?? 'deepseek-chat';
  }

  async *streamChat(input: StreamChatInput): AsyncGenerator<string> {
    if (!this.apiKey) {
      throw new Error('缺少 DEEPSEEK_API_KEY，无法调用 DeepSeek 付费 API');
    }

    const response = await fetch(resolveDeepSeekEndpoint(this.baseUrl), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model ?? this.defaultModel,
        messages: input.messages,
        stream: true,
      }),
      signal: input.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `DeepSeek 请求失败（${response.status}）`);
    }

    if (!response.body) {
      throw new Error('DeepSeek 流式响应为空');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const boundaryIndex = buffer.indexOf('\n\n');
        if (boundaryIndex < 0) {
          break;
        }

        const rawEvent = buffer.slice(0, boundaryIndex);
        buffer = buffer.slice(boundaryIndex + 2);
        const data = extractSseData(rawEvent);
        if (!data) {
          continue;
        }

        if (data === '[DONE]') {
          return;
        }

        const chunk = JSON.parse(data) as DeepSeekStreamChunk;
        if (chunk.error?.message) {
          throw new Error(chunk.error.message);
        }

        const choice = chunk.choices?.[0];
        const delta = choice?.delta?.content ?? '';
        if (delta) {
          yield delta;
        }

        if (choice?.finish_reason) {
          return;
        }
      }
    }

    const tail = `${buffer}${decoder.decode()}`.trim();
    if (!tail) {
      return;
    }

    const data = extractSseData(tail);
    if (!data || data === '[DONE]') {
      return;
    }

    const chunk = JSON.parse(data) as DeepSeekStreamChunk;
    if (chunk.error?.message) {
      throw new Error(chunk.error.message);
    }

    const delta = chunk.choices?.[0]?.delta?.content ?? '';
    if (delta) {
      yield delta;
    }
  }
}
