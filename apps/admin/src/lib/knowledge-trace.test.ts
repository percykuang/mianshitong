import { describe, expect, it } from 'vitest';
import type { KnowledgeTraceSessionSource } from './knowledge-trace';
import {
  buildKnowledgeTraceOverview,
  buildKnowledgeTraceRegressionCandidates,
  filterKnowledgeTraceRows,
  flattenKnowledgeTraceRows,
  mapKnowledgeTraceRecordSourcesToRows,
  normalizeKnowledgeTraceIntentKind,
  normalizeKnowledgeTraceMode,
} from './knowledge-trace';

const sessionSources: KnowledgeTraceSessionSource[] = [
  {
    sessionId: 'session-1',
    sessionTitle: 'React 面试准备',
    sessionUpdatedAt: '2026-03-30T10:00:00.000Z',
    actorId: 'actor-1',
    actorLabel: 'guest-1',
    actorType: 'guest' as const,
    runtime: {
      questionPlan: [],
      currentQuestionIndex: 0,
      followUpRound: 0,
      currentStage: 'technical',
      activeQuestionAnswers: [],
      assessments: [],
      followUpTrace: [],
      assessmentTrace: [],
      resumeProfile: null,
      interviewBlueprint: null,
      planningSummary: null,
      planGeneratedAt: null,
      planningTrace: null,
      reportTrace: null,
      projectQuestion: null,
      knowledgeRetrievalTrace: [
        {
          createdAt: '2026-03-30T10:00:00.000Z',
          intentKind: 'technical_question',
          mode: 'strong',
          categories: ['tech_knowledge', 'interview_playbook'],
          preferredTags: ['react', '前端'],
          queryPreview: 'React useMemo 和 useCallback 的区别',
          results: [
            {
              documentId: 'doc-1',
              documentTitle: 'React Hooks 面试手册',
              category: 'tech_knowledge',
              headingPath: ['Hooks', 'useMemo 与 useCallback'],
              score: 1.8,
            },
          ],
        },
      ],
    },
  },
  {
    sessionId: 'session-2',
    sessionTitle: '简历修改',
    sessionUpdatedAt: '2026-03-30T11:00:00.000Z',
    actorId: 'actor-2',
    actorLabel: 'user@example.com',
    actorType: 'registered' as const,
    runtime: {
      questionPlan: [],
      currentQuestionIndex: 0,
      followUpRound: 0,
      currentStage: 'technical',
      activeQuestionAnswers: [],
      assessments: [],
      followUpTrace: [],
      assessmentTrace: [],
      resumeProfile: null,
      interviewBlueprint: null,
      planningSummary: null,
      planGeneratedAt: null,
      planningTrace: null,
      reportTrace: null,
      projectQuestion: null,
      knowledgeRetrievalTrace: [
        {
          createdAt: '2026-03-30T11:00:00.000Z',
          intentKind: 'resume_optimize',
          mode: 'weak',
          categories: ['project_resume', 'interview_playbook'],
          preferredTags: ['简历', '项目'],
          queryPreview: '简历里的项目经历怎么写得更有亮点',
          results: [
            {
              documentId: 'doc-2',
              documentTitle: '项目亮点提炼模板',
              category: 'project_resume',
              headingPath: ['项目亮点提炼'],
              score: 1.2,
            },
          ],
        },
        {
          createdAt: '2026-03-30T11:05:00.000Z',
          intentKind: 'resume_optimize',
          mode: 'none',
          categories: ['project_resume', 'interview_playbook'],
          preferredTags: ['简历'],
          queryPreview: '我这段经历还是写得太流水账',
          results: [],
        },
      ],
    },
  },
];

describe('knowledge trace helpers', () => {
  it('应把会话 runtime 展平成 trace rows', () => {
    const rows = flattenKnowledgeTraceRows(sessionSources);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      sessionId: 'session-1',
      topDocumentTitle: 'React Hooks 面试手册',
      resultCount: 1,
    });
    expect(rows[2]).toMatchObject({
      sessionId: 'session-2',
      mode: 'none',
      resultCount: 0,
      topDocumentTitle: null,
    });
  });

  it('应支持按 intent、mode 和 keyword 过滤', () => {
    const rows = flattenKnowledgeTraceRows(sessionSources);
    const filtered = filterKnowledgeTraceRows(rows, {
      intentKind: 'resume_optimize',
      mode: 'weak',
      keyword: '亮点',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.queryPreview).toBe('简历里的项目经历怎么写得更有亮点');
  });

  it('应输出概览统计', () => {
    const rows = flattenKnowledgeTraceRows(sessionSources);
    const overview = buildKnowledgeTraceOverview(rows);

    expect(overview).toMatchObject({
      totalTraces: 3,
      tracedSessionCount: 2,
      strongCount: 1,
      weakCount: 1,
      noneCount: 1,
    });
    expect(overview.modeDistribution.map((item) => item.key)).toEqual(['none', 'strong', 'weak']);
    expect(overview.topDocuments[0]).toMatchObject({
      key: 'React Hooks 面试手册',
      count: 1,
    });
  });

  it('应按 queryHash 聚合高频 Query，避免被截断摘要误合并', () => {
    const rows = mapKnowledgeTraceRecordSourcesToRows([
      {
        id: 'trace-1',
        sessionId: 'session-1',
        sessionTitle: 'A',
        sessionUpdatedAt: '2026-03-30T10:00:00.000Z',
        actorId: 'actor-1',
        actorLabel: 'guest-1',
        actorType: 'guest',
        entry: {
          createdAt: '2026-03-30T10:00:00.000Z',
          intentKind: 'technical_question',
          mode: 'strong',
          categories: ['tech_knowledge'],
          preferredTags: ['react'],
          queryHash: 'hash-a',
          queryPreview: '一个很长的问题摘要 A',
          results: [],
        },
      },
      {
        id: 'trace-2',
        sessionId: 'session-2',
        sessionTitle: 'B',
        sessionUpdatedAt: '2026-03-30T10:01:00.000Z',
        actorId: 'actor-2',
        actorLabel: 'guest-2',
        actorType: 'guest',
        entry: {
          createdAt: '2026-03-30T10:01:00.000Z',
          intentKind: 'technical_question',
          mode: 'weak',
          categories: ['tech_knowledge'],
          preferredTags: ['react'],
          queryHash: 'hash-a',
          queryPreview: '另一个被截断后的摘要 A',
          results: [],
        },
      },
    ]);

    const overview = buildKnowledgeTraceOverview(rows);

    expect(overview.topQueries[0]).toMatchObject({
      count: 2,
      label: '一个很长的问题摘要 A',
    });
  });

  it('应输出优先回灌到 eval 的 weak/none 候选样本', () => {
    const rows = flattenKnowledgeTraceRows(sessionSources);
    const candidates = buildKnowledgeTraceRegressionCandidates(rows, 5);

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      dominantMode: 'none',
      queryPreview: '我这段经历还是写得太流水账',
      count: 1,
    });
    expect(candidates[1]).toMatchObject({
      dominantMode: 'weak',
      queryPreview: '简历里的项目经历怎么写得更有亮点',
      topDocumentTitle: '项目亮点提炼模板',
    });
  });

  it('应兼容无效的 intent 和 mode 查询参数', () => {
    expect(normalizeKnowledgeTraceIntentKind('technical_question')).toBe('technical_question');
    expect(normalizeKnowledgeTraceIntentKind('interview_playbook')).toBe('interview_playbook');
    expect(normalizeKnowledgeTraceIntentKind('unknown')).toBe('');
    expect(normalizeKnowledgeTraceMode('strong')).toBe('strong');
    expect(normalizeKnowledgeTraceMode('invalid')).toBe('');
  });
});
