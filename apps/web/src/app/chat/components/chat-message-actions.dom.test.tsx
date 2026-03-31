/**
 * @jest-environment jsdom
 */
import '../../../../vitest.setup';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CHAT_MESSAGE_ACTIONS_COPY } from '../lib/chat-copy';
import { ChatMessageActions } from './chat-message-actions';

describe('ChatMessageActions', () => {
  it('默认动作文案使用共享配置', () => {
    render(
      <ChatMessageActions
        isUserMessage={false}
        content="React 和 Vue 的区别"
        messageId="message-1"
        activeMessageFeedback={null}
        messageFeedbackPending={false}
        onErrorFeedback={() => {}}
        onStartEditUserMessage={() => {}}
        onSubmitMessageFeedback={async () => {}}
      />,
    );

    expect(
      screen.getByRole('button', { name: CHAT_MESSAGE_ACTIONS_COPY.copy }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: CHAT_MESSAGE_ACTIONS_COPY.upvoteReply }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: CHAT_MESSAGE_ACTIONS_COPY.downvoteReply }),
    ).toBeInTheDocument();
  });

  it('复制后保持原始可见文案，不切换为成功提示文案', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn(async () => undefined),
      },
    });

    render(
      <ChatMessageActions
        isUserMessage={false}
        content="React 和 Vue 的区别"
        messageId="message-1"
        activeMessageFeedback={null}
        messageFeedbackPending={false}
        onErrorFeedback={() => {}}
        onStartEditUserMessage={() => {}}
        onSubmitMessageFeedback={async () => {}}
      />,
    );

    const copyButton = screen.getByRole('button', { name: CHAT_MESSAGE_ACTIONS_COPY.copy });
    fireEvent.click(copyButton);

    expect(
      await screen.findByRole('button', { name: CHAT_MESSAGE_ACTIONS_COPY.copy }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '已复制' })).not.toBeInTheDocument();
  });

  it('反馈状态变化时应重新挂载对应图标并保留动画 class', () => {
    const { rerender } = render(
      <ChatMessageActions
        isUserMessage={false}
        content="React 和 Vue 的区别"
        messageId="message-1"
        activeMessageFeedback={null}
        messageFeedbackPending={false}
        onErrorFeedback={() => {}}
        onStartEditUserMessage={() => {}}
        onSubmitMessageFeedback={async () => {}}
      />,
    );

    const initialUpvoteIcon = screen.getByTestId('message-upvote-icon');
    expect(initialUpvoteIcon.className).toContain('animate-in');
    expect(initialUpvoteIcon.className).toContain('zoom-in-75');

    rerender(
      <ChatMessageActions
        isUserMessage={false}
        content="React 和 Vue 的区别"
        messageId="message-1"
        activeMessageFeedback="like"
        messageFeedbackPending={false}
        onErrorFeedback={() => {}}
        onStartEditUserMessage={() => {}}
        onSubmitMessageFeedback={async () => {}}
      />,
    );

    const activeUpvoteIcon = screen.getByTestId('message-upvote-icon');
    expect(activeUpvoteIcon).not.toBe(initialUpvoteIcon);
    expect(activeUpvoteIcon.className).toContain('animate-in');
    expect(activeUpvoteIcon.className).toContain('zoom-in-75');

    rerender(
      <ChatMessageActions
        isUserMessage={false}
        content="React 和 Vue 的区别"
        messageId="message-1"
        activeMessageFeedback={null}
        messageFeedbackPending={false}
        onErrorFeedback={() => {}}
        onStartEditUserMessage={() => {}}
        onSubmitMessageFeedback={async () => {}}
      />,
    );

    const resetUpvoteIcon = screen.getByTestId('message-upvote-icon');
    expect(resetUpvoteIcon).not.toBe(activeUpvoteIcon);
    expect(resetUpvoteIcon.className).toContain('animate-in');
    expect(resetUpvoteIcon.className).toContain('zoom-in-75');
  });
});
