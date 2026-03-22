import { DeepSeekJsonCompletionProvider } from '@mianshitong/llm';

export function readEnv(name: string): string | undefined {
  if (!('process' in globalThis)) {
    return undefined;
  }

  return (
    globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process?.env?.[name];
}

export function canUseDeepSeekStructuredOutput(): boolean {
  return (
    (readEnv('LLM_PROVIDER') ?? '').trim().toLowerCase() === 'deepseek' &&
    Boolean(readEnv('DEEPSEEK_API_KEY')?.trim())
  );
}

export function createDeepSeekStructuredOutputProvider(
  modelEnvNames: string[],
): DeepSeekJsonCompletionProvider | undefined {
  if (!canUseDeepSeekStructuredOutput()) {
    return undefined;
  }

  const model =
    modelEnvNames.map((name) => readEnv(name)?.trim()).find((value) => Boolean(value)) ??
    'deepseek-chat';

  return new DeepSeekJsonCompletionProvider({
    baseUrl: readEnv('DEEPSEEK_BASE_URL') ?? 'https://api.deepseek.com',
    apiKey: readEnv('DEEPSEEK_API_KEY'),
    model,
  });
}
