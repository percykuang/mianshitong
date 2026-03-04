import type { StreamChatInput, StreamChatProvider } from './contracts';

interface OllamaStreamChunk {
  done?: boolean;
  message?: {
    content?: string;
  };
  response?: string;
  error?: string;
}

function resolveOllamaChunkText(chunk: OllamaStreamChunk): string {
  if (typeof chunk.message?.content === 'string') {
    return chunk.message.content;
  }

  if (typeof chunk.response === 'string') {
    return chunk.response;
  }

  return '';
}

export class OllamaStreamChatProvider implements StreamChatProvider {
  public readonly name = 'ollama-stream-provider';

  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(config?: { baseUrl?: string; model?: string }) {
    this.baseUrl = config?.baseUrl ?? 'http://127.0.0.1:11434';
    this.defaultModel = config?.model ?? 'llama3.2:latest';
  }

  async *streamChat(input: StreamChatInput): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: input.model ?? this.defaultModel,
        messages: input.messages,
        stream: true,
      }),
      signal: input.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Ollama 请求失败（${response.status}）`);
    }

    if (!response.body) {
      throw new Error('Ollama 流式响应为空');
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
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
          continue;
        }

        const chunk = JSON.parse(line) as OllamaStreamChunk;
        if (typeof chunk.error === 'string' && chunk.error) {
          throw new Error(chunk.error);
        }

        const content = resolveOllamaChunkText(chunk);
        if (content) {
          yield content;
        }

        if (chunk.done) {
          return;
        }
      }
    }

    const tail = `${buffer}${decoder.decode()}`.trim();
    if (!tail) {
      return;
    }

    for (const rawLine of tail.split('\n')) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      const chunk = JSON.parse(line) as OllamaStreamChunk;
      if (typeof chunk.error === 'string' && chunk.error) {
        throw new Error(chunk.error);
      }

      const content = resolveOllamaChunkText(chunk);
      if (content) {
        yield content;
      }
    }
  }
}
