import { describe, expect, it } from 'vitest';
import { prependKnowledgeDocumentContext } from './knowledge-document-context';

describe('prependKnowledgeDocumentContext', () => {
  it('强命中时会在消息前插入内部知识背景 system prompt，并约束不要主动自曝来源', () => {
    const messages = prependKnowledgeDocumentContext(
      [{ role: 'user', content: 'React useMemo 和 useCallback 的区别' }],
      {
        mode: 'strong',
        entries: [
          {
            documentId: 'doc-1',
            documentTitle: 'React Hooks 面试手册',
            category: 'tech_knowledge',
            contentShape: 'reference',
            headingPath: ['React', 'useMemo 和 useCallback'],
            content: 'useMemo 缓存值，useCallback 缓存函数引用。',
            score: 6.2,
          },
        ],
      },
    );

    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('高度相关的内部知识背景');
    expect(messages[0]?.content).toContain('React Hooks 面试手册');
    expect(messages[0]?.content).toContain('主题路径：React > useMemo 和 useCallback');
    expect(messages[0]?.content).toContain('默认不要在正文里主动提到“根据某文档/资料/知识库”');
  });

  it('未命中时不会改写原始消息数组', () => {
    const base = [{ role: 'user' as const, content: '你好' }];
    const messages = prependKnowledgeDocumentContext(base, { mode: 'none', entries: [] });

    expect(messages).toEqual(base);
  });

  it('流程型 interview playbook 上下文会强调保持原始阶段顺序', () => {
    const messages = prependKnowledgeDocumentContext(
      [{ role: 'user', content: '前端面试流程一般是怎么样的？' }],
      {
        mode: 'strong',
        entries: [
          {
            documentId: 'doc-process',
            documentTitle: '了解面试流程',
            category: 'interview_playbook',
            contentShape: 'process',
            headingPath: ['寻找工作机会', '一面'],
            content: '技术面试，以考察基础知识为主。',
            score: 4.2,
          },
          {
            documentId: 'doc-process',
            documentTitle: '了解面试流程',
            category: 'interview_playbook',
            contentShape: 'process',
            headingPath: ['寻找工作机会', '二面'],
            content: '技术面试，以考察框架和项目为主。',
            score: 3.9,
          },
        ],
      },
    );

    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('已按原始文档顺序整理');
    expect(messages[0]?.content).toContain('不要自行删减或合并轮次');
  });
});
