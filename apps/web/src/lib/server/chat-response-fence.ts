const CODE_BLOCK_PATTERN = /```[\s\S]*?```/;
const COMPLETE_FENCE_PATTERN = /^```([\w-]*)\n([\s\S]*?)\n```$/;
const FENCE_LINE_PATTERN = /^\s*```([\w-]+)?\s*$/;
const CODE_LINE_PATTERN =
  /^\s*(?:#!\/|[{}()[\],.;]|[\w.$\[\]]+\s*(?::|[-+*/%]?=)\s*.+|(?:const|let|var|function|return|for|while|if|else|switch|case|break|continue|class|import|export|from|try|catch|finally|new|await|async|def|print|SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|interface|type|enum|extends|implements)\b|(?:console|Math|JSON|Array|Object|Promise)\.|\/\/|\/\*|\*\/|#include|<\/?[A-Za-z][^>]*>|\.\w+\(|\w+\([^)]*\)\s*\{|[-+*/%<>!=]=?|=>|(?:echo|cd|ls|cat|grep|find|mkdir|rm|cp|mv|chmod|chown|sed|awk|curl|wget|pnpm|npm|yarn|bun|node|git|docker|kubectl)\b|[.#]?[A-Za-z_-][\w-]*\s*\{|[A-Za-z_-][\w-]*:\s*.+|-[ ]+[A-Za-z_-][\w-]*:?.*)/;
const PROSE_LINE_PATTERN = /[，。！？；：]/;

export function hasCompleteCodeBlock(content: string): boolean {
  return CODE_BLOCK_PATTERN.test(content);
}

export function unwrapCompleteCodeBlock(content: string): {
  language: string;
  code: string;
} | null {
  const match = COMPLETE_FENCE_PATTERN.exec(content.trim());
  if (!match) {
    return null;
  }

  return {
    language: match[1].toLowerCase(),
    code: match[2].trimEnd(),
  };
}

export function isLikelyProseLine(line: string): boolean {
  if (!line) {
    return false;
  }

  if (/^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
    return true;
  }

  return PROSE_LINE_PATTERN.test(line) && !CODE_LINE_PATTERN.test(line);
}

export function isLikelyCodeLine(line: string): boolean {
  if (!line || /^```/.test(line)) {
    return false;
  }

  return CODE_LINE_PATTERN.test(line);
}

export function stripUnbalancedFenceLines(content: string): {
  content: string;
  hintedLanguage: string | null;
} {
  const lines = content.split('\n');
  let fenceCount = 0;
  let hintedLanguage: string | null = null;

  for (const line of lines) {
    const match = FENCE_LINE_PATTERN.exec(line.trim());
    if (!match) {
      continue;
    }

    fenceCount += 1;
    if (!hintedLanguage && match[1]) {
      hintedLanguage = match[1].toLowerCase();
    }
  }

  if (fenceCount === 0 || fenceCount % 2 === 0) {
    return {
      content: content.trim(),
      hintedLanguage: null,
    };
  }

  return {
    content: lines
      .filter((line) => !FENCE_LINE_PATTERN.test(line.trim()))
      .join('\n')
      .trim(),
    hintedLanguage,
  };
}
