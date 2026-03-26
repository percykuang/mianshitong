/**
 * @jest-environment jsdom
 */
import '../../../../vitest.setup';
import type { ChatMessage } from '@mianshitong/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatMessageItem } from './chat-message-item';

vi.mock('../hooks/use-chat-message-feedback', () => ({
  useChatMessageFeedback: () => ({
    pendingMessageId: null,
    setMessageFeedback: vi.fn(),
  }),
}));

const ASSISTANT_MESSAGE: ChatMessage = {
  id: 'assistant-1',
  role: 'assistant',
  kind: 'text',
  content: '正在生成中的回复片段',
  createdAt: new Date().toISOString(),
  feedback: null,
};

const USER_MESSAGE: ChatMessage = {
  id: 'user-1',
  role: 'user',
  kind: 'text',
  content:
    '不要使用代码块。只输出一个 markdown 表格，对比 React useMemo 和 useCallback，三列：维度、useMemo、useCallback。',
  createdAt: new Date().toISOString(),
  feedback: null,
};

describe('ChatMessageItem', () => {
  it('assistant 消息生成中时不显示复制和反馈按钮', () => {
    render(
      <ChatMessageItem
        sessionId="session-1"
        message={ASSISTANT_MESSAGE}
        isLoading={false}
        isStreaming
        isEditing={false}
        editingValue=""
        sending
        onStartEditUserMessage={() => {}}
        onEditingValueChange={() => {}}
        onCancelEditUserMessage={() => {}}
        onSubmitEditUserMessage={async () => {}}
        onNotice={() => {}}
      />,
    );

    expect(screen.queryByLabelText('复制')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('赞同回复')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('不赞同回复')).not.toBeInTheDocument();
  });

  it('assistant 消息生成完成后显示复制和反馈按钮', () => {
    render(
      <ChatMessageItem
        sessionId="session-1"
        message={ASSISTANT_MESSAGE}
        isLoading={false}
        isStreaming={false}
        isEditing={false}
        editingValue=""
        sending={false}
        onStartEditUserMessage={() => {}}
        onEditingValueChange={() => {}}
        onCancelEditUserMessage={() => {}}
        onSubmitEditUserMessage={async () => {}}
        onNotice={() => {}}
      />,
    );

    expect(screen.getByLabelText('复制')).toBeInTheDocument();
    expect(screen.getByLabelText('赞同回复')).toBeInTheDocument();
    expect(screen.getByLabelText('不赞同回复')).toBeInTheDocument();
  });

  it('user 长消息气泡应保持右对齐，但文本本身使用正常左对齐换行', () => {
    const { container } = render(
      <ChatMessageItem
        sessionId="session-1"
        message={USER_MESSAGE}
        isLoading={false}
        isStreaming={false}
        isEditing={false}
        editingValue=""
        sending={false}
        onStartEditUserMessage={() => {}}
        onEditingValueChange={() => {}}
        onCancelEditUserMessage={() => {}}
        onSubmitEditUserMessage={async () => {}}
        onNotice={() => {}}
      />,
    );

    const paragraph = screen.getByText(USER_MESSAGE.content);
    expect(paragraph.className).toContain('whitespace-pre-wrap');
    expect(paragraph.className).toContain('wrap-break-word');

    const bubble = paragraph.parentElement;
    expect(bubble?.className).toContain('self-end');
    expect(bubble?.className).toContain('text-left');
    expect(bubble?.className).not.toContain('text-right');

    const wrapper = bubble?.parentElement;
    expect(wrapper?.className).toContain('items-end');
    expect(container.querySelector('article')).toBeTruthy();
  });
});
