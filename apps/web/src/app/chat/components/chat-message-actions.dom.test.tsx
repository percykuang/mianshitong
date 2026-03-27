/**
 * @jest-environment jsdom
 */
import '../../../../vitest.setup';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatMessageActions } from './chat-message-actions';

describe('ChatMessageActions', () => {
  it('反馈状态变化时应重新挂载对应图标并保留动画 class', () => {
    const { rerender } = render(
      <ChatMessageActions
        isUserMessage={false}
        content="React 和 Vue 的区别"
        messageId="message-1"
        activeFeedback={null}
        feedbackPending={false}
        onNotice={() => {}}
        onStartEditUserMessage={() => {}}
        onSetMessageFeedback={async () => {}}
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
        activeFeedback="like"
        feedbackPending={false}
        onNotice={() => {}}
        onStartEditUserMessage={() => {}}
        onSetMessageFeedback={async () => {}}
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
        activeFeedback={null}
        feedbackPending={false}
        onNotice={() => {}}
        onStartEditUserMessage={() => {}}
        onSetMessageFeedback={async () => {}}
      />,
    );

    const resetUpvoteIcon = screen.getByTestId('message-upvote-icon');
    expect(resetUpvoteIcon).not.toBe(activeUpvoteIcon);
    expect(resetUpvoteIcon.className).toContain('animate-in');
    expect(resetUpvoteIcon.className).toContain('zoom-in-75');
  });
});
