import type { ChatTurn } from '@mianshitong/llm';
import { unwrapMarkdownFenceWrapper } from '@/lib/chat-markdown-normalization';
import {
  prependChatReplyFormattingInstruction as prependGeneralChatPolicyInstruction,
  stripMarkdownHorizontalRules,
} from '@/lib/server/chat-general-policy';
import {
  hasCompleteCodeBlock,
  isLikelyCodeLine,
  isLikelyProseLine,
  stripUnbalancedFenceLines,
  unwrapCompleteCodeBlock,
} from './chat-response-fence';
import { detectCodeLanguage, shouldOverrideFenceLanguage } from './chat-response-language';

function normalizeCompleteCodeBlockLanguage(content: string): string {
  const unwrapped = unwrapCompleteCodeBlock(content);
  if (!unwrapped) {
    return content;
  }

  const detectedLanguage = detectCodeLanguage(unwrapped.code);
  if (!shouldOverrideFenceLanguage(unwrapped.language, detectedLanguage)) {
    return content;
  }

  return ['```' + detectedLanguage, unwrapped.code, '```'].join('\n');
}

export function prependChatReplyFormattingInstruction(messages: ChatTurn[]): ChatTurn[] {
  return prependGeneralChatPolicyInstruction(messages);
}

export function normalizeAssistantMarkdown(content: string): string {
  const trimmed = stripMarkdownHorizontalRules(unwrapMarkdownFenceWrapper(content));
  if (!trimmed) {
    return trimmed;
  }

  if (hasCompleteCodeBlock(trimmed)) {
    return normalizeCompleteCodeBlockLanguage(trimmed);
  }

  const normalizedFenceResult = stripUnbalancedFenceLines(trimmed);
  const normalizedContent = normalizedFenceResult.content;
  if (!normalizedContent) {
    return '';
  }

  const nonEmptyLines = normalizedContent
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  if (nonEmptyLines.length < 3) {
    return normalizedContent;
  }

  const codeLineCount = nonEmptyLines.filter((line) => isLikelyCodeLine(line.trim())).length;
  const proseLineCount = nonEmptyLines.filter((line) => isLikelyProseLine(line.trim())).length;
  const codeRatio = codeLineCount / nonEmptyLines.length;

  if (codeRatio < 0.75 || proseLineCount > 1) {
    return normalizedContent;
  }

  const language = normalizedFenceResult.hintedLanguage ?? detectCodeLanguage(normalizedContent);
  return ['```' + language, normalizedContent, '```'].join('\n');
}
