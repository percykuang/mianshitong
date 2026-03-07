import type { ChatSession, SessionSummary } from '@mianshitong/shared';
import { toSessionSummary } from './chat-local-session';

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

export async function listLocalSessions(): Promise<SessionSummary[]> {
  const sessions = await withStore('readonly', async (store) =>
    requestToPromise(store.getAll() as IDBRequest<ChatSession[]>),
  );

  return sessions
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((session) => toSessionSummary(session));
}

export async function getLocalSessionById(sessionId: string): Promise<ChatSession | null> {
  return withStore('readonly', async (store) => {
    const result = await requestToPromise(
      store.get(sessionId) as IDBRequest<ChatSession | undefined>,
    );
    return result ?? null;
  });
}

export async function saveLocalSession(session: ChatSession): Promise<void> {
  await withStore('readwrite', async (store) => {
    await requestToPromise(store.put(session));
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
