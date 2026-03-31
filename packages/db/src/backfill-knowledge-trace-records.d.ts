declare module '../scripts/backfill-knowledge-trace-records.mjs' {
  export interface BackfillKnowledgeTraceResultRecord {
    rank: number;
    documentId: string;
    documentTitle: string;
    category: 'tech_knowledge' | 'interview_playbook' | 'project_resume';
    headingPath: string[];
    score: number;
  }

  export interface BackfillKnowledgeTraceRecord {
    sessionId: string;
    actorId: string;
    userId: string | null;
    triggerKind: 'new_message';
    queryHash: string;
    queryPreview: string;
    intentKind:
      | 'technical_question'
      | 'interview_playbook'
      | 'project_highlight'
      | 'resume_optimize'
      | 'self_intro';
    mode: 'strong' | 'weak' | 'none';
    categories: Array<'tech_knowledge' | 'interview_playbook' | 'project_resume'>;
    preferredTags: string[];
    createdAt: Date;
    results: BackfillKnowledgeTraceResultRecord[];
  }

  export interface BackfillKnowledgeTraceArgs {
    batchSize: number;
    dryRun: boolean;
    limitSessions: number | null;
    sessionId: string | null;
  }

  export function buildLegacyKnowledgeTraceQueryHash(queryPreview: string): string;
  export function normalizeBackfillKnowledgeTraceRecord(input: {
    sessionId: string;
    actorId: string;
    userId?: string | null;
    trace: unknown;
  }): BackfillKnowledgeTraceRecord | null;
  export function buildKnowledgeTraceBackfillDedupKey(record: {
    sessionId: string;
    triggerKind: string;
    createdAt: Date | string;
    intentKind: string;
    mode: string;
    queryHash: string;
    queryPreview: string;
  }): string;
  export function extractBackfillKnowledgeTraceRecordsFromRuntime(sessionRecord: {
    id: string;
    actorId: string;
    userId?: string | null;
    runtime: unknown;
  }): BackfillKnowledgeTraceRecord[];
  export function parseBackfillKnowledgeTraceArgs(argv: string[]): BackfillKnowledgeTraceArgs;
}
