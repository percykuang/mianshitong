const SYSTEM_WELCOME =
  '你好，我是面试通 AI 面试官。你可以直接说“开始模拟面试”，或先让我帮你优化简历/拆解面试题。';

export function isSystemMessage(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as { role?: unknown; kind?: unknown; content?: unknown };
  if (record.role === 'system' || record.kind === 'system') {
    return true;
  }

  return typeof record.content === 'string' && record.content === SYSTEM_WELCOME;
}

export function countVisibleMessages(value: unknown): number {
  if (!Array.isArray(value)) {
    return 0;
  }

  return value.filter((item) => !isSystemMessage(item)).length;
}
