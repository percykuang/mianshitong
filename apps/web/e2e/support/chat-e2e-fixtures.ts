import { execFileSync } from 'node:child_process';
import { expect, type Page } from '@playwright/test';
import { prisma } from '@mianshitong/db';
import { buildKnowledgeDocumentChunks } from '@mianshitong/retrieval';
import type { CreateSessionInput } from '@mianshitong/shared';

export interface CreatedChatSession {
  id: string;
  title: string;
  assistantContent: string;
}

export interface ChatConversationTurn {
  user: string;
  assistant?: string;
}

export interface CreatedConfiguredSession {
  id: string;
}

export interface SeededKnowledgeDocumentFixture {
  documentId: string;
  title: string;
  prompt: string;
  expectedKnowledgeHitText: string;
}

const KNOWLEDGE_DOCUMENT_E2E_TITLE = 'E2E React 性能优化面试手册';
const INTERVIEW_PLAYBOOK_DOCUMENT_E2E_TITLE = 'E2E 前端面试流程手册';
const RESUME_KNOWLEDGE_DOCUMENT_E2E_TITLE = 'E2E 项目亮点提炼模板';
const E2E_DATABASE_URL =
  'postgresql://mianshitong:mianshitong@127.0.0.1:5432/mianshitong?schema=public';
const E2E_ASSISTANT_RESPONSE_TIMEOUT_MS = 15_000;
const QUESTION_BANK_FIXTURE_PREFIX = 'rag_fixture_';

let ensureQuestionBankFixturesPromise: Promise<void> | null = null;

function ensureE2eDatabaseUrl(): void {
  process.env.DATABASE_URL ||= E2E_DATABASE_URL;
}

async function ensureInterviewQuestionBankFixtures(): Promise<void> {
  ensureE2eDatabaseUrl();

  if (!ensureQuestionBankFixturesPromise) {
    ensureQuestionBankFixturesPromise = (async () => {
      const existingCount = await prisma.questionBankItem.count({
        where: {
          questionId: {
            startsWith: QUESTION_BANK_FIXTURE_PREFIX,
          },
        },
      });

      if (existingCount > 0) {
        return;
      }

      execFileSync('pnpm', ['retrieval:seed-fixtures'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_URL: process.env.DATABASE_URL ?? E2E_DATABASE_URL,
        },
        stdio: 'inherit',
      });
    })().catch((error) => {
      ensureQuestionBankFixturesPromise = null;
      throw error;
    });
  }

  await ensureQuestionBankFixturesPromise;
}

export async function seedKnowledgeDocumentFixture(): Promise<SeededKnowledgeDocumentFixture> {
  ensureE2eDatabaseUrl();
  await cleanupKnowledgeDocumentFixture();

  const title = KNOWLEDGE_DOCUMENT_E2E_TITLE;
  const content = [
    '# React 性能优化',
    '## 核心原则',
    '先定位，再优化，避免为了优化而优化。',
    '',
    '## 常见手段',
    'React.memo 用于减少不必要的子组件重渲染。',
    '长列表优先考虑虚拟列表。',
    '只有在稳定引用确实能减少渲染成本时，再考虑 useMemo 和 useCallback。',
    '',
    '## 面试回答建议',
    '回答时先给结论，再讲适用场景、收益、代价和常见误区。',
    '当问题没有明显性能瓶颈时，不要滥用缓存型优化。',
  ].join('\n');

  const document = await prisma.knowledgeDocument.create({
    data: {
      title,
      category: 'tech_knowledge',
      contentShape: 'reference',
      summary: '用于验证 Web 聊天里的知识文档检索增强链路。',
      content,
      tags: ['react', 'performance', 'useMemo', 'useCallback'],
      isPublished: true,
    },
  });

  const chunks = buildKnowledgeDocumentChunks({
    documentId: document.id,
    title,
    category: 'tech_knowledge',
    contentShape: 'reference',
    summary: document.summary,
    tags: [...document.tags],
    content,
  });

  await prisma.knowledgeDocumentChunk.createMany({
    data: chunks.map((chunk) => ({
      documentId: document.id,
      chunkOrder: chunk.chunkOrder,
      headingPath: [...chunk.headingPath],
      headingText: chunk.headingText,
      content: chunk.content,
      searchText: chunk.searchText,
      tags: [...chunk.tags],
      normalizedTags: [...chunk.normalizedTags],
    })),
  });

  return {
    documentId: document.id,
    title,
    prompt: 'React 性能优化在面试里应该怎么回答？什么时候不该滥用 useMemo 和 useCallback？',
    expectedKnowledgeHitText: '知识命中：技术知识::',
  };
}

export async function seedInterviewPlaybookKnowledgeDocumentFixture(): Promise<SeededKnowledgeDocumentFixture> {
  ensureE2eDatabaseUrl();
  await cleanupInterviewPlaybookKnowledgeDocumentFixture();

  const title = INTERVIEW_PLAYBOOK_DOCUMENT_E2E_TITLE;
  const content = [
    '# 前端面试流程',
    '## 常见环节',
    '通常会经历简历筛选、技术一面、技术二面、HR 面和 offer 沟通。',
    '',
    '## 准备建议',
    '技术一面重点准备基础知识和项目表达。',
    '技术二面重点准备项目取舍、复杂问题排查和性能优化。',
    'HR 面重点准备职业规划、离职原因和沟通协作案例。',
  ].join('\n');

  const document = await prisma.knowledgeDocument.create({
    data: {
      title,
      category: 'interview_playbook',
      contentShape: 'process',
      summary: '用于验证面试流程类问题会命中 interview_playbook 文档。',
      content,
      tags: ['面试', '流程', '一面', '二面', 'HR 面'],
      isPublished: true,
    },
  });

  const chunks = buildKnowledgeDocumentChunks({
    documentId: document.id,
    title,
    category: 'interview_playbook',
    contentShape: 'process',
    summary: document.summary,
    tags: [...document.tags],
    content,
  });

  await prisma.knowledgeDocumentChunk.createMany({
    data: chunks.map((chunk) => ({
      documentId: document.id,
      chunkOrder: chunk.chunkOrder,
      headingPath: [...chunk.headingPath],
      headingText: chunk.headingText,
      content: chunk.content,
      searchText: chunk.searchText,
      tags: [...chunk.tags],
      normalizedTags: [...chunk.normalizedTags],
    })),
  });

  return {
    documentId: document.id,
    title,
    prompt: '前端面试流程一般是怎么样的？',
    expectedKnowledgeHitText: '知识命中：面试打法::',
  };
}

export async function seedResumeKnowledgeDocumentFixture(): Promise<SeededKnowledgeDocumentFixture> {
  ensureE2eDatabaseUrl();
  await cleanupResumeKnowledgeDocumentFixture();

  const title = RESUME_KNOWLEDGE_DOCUMENT_E2E_TITLE;
  const content = [
    '# 项目亮点提炼',
    '## 基本框架',
    '先交代项目背景和业务目标，再说明自己负责的关键动作。',
    '最后补结果和指标，用数据体现影响。',
    '',
    '## 表达建议',
    '优先强调复杂性、取舍和结果。',
    '避免只堆技术名词，不解释业务价值。',
  ].join('\n');

  const document = await prisma.knowledgeDocument.create({
    data: {
      title,
      category: 'project_resume',
      contentShape: 'template',
      summary: '用于验证简历优化和项目亮点链路会命中 project_resume 文档。',
      content,
      tags: ['项目', '简历', '亮点', '业务价值'],
      isPublished: true,
    },
  });

  const chunks = buildKnowledgeDocumentChunks({
    documentId: document.id,
    title,
    category: 'project_resume',
    contentShape: 'template',
    summary: document.summary,
    tags: [...document.tags],
    content,
  });

  await prisma.knowledgeDocumentChunk.createMany({
    data: chunks.map((chunk) => ({
      documentId: document.id,
      chunkOrder: chunk.chunkOrder,
      headingPath: [...chunk.headingPath],
      headingText: chunk.headingText,
      content: chunk.content,
      searchText: chunk.searchText,
      tags: [...chunk.tags],
      normalizedTags: [...chunk.normalizedTags],
    })),
  });

  return {
    documentId: document.id,
    title,
    prompt: [
      '我在改简历，里面有一段 React 性能优化经历。',
      '但现在写出来像流水账，想知道怎么改写得更有亮点，也更容易让面试官看出业务价值。',
    ].join(''),
    expectedKnowledgeHitText: '知识命中：项目/简历::',
  };
}

export async function cleanupKnowledgeDocumentFixture(): Promise<void> {
  ensureE2eDatabaseUrl();
  await prisma.knowledgeDocument.deleteMany({
    where: {
      title: KNOWLEDGE_DOCUMENT_E2E_TITLE,
    },
  });
}

export async function cleanupInterviewPlaybookKnowledgeDocumentFixture(): Promise<void> {
  ensureE2eDatabaseUrl();
  await prisma.knowledgeDocument.deleteMany({
    where: {
      title: INTERVIEW_PLAYBOOK_DOCUMENT_E2E_TITLE,
    },
  });
}

export async function cleanupResumeKnowledgeDocumentFixture(): Promise<void> {
  ensureE2eDatabaseUrl();
  await prisma.knowledgeDocument.deleteMany({
    where: {
      title: RESUME_KNOWLEDGE_DOCUMENT_E2E_TITLE,
    },
  });
}

export async function openChat(page: Page): Promise<void> {
  await page.goto('/chat');
  await expect(page.getByTestId('multimodal-input')).toBeVisible();
}

export async function createConfiguredSession(
  page: Page,
  input: CreateSessionInput,
): Promise<CreatedConfiguredSession> {
  await ensureInterviewQuestionBankFixtures();
  await openChat(page);

  const result = await page.evaluate(async (payload) => {
    const response = await fetch('/api/chat/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const json = (await response.json()) as {
      session?: { id?: string };
      message?: string;
    };

    return {
      ok: response.ok,
      status: response.status,
      sessionId: json.session?.id ?? null,
      message: json.message ?? null,
    };
  }, input);

  expect(result.ok, result.message ?? `创建会话失败，状态码 ${result.status}`).toBe(true);
  expect(result.sessionId).toMatch(/^[0-9a-f]{32}$/);

  return {
    id: result.sessionId!,
  };
}

function resolveExpectedAssistantContent(prompt: string): string {
  return `[web-e2e] 已按真实模型链路处理：${prompt}`;
}

function resolveSessionIdFromUrl(url: string): string {
  const matched = /\/chat\/([0-9a-f]{32})$/.exec(url);
  if (!matched?.[1]) {
    throw new Error(`无法从当前 URL 解析会话 ID: ${url}`);
  }

  return matched[1];
}

async function waitForCompletedAssistantTurn(
  page: Page,
  input: {
    userContent: string;
    assistantContent: string;
  },
): Promise<void> {
  const main = page.getByRole('main');

  await expect(main).toContainText(input.userContent, {
    timeout: E2E_ASSISTANT_RESPONSE_TIMEOUT_MS,
  });
  await expect(main).toContainText(input.assistantContent, {
    timeout: E2E_ASSISTANT_RESPONSE_TIMEOUT_MS,
  });
  await expect(page.getByTestId('send-button')).toHaveAttribute('aria-label', '发送消息', {
    timeout: E2E_ASSISTANT_RESPONSE_TIMEOUT_MS,
  });
}

export async function createRemoteSession(page: Page, prompt: string): Promise<CreatedChatSession> {
  await openChat(page);

  const quickPromptButton = page.getByRole('button', { name: prompt });
  if (await quickPromptButton.count()) {
    await quickPromptButton.first().click();
  } else {
    await page.getByTestId('multimodal-input').fill(prompt);
    await page.getByTestId('send-button').click();
  }

  await expect(page).toHaveURL(/\/chat\/[0-9a-f]{32}$/);
  const assistantContent = resolveExpectedAssistantContent(prompt);
  await waitForCompletedAssistantTurn(page, {
    userContent: prompt,
    assistantContent,
  });

  return {
    id: resolveSessionIdFromUrl(page.url()),
    title: prompt,
    assistantContent,
  };
}

export async function createRemoteConversationSession(
  page: Page,
  turns: ChatConversationTurn[],
): Promise<CreatedChatSession> {
  if (turns.length === 0) {
    throw new Error('至少需要一轮对话来创建会话');
  }

  await openChat(page);

  for (const turn of turns) {
    await page.getByTestId('multimodal-input').fill(turn.user);
    await page.getByTestId('send-button').click();

    const assistantContent = turn.assistant ?? resolveExpectedAssistantContent(turn.user);
    await waitForCompletedAssistantTurn(page, {
      userContent: turn.user,
      assistantContent,
    });
  }

  const lastTurn = turns.at(-1)!;
  return {
    id: resolveSessionIdFromUrl(page.url()),
    title: turns[0]!.user,
    assistantContent: lastTurn.assistant ?? resolveExpectedAssistantContent(lastTurn.user),
  };
}
