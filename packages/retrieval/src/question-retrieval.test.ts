import { describe, expect, it } from 'vitest';
import type { InterviewQuestion } from '@mianshitong/shared';
import {
  buildQuestionRetrievalDocs,
  createLexicalQuestionRetriever,
  searchQuestionDocs,
} from './question-retrieval';
import type { EmbeddingProvider } from '@mianshitong/llm';
import { createVectorQuestionRetriever } from './vector-question-retriever';

const questionBank: InterviewQuestion[] = [
  {
    id: 'react_hooks_mid',
    level: 'mid',
    title: 'React Hooks 闭包陷阱',
    prompt: '请解释 useEffect 和 useCallback 中常见的闭包陷阱。',
    answer: '需要理解依赖数组、闭包捕获与重新渲染。',
    keyPoints: ['useEffect', '闭包', '依赖数组'],
    tags: ['React', 'JavaScript'],
    order: 2,
  },
  {
    id: 'javascript_event_loop',
    level: 'mid',
    title: '事件循环',
    prompt: '讲一下浏览器事件循环与微任务执行顺序。',
    answer: '微任务会在当前宏任务后立即清空。',
    keyPoints: ['Promise', '微任务', '宏任务'],
    tags: ['JavaScript'],
    order: 1,
  },
  {
    id: 'react_architecture_senior',
    level: 'senior',
    title: '大型 React 应用架构拆分',
    prompt: '如何设计大型 React 应用的状态与边界？',
    answer: '需要从模块边界、状态归属和演进路径思考。',
    keyPoints: ['状态管理', '边界', '可维护性'],
    tags: ['React', 'Engineering'],
    order: 3,
  },
];

describe('question retrieval', () => {
  it('builds searchable docs from question bank records', () => {
    const docs = buildQuestionRetrievalDocs(questionBank);

    expect(docs).toHaveLength(3);
    expect(docs[0].normalizedTags).toEqual(['react', 'javascript']);
    expect(docs[0].searchText).toContain('闭包陷阱');
    expect(docs[0].tokens).toContain('react');
  });

  it('prioritizes must-include tags and exact level matches', () => {
    const docs = buildQuestionRetrievalDocs(questionBank);
    const [topResult] = searchQuestionDocs({
      docs,
      query: {
        queryText: '我做过 React Hooks 和闭包相关项目，想考察 useEffect。',
        targetLevel: 'mid',
        preferredTags: [
          { tag: 'react', weight: 1 },
          { tag: 'javascript', weight: 0.6 },
        ],
        mustIncludeTags: ['react'],
        limit: 3,
      },
    });

    expect(topResult?.doc.id).toBe('react_hooks_mid');
    expect(topResult?.matchedMustIncludeTags).toEqual(['react']);
    expect(topResult?.breakdown.level).toBeGreaterThan(0);
  });

  it('respects exclusions and falls back to adjacent difficulty', () => {
    const docs = buildQuestionRetrievalDocs(questionBank);
    const [topResult] = searchQuestionDocs({
      docs,
      query: {
        queryText: '我主要做 React 工程化架构设计。',
        targetLevel: 'mid',
        allowedLevels: ['mid', 'senior'],
        preferredTags: [{ tag: 'react', weight: 1 }],
        excludeQuestionIds: ['react_hooks_mid'],
        limit: 3,
      },
    });

    expect(topResult?.doc.id).toBe('react_architecture_senior');
    expect(topResult?.doc.level).toBe('senior');
  });

  it('exposes an async retriever adapter for future retrieval backends', async () => {
    const retriever = createLexicalQuestionRetriever({ questionBank });
    const [topResult] = await retriever.search({
      queryText: '我想考察 React Hooks 和闭包问题。',
      targetLevel: 'mid',
      preferredTags: [{ tag: 'react', weight: 1 }],
      mustIncludeTags: ['react'],
      limit: 3,
    });

    expect(topResult?.doc.id).toBe('react_hooks_mid');
  });

  it('reorders vector candidates with tag and level constraints', async () => {
    const docs = buildQuestionRetrievalDocs(questionBank);
    const embeddingProvider: EmbeddingProvider = {
      name: 'mock-embedding-provider',
      async embedTexts() {
        return [[0.9, 0.1, 0.3]];
      },
    };
    const retriever = createVectorQuestionRetriever({
      embeddingProvider,
      vectorStore: {
        async searchByEmbedding() {
          return [
            { doc: docs[2], similarity: 0.92 },
            { doc: docs[0], similarity: 0.79 },
          ];
        },
      },
      fallbackRetriever: createLexicalQuestionRetriever({ docs }),
    });

    const [topResult] = await retriever.search({
      queryText: '我想考察 React Hooks 和闭包问题。',
      targetLevel: 'mid',
      preferredTags: [{ tag: 'react', weight: 1 }],
      mustIncludeTags: ['react'],
      limit: 3,
    });

    expect(topResult?.doc.id).toBe('react_hooks_mid');
    expect(topResult?.breakdown.semantic).toBeGreaterThan(0);
  });

  it('falls back to lexical retrieval when vector search returns no candidates', async () => {
    const docs = buildQuestionRetrievalDocs(questionBank);
    const embeddingProvider: EmbeddingProvider = {
      name: 'mock-embedding-provider',
      async embedTexts() {
        return [[0.1, 0.2, 0.3]];
      },
    };
    const retriever = createVectorQuestionRetriever({
      embeddingProvider,
      vectorStore: {
        async searchByEmbedding() {
          return [];
        },
      },
      fallbackRetriever: createLexicalQuestionRetriever({ docs }),
    });

    const [topResult] = await retriever.search({
      queryText: '我做过 React Hooks 和闭包相关项目，想考察 useEffect。',
      targetLevel: 'mid',
      preferredTags: [{ tag: 'react', weight: 1 }],
      mustIncludeTags: ['react'],
      limit: 3,
    });

    expect(topResult?.doc.id).toBe('react_hooks_mid');
    expect(topResult?.breakdown.semantic).toBe(0);
  });
});
