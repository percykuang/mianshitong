export const QUESTION_LEVEL_VALUES = ['junior', 'mid', 'senior'] as const;

export type QuestionLevelValue = (typeof QUESTION_LEVEL_VALUES)[number];

export const QUESTION_LEVEL_OPTIONS = [
  { label: '初级', value: 'junior' },
  { label: '中级', value: 'mid' },
  { label: '高级', value: 'senior' },
];

export const QUESTION_TAG_OPTIONS = [
  { label: 'JavaScript', value: 'javascript' },
  { label: 'React', value: 'react' },
  { label: 'Vue', value: 'vue' },
  { label: '工程化', value: 'engineering' },
  { label: '性能', value: 'performance' },
  { label: '网络', value: 'network' },
  { label: '安全', value: 'security' },
  { label: 'Node', value: 'node' },
];

const TAG_VALUE_MAP = new Map(
  QUESTION_TAG_OPTIONS.flatMap((item) => [
    [item.value.toLowerCase(), item.value],
    [item.label.toLowerCase(), item.value],
  ]),
);

const TAG_LABEL_MAP = new Map(QUESTION_TAG_OPTIONS.map((item) => [item.value, item.label]));

export function normalizeQuestionTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => TAG_VALUE_MAP.get(item.toLowerCase()) ?? item);

  return Array.from(new Set(normalized));
}

export function isQuestionLevel(value: unknown): value is QuestionLevelValue {
  return typeof value === 'string' && QUESTION_LEVEL_VALUES.includes(value as QuestionLevelValue);
}

export function formatQuestionTags(value: unknown): string[] {
  const normalized = normalizeQuestionTags(value);
  return normalized.map((item) => TAG_LABEL_MAP.get(item) ?? item);
}
