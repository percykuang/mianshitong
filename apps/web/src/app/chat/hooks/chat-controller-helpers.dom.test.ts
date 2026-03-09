/**
 * @jest-environment jsdom
 */
import '../../../../vitest.setup';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeSidebarOnMobile, copyToClipboard } from './chat-controller-helpers';

function setViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('chat-controller-helpers', () => {
  it('移动端会关闭侧栏，桌面端保持不变', () => {
    const setSidebarOpen = vi.fn();

    setViewportWidth(375);
    closeSidebarOnMobile(setSidebarOpen);
    setViewportWidth(1280);
    closeSidebarOnMobile(setSidebarOpen);

    expect(setSidebarOpen).toHaveBeenCalledTimes(1);
    expect(setSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('在安全上下文中优先走 clipboard API', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await copyToClipboard('hello');

    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('在非安全上下文中会回退到 execCommand copy', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: false,
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => true),
    });

    await copyToClipboard('fallback');

    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });
});
