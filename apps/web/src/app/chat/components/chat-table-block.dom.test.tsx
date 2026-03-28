/**
 * @jest-environment jsdom
 */
import '../../../../vitest.setup';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatMarkdown } from './chat-markdown';

const TABLE_MARKDOWN = `
| 维度 | useMemo | useCallback |
| --- | --- | --- |
| 作用 | 缓存计算结果 | 缓存函数引用 |
| 典型场景 | 依赖复杂计算 | 依赖回调稳定性 |
`;

const HORIZONTAL_RULE_MARKDOWN = `
第一段

---

第二段
`;

describe('ChatTableBlock', () => {
  it('渲染表格但不显示复制和下载按钮', () => {
    render(<ChatMarkdown content={TABLE_MARKDOWN} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '复制表格' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '下载表格' })).not.toBeInTheDocument();
  });

  it('渲染 Markdown 分割线时应保留垂直间距', () => {
    const { container } = render(<ChatMarkdown content={HORIZONTAL_RULE_MARKDOWN} />);

    const separator = container.querySelector('hr');
    expect(separator).toBeInTheDocument();
    expect(separator?.className).toContain('my-6');
  });
});
