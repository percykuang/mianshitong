/**
 * @jest-environment jsdom
 */
import '../../../../vitest.setup';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatUsageLimitBanner } from './chat-usage-limit-banner';

describe('ChatUsageLimitBanner', () => {
  it('游客额度用尽时展示登录和注册入口', () => {
    render(
      <ChatUsageLimitBanner usage={{ actorType: 'guest', used: 10, max: 10, remaining: 0 }} />,
    );

    expect(screen.getByText('今日体验额度已用完')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '登录' })).toHaveAttribute(
      'href',
      '/login?callbackUrl=/chat',
    );
    expect(screen.getByRole('link', { name: '注册' })).toHaveAttribute(
      'href',
      '/register?callbackUrl=/chat',
    );
  });

  it('注册用户额度用尽时只展示重置提示', () => {
    render(
      <ChatUsageLimitBanner usage={{ actorType: 'registered', used: 30, max: 30, remaining: 0 }} />,
    );

    expect(screen.getByText('今日额度已用完')).toBeInTheDocument();
    expect(screen.getByText(/明天 00:00 自动重置/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '登录' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '注册' })).not.toBeInTheDocument();
  });
});
