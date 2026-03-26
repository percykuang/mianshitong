import { scryptSync } from 'node:crypto';
import type { Page } from '@playwright/test';
import { Prisma, prisma } from '@mianshitong/db';
import { createInterviewSession, processSessionMessage } from '@mianshitong/interview-engine';
import type { ChatSession, InterviewQuestion } from '@mianshitong/shared';

const ADMIN_EMAIL = 'e2e-admin@mianshitong.local';
const ADMIN_PASSWORD = 'Admin123456!';
const TRACE_USER_EMAIL = 'e2e-user@mianshitong.local';
const TRACE_SESSION_ID = 'admin-trace-e2e-session';

function hashAdminPassword(password: string): string {
  const salt = 'admin-e2e-salt';
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

async function cleanupFixtureRecords(): Promise<void> {
  await prisma.chatSessionRecord.deleteMany({
    where: {
      OR: [{ id: TRACE_SESSION_ID }, { user: { email: TRACE_USER_EMAIL } }],
    },
  });
  await prisma.userActor.deleteMany({
    where: {
      OR: [{ authUser: { email: TRACE_USER_EMAIL } }, { displayName: TRACE_USER_EMAIL }],
    },
  });
  await prisma.authUser.deleteMany({ where: { email: TRACE_USER_EMAIL } });
  await prisma.adminUser.deleteMany({ where: { email: ADMIN_EMAIL } });
}

async function buildTraceSession(): Promise<ChatSession> {
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

  session.id = TRACE_SESSION_ID;

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

  session.title = 'Admin Trace E2E 会话';
  return session;
}

export async function seedAdminTraceSession() {
  await cleanupFixtureRecords();

  await prisma.adminUser.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash: hashAdminPassword(ADMIN_PASSWORD),
    },
  });

  const authUser = await prisma.authUser.create({
    data: {
      email: TRACE_USER_EMAIL,
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

  const session = await buildTraceSession();

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

  return {
    sessionId: session.id,
    adminEmail: ADMIN_EMAIL,
    adminPassword: ADMIN_PASSWORD,
  };
}

export async function cleanupAdminTraceSession(): Promise<void> {
  await cleanupFixtureRecords();
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
