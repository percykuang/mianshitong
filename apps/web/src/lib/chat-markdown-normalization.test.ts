import { describe, expect, it } from 'vitest';
import { unwrapMarkdownFenceWrapper } from './chat-markdown-normalization';

describe('unwrapMarkdownFenceWrapper', () => {
  it('会展开 markdown 包裹层并返回内部 markdown 内容', () => {
    expect(unwrapMarkdownFenceWrapper('```markdown\n## 标题\n- 列表项\n```')).toBe(
      '## 标题\n- 列表项',
    );
  });

  it('不会误展开普通代码块', () => {
    expect(unwrapMarkdownFenceWrapper('```ts\nconst count = 1;\n```')).toBe(
      '```ts\nconst count = 1;\n```',
    );
  });

  it('不会误展开只包含普通文本的 markdown fence', () => {
    expect(unwrapMarkdownFenceWrapper('```markdown\n只是普通文本\n```')).toBe(
      '```markdown\n只是普通文本\n```',
    );
  });
});
