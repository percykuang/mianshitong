import type { EmbeddingInput, EmbeddingProvider } from './contracts';

interface OllamaEmbedResponse {
  embeddings?: unknown;
  error?: string;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number');
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  public readonly name = 'ollama-embedding-provider';

  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly dimensions?: number;

  constructor(config?: { baseUrl?: string; model?: string; dimensions?: number }) {
    this.baseUrl = config?.baseUrl ?? 'http://127.0.0.1:11434';
    this.defaultModel = config?.model ?? 'nomic-embed-text';
    this.dimensions = config?.dimensions;
  }

  async embedTexts(input: EmbeddingInput): Promise<number[][]> {
    if (input.texts.length === 0) {
      return [];
    }

    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/embed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.defaultModel,
        input: input.texts,
        ...(this.dimensions ? { dimensions: this.dimensions } : {}),
      }),
      signal: input.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Ollama embedding 请求失败（${response.status}）`);
    }

    const payload = (await response.json()) as OllamaEmbedResponse;
    if (typeof payload.error === 'string' && payload.error) {
      throw new Error(payload.error);
    }

    if (
      !Array.isArray(payload.embeddings) ||
      payload.embeddings.some((item) => !isNumberArray(item))
    ) {
      throw new Error('Ollama embedding 响应格式无效');
    }

    return payload.embeddings;
  }
}
