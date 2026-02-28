import { describe, expect, it } from 'vitest';
import { MIANSHITONG_PLACEHOLDER } from './index';

describe('shared placeholder', () => {
  it('exports placeholder constant', () => {
    expect(MIANSHITONG_PLACEHOLDER).toBe('mianshitong');
  });
});
