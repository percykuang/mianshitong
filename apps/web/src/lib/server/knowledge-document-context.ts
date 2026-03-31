import type { ChatTurn } from '@mianshitong/llm';
import type {
  KnowledgeDocumentCategory,
  KnowledgeDocumentContentShape,
} from '@mianshitong/retrieval';

export type KnowledgeDocumentHitMode = 'strong' | 'weak' | 'none';

export interface KnowledgeDocumentContextEntry {
  documentId: string;
  documentTitle: string;
  category: KnowledgeDocumentCategory;
  contentShape: KnowledgeDocumentContentShape;
  headingPath: string[];
  content: string;
  score: number;
}

export interface KnowledgeDocumentContext {
  mode: KnowledgeDocumentHitMode;
  entries: KnowledgeDocumentContextEntry[];
}

function formatCategoryLabel(category: KnowledgeDocumentCategory): string {
  if (category === 'tech_knowledge') {
    return '技术知识';
  }

  if (category === 'interview_playbook') {
    return '面试打法';
  }

  return '项目/简历';
}

function buildKnowledgeContextInstruction(context: KnowledgeDocumentContext): string {
  const isOrderedProcessContext =
    context.entries.length > 1 &&
    context.entries.every(
      (entry) =>
        entry.contentShape === 'process' && entry.documentId === context.entries[0]?.documentId,
    );
  const intro =
    context.mode === 'strong'
      ? [
          '以下是与当前问题高度相关的内部知识背景。',
          '回答时应优先吸收这些知识来组织内容，但不要逐字复述，也不要编造其中不存在的事实。',
          '默认不要在正文里主动提到“根据某文档/资料/知识库”或直接报出文档标题；应像资深面试官本来就掌握这些知识一样自然回答。',
          isOrderedProcessContext
            ? '这些流程型知识已按原始文档顺序整理；如果其中明确给出阶段顺序，不要自行删减或合并轮次。'
            : null,
          '只有当用户明确追问依据、来源或参考材料时，才可以概括说明信息来源。',
        ]
      : [
          '以下是与当前问题可能相关的内部知识背景。',
          '这些内容只作为辅助背景；如果相关性不足，不要强行套用，也不要假装“某份资料里明确写了”。',
          '默认不要在正文里主动提到文档、资料或知识库来源；只有用户明确追问依据时，才可以再解释来源。',
          isOrderedProcessContext
            ? '这些流程型知识已按原始文档顺序整理；如果其中明确给出阶段顺序，不要自行删减或合并轮次。'
            : null,
        ];

  const entries = context.entries.map((entry, index) =>
    [
      `[知识背景 ${index + 1}]`,
      `背景分类：${formatCategoryLabel(entry.category)}`,
      `知识主题：${entry.documentTitle}`,
      entry.headingPath.length > 0 ? `主题路径：${entry.headingPath.join(' > ')}` : null,
      '内容：',
      entry.content,
    ]
      .filter(Boolean)
      .join('\n'),
  );

  return [...intro, '', ...entries].join('\n');
}

export function prependKnowledgeDocumentContext(
  messages: ChatTurn[],
  context: KnowledgeDocumentContext | null,
): ChatTurn[] {
  if (!context || context.mode === 'none' || context.entries.length === 0) {
    return messages;
  }

  return [
    {
      role: 'system',
      content: buildKnowledgeContextInstruction(context),
    },
    ...messages,
  ];
}
