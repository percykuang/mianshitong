import type { JsonCompletionInput, JsonCompletionProvider } from './contracts';
import { resolveDeepSeekEndpoint } from './deepseek-utils';

interface DeepSeekJsonResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
    finish_reason?: string | null;
  }>;
  error?: {
    message?: string;
  };
}

export class DeepSeekJsonCompletionProvider implements JsonCompletionProvider {
  public readonly name = 'deepseek-json-provider';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(config: { baseUrl?: string; apiKey?: string; model?: string }) {
    this.baseUrl = config.baseUrl ?? 'https://api.deepseek.com';
    this.apiKey = config.apiKey?.trim() ?? '';
    this.defaultModel = config.model ?? 'deepseek-chat';
  }

  async completeJson(input: JsonCompletionInput): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error('缺少 DEEPSEEK_API_KEY，无法调用 DeepSeek 结构化输出接口');
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
        stream: false,
        response_format: { type: 'json_object' },
        ...(typeof input.maxTokens === 'number' ? { max_tokens: input.maxTokens } : {}),
        ...(typeof input.temperature === 'number' ? { temperature: input.temperature } : {}),
      }),
      signal: input.signal,
    });

    const rawText = (await response.text()).trim();
    if (!response.ok) {
      throw new Error(rawText || `DeepSeek JSON 请求失败（${response.status}）`);
    }

    if (!rawText) {
      throw new Error('DeepSeek JSON 响应为空');
    }

    const payload = JSON.parse(rawText) as DeepSeekJsonResponse;
    if (payload.error?.message) {
      throw new Error(payload.error.message);
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('DeepSeek JSON 输出为空');
    }

    return JSON.parse(content);
  }
}
