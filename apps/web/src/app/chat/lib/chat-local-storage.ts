import type { ChatSession, SessionSummary } from '@mianshitong/shared';
import { compareSessionsByPinnedAndCreated } from '@/lib/chat-session-order';
import {
  createChatSessionId,
  isLegacyChatSessionId,
  normalizeChatSessionId,
} from '@/lib/chat-session-id';
import { normalizeStoredSession, toSessionSummary } from './chat-local-session';

const DB_NAME = 'mianshitong-chat';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('打开 IndexDB 失败'));
  });

  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexDB 请求失败'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, mode);
  const store = tx.objectStore(STORE_NAME);
  const result = await action(store);

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexDB 事务失败'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexDB 事务中断'));
  });

  return result;
}

async function migrateLegacyLocalSessions(sessions: ChatSession[]): Promise<ChatSession[]> {
  const legacySessions = sessions.filter((session) => isLegacyChatSessionId(session.id));
  const normalizedSessions = sessions.map((session) => normalizeStoredSession(session));
  if (legacySessions.length === 0) {
    return normalizedSessions;
  }

  const usedIds = new Set(
    normalizedSessions
      .filter((session) => !isLegacyChatSessionId(session.id))
      .map((session) => session.id),
  );
  const migratedSessions = normalizedSessions.map((session) => {
    if (!isLegacyChatSessionId(session.id)) {
      return session;
    }

    let nextId = normalizeChatSessionId(session.id) ?? createChatSessionId();
    while (usedIds.has(nextId)) {
      nextId = createChatSessionId();
    }
    usedIds.add(nextId);

    return {
      ...session,
      id: nextId,
    };
  });

  await withStore('readwrite', async (store) => {
    for (const session of migratedSessions) {
      await requestToPromise(store.put(session));
    }

    for (const session of legacySessions) {
      await requestToPromise(store.delete(session.id));
    }
  });

  return migratedSessions;
}

function normalizeTitle(title: string): string {
  const normalized = title.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    throw new Error('请输入有效的会话名称');
  }

  return normalized.slice(0, 60);
}

export async function listLocalSessions(): Promise<SessionSummary[]> {
  const sessions = await withStore('readonly', async (store) =>
    requestToPromise(store.getAll() as IDBRequest<ChatSession[]>),
  );
  const normalizedSessions = await migrateLegacyLocalSessions(sessions);

  return normalizedSessions
    .slice()
    .sort(compareSessionsByPinnedAndCreated)
    .map((session) => toSessionSummary(session));
}

export async function getLocalSessionById(sessionId: string): Promise<ChatSession | null> {
  return withStore('readonly', async (store) => {
    const result = await requestToPromise(
      store.get(sessionId) as IDBRequest<ChatSession | undefined>,
    );
    return result ? normalizeStoredSession(result) : null;
  });
}

export async function saveLocalSession(session: ChatSession): Promise<void> {
  await withStore('readwrite', async (store) => {
    await requestToPromise(store.put(normalizeStoredSession(session)));
  });
}

export async function renameLocalSession(sessionId: string, title: string): Promise<ChatSession> {
  const normalizedTitle = normalizeTitle(title);

  return withStore('readwrite', async (store) => {
    const session = await requestToPromise(
      store.get(sessionId) as IDBRequest<ChatSession | undefined>,
    );
    if (!session) {
      throw new Error('Session not found');
    }

    const nextSession: ChatSession = {
      ...normalizeStoredSession(session),
      title: normalizedTitle,
    };

    await requestToPromise(store.put(nextSession));
    return nextSession;
  });
}

export async function setLocalSessionPinnedState(
  sessionId: string,
  pinned: boolean,
): Promise<ChatSession> {
  return withStore('readwrite', async (store) => {
    const session = await requestToPromise(
      store.get(sessionId) as IDBRequest<ChatSession | undefined>,
    );
    if (!session) {
      throw new Error('Session not found');
    }

    const nextSession: ChatSession = {
      ...normalizeStoredSession(session),
      pinnedAt: pinned ? new Date().toISOString() : null,
    };

    await requestToPromise(store.put(nextSession));
    return nextSession;
  });
}

export async function deleteLocalSession(sessionId: string): Promise<void> {
  await withStore('readwrite', async (store) => {
    await requestToPromise(store.delete(sessionId));
  });
}

export async function clearLocalSessions(): Promise<void> {
  await withStore('readwrite', async (store) => {
    await requestToPromise(store.clear());
  });
}
