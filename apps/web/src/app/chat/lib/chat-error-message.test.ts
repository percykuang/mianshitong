import { describe, expect, it } from 'vitest';
import { getChatErrorMessage } from './chat-error-message';

describe('getChatErrorMessage', () => {
  it('优先返回 Error 实例上的 message', () => {
    expect(getChatErrorMessage(new Error('请求失败'), '默认错误')).toBe('请求失败');
  });

  it('非 Error 输入时返回 fallback 文案', () => {
    expect(getChatErrorMessage('unknown', '默认错误')).toBe('默认错误');
  });
});
