import type { ChatTurn } from '@mianshitong/llm';
import { unwrapMarkdownFenceWrapper } from '@/lib/chat-markdown-normalization';
import {
  hasCompleteCodeBlock,
  isLikelyCodeLine,
  isLikelyProseLine,
  stripUnbalancedFenceLines,
  unwrapCompleteCodeBlock,
} from './chat-response-fence';
import { detectCodeLanguage, shouldOverrideFenceLanguage } from './chat-response-language';

const CHAT_REPLY_FORMATTING_INSTRUCTION = [
  '你是面试通的 AI 助手。',
  '默认使用 Markdown 输出。',
  '当你返回可执行代码、配置文件、命令行脚本、SQL 或完整代码示例时，必须使用 fenced code block 包裹，并尽量标注语言，例如 ```js。',
  '不要把普通解释性段落误写成代码块；只有代码内容才放进 fenced code block。',
  '如果只是提到变量名、函数名、命令名或短表达式，使用单个反引号作为行内代码。',
].join('\n');

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
  if (
    messages[0]?.role === 'system' &&
    messages[0].content.includes(CHAT_REPLY_FORMATTING_INSTRUCTION)
  ) {
    return messages;
  }

  return [
    {
      role: 'system',
      content: CHAT_REPLY_FORMATTING_INSTRUCTION,
    },
    ...messages,
  ];
}

export function normalizeAssistantMarkdown(content: string): string {
  const trimmed = unwrapMarkdownFenceWrapper(content);
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
