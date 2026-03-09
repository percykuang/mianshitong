const GENERIC_FENCE_LANGUAGES = new Set([
  '',
  'text',
  'txt',
  'plain',
  'plaintext',
  'markdown',
  'md',
]);

function canParseJson(content: string): boolean {
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

function isYamlLike(content: string): boolean {
  const nonEmptyLines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (nonEmptyLines.length < 2) {
    return false;
  }

  const yamlLikeLines = nonEmptyLines.filter(
    (line) =>
      /^([A-Za-z_][\w-]*):(?:\s+.+)?$/.test(line) ||
      /^-\s+[A-Za-z_][\w-]*(?::\s*.+)?$/.test(line) ||
      /^\w[\w-]*:\s*$/.test(line),
  ).length;

  return yamlLikeLines / nonEmptyLines.length >= 0.7;
}

function isTsLike(content: string): boolean {
  return (
    /(^|\n)\s*(?:interface|type|enum)\b/.test(content) ||
    /:\s*[A-Z][\w<>, \[\]|?]+/m.test(content) ||
    /\bimplements\b|\breadonly\b|\bas const\b|<\w+>\(/.test(content)
  );
}

function isJsxLike(content: string): boolean {
  return /<([A-Z][A-Za-z0-9]*|div|span|button|input|section|main|article|header|footer)(\s|>)/.test(
    content,
  );
}

export function isGenericFenceLanguage(language: string): boolean {
  return GENERIC_FENCE_LANGUAGES.has(language);
}

export function detectCodeLanguage(content: string): string {
  if (/^\s*</m.test(content)) {
    if (/<template|<script|<style/m.test(content)) {
      return 'vue';
    }

    if (/<svg|<path|<circle|<rect/m.test(content)) {
      return 'html';
    }

    if (isJsxLike(content)) {
      return isTsLike(content) ? 'tsx' : 'jsx';
    }

    return 'html';
  }

  if (/^\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\b/im.test(content)) {
    return 'sql';
  }

  if (
    /^\s*#!/m.test(content) ||
    /^\s*(?:curl|npm|pnpm|yarn|bun|node|npx|git|docker|kubectl|echo|cd|ls|mkdir|rm|cp|mv|chmod|sed|awk)\b/m.test(
      content,
    )
  ) {
    return 'bash';
  }

  if (canParseJson(content)) {
    return 'json';
  }

  if (isYamlLike(content)) {
    return 'yaml';
  }

  if (
    /[.#]?[A-Za-z_-][\w-]*\s*\{[\s\S]*:[^\n;]+;?/m.test(content) &&
    !/function\b|=>/.test(content)
  ) {
    return 'css';
  }

  if (isJsxLike(content)) {
    return isTsLike(content) ? 'tsx' : 'jsx';
  }

  if (isTsLike(content)) {
    return 'typescript';
  }

  if (
    /(^|\n)\s*(?:const|let|var|function|console\.|=>|for\s*\(|while\s*\(|if\s*\()/m.test(content)
  ) {
    return 'javascript';
  }

  if (/^\s*def\b/m.test(content) || /:\s*$/m.test(content)) {
    return 'python';
  }

  if (/^\s*package\b/m.test(content) || /\bfunc\b/m.test(content)) {
    return 'go';
  }

  return 'text';
}

export function shouldOverrideFenceLanguage(
  currentLanguage: string,
  detectedLanguage: string,
): boolean {
  if (detectedLanguage === 'text' || currentLanguage === detectedLanguage) {
    return false;
  }

  if (isGenericFenceLanguage(currentLanguage)) {
    return true;
  }

  return (
    (currentLanguage === 'javascript' &&
      (detectedLanguage === 'vue' || detectedLanguage === 'jsx')) ||
    (currentLanguage === 'typescript' && detectedLanguage === 'tsx') ||
    (currentLanguage === 'html' && detectedLanguage === 'vue')
  );
}
