import {
  isKnowledgeDocumentCategory,
  isKnowledgeDocumentContentShape,
  normalizeKnowledgeDocumentTags,
  type KnowledgeDocumentCategoryValue,
  type KnowledgeDocumentContentShapeValue,
} from '@/components/knowledge-document-options';

const INVALID_VALUE = Symbol('invalid-knowledge-document-value');

type InvalidValue = typeof INVALID_VALUE;

type KnowledgeDocumentPayload = {
  title: string;
  category: KnowledgeDocumentCategoryValue;
  contentShape: KnowledgeDocumentContentShapeValue;
  summary: string | null;
  content: string;
  tags: string[];
  isPublished: boolean;
};

type PatchKnowledgeDocumentPayload = Partial<KnowledgeDocumentPayload>;

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

function parseTags(value: unknown): string[] | InvalidValue {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return INVALID_VALUE;
  }

  const tags = normalizeKnowledgeDocumentTags(value);
  return tags.length > 0 ? tags : INVALID_VALUE;
}

function parseIsPublished(value: unknown): boolean | InvalidValue {
  if (value === undefined) {
    return false;
  }

  return typeof value === 'boolean' ? value : INVALID_VALUE;
}

function parseContentShape(
  value: unknown,
  fallback: KnowledgeDocumentContentShapeValue | null = null,
): KnowledgeDocumentContentShapeValue | InvalidValue {
  if (value === undefined) {
    return fallback ?? INVALID_VALUE;
  }

  const parsed = parseText(value);
  if (parsed === INVALID_VALUE || !isKnowledgeDocumentContentShape(parsed)) {
    return INVALID_VALUE;
  }

  return parsed;
}

export function parseCreateKnowledgeDocumentPayload(
  body: Record<string, unknown>,
): ParseResult<KnowledgeDocumentPayload> {
  const title = parseText(body.title);
  if (title === INVALID_VALUE || !title) {
    return { ok: false, message: '标题不能为空。' };
  }

  const category = parseText(body.category);
  if (category === INVALID_VALUE || !isKnowledgeDocumentCategory(category)) {
    return { ok: false, message: '文档分类无效。' };
  }

  const contentShape = parseContentShape(body.contentShape, 'reference');
  if (contentShape === INVALID_VALUE) {
    return { ok: false, message: '内容形态无效。' };
  }

  const summary = parseOptionalText(body.summary);
  if (summary === INVALID_VALUE) {
    return { ok: false, message: '摘要格式无效。' };
  }

  const content = parseText(body.content);
  if (content === INVALID_VALUE || !content) {
    return { ok: false, message: 'Markdown 内容不能为空。' };
  }

  const tags = parseTags(body.tags);
  if (tags === INVALID_VALUE) {
    return { ok: false, message: '请至少填写一个标签。' };
  }

  const isPublished = parseIsPublished(body.isPublished);
  if (isPublished === INVALID_VALUE) {
    return { ok: false, message: '发布状态格式无效。' };
  }

  return {
    ok: true,
    data: { title, category, contentShape, summary, content, tags, isPublished },
  };
}

export function parsePatchKnowledgeDocumentPayload(
  body: Record<string, unknown>,
): ParseResult<PatchKnowledgeDocumentPayload> {
  const patch: PatchKnowledgeDocumentPayload = {};

  if (body.title !== undefined) {
    const title = parseText(body.title);
    if (title === INVALID_VALUE || !title) {
      return { ok: false, message: '标题不能为空。' };
    }
    patch.title = title;
  }

  if (body.category !== undefined) {
    const category = parseText(body.category);
    if (category === INVALID_VALUE || !isKnowledgeDocumentCategory(category)) {
      return { ok: false, message: '文档分类无效。' };
    }
    patch.category = category;
  }

  if (body.contentShape !== undefined) {
    const contentShape = parseContentShape(body.contentShape);
    if (contentShape === INVALID_VALUE) {
      return { ok: false, message: '内容形态无效。' };
    }
    patch.contentShape = contentShape;
  }

  if (body.summary !== undefined) {
    const summary = parseOptionalText(body.summary);
    if (summary === INVALID_VALUE) {
      return { ok: false, message: '摘要格式无效。' };
    }
    patch.summary = summary;
  }

  if (body.content !== undefined) {
    const content = parseText(body.content);
    if (content === INVALID_VALUE || !content) {
      return { ok: false, message: 'Markdown 内容不能为空。' };
    }
    patch.content = content;
  }

  if (body.tags !== undefined) {
    const tags = parseTags(body.tags);
    if (tags === INVALID_VALUE) {
      return { ok: false, message: '请至少填写一个标签。' };
    }
    patch.tags = tags;
  }

  if (body.isPublished !== undefined) {
    const isPublished = parseIsPublished(body.isPublished);
    if (isPublished === INVALID_VALUE) {
      return { ok: false, message: '发布状态格式无效。' };
    }
    patch.isPublished = isPublished;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, message: '没有可更新的字段。' };
  }

  return { ok: true, data: patch };
}
