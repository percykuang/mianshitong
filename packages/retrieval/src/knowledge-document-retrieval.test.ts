import { describe, expect, it } from 'vitest';
import {
  buildKnowledgeDocumentChunks,
  normalizeKnowledgeDocumentTag,
  resolveKnowledgeDocumentHitMode,
  searchKnowledgeDocumentChunks,
} from './knowledge-document-retrieval';

describe('knowledge document retrieval', () => {
  it('按 markdown 标题和段落切分文档块，并保留标题路径', () => {
    const chunks = buildKnowledgeDocumentChunks({
      documentId: 'doc-1',
      title: 'React Hooks 面试手册',
      category: 'tech_knowledge',
      contentShape: 'reference',
      summary: '覆盖 useMemo、useCallback 和闭包问题。',
      tags: ['React', 'Hooks'],
      content: [
        '# React',
        '## useMemo 和 useCallback',
        '它们都依赖依赖数组，但优化目标不同。',
        '',
        '```tsx',
        'const value = useMemo(() => list.filter(Boolean), [list]);',
        '```',
        '',
        '## 闭包问题',
        'React 回调里经常出现拿到旧值的问题。',
      ].join('\n'),
    });

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]?.headingPath).toEqual(['React', 'useMemo 和 useCallback']);
    expect(chunks[0]?.searchText).toContain('React Hooks 面试手册');
    expect(chunks.at(-1)?.headingPath).toEqual(['React', '闭包问题']);
  });

  it('会对标签做稳定归一化', () => {
    expect(normalizeKnowledgeDocumentTag('React Hooks')).toBe('reacthooks');
    expect(normalizeKnowledgeDocumentTag('project_resume')).toBe('projectresume');
  });

  it('能优先检索与问题最相关的知识块', () => {
    const results = searchKnowledgeDocumentChunks({
      chunks: [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          title: 'React Hooks 面试手册',
          category: 'tech_knowledge',
          contentShape: 'reference',
          chunkOrder: 0,
          headingPath: ['React', 'useMemo 和 useCallback'],
          headingText: 'useMemo 和 useCallback',
          content: 'useMemo 缓存结果，useCallback 缓存函数引用。',
          searchText:
            'React Hooks 面试手册\nReact\nuseMemo 和 useCallback\nReact\nHooks\nuseMemo 缓存结果，useCallback 缓存函数引用。',
          tags: ['React', 'Hooks'],
          normalizedTags: ['react', 'hooks'],
        },
        {
          id: 'chunk-2',
          documentId: 'doc-2',
          title: '项目亮点表达',
          category: 'project_resume',
          contentShape: 'template',
          chunkOrder: 0,
          headingPath: ['项目亮点'],
          headingText: '项目亮点',
          content: '项目亮点要写业务价值和个人贡献。',
          searchText: '项目亮点表达\n项目亮点\n项目亮点要写业务价值和个人贡献。',
          tags: ['项目'],
          normalizedTags: ['项目'],
        },
      ],
      query: {
        queryText: 'React useMemo 和 useCallback 的区别是什么？',
        categories: ['tech_knowledge', 'interview_playbook'],
        preferredTags: ['React'],
        limit: 3,
      },
    });

    expect(results[0]?.chunk.id).toBe('chunk-1');
    expect(results[0]?.matchedTags).toContain('react');
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
    expect(resolveKnowledgeDocumentHitMode(results)).toBe('strong');
  });

  it('能根据结果强度区分 strong / weak / none', () => {
    const baseChunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        title: 'React Hooks 面试手册',
        category: 'tech_knowledge' as const,
        contentShape: 'reference' as const,
        chunkOrder: 0,
        headingPath: ['React', 'useMemo 和 useCallback'],
        headingText: 'useMemo 和 useCallback',
        content: 'useMemo 缓存结果，useCallback 缓存函数引用。',
        searchText:
          'React Hooks 面试手册\nReact\nuseMemo 和 useCallback\nReact\nHooks\nuseMemo 缓存结果，useCallback 缓存函数引用。',
        tags: ['React', 'Hooks'],
        normalizedTags: ['react', 'hooks'],
      },
    ];

    const strongResults = searchKnowledgeDocumentChunks({
      chunks: baseChunks,
      query: {
        queryText: 'React useMemo 和 useCallback 的区别是什么？',
        categories: ['tech_knowledge'],
        preferredTags: ['React'],
        limit: 3,
      },
    });

    const weakResults = searchKnowledgeDocumentChunks({
      chunks: [
        {
          ...baseChunks[0],
          searchText: 'React Hooks 面试手册\nReact Hooks 入门\n缓存优化提示',
        },
      ],
      query: {
        queryText: 'React 的缓存优化思路',
        categories: ['tech_knowledge'],
        preferredTags: [],
        limit: 3,
      },
    });

    const noneResults = searchKnowledgeDocumentChunks({
      chunks: baseChunks,
      query: {
        queryText: 'Kubernetes 集群怎么做网络隔离？',
        categories: ['tech_knowledge'],
        preferredTags: [],
        limit: 3,
      },
    });

    expect(resolveKnowledgeDocumentHitMode(strongResults)).toBe('strong');
    expect(resolveKnowledgeDocumentHitMode(weakResults)).toBe('weak');
    expect(resolveKnowledgeDocumentHitMode(noneResults)).toBe('none');
  });
});
