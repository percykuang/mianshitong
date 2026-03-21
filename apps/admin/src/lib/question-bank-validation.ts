import {
  isQuestionLevel,
  normalizeQuestionTags,
  type QuestionLevelValue,
} from '@/components/question-bank-options';

const INVALID_VALUE = Symbol('invalid-question-bank-value');

type InvalidValue = typeof INVALID_VALUE;

type CreateQuestionPayload = {
  title: string;
  prompt: string | null;
  level: QuestionLevelValue;
  answer: string | null;
  keyPoints: string[];
  followUps: string[];
  tags: string[];
  order: number | null;
  isActive: boolean;
};

type PatchQuestionPayload = Partial<CreateQuestionPayload>;

type ParseResult<T> = { ok: true; data: T } | { ok: false; message: string };

function parseText(value: unknown): string | InvalidValue {
  if (typeof value !== 'string') {
    return INVALID_VALUE;
  }
  return value.trim();
}

function parseOptionalText(value: unknown): string | null | InvalidValue {
  if (value === undefined || value === null) {
    return null;
  }
  const parsed = parseText(value);
  if (parsed === INVALID_VALUE) {
    return INVALID_VALUE;
  }
  return parsed || null;
}

function parseStringArray(value: unknown): string[] | InvalidValue {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return INVALID_VALUE;
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function parseTags(value: unknown): string[] | InvalidValue {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return INVALID_VALUE;
  }
  const tags = normalizeQuestionTags(value);
  return tags.length > 0 ? tags : INVALID_VALUE;
}

function parseOrder(value: unknown): number | null | InvalidValue {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return INVALID_VALUE;
  }
  return value;
}

function parseIsActive(value: unknown): boolean | InvalidValue {
  if (value === undefined) {
    return true;
  }
  return typeof value === 'boolean' ? value : INVALID_VALUE;
}

export function parseCreateQuestionPayload(
  body: Record<string, unknown>,
): ParseResult<CreateQuestionPayload> {
  const title = parseText(body.title);
  if (title === INVALID_VALUE || !title) {
    return { ok: false, message: '标题不能为空。' };
  }

  const levelValue = parseText(body.level);
  if (levelValue === INVALID_VALUE || !isQuestionLevel(levelValue)) {
    return { ok: false, message: '难度等级无效。' };
  }

  const tags = parseTags(body.tags);
  if (tags === INVALID_VALUE) {
    return { ok: false, message: '请至少填写一个标签。' };
  }

  const prompt = parseOptionalText(body.prompt);
  if (prompt === INVALID_VALUE) {
    return { ok: false, message: '题目描述格式无效。' };
  }

  const answer = parseOptionalText(body.answer);
  if (answer === INVALID_VALUE) {
    return { ok: false, message: '参考答案格式无效。' };
  }

  const keyPoints = parseStringArray(body.keyPoints);
  if (keyPoints === INVALID_VALUE) {
    return { ok: false, message: '要点格式无效。' };
  }

  const followUps = parseStringArray(body.followUps);
  if (followUps === INVALID_VALUE) {
    return { ok: false, message: '追问格式无效。' };
  }

  const order = parseOrder(body.order);
  if (order === INVALID_VALUE) {
    return { ok: false, message: '序号必须是整数。' };
  }

  const isActive = parseIsActive(body.isActive);
  if (isActive === INVALID_VALUE) {
    return { ok: false, message: '启用状态格式无效。' };
  }

  return {
    ok: true,
    data: { title, prompt, level: levelValue, answer, keyPoints, followUps, tags, order, isActive },
  };
}

export function parsePatchQuestionPayload(
  body: Record<string, unknown>,
): ParseResult<PatchQuestionPayload> {
  const patch: PatchQuestionPayload = {};

  if (body.title !== undefined) {
    const title = parseText(body.title);
    if (title === INVALID_VALUE || !title) {
      return { ok: false, message: '标题不能为空。' };
    }
    patch.title = title;
  }

  if (body.prompt !== undefined) {
    const prompt = parseOptionalText(body.prompt);
    if (prompt === INVALID_VALUE) {
      return { ok: false, message: '题目描述格式无效。' };
    }
    patch.prompt = prompt;
  }

  if (body.level !== undefined) {
    const levelValue = parseText(body.level);
    if (levelValue === INVALID_VALUE || !isQuestionLevel(levelValue)) {
      return { ok: false, message: '难度等级无效。' };
    }
    patch.level = levelValue;
  }

  if (body.answer !== undefined) {
    const answer = parseOptionalText(body.answer);
    if (answer === INVALID_VALUE) {
      return { ok: false, message: '参考答案格式无效。' };
    }
    patch.answer = answer;
  }

  if (body.keyPoints !== undefined) {
    const keyPoints = parseStringArray(body.keyPoints);
    if (keyPoints === INVALID_VALUE) {
      return { ok: false, message: '要点格式无效。' };
    }
    patch.keyPoints = keyPoints;
  }

  if (body.followUps !== undefined) {
    const followUps = parseStringArray(body.followUps);
    if (followUps === INVALID_VALUE) {
      return { ok: false, message: '追问格式无效。' };
    }
    patch.followUps = followUps;
  }

  if (body.tags !== undefined) {
    const tags = parseTags(body.tags);
    if (tags === INVALID_VALUE) {
      return { ok: false, message: '请至少填写一个标签。' };
    }
    patch.tags = tags;
  }

  if (body.order !== undefined) {
    const order = parseOrder(body.order);
    if (order === INVALID_VALUE) {
      return { ok: false, message: '序号必须是整数。' };
    }
    patch.order = order;
  }

  if (body.isActive !== undefined) {
    const isActive = parseIsActive(body.isActive);
    if (isActive === INVALID_VALUE) {
      return { ok: false, message: '启用状态格式无效。' };
    }
    patch.isActive = isActive;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, message: '没有可更新的字段。' };
  }

  return { ok: true, data: patch };
}
