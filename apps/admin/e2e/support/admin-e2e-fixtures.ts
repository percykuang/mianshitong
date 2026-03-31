import { scryptSync } from 'node:crypto';
import type { Page } from '@playwright/test';
import { Prisma, prisma } from '@mianshitong/db';
import { createInterviewSession, processSessionMessage } from '@mianshitong/interview-engine';
import type { ChatSession, InterviewQuestion } from '@mianshitong/shared';

const ADMIN_PASSWORD = 'Admin123456!';
const E2E_DATABASE_URL =
  'postgresql://mianshitong:mianshitong@127.0.0.1:5432/mianshitong?schema=public';
const TRACE_USER_EMAIL_PREFIX = 'e2e-user';
const TRACE_SESSION_ID_PREFIX = 'admin-trace-e2e-session';

interface AdminTraceFixtureIdentity {
  adminEmail: string;
  traceUserEmail: string;
  traceSessionId: string;
}

function ensureE2eDatabaseUrl(): void {
  process.env.DATABASE_URL ||= E2E_DATABASE_URL;
}

function hashAdminPassword(password: string): string {
  const salt = 'admin-e2e-salt';
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

async function cleanupFixtureRecords(identity: AdminTraceFixtureIdentity): Promise<void> {
  await prisma.chatSessionRecord.deleteMany({
    where: {
      OR: [{ id: identity.traceSessionId }, { user: { email: identity.traceUserEmail } }],
    },
  });
  await prisma.userActor.deleteMany({
    where: {
      OR: [
        { authUser: { email: identity.traceUserEmail } },
        { displayName: identity.traceUserEmail },
      ],
    },
  });
  await prisma.authUser.deleteMany({ where: { email: identity.traceUserEmail } });
  await prisma.adminUser.deleteMany({ where: { email: identity.adminEmail } });
}

async function buildTraceSession(traceSessionId: string): Promise<ChatSession> {
  const questionBank: InterviewQuestion[] = [
    {
      id: 'js_event_loop',
      level: 'mid',
      title: '事件循环与任务调度',
      prompt: '请你讲一下浏览器事件循环里宏任务和微任务的执行顺序。',
      keyPoints: ['Promise', '宏任务', '微任务'],
      followUps: ['Node.js 里的 nextTick 和 Promise 微任务顺序有什么差异？'],
      tags: ['javascript', 'JavaScript'],
    },
  ];

  let session = createInterviewSession({
    now: '2026-03-22T10:00:00.000Z',
    config: {
      topics: ['javascript'],
      level: 'mid',
      questionCount: 1,
      feedbackMode: 'per_question',
    },
    questionBank,
  });

  session.id = traceSessionId;

  session = (
    await processSessionMessage({
      session,
      content: '开始模拟面试，我有 3 年前端经验，主要做 React 和 JavaScript。',
      questionBank,
      now: '2026-03-22T10:01:00.000Z',
    })
  ).session;

  session = (
    await processSessionMessage({
      session,
      content: '我知道 Promise。',
      questionBank,
      now: '2026-03-22T10:02:00.000Z',
    })
  ).session;

  session = (
    await processSessionMessage({
      session,
      content:
        '调用栈清空后会先执行微任务再执行宏任务，Promise 属于微任务，最后再进入下一轮事件循环。',
      questionBank,
      now: '2026-03-22T10:03:00.000Z',
    })
  ).session;

  session.runtime.knowledgeRetrievalTrace = [
    {
      createdAt: '2026-03-22T10:02:30.000Z',
      intentKind: 'technical_question',
      mode: 'strong',
      categories: ['tech_knowledge', 'interview_playbook'],
      preferredTags: ['前端', '事件循环', 'Promise', '微任务'],
      queryPreview: 'Promise、宏任务、微任务的执行顺序怎么回答更清楚？',
      results: [
        {
          documentId: 'doc-tech-event-loop',
          documentTitle: '事件循环面试回答模板',
          category: 'tech_knowledge',
          headingPath: ['事件循环', '宏任务与微任务'],
          score: 1.732,
        },
      ],
    },
  ];

  session.title = 'Admin Trace E2E 会话';
  return session;
}

export async function seedAdminTraceSession() {
  ensureE2eDatabaseUrl();
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const identity: AdminTraceFixtureIdentity = {
    adminEmail: `e2e-admin+${suffix}@mianshitong.local`,
    traceUserEmail: `${TRACE_USER_EMAIL_PREFIX}+${suffix}@mianshitong.local`,
    traceSessionId: `${TRACE_SESSION_ID_PREFIX}-${suffix}`,
  };

  await cleanupFixtureRecords(identity);

  await prisma.adminUser.create({
    data: {
      email: identity.adminEmail,
      passwordHash: hashAdminPassword(ADMIN_PASSWORD),
    },
  });

  const authUser = await prisma.authUser.create({
    data: {
      email: identity.traceUserEmail,
      passwordHash: 'not-used-in-e2e',
    },
  });
  await prisma.userActor.create({
    data: {
      id: authUser.id,
      type: 'registered',
      displayName: authUser.email,
      authUserId: authUser.id,
      lastSeenAt: new Date(),
    },
  });

  const session = await buildTraceSession(identity.traceSessionId);

  await prisma.chatSessionRecord.create({
    data: {
      id: session.id,
      actorId: authUser.id,
      userId: authUser.id,
      title: session.title,
      modelId: session.modelId,
      isPrivate: session.isPrivate,
      status: session.status,
      config: session.config as unknown as Prisma.InputJsonValue,
      report:
        session.report === null
          ? Prisma.JsonNull
          : (session.report as unknown as Prisma.InputJsonValue),
      runtime: session.runtime as unknown as Prisma.InputJsonValue,
      messages: session.messages as unknown as Prisma.InputJsonValue,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
    },
  });

  await prisma.knowledgeRetrievalTraceRecord.create({
    data: {
      sessionId: session.id,
      actorId: authUser.id,
      userId: authUser.id,
      triggerKind: 'new_message',
      queryHash: 'admin-trace-e2e-query-hash',
      queryPreview: 'Promise、宏任务、微任务的执行顺序怎么回答更清楚？',
      intentKind: 'technical_question',
      mode: 'strong',
      categories: ['tech_knowledge', 'interview_playbook'],
      preferredTags: ['前端', '事件循环', 'Promise', '微任务'],
      createdAt: new Date('2026-03-22T10:02:30.000Z'),
      results: {
        create: [
          {
            rank: 0,
            documentId: 'doc-tech-event-loop',
            documentTitle: '事件循环面试回答模板',
            category: 'tech_knowledge',
            headingPath: ['事件循环', '宏任务与微任务'],
            score: 1.732,
          },
        ],
      },
    },
  });

  return {
    ...identity,
    sessionId: session.id,
    adminPassword: ADMIN_PASSWORD,
  };
}

export async function cleanupAdminTraceSession(identity: AdminTraceFixtureIdentity): Promise<void> {
  ensureE2eDatabaseUrl();
  await cleanupFixtureRecords(identity);
}

export async function loginAdmin(
  page: Page,
  input: { email: string; password: string },
): Promise<void> {
  const response = await page.request.post('/api/admin/login', {
    data: {
      email: input.email,
      password: input.password,
    },
  });

  if (!response.ok()) {
    const body = await response.text().catch(() => '');
    throw new Error(`admin login failed: ${response.status()} ${body}`);
  }
}
