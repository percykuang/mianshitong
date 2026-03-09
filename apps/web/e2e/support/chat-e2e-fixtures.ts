import type { Page } from '@playwright/test';
import { normalizeInterviewConfig, type ChatMessage, type ChatSession } from '@mianshitong/shared';

const DB_NAME = 'mianshitong-chat';
const STORE_NAME = 'sessions';

interface BuildSessionInput {
  id: string;
  title: string;
  createdAt: string;
  userContent: string;
  assistantContent: string;
}

function createMessage(input: {
  id: string;
  role: ChatMessage['role'];
  kind: ChatMessage['kind'];
  content: string;
  createdAt: string;
}): ChatMessage {
  return {
    id: input.id,
    role: input.role,
    kind: input.kind,
    content: input.content,
    createdAt: input.createdAt,
  };
}

export function buildGuestSession(input: BuildSessionInput): ChatSession {
  return {
    id: input.id,
    title: input.title,
    modelId: 'deepseek-chat',
    isPrivate: true,
    status: 'idle',
    config: normalizeInterviewConfig(undefined),
    report: null,
    runtime: {
      questionPlan: [],
      currentQuestionIndex: 0,
      followUpRound: 0,
      activeQuestionAnswers: [],
      assessments: [],
    },
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    pinnedAt: null,
    messages: [
      createMessage({
        id: `${input.id}-user`,
        role: 'user',
        kind: 'text',
        content: input.userContent,
        createdAt: input.createdAt,
      }),
      createMessage({
        id: `${input.id}-assistant`,
        role: 'assistant',
        kind: 'text',
        content: input.assistantContent,
        createdAt: input.createdAt,
      }),
    ],
  };
}

export async function seedGuestSessions(page: Page, sessions: ChatSession[]): Promise<void> {
  await page.goto('/chat');
  await page.evaluate(
    async ({ dbName, storeName, sessions }) => {
      const openDatabase = () =>
        new Promise<IDBDatabase>((resolve, reject) => {
          const request = window.indexedDB.open(dbName, 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(storeName)) {
              db.createObjectStore(storeName, { keyPath: 'id' });
            }
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error ?? new Error('open db failed'));
        });

      const database = await openDatabase();
      const transaction = database.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      await new Promise<void>((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onerror = () => reject(clearRequest.error ?? new Error('clear failed'));
        clearRequest.onsuccess = () => {
          for (const session of sessions) {
            store.put(session);
          }
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('seed failed'));
        transaction.onabort = () => reject(transaction.error ?? new Error('seed aborted'));
      });
      database.close();
    },
    { dbName: DB_NAME, storeName: STORE_NAME, sessions },
  );
}

export async function mockGuestStream(page: Page, assistantContent: string): Promise<void> {
  const chunks = assistantContent.match(/.{1,8}/g) ?? [assistantContent];
  const body = [
    ...chunks.map((delta) => `event: delta\ndata: ${JSON.stringify({ delta })}\n`),
    `event: done\ndata: ${JSON.stringify({ assistantContent })}\n`,
  ].join('\n');

  await page.route('**/api/chat/stream', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      body,
    });
  });
}
