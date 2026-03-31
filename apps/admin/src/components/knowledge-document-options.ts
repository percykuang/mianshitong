export const KNOWLEDGE_DOCUMENT_CATEGORY_OPTIONS = [
  { label: '技术知识', value: 'tech_knowledge' },
  { label: '面试打法', value: 'interview_playbook' },
  { label: '项目/简历', value: 'project_resume' },
] as const;

export const KNOWLEDGE_DOCUMENT_CONTENT_SHAPE_OPTIONS = [
  { label: '参考资料', value: 'reference' },
  { label: '流程型内容', value: 'process' },
  { label: '清单型内容', value: 'checklist' },
  { label: '模板型内容', value: 'template' },
] as const;

export type KnowledgeDocumentCategoryValue =
  (typeof KNOWLEDGE_DOCUMENT_CATEGORY_OPTIONS)[number]['value'];
export type KnowledgeDocumentContentShapeValue =
  (typeof KNOWLEDGE_DOCUMENT_CONTENT_SHAPE_OPTIONS)[number]['value'];

export function isKnowledgeDocumentCategory(
  value: string,
): value is KnowledgeDocumentCategoryValue {
  return KNOWLEDGE_DOCUMENT_CATEGORY_OPTIONS.some((item) => item.value === value);
}

export function isKnowledgeDocumentContentShape(
  value: string,
): value is KnowledgeDocumentContentShapeValue {
  return KNOWLEDGE_DOCUMENT_CONTENT_SHAPE_OPTIONS.some((item) => item.value === value);
}

export function getKnowledgeDocumentCategoryLabel(value: string): string {
  return (
    KNOWLEDGE_DOCUMENT_CATEGORY_OPTIONS.find((item) => item.value === value)?.label ?? '未知分类'
  );
}

export function getKnowledgeDocumentContentShapeLabel(value: string): string {
  return (
    KNOWLEDGE_DOCUMENT_CONTENT_SHAPE_OPTIONS.find((item) => item.value === value)?.label ??
    '未知形态'
  );
}

export function normalizeKnowledgeDocumentTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }

    const normalized = item.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    tags.push(normalized);
  }

  return tags;
}
