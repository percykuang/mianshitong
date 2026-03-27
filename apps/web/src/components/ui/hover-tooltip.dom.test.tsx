/**
 * @jest-environment jsdom
 */
import '../../../vitest.setup';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HoverTooltip } from './hover-tooltip';

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

describe('HoverTooltip', () => {
  it('启用时 hover 后显示提示文案', async () => {
    vi.useFakeTimers();

    render(
      <HoverTooltip content="复制" side="top">
        <button type="button">按钮</button>
      </HoverTooltip>,
    );

    const trigger = screen.getByRole('button', { name: '按钮' }).closest('span');
    expect(trigger).toBeTruthy();

    fireEvent.pointerMove(trigger!);
    fireEvent.mouseEnter(trigger!);

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent('复制');

    vi.useRealTimers();
  });

  it('禁用时 hover 后不显示提示文案', async () => {
    vi.useFakeTimers();

    render(
      <HoverTooltip content="复制" side="top" disabled>
        <button type="button">按钮</button>
      </HoverTooltip>,
    );

    const trigger = screen.getByRole('button', { name: '按钮' }).closest('span');
    expect(trigger).toBeTruthy();

    fireEvent.pointerMove(trigger!);
    fireEvent.mouseEnter(trigger!);

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.queryByText('复制')).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
