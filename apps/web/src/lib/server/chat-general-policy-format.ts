import { HORIZONTAL_RULE_PATTERN } from './chat-general-policy.constants';

export function stripMarkdownHorizontalRules(content: string): string {
  const lines = content.split('\n');
  let inFence = false;
  const cleaned: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      cleaned.push(line);
      continue;
    }

    if (!inFence && HORIZONTAL_RULE_PATTERN.test(trimmed)) {
      continue;
    }

    cleaned.push(line);
  }

  return cleaned
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
