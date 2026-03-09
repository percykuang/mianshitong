import { describe, expect, it } from 'vitest';
import { compareSessionsByPinnedAndCreated } from './chat-session-order';

describe('compareSessionsByPinnedAndCreated', () => {
  it('置顶会话优先按 pinnedAt 倒序排序', () => {
    const sessions = [
      {
        id: 'older-pinned',
        pinnedAt: '2026-03-09T10:00:00.000Z',
        createdAt: '2026-03-09T09:00:00.000Z',
      },
      {
        id: 'newer-pinned',
        pinnedAt: '2026-03-09T11:00:00.000Z',
        createdAt: '2026-03-09T08:00:00.000Z',
      },
      {
        id: 'normal',
        pinnedAt: null,
        createdAt: '2026-03-09T12:00:00.000Z',
      },
    ];

    expect([...sessions].sort(compareSessionsByPinnedAndCreated).map((item) => item.id)).toEqual([
      'newer-pinned',
      'older-pinned',
      'normal',
    ]);
  });

  it('未置顶会话按 createdAt 倒序排序', () => {
    const sessions = [
      {
        id: 'older',
        pinnedAt: null,
        createdAt: '2026-03-09T09:00:00.000Z',
      },
      {
        id: 'newer',
        pinnedAt: null,
        createdAt: '2026-03-09T10:00:00.000Z',
      },
    ];

    expect([...sessions].sort(compareSessionsByPinnedAndCreated).map((item) => item.id)).toEqual([
      'newer',
      'older',
    ]);
  });
});
