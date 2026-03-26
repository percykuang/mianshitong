import { describe, expect, it } from 'vitest';
import {
  buildGeneralChatFallbackReply,
  prependGeneralChatIntentInstruction,
  prependChatReplyFormattingInstruction,
  resolveGeneralChatIntent,
  stripMarkdownHorizontalRules,
} from './chat-general-policy';

describe('prependChatReplyFormattingInstruction', () => {
  it('会插入面向产品角色的系统策略', () => {
    const messages = prependChatReplyFormattingInstruction([
      {
        role: 'user',
        content: '你好',
      },
    ]);

    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('专注前端领域的编程面试官');
    expect(messages[0]?.content).toContain('不要使用 Markdown 分割线');
    expect(messages[0]?.content).toContain('如果用户请求优化简历');
    expect(messages[0]?.content).toContain('技术问答场景不要使用 H1');
  });
});

describe('resolveGeneralChatIntent', () => {
  it('会识别新会话问候语意图', () => {
    const intent = resolveGeneralChatIntent({
      content: '你好',
      userMessageCount: 0,
    });

    expect(intent).toEqual({ kind: 'greeting' });
  });

  it('会识别简历优化入口意图', () => {
    const intent = resolveGeneralChatIntent({
      content: '可以帮我优化简历吗？',
      userMessageCount: 0,
    });

    expect(intent).toEqual({ kind: 'resume_optimize' });
  });

  it('不会把完整简历正文误判成入口模板', () => {
    const intent = resolveGeneralChatIntent({
      content: [
        '教育背景：XX 大学 计算机专业',
        '专业技能：React、TypeScript、Vue',
        '工作经历：负责中后台前端开发',
        '项目经验：主导低代码平台搭建',
      ].join('\n'),
      userMessageCount: 0,
    });

    expect(intent).toBeNull();
  });

  it('会识别简单算术问题并保留结果元数据', () => {
    const intent = resolveGeneralChatIntent({
      content: '1+2等于几？',
      userMessageCount: 0,
    });

    expect(intent).toEqual({
      kind: 'simple_arithmetic',
      arithmetic: {
        left: 1,
        operator: '+',
        right: 2,
        result: 3,
      },
    });
  });

  it('会识别项目亮点问题', () => {
    const intent = resolveGeneralChatIntent({
      content: '我是前端工程师，如何挖掘简历项目亮点',
      userMessageCount: 0,
    });

    expect(intent).toEqual({ kind: 'project_highlight' });
  });

  it('会识别自我介绍问题', () => {
    const intent = resolveGeneralChatIntent({
      content: '前端面试时，如何正确的自我介绍',
      userMessageCount: 0,
    });

    expect(intent).toEqual({ kind: 'self_intro' });
  });

  it('会识别技术概念题', () => {
    const intent = resolveGeneralChatIntent({
      content: 'JS闭包是什么',
      userMessageCount: 0,
    });

    expect(intent).toEqual({
      kind: 'technical_question',
      question: 'JS闭包是什么',
      style: 'concept',
    });
  });

  it('会识别技术机制题', () => {
    const intent = resolveGeneralChatIntent({
      content: '事件循环是什么',
      userMessageCount: 0,
    });

    expect(intent).toEqual({
      kind: 'technical_question',
      question: '事件循环是什么',
      style: 'mechanism',
    });
  });

  it('会识别技术对比题', () => {
    const intent = resolveGeneralChatIntent({
      content: 'React useMemo 和 useCallback 的区别',
      userMessageCount: 0,
    });

    expect(intent).toEqual({
      kind: 'technical_question',
      question: 'React useMemo 和 useCallback 的区别',
      style: 'comparison',
    });
  });
});

describe('prependGeneralChatIntentInstruction', () => {
  it('会为意图消息追加专属 system 指令', () => {
    const messages = prependGeneralChatIntentInstruction(
      [
        {
          role: 'user',
          content: '可以帮我优化简历吗？',
        },
      ],
      { kind: 'resume_optimize' },
    );

    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('简历优化入口');
    expect(messages[0]?.content).toContain('粘贴完整简历文本');
    expect(messages[1]).toEqual({
      role: 'user',
      content: '可以帮我优化简历吗？',
    });
    expect(messages[2]?.role).toBe('assistant');
    expect(messages[2]?.content).toContain('当然可以');
  });

  it('会为技术问答追加结构化指令和 few-shot', () => {
    const messages = prependGeneralChatIntentInstruction(
      [
        {
          role: 'user',
          content: 'React useMemo 和 useCallback 的区别',
        },
      ],
      {
        kind: 'technical_question',
        question: 'React useMemo 和 useCallback 的区别',
        style: 'comparison',
      },
    );

    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('前端技术问答');
    expect(messages[0]?.content).toContain('优先使用 `##` 和 `###`');
    expect(messages[0]?.content).toContain('## 一句话区别');
    expect(messages[1]).toEqual({
      role: 'user',
      content: 'React useMemo 和 useCallback 的区别',
    });
    expect(messages[2]?.role).toBe('assistant');
    expect(messages[2]?.content).toContain('## 一句话区别');
    expect(messages[2]?.content).toContain('## 什么时候用');
  });
});

describe('buildGeneralChatFallbackReply', () => {
  it('会为简单算术问题生成兜底回复', () => {
    const reply = buildGeneralChatFallbackReply({
      kind: 'simple_arithmetic',
      arithmetic: {
        left: 1,
        operator: '+',
        right: 2,
        result: 3,
      },
    });

    expect(reply).toContain('1+2 等于 3');
    expect(reply).toContain('前端面试助手');
  });

  it('会为技术问答生成结构化兜底回复', () => {
    const reply = buildGeneralChatFallbackReply({
      kind: 'technical_question',
      question: 'React useMemo 和 useCallback 的区别',
      style: 'comparison',
    });

    expect(reply).toContain('## 一句话区别');
    expect(reply).toContain('## 建议按这个顺序回答');
    expect(reply).toContain('## 你可以继续这样追问');
  });
});

describe('stripMarkdownHorizontalRules', () => {
  it('会移除普通文本中的分割线', () => {
    const content = ['第一段', '---', '', '第二段', '***', '第三段'].join('\n');

    expect(stripMarkdownHorizontalRules(content)).toBe('第一段\n\n第二段\n第三段');
  });

  it('不会移除代码块中的分割线内容', () => {
    const content = ['```bash', 'echo "---"', '```', '---', '说明'].join('\n');

    expect(stripMarkdownHorizontalRules(content)).toBe(
      ['```bash', 'echo "---"', '```', '说明'].join('\n'),
    );
  });
});
