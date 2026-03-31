import { describe, expect, it } from 'vitest';
import {
  APP_SLUG,
  DEFAULT_INTERVIEW_CONFIG,
  MODEL_OPTIONS,
  mergeKnowledgeRetrievalTraceEntries,
  normalizeInterviewConfig,
  normalizeKnowledgeTracePreferredTags,
} from './index';
import type { KnowledgeRetrievalTraceEntry } from './types';

describe('shared constants', () => {
  it('exports app slug', () => {
    expect(APP_SLUG).toBe('mianshitong');
  });

  it('contains deepseek model options', () => {
    expect(MODEL_OPTIONS.map((item) => item.id)).toEqual(['deepseek-chat', 'deepseek-reasoner']);
  });

  it('normalizes config defaults and ranges', () => {
    const config = normalizeInterviewConfig({ questionCount: 99, topics: [] });

    expect(config.questionCount).toBe(8);
    expect(config.topics).toEqual(DEFAULT_INTERVIEW_CONFIG.topics);
  });

  it('normalizes trace preferred tags for display readability', () => {
    const tags = normalizeKnowledgeTracePreferredTags(
      ['react', '我在改简历', '在改', '性能优化经历', '怎么改写得更有亮点', '业务价值', '项目'],
      'resume_optimize',
    );

    expect(tags).toEqual(['项目', '简历', 'react', '性能优化经历', '业务价值']);
  });

  it('keeps interview playbook tags readable for trace display', () => {
    const tags = normalizeKnowledgeTracePreferredTags(
      ['前端面试流程', '流程', '一面', '一般是怎么样的', 'hr', 'offer'],
      'interview_playbook',
    );

    expect(tags).toEqual(['面试', '前端面试流程', '流程', '一面', 'hr', 'offer']);
  });

  it('merges knowledge retrieval traces without dropping concurrent entries', () => {
    const existing: KnowledgeRetrievalTraceEntry[] = [
      {
        createdAt: '2026-03-31T12:00:00.000Z',
        intentKind: 'technical_question' as const,
        mode: 'strong' as const,
        categories: ['tech_knowledge', 'interview_playbook'],
        preferredTags: ['前端', 'react'],
        queryPreview: 'React 性能优化怎么回答？',
        results: [
          {
            documentId: 'doc-1',
            documentTitle: 'React 性能优化面试手册',
            category: 'tech_knowledge' as const,
            headingPath: ['React 性能优化'],
            score: 6.1,
          },
        ],
      },
    ];
    const incoming: KnowledgeRetrievalTraceEntry[] = [
      {
        ...existing[0],
      },
      {
        createdAt: '2026-03-31T12:00:01.000Z',
        intentKind: 'resume_optimize' as const,
        mode: 'weak' as const,
        categories: ['project_resume', 'interview_playbook'],
        preferredTags: ['项目', '简历'],
        queryPreview: '简历里的项目经历怎么写更有亮点？',
        results: [],
      },
    ];

    const merged = mergeKnowledgeRetrievalTraceEntries(existing, incoming);

    expect(merged).toHaveLength(2);
    expect(merged[0]?.queryPreview).toBe('React 性能优化怎么回答？');
    expect(merged[1]?.queryPreview).toBe('简历里的项目经历怎么写更有亮点？');
  });
});
