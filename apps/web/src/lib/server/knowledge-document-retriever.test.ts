import { describe, expect, it } from 'vitest';
import { resolveGeneralChatIntent } from '@/lib/server/chat-general-policy';
import { createDraftSession } from './chat-session-model';
import {
  appendKnowledgeRetrievalTrace,
  buildKnowledgeDocumentContextFromResults,
  buildKnowledgeTraceQueryHash,
  buildKnowledgeRetrievalTraceEntry,
  resolveKnowledgeRetrievalPlan,
  selectKnowledgeSearchResultsForContext,
  trimKnowledgeRetrievalTraceForEditedMessage,
} from './knowledge-document-retriever';

describe('resolveKnowledgeRetrievalPlan', () => {
  it('自我介绍与项目亮点混杂时，仍应优先走 self_intro，并检索 playbook + project_resume', () => {
    const content = [
      '我现在在准备前端面试，自我介绍经常讲得很散。',
      '另外我也想把简历里的项目亮点一起带进去，但又怕说成流水账。',
      '这种开场应该怎么组织会更自然？',
    ].join('');

    const intent = resolveGeneralChatIntent({
      content,
      userMessageCount: 0,
    });
    const plan = resolveKnowledgeRetrievalPlan({ intent, content });

    expect(intent).toEqual({ kind: 'self_intro' });
    expect(plan).not.toBeNull();
    expect(plan?.categories).toEqual(['interview_playbook', 'project_resume']);
    expect(plan?.preferredTags).toContain('面试');
    expect(plan?.preferredTags).toContain('自我介绍');
  });

  it('简历优化里夹带技术关键词时，仍应优先走 resume_optimize，而不是技术问答检索', () => {
    const content = [
      '我在改简历，里面有一段 React 性能优化经历。',
      '但现在写出来像流水账，想知道怎么改写得更有亮点，也更容易让面试官看出业务价值。',
    ].join('');

    const intent = resolveGeneralChatIntent({
      content,
      userMessageCount: 0,
    });
    const plan = resolveKnowledgeRetrievalPlan({ intent, content });

    expect(intent).toEqual({ kind: 'resume_optimize' });
    expect(plan).not.toBeNull();
    expect(plan?.categories).toEqual(['project_resume', 'interview_playbook']);
    expect(plan?.categories).not.toContain('tech_knowledge');
    expect(plan?.preferredTags).toContain('项目');
    expect(plan?.preferredTags).toContain('简历');
  });

  it('面试流程问题应走 interview_playbook 检索，而不是直接落空', () => {
    const content = '前端面试流程一般是怎么样的？';

    const intent = resolveGeneralChatIntent({
      content,
      userMessageCount: 0,
    });
    const plan = resolveKnowledgeRetrievalPlan({ intent, content });

    expect(intent).toEqual({ kind: 'interview_playbook' });
    expect(plan).not.toBeNull();
    expect(plan?.categories).toEqual(['interview_playbook']);
    expect(plan?.preferredTags).toContain('面试');
    expect(plan?.preferredTags).toContain('流程');
    expect(plan?.resultLimit).toBe(8);
  });

  it('命中 process 形态文档后，应按文档原顺序展开上下文，而不是只保留前几个高分 chunk', () => {
    const searchableChunks = [
      {
        id: 'chunk-0',
        documentId: 'doc-process',
        title: '了解面试流程',
        category: 'interview_playbook' as const,
        contentShape: 'process' as const,
        chunkOrder: 0,
        headingPath: ['寻找工作机会', '投递简历'],
        headingText: '投递简历',
        content: '先投递简历。',
        searchText: '了解面试流程\n投递简历\n先投递简历。',
        tags: ['面试'],
        normalizedTags: ['面试'],
        tokens: ['了解面试流程', '投递简历', '面试'],
      },
      {
        id: 'chunk-1',
        documentId: 'doc-process',
        title: '了解面试流程',
        category: 'interview_playbook' as const,
        contentShape: 'process' as const,
        chunkOrder: 1,
        headingPath: ['寻找工作机会', '一面'],
        headingText: '一面',
        content: '一面内容。',
        searchText: '了解面试流程\n一面\n一面内容。',
        tags: ['面试'],
        normalizedTags: ['面试'],
        tokens: ['了解面试流程', '一面', '面试'],
      },
      {
        id: 'chunk-2',
        documentId: 'doc-process',
        title: '了解面试流程',
        category: 'interview_playbook' as const,
        contentShape: 'process' as const,
        chunkOrder: 2,
        headingPath: ['寻找工作机会', '二面'],
        headingText: '二面',
        content: '二面内容。',
        searchText: '了解面试流程\n二面\n二面内容。',
        tags: ['面试'],
        normalizedTags: ['面试'],
        tokens: ['了解面试流程', '二面', '面试'],
      },
      {
        id: 'chunk-3',
        documentId: 'doc-process',
        title: '了解面试流程',
        category: 'interview_playbook' as const,
        contentShape: 'process' as const,
        chunkOrder: 3,
        headingPath: ['寻找工作机会', '三面'],
        headingText: '三面',
        content: '三面内容。',
        searchText: '了解面试流程\n三面\n三面内容。',
        tags: ['面试'],
        normalizedTags: ['面试'],
        tokens: ['了解面试流程', '三面', '面试'],
      },
    ];

    const rankedResults = [
      {
        chunk: searchableChunks[0],
        score: 4.4,
        lexicalOverlap: ['面试', '流程'],
        matchedTags: ['面试'],
        breakdown: { lexical: 2.3, heading: 0, tag: 2.1, penalty: 0 },
      },
      {
        chunk: searchableChunks[1],
        score: 4.4,
        lexicalOverlap: ['面试', '流程'],
        matchedTags: ['面试'],
        breakdown: { lexical: 2.3, heading: 0, tag: 2.1, penalty: 0 },
      },
      {
        chunk: searchableChunks[2],
        score: 4.4,
        lexicalOverlap: ['面试', '流程'],
        matchedTags: ['面试'],
        breakdown: { lexical: 2.3, heading: 0, tag: 2.1, penalty: 0 },
      },
      {
        chunk: searchableChunks[3],
        score: 3.4,
        lexicalOverlap: ['面试'],
        matchedTags: ['面试'],
        breakdown: { lexical: 1.3, heading: 0, tag: 2.1, penalty: 0 },
      },
    ];

    const results = selectKnowledgeSearchResultsForContext({
      searchableChunks,
      rankedResults,
      resultLimit: 8,
    });

    expect(results.map((result) => result.chunk.headingText)).toEqual([
      '投递简历',
      '一面',
      '二面',
      '三面',
    ]);
  });

  it('命中非 process 文档时，应继续保持普通 TopK chunk 注入', () => {
    const searchableChunks = [
      {
        id: 'chunk-ref-0',
        documentId: 'doc-reference',
        title: '项目亮点模板',
        category: 'project_resume' as const,
        contentShape: 'template' as const,
        chunkOrder: 0,
        headingPath: ['背景'],
        headingText: '背景',
        content: '先讲项目背景。',
        searchText: '项目亮点模板\n背景\n先讲项目背景。',
        tags: ['项目'],
        normalizedTags: ['项目'],
        tokens: ['项目', '背景'],
      },
      {
        id: 'chunk-ref-1',
        documentId: 'doc-reference',
        title: '项目亮点模板',
        category: 'project_resume' as const,
        contentShape: 'template' as const,
        chunkOrder: 1,
        headingPath: ['动作'],
        headingText: '动作',
        content: '再讲关键动作。',
        searchText: '项目亮点模板\n动作\n再讲关键动作。',
        tags: ['项目'],
        normalizedTags: ['项目'],
        tokens: ['项目', '动作'],
      },
    ];

    const rankedResults = [
      {
        chunk: searchableChunks[1],
        score: 5,
        lexicalOverlap: ['项目'],
        matchedTags: ['项目'],
        breakdown: { lexical: 2.8, heading: 0.4, tag: 1.8, penalty: 0 },
      },
      {
        chunk: searchableChunks[0],
        score: 4.4,
        lexicalOverlap: ['项目'],
        matchedTags: ['项目'],
        breakdown: { lexical: 2.4, heading: 0.2, tag: 1.8, penalty: 0 },
      },
    ];

    const results = selectKnowledgeSearchResultsForContext({
      searchableChunks,
      rankedResults,
      resultLimit: 1,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.chunk.headingText).toBe('动作');
  });
});

describe('buildKnowledgeDocumentContextFromResults', () => {
  it('none 模式时应返回空 entries，避免误注入上下文', () => {
    const context = buildKnowledgeDocumentContextFromResults({
      mode: 'none',
      results: [
        {
          chunk: {
            id: 'chunk-1',
            documentId: 'doc-1',
            title: 'React 性能优化面试手册',
            category: 'tech_knowledge',
            contentShape: 'reference',
            chunkOrder: 0,
            headingPath: ['React 性能优化'],
            headingText: 'React 性能优化',
            content: '先定位，再优化。',
            searchText: 'React 性能优化面试手册\n先定位，再优化。',
            tags: ['react'],
            normalizedTags: ['react'],
            tokens: ['react', '性能优化'],
          },
          score: 1.8,
          lexicalOverlap: ['react'],
          matchedTags: [],
          breakdown: {
            lexical: 1.8,
            heading: 0,
            tag: 0,
            penalty: 0,
          },
        },
      ],
    });

    expect(context).toEqual({ mode: 'none', entries: [] });
  });
});

describe('knowledge retrieval trace helpers', () => {
  it('应构建可持久化的检索 trace 条目', () => {
    const content = [
      '我在改简历，里面有一段 React 性能优化经历。',
      '现在写出来像流水账，想知道怎么改写得更有亮点。',
    ].join('');
    const intent = resolveGeneralChatIntent({
      content,
      userMessageCount: 0,
    });
    const plan = resolveKnowledgeRetrievalPlan({ intent, content });

    expect(intent).toEqual({ kind: 'resume_optimize' });
    expect(plan).not.toBeNull();

    if (!intent || intent.kind !== 'resume_optimize' || !plan) {
      throw new Error('预期命中 resume_optimize 检索计划');
    }

    const trace = buildKnowledgeRetrievalTraceEntry({
      intent,
      content,
      plan,
      mode: 'weak',
      now: '2026-03-30T12:00:00.000Z',
      results: [
        {
          chunk: {
            id: 'chunk-1',
            documentId: 'doc-1',
            title: '项目亮点提炼模板',
            category: 'project_resume',
            contentShape: 'template',
            chunkOrder: 0,
            headingPath: ['项目亮点提炼'],
            headingText: '项目亮点提炼',
            content: '背景、目标、动作、结果、业务价值。',
            searchText: '项目亮点提炼模板\n背景、目标、动作、结果、业务价值。',
            tags: ['项目', '简历'],
            normalizedTags: ['项目', '简历'],
            tokens: ['项目', '亮点', '简历'],
          },
          score: 1.2367,
          lexicalOverlap: ['项目'],
          matchedTags: ['简历'],
          breakdown: {
            lexical: 0.8,
            heading: 0.2,
            tag: 0.2367,
            penalty: 0,
          },
        },
      ],
    });

    expect(trace).toEqual({
      createdAt: '2026-03-30T12:00:00.000Z',
      intentKind: 'resume_optimize',
      mode: 'weak',
      categories: ['project_resume', 'interview_playbook'],
      preferredTags: expect.arrayContaining(['项目', '简历', 'react', '性能优化经历']),
      queryHash: buildKnowledgeTraceQueryHash(content),
      queryPreview: content,
      results: [
        {
          documentId: 'doc-1',
          documentTitle: '项目亮点提炼模板',
          category: 'project_resume',
          headingPath: ['项目亮点提炼'],
          score: 1.237,
        },
      ],
    });
    expect(trace.preferredTags).not.toContain('我在改简历');
    expect(trace.preferredTags).not.toContain('在改');
  });

  it('应只保留最近 12 条检索 trace', () => {
    let session = createDraftSession();

    for (let index = 0; index < 14; index += 1) {
      session = appendKnowledgeRetrievalTrace(session, {
        createdAt: `2026-03-30T12:00:${String(index).padStart(2, '0')}.000Z`,
        intentKind: 'technical_question',
        mode: 'none',
        categories: ['tech_knowledge', 'interview_playbook'],
        preferredTags: [`tag-${index}`],
        queryPreview: `query-${index}`,
        results: [],
      });
    }

    expect(session.runtime.knowledgeRetrievalTrace).toHaveLength(12);
    expect(session.runtime.knowledgeRetrievalTrace[0]?.queryPreview).toBe('query-2');
    expect(session.runtime.knowledgeRetrievalTrace.at(-1)?.queryPreview).toBe('query-13');
  });

  it('编辑最后一条知识检索消息时，应裁掉该轮旧 trace，避免保留失效记录', () => {
    const session = appendKnowledgeRetrievalTrace(
      {
        ...createDraftSession(),
        messages: [
          {
            id: 'user-1',
            role: 'user',
            kind: 'text',
            content: 'React useMemo 和 useCallback 的区别是什么？',
            createdAt: '2026-03-31T12:00:00.000Z',
          },
          {
            id: 'assistant-1',
            role: 'assistant',
            kind: 'text',
            content: 'useMemo 缓存值，useCallback 缓存函数引用。',
            createdAt: '2026-03-31T12:00:01.000Z',
            completionStatus: 'completed',
          },
        ],
      },
      {
        createdAt: '2026-03-31T12:00:01.000Z',
        intentKind: 'technical_question',
        mode: 'strong',
        categories: ['tech_knowledge', 'interview_playbook'],
        preferredTags: ['前端', 'react'],
        queryPreview: 'React useMemo 和 useCallback 的区别是什么？',
        results: [],
      },
    );

    const trimmed = trimKnowledgeRetrievalTraceForEditedMessage(session, 'user-1');

    expect(trimmed.runtime.knowledgeRetrievalTrace).toEqual([]);
  });

  it('编辑非知识检索消息时，不应误删已有 trace', () => {
    const session = {
      ...appendKnowledgeRetrievalTrace(createDraftSession(), {
        createdAt: '2026-03-31T12:00:00.000Z',
        intentKind: 'technical_question',
        mode: 'strong',
        categories: ['tech_knowledge', 'interview_playbook'],
        preferredTags: ['前端', 'react'],
        queryPreview: 'React Fiber 的工作原理是什么？',
        results: [],
      }),
      messages: [
        {
          id: 'user-1',
          role: 'user' as const,
          kind: 'text' as const,
          content: '你好',
          createdAt: '2026-03-31T12:00:02.000Z',
        },
      ],
    };

    const trimmed = trimKnowledgeRetrievalTraceForEditedMessage(session, 'user-1');

    expect(trimmed.runtime.knowledgeRetrievalTrace).toHaveLength(1);
    expect(trimmed.runtime.knowledgeRetrievalTrace[0]?.queryPreview).toBe(
      'React Fiber 的工作原理是什么？',
    );
  });
});
