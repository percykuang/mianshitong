import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepSeekJsonCompletionProvider } from './deepseek-json-provider';

describe('DeepSeekJsonCompletionProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests json output and parses the structured payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  seniority: 'mid',
                  primaryTags: [{ tag: 'react', weight: 0.9 }],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new DeepSeekJsonCompletionProvider({
      apiKey: 'test-key',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
    });

    const result = await provider.completeJson({
      messages: [{ role: 'system', content: '只返回 json' }],
      maxTokens: 256,
      temperature: 0.1,
    });

    expect(result).toEqual({
      seniority: 'mid',
      primaryTags: [{ tag: 'react', weight: 0.9 }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.deepseek.com/v1/chat/completions');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        authorization: 'Bearer test-key',
        'content-type': 'application/json',
      }),
    });

    const body = JSON.parse(String(init?.body)) as {
      response_format?: { type?: string };
      max_tokens?: number;
      temperature?: number;
    };
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.max_tokens).toBe(256);
    expect(body.temperature).toBe(0.1);
  });

  it('throws when the model content is not valid json', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'not-json' } }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    const provider = new DeepSeekJsonCompletionProvider({
      apiKey: 'test-key',
    });

    await expect(
      provider.completeJson({
        messages: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toThrow(SyntaxError);
  });
});
