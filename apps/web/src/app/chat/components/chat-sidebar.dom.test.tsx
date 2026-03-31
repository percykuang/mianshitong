/**
 * @jest-environment jsdom
 */
import '../../../../vitest.setup';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatSidebar } from './chat-sidebar';

vi.mock('@/components/guest-menu', () => ({
  GuestMenu: () => <div data-testid="guest-menu" />,
}));

describe('ChatSidebar', () => {
  it('侧边栏顶部操作按钮 hover 时不再显示 tooltip', () => {
    render(
      <ChatSidebar
        sessionsLoading={false}
        sessions={[]}
        activeSessionId={null}
        sidebarOpen
        onSelectSession={async () => {}}
        onRequestRenameSession={() => {}}
        onRequestDeleteSession={() => {}}
        onTogglePinSession={async () => {}}
        onRequestDeleteAllSessions={() => {}}
        onNewChat={async () => {}}
        onCloseSidebar={() => {}}
      />,
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: '删除所有会话记录' }));
    fireEvent.mouseEnter(screen.getByRole('button', { name: '新建会话' }));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByTestId('guest-menu')).toBeInTheDocument();
  });
});
