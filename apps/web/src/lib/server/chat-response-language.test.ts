import { describe, expect, it } from 'vitest';
import { detectCodeLanguage, shouldOverrideFenceLanguage } from './chat-response-language';

describe('detectCodeLanguage', () => {
  it('能识别普通 JavaScript 代码', () => {
    const content = ['const count = 0;', 'count += 1;', 'console.log(count);'].join('\n');

    expect(detectCodeLanguage(content)).toBe('javascript');
  });

  it('能识别 JSON 与 YAML', () => {
    expect(detectCodeLanguage('{"name":"mianshitong"}')).toBe('json');
    expect(detectCodeLanguage('name: mianshitong\nmodel: deepseek-r1:8b')).toBe('yaml');
  });
});

describe('shouldOverrideFenceLanguage', () => {
  it('会用更准确的语言覆盖通用类型', () => {
    expect(shouldOverrideFenceLanguage('text', 'javascript')).toBe(true);
    expect(shouldOverrideFenceLanguage('markdown', 'tsx')).toBe(true);
  });

  it('不会把 text 检测结果强行覆盖已有语言', () => {
    expect(shouldOverrideFenceLanguage('typescript', 'text')).toBe(false);
    expect(shouldOverrideFenceLanguage('javascript', 'javascript')).toBe(false);
  });
});
