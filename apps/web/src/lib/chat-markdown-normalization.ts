const COMPLETE_FENCE_PATTERN = /^```([\w-]*)\n([\s\S]*?)\n```$/;
const MARKDOWN_WRAPPER_LANGUAGES = new Set(['markdown', 'md']);
const MARKDOWN_CONTENT_PATTERN = /(^|\n)(?:```[\w-]*\s*$|#{1,6}\s|[-*+]\s|\d+\.\s|>\s|\|.+\|)/m;

export function unwrapMarkdownFenceWrapper(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) {
    return trimmed;
  }

  const match = COMPLETE_FENCE_PATTERN.exec(trimmed);
  if (!match) {
    return trimmed;
  }

  const language = match[1].toLowerCase();
  if (!MARKDOWN_WRAPPER_LANGUAGES.has(language)) {
    return trimmed;
  }

  const innerContent = match[2].trim();
  if (!innerContent) {
    return '';
  }

  if (!MARKDOWN_CONTENT_PATTERN.test(innerContent) && !/`[^`]+`/.test(innerContent)) {
    return trimmed;
  }

  return innerContent;
}
