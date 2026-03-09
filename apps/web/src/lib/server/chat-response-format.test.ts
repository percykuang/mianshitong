import { describe, expect, it } from 'vitest';
import {
  normalizeAssistantMarkdown,
  prependChatReplyFormattingInstruction,
} from './chat-response-format';

describe('prependChatReplyFormattingInstruction', () => {
  it('会在首条 system 消息前插入格式约束', () => {
    const messages = prependChatReplyFormattingInstruction([
      {
        role: 'user',
        content: '帮我写一个冒泡排序',
      },
    ]);

    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('默认使用 Markdown 输出');
    expect(messages[0]?.content).toContain('代码缩进一律使用 2 个空格');
    expect(messages[0]?.content).toContain('语句结尾必须补上分号');
    expect(messages[1]?.content).toBe('帮我写一个冒泡排序');
  });

  it('不会重复插入相同的格式约束', () => {
    const once = prependChatReplyFormattingInstruction([
      {
        role: 'user',
        content: '继续',
      },
    ]);
    const twice = prependChatReplyFormattingInstruction(once);

    expect(twice).toHaveLength(2);
    expect(twice[0]).toEqual(once[0]);
  });
});

describe('normalizeAssistantMarkdown', () => {
  it('会把未包裹但明显是代码的回复补成 fenced code block', () => {
    const content = ['const count = 0;', 'count += 1;', 'console.log(count);'].join('\n');

    expect(normalizeAssistantMarkdown(content)).toBe(
      '```javascript\nconst count = 0;\ncount += 1;\nconsole.log(count);\n```',
    );
  });

  it('会修正完整代码块中泛型语言标记', () => {
    const content = '```text\nconst count = 0;\nconsole.log(count);\n```';

    expect(normalizeAssistantMarkdown(content)).toBe(
      '```javascript\nconst count = 0;\nconsole.log(count);\n```',
    );
  });

  it('会展开 markdown wrapper，但不会把普通说明文字误判为代码块', () => {
    const content = '```markdown\n1. 先看简历\n2. 再模拟面试\n```';

    expect(normalizeAssistantMarkdown(content)).toBe('1. 先看简历\n2. 再模拟面试');
  });
});
