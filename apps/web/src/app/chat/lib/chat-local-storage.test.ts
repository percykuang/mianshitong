import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDraftLocalSession } from './chat-local-session';
import { createIndexedDbMock } from './test-indexeddb';

async function loadLocalStorageModule() {
  vi.resetModules();
  vi.stubGlobal('window', { indexedDB: createIndexedDbMock() } as unknown as Window &
    typeof globalThis);
  return import('./chat-local-storage');
}

describe('chat-local-storage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-09T13:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('可以保存并读取本地会话', async () => {
    const storage = await loadLocalStorageModule();
    const session = createDraftLocalSession('deepseek-chat', 'local_session_1');

    await storage.saveLocalSession(session);

    await expect(storage.getLocalSessionById(session.id)).resolves.toMatchObject({
      id: 'local_session_1',
      title: '新的对话',
      pinnedAt: null,
    });
  });

  it('列出会话时会迁移旧版 sessionId 并按置顶和创建时间排序', async () => {
    const storage = await loadLocalStorageModule();
    const legacy = {
      ...createDraftLocalSession('deepseek-chat', 'session_legacy_ab'),
      createdAt: '2026-03-09T10:00:00.000Z',
      updatedAt: '2026-03-09T10:00:00.000Z',
    };
    const pinned = {
      ...createDraftLocalSession('deepseek-chat', 'modern_pinned'),
      createdAt: '2026-03-09T09:00:00.000Z',
      updatedAt: '2026-03-09T09:00:00.000Z',
      pinnedAt: '2026-03-09T12:00:00.000Z',
    };

    await storage.saveLocalSession(legacy);
    await storage.saveLocalSession(pinned);

    const sessions = await storage.listLocalSessions();

    expect(sessions.map((session) => session.id)).toEqual(['modern_pinned', 'legacyab']);
    await expect(storage.getLocalSessionById('session_legacy_ab')).resolves.toBeNull();
    await expect(storage.getLocalSessionById('legacyab')).resolves.toMatchObject({
      id: 'legacyab',
    });
  });

  it('支持重命名、置顶与取消置顶', async () => {
    const storage = await loadLocalStorageModule();
    const session = createDraftLocalSession('deepseek-chat', 'local_session_2');
    await storage.saveLocalSession(session);

    const renamed = await storage.renameLocalSession(session.id, '  新的会话标题  ');
    const pinned = await storage.setLocalSessionPinnedState(session.id, true);
    const unpinned = await storage.setLocalSessionPinnedState(session.id, false);

    expect(renamed.title).toBe('新的会话标题');
    expect(pinned.pinnedAt).toBe('2026-03-09T13:00:00.000Z');
    expect(unpinned.pinnedAt).toBeNull();
  });

  it('支持删除单个会话和清空全部会话', async () => {
    const storage = await loadLocalStorageModule();
    const first = createDraftLocalSession('deepseek-chat', 'local_session_1');
    const second = createDraftLocalSession('deepseek-chat', 'local_session_2');
    await storage.saveLocalSession(first);
    await storage.saveLocalSession(second);

    await storage.deleteLocalSession(first.id);
    await expect(storage.getLocalSessionById(first.id)).resolves.toBeNull();

    await storage.clearLocalSessions();
    await expect(storage.listLocalSessions()).resolves.toEqual([]);
  });
});
