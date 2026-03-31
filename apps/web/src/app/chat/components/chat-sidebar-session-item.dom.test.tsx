/**
 * @jest-environment jsdom
 */
import '../../../../vitest.setup';
import type { SessionSummary } from '@mianshitong/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatSidebarSessionItem } from './chat-sidebar-session-item';

const SESSION: SessionSummary = {
  id: 'session-1',
  title: 'React 性能优化',
  modelId: 'deepseek-chat',
  isPrivate: false,
  status: 'idle',
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
  pinnedAt: null,
  messageCount: 2,
  lastMessagePreview: '最后一条消息',
};

describe('ChatSidebarSessionItem', () => {
  it('更多操作应使用标准菜单并展示会话操作项', () => {
    render(
      <ChatSidebarSessionItem
        session={SESSION}
        active={false}
        onSelect={async () => {}}
        onRequestRename={() => {}}
        onRequestDelete={() => {}}
        onTogglePin={async () => {}}
      />,
    );

    const trigger = screen.getByRole('button', { name: '更多会话操作' });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    expect(screen.getByTestId('session-actions-menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '置顶' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '重命名' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '删除' })).toBeInTheDocument();
  });
});
