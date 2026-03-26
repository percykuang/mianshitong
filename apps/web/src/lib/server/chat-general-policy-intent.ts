import {
  GREETING_PATTERNS,
  PROJECT_HIGHLIGHT_PATTERN,
  RESUME_REQUEST_PATTERN,
  SECTION_HINTS,
  SELF_INTRO_PATTERN,
  TECHNICAL_COMPARE_PATTERN,
  TECHNICAL_DOMAIN_HINTS,
  TECHNICAL_MECHANISM_HINTS,
  TECHNICAL_MECHANISM_PATTERN,
  TECHNICAL_QUESTION_PATTERN,
} from './chat-general-policy.constants';
import type {
  ArithmeticIntent,
  GeneralChatIntent,
  TechnicalQuestionIntentStyle,
} from './chat-general-policy.types';

function normalizeCompactText(content: string): string {
  return content.replace(/\s+/g, '').toLowerCase();
}

function isGreeting(content: string): boolean {
  const trimmed = content.trim();
  return GREETING_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function countTechnicalDomainHits(content: string): number {
  const normalized = normalizeCompactText(content)
    .replace(/[`"'“”‘’]/g, '')
    .replace(/[（）()]/g, '');
  const keywordHits = TECHNICAL_DOMAIN_HINTS.filter((hint) => normalized.includes(hint)).length;
  const hookLikeHits = /(?:^|[\s(（])use[A-Z][A-Za-z]+/.test(content) ? 1 : 0;
  const codeLikeHits =
    /\b(?:Promise|setTimeout|setInterval|requestAnimationFrame|MutationObserver)\b/.test(content)
      ? 1
      : 0;

  return keywordHits + hookLikeHits + codeLikeHits;
}

function detectTechnicalQuestionStyle(content: string): TechnicalQuestionIntentStyle {
  const normalized = normalizeCompactText(content);

  if (TECHNICAL_COMPARE_PATTERN.test(content)) {
    return 'comparison';
  }

  if (
    TECHNICAL_MECHANISM_PATTERN.test(content) ||
    TECHNICAL_MECHANISM_HINTS.some((hint) => normalized.includes(hint))
  ) {
    return 'mechanism';
  }

  return 'concept';
}

function resolveTechnicalQuestionIntent(content: string): GeneralChatIntent | null {
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  const technicalHitCount = countTechnicalDomainHits(trimmed);
  const looksLikeQuestion =
    /[？?]/.test(trimmed) || TECHNICAL_QUESTION_PATTERN.test(trimmed) || trimmed.length <= 32;

  if (technicalHitCount === 0 || !looksLikeQuestion) {
    return null;
  }

  return {
    kind: 'technical_question',
    question: trimmed,
    style: detectTechnicalQuestionStyle(trimmed),
  };
}

function looksLikeResumeDocument(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }

  const lines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 4 && trimmed.length < 180) {
    return false;
  }

  const hitCount = SECTION_HINTS.filter((keyword) => trimmed.includes(keyword)).length;
  if (hitCount >= 2) {
    return true;
  }

  const colonLikeLineCount = lines.filter((line) => /[:：]/.test(line)).length;
  return hitCount >= 1 && colonLikeLineCount >= 3;
}

function parseSimpleArithmetic(content: string): ArithmeticIntent | null {
  const normalized = normalizeCompactText(content)
    .replace(/^请问/, '')
    .replace(/^请帮我算一下/, '')
    .replace(/^帮我算一下/, '')
    .replace(/[？?=]/g, '')
    .replace(/等于几$/, '')
    .replace(/是多少$/, '')
    .replace(/×/g, '*')
    .replace(/[xX]/g, '*')
    .replace(/÷/g, '/');

  const match = /^(-?\d+(?:\.\d+)?)([+\-*/])(-?\d+(?:\.\d+)?)$/.exec(normalized);
  if (!match) {
    return null;
  }

  const left = Number(match[1]);
  const operator = match[2] as '+' | '-' | '*' | '/';
  const right = Number(match[3]);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return null;
  }
  if (operator === '/' && right === 0) {
    return null;
  }

  const result =
    operator === '+'
      ? left + right
      : operator === '-'
        ? left - right
        : operator === '*'
          ? left * right
          : left / right;

  return { left, operator, right, result };
}

export function formatArithmeticExpression(input: ArithmeticIntent): string {
  const operatorLabel =
    input.operator === '*' ? '×' : input.operator === '/' ? '÷' : input.operator;

  const resultText = Number.isInteger(input.result) ? String(input.result) : String(input.result);
  return `${input.left}${operatorLabel}${input.right} 等于 ${resultText}。`;
}

export function resolveGeneralChatIntent(input: {
  content: string;
  userMessageCount: number;
}): GeneralChatIntent | null {
  const trimmed = input.content.trim();
  if (!trimmed) {
    return null;
  }

  if (input.userMessageCount === 0 && isGreeting(trimmed)) {
    return { kind: 'greeting' };
  }

  const arithmetic = parseSimpleArithmetic(trimmed);
  if (arithmetic) {
    return { kind: 'simple_arithmetic', arithmetic };
  }

  if (SELF_INTRO_PATTERN.test(trimmed)) {
    return { kind: 'self_intro' };
  }

  if (PROJECT_HIGHLIGHT_PATTERN.test(trimmed)) {
    return { kind: 'project_highlight' };
  }

  if (
    trimmed.includes('简历') &&
    RESUME_REQUEST_PATTERN.test(trimmed) &&
    !looksLikeResumeDocument(trimmed)
  ) {
    return { kind: 'resume_optimize' };
  }

  const technicalIntent = resolveTechnicalQuestionIntent(trimmed);
  if (technicalIntent) {
    return technicalIntent;
  }

  return null;
}
