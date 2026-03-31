import { describe, expect, it } from 'vitest';

const helpersPromise = import('../scripts/backfill-knowledge-trace-records.mjs');

describe('knowledge trace backfill helpers', () => {
  it('应为缺失 queryHash 的历史 trace 回填稳定 hash', async () => {
    const { buildLegacyKnowledgeTraceQueryHash, normalizeBackfillKnowledgeTraceRecord } =
      await helpersPromise;
    const record = normalizeBackfillKnowledgeTraceRecord({
      sessionId: 'session-1',
      actorId: 'actor-1',
      userId: 'user-1',
      trace: {
        createdAt: '2026-03-31T12:00:00.000Z',
        intentKind: 'technical_question',
        mode: 'strong',
        categories: ['tech_knowledge', 'unknown'],
        preferredTags: [' Promise ', 'Promise', '', ' 微任务 '],
        queryPreview: ' Promise 和微任务怎么解释？ ',
        results: [
          {
            documentId: 'doc-1',
            documentTitle: '事件循环',
            category: 'tech_knowledge',
            headingPath: ['事件循环', '微任务'],
            score: 1.234,
          },
        ],
      },
    });

    expect(record).toEqual({
      sessionId: 'session-1',
      actorId: 'actor-1',
      userId: 'user-1',
      triggerKind: 'new_message',
      queryHash: buildLegacyKnowledgeTraceQueryHash('Promise 和微任务怎么解释？'),
      queryPreview: 'Promise 和微任务怎么解释？',
      intentKind: 'technical_question',
      mode: 'strong',
      categories: ['tech_knowledge'],
      preferredTags: ['Promise', '微任务'],
      createdAt: new Date('2026-03-31T12:00:00.000Z'),
      results: [
        {
          rank: 0,
          documentId: 'doc-1',
          documentTitle: '事件循环',
          category: 'tech_knowledge',
          headingPath: ['事件循环', '微任务'],
          score: 1.234,
        },
      ],
    });
  });

  it('应从 runtime 中提取有效历史 trace 并跳过无效项', async () => {
    const { extractBackfillKnowledgeTraceRecordsFromRuntime } = await helpersPromise;
    const records = extractBackfillKnowledgeTraceRecordsFromRuntime({
      id: 'session-1',
      actorId: 'actor-1',
      userId: null,
      runtime: {
        knowledgeRetrievalTrace: [
          {
            createdAt: '2026-03-31T12:00:00.000Z',
            intentKind: 'technical_question',
            mode: 'weak',
            categories: ['tech_knowledge'],
            preferredTags: ['前端'],
            queryPreview: '事件循环怎么回答',
            results: [],
          },
          {
            createdAt: 'invalid-date',
            intentKind: 'technical_question',
            mode: 'weak',
            categories: ['tech_knowledge'],
            preferredTags: [],
            queryPreview: '这条应被跳过',
            results: [],
          },
        ],
      },
    });

    expect(records).toHaveLength(1);
    expect(records[0]?.queryPreview).toBe('事件循环怎么回答');
  });

  it('应使用稳定去重键避免重复回填', async () => {
    const { buildKnowledgeTraceBackfillDedupKey } = await helpersPromise;
    const left = buildKnowledgeTraceBackfillDedupKey({
      sessionId: 'session-1',
      triggerKind: 'new_message',
      createdAt: new Date('2026-03-31T12:00:00.000Z'),
      intentKind: 'technical_question',
      mode: 'strong',
      queryHash: 'hash-1',
      queryPreview: 'query-1',
    });
    const right = buildKnowledgeTraceBackfillDedupKey({
      sessionId: 'session-1',
      triggerKind: 'new_message',
      createdAt: new Date('2026-03-31T12:00:00.000Z'),
      intentKind: 'technical_question',
      mode: 'strong',
      queryHash: 'hash-1',
      queryPreview: 'query-1',
    });

    expect(left).toBe(right);
  });

  it('应解析 dry-run 与批量参数', async () => {
    const { parseBackfillKnowledgeTraceArgs } = await helpersPromise;
    expect(
      parseBackfillKnowledgeTraceArgs([
        '--dry-run',
        '--batch-size=50',
        '--limit-sessions=10',
        '--session-id=session-1',
        '--created-after=2026-03-01T00:00:00.000Z',
        '--created-before=2026-03-31T23:59:59.000Z',
        '--report-json=/tmp/knowledge-trace-backfill.json',
      ]),
    ).toEqual({
      dryRun: true,
      batchSize: 50,
      limitSessions: 10,
      sessionId: 'session-1',
      createdAfter: new Date('2026-03-01T00:00:00.000Z'),
      createdBefore: new Date('2026-03-31T23:59:59.000Z'),
      reportJson: '/tmp/knowledge-trace-backfill.json',
    });
  });

  it('应按 createdAt 时间窗口过滤回填记录', async () => {
    const { shouldIncludeBackfillRecord } = await helpersPromise;
    const record = {
      createdAt: new Date('2026-03-15T12:00:00.000Z'),
    };

    expect(
      shouldIncludeBackfillRecord(record, {
        createdAfter: new Date('2026-03-01T00:00:00.000Z'),
        createdBefore: new Date('2026-03-31T23:59:59.000Z'),
      }),
    ).toBe(true);
    expect(
      shouldIncludeBackfillRecord(record, {
        createdAfter: new Date('2026-03-20T00:00:00.000Z'),
        createdBefore: null,
      }),
    ).toBe(false);
  });

  it('应生成结构化 backfill 报告', async () => {
    const { buildKnowledgeTraceBackfillReport } = await helpersPromise;

    expect(
      buildKnowledgeTraceBackfillReport({
        options: {
          batchSize: 100,
          dryRun: true,
          limitSessions: 20,
          sessionId: null,
          createdAfter: new Date('2026-03-01T00:00:00.000Z'),
          createdBefore: null,
          reportJson: '/tmp/report.json',
        },
        summary: {
          scannedSessions: 20,
          sessionsWithTrace: 3,
          extractedTraceRecords: 5,
          filteredOutByCreatedAt: 2,
          skippedExistingRecords: 1,
          createdTraceRecords: 2,
        },
        startedAt: new Date('2026-03-31T12:00:00.000Z'),
        finishedAt: new Date('2026-03-31T12:00:03.000Z'),
      }),
    ).toEqual({
      startedAt: '2026-03-31T12:00:00.000Z',
      finishedAt: '2026-03-31T12:00:03.000Z',
      options: {
        batchSize: 100,
        dryRun: true,
        limitSessions: 20,
        sessionId: null,
        createdAfter: '2026-03-01T00:00:00.000Z',
        createdBefore: null,
        reportJson: '/tmp/report.json',
      },
      summary: {
        scannedSessions: 20,
        sessionsWithTrace: 3,
        extractedTraceRecords: 5,
        filteredOutByCreatedAt: 2,
        skippedExistingRecords: 1,
        createdTraceRecords: 2,
      },
    });
  });
});
