'use client';

import { ArrowDown } from '@/components/icons';
import { usePathname } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChatComposer } from './components/chat-composer';
import { ChatConversationTransition } from './components/chat-conversation-transition';
import { ChatHeader } from './components/chat-header';
import { CHAT_CONTENT_SHELL_CLASS } from './components/chat-layout';
import { ChatMessageList } from './components/chat-message-list';
import { ChatSessionDialog } from './components/chat-session-dialog';
import { ChatSidebar } from './components/chat-sidebar';
import { useAutoScroll } from './hooks/use-auto-scroll';
import { useChatController } from './hooks/use-chat-controller';
import { useChatSessionDialog } from './hooks/use-chat-session-dialog';
import { useChatSessionPin } from './hooks/use-chat-session-pin';
import { useChatSessionRename } from './hooks/use-chat-session-rename';
import {
  requestFollowAndFocusComposer,
  shouldRequestFollowBeforeSend,
} from './lib/chat-client-action-helpers';
import { getChatClientViewState } from './lib/chat-client-view-state';
import { getRouteSessionIdFromPathname } from './lib/chat-route';

export function ChatClient() {
  const pathname = usePathname();
  const routeSessionId = getRouteSessionIdFromPathname(pathname);
  const controller = useChatController();
  const renameSession = useChatSessionRename(controller.showErrorFeedback);
  const pinSession = useChatSessionPin(controller.showErrorFeedback);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const [followRequestKey, setFollowRequestKey] = useState(0);
  const latestMessages = controller.activeSession?.messages ?? [];
  const {
    hasUserMessages,
    shouldShowConversationTransition,
    latestMessageContent,
    visibleEditingMessageId,
    activeBannerFeedback,
    bannerFeedbackToneClassName,
    shouldShowScrollToBottomButton,
  } = getChatClientViewState({
    routeSessionId,
    activeSessionId: controller.activeSession?.id ?? null,
    activeSessionLoading: controller.activeSessionLoading,
    messages: latestMessages,
    editingMessageId: controller.editingMessageId,
    bannerFeedback: controller.bannerFeedback,
  });

  const dialog = useChatSessionDialog({
    onRenameSession: renameSession,
    onDeleteSession: controller.handleDeleteSession,
    onDeleteAllSessions: controller.handleDeleteAllSessions,
  });

  const { scrollContainerRef, isPinnedToBottom, scrollToBottom } = useAutoScroll({
    activeSessionId: controller.activeSessionId,
    activeSessionLoading: controller.activeSessionLoading,
    messageCount: latestMessages.length,
    lastMessageContent: latestMessageContent,
    sending: controller.sending,
    followRequestKey,
  });

  const requestFollow = useCallback(() => {
    setFollowRequestKey((value) => value + 1);
    scrollToBottom();
  }, [scrollToBottom]);

  const handleSubmitMessage = async (content: string) => {
    if (shouldRequestFollowBeforeSend(controller.sending, content)) {
      requestFollow();
    }
    await controller.sendMessage(content);
  };

  const handleQuickPrompt = async (prompt: string) => {
    requestFollow();
    await controller.handleQuickPrompt(prompt);
  };

  const handleSubmitEditUserMessage = async () => {
    const result = await controller.submitEditingUserMessage();
    if (result === 'error') {
      return;
    }

    requestFollowAndFocusComposer({
      requestFollow,
      composerInputRef,
    });
  };

  return (
    <div className="group/sidebar-wrapper flex h-dvh w-full overflow-hidden has-data-[variant=inset]:bg-sidebar">
      <ChatSidebar
        sessionsLoading={controller.sessionsLoading}
        sessions={controller.sessions}
        activeSessionId={controller.activeSessionId}
        sidebarOpen={controller.sidebarOpen}
        onSelectSession={controller.handlePickSession}
        onRequestRenameSession={dialog.openRenameDialog}
        onRequestDeleteSession={dialog.openDeleteSessionDialog}
        onTogglePinSession={(session, pinned) => pinSession(session.id, pinned)}
        onRequestDeleteAllSessions={dialog.openDeleteAllDialog}
        onNewChat={controller.handleNewChat}
        onCloseSidebar={() => controller.setSidebarOpen(false)}
      />

      <main
        className={cn(
          'relative flex h-dvh min-h-0 w-full flex-1 flex-col overflow-hidden bg-background transition-[margin] duration-200 ease-linear',
          controller.sidebarOpen ? 'md:ml-64' : 'md:ml-0',
        )}
      >
        <div className="overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
          <ChatHeader
            sidebarOpen={controller.sidebarOpen}
            onToggleSidebar={() => controller.setSidebarOpen((value) => !value)}
          />

          <div className="relative flex min-h-0 flex-1 flex-col">
            {shouldShowConversationTransition ? (
              <ChatConversationTransition />
            ) : (
              <ChatMessageList
                sessionId={controller.activeSessionId}
                messages={latestMessages}
                hasUserMessages={hasUserMessages}
                hideEmptyState={shouldShowConversationTransition}
                sending={controller.sending}
                editingMessageId={visibleEditingMessageId}
                editingValue={controller.editingValue}
                scrollContainerRef={scrollContainerRef}
                onStartEditUserMessage={controller.startEditingUserMessage}
                onEditingValueChange={controller.setEditingValue}
                onCancelEditUserMessage={controller.cancelEditingUserMessage}
                onSubmitEditUserMessage={handleSubmitEditUserMessage}
                onErrorFeedback={controller.showErrorFeedback}
              />
            )}
            {shouldShowScrollToBottomButton ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-4">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="回到底部"
                  className={cn(
                    'pointer-events-auto rounded-full border bg-background p-2 shadow-lg transition-all hover:bg-muted',
                    isPinnedToBottom
                      ? 'pointer-events-none scale-0 opacity-0'
                      : 'scale-100 opacity-100',
                  )}
                  onClick={scrollToBottom}
                >
                  <ArrowDown className="size-4" />
                </Button>
              </div>
            ) : null}
          </div>

          <div
            className={`${CHAT_CONTENT_SHELL_CLASS} sticky bottom-0 z-10 bg-background pb-3 md:pb-4`}
          >
            <ChatComposer
              hasUserMessages={hasUserMessages}
              hideQuickPrompts={shouldShowConversationTransition}
              quickPrompts={controller.quickPrompts}
              inputValue={controller.inputValue}
              selectedModelId={controller.selectedModelId}
              sending={controller.sending}
              loading={controller.activeSessionLoading}
              usage={controller.chatUsage}
              usageLoading={controller.usageLoading}
              inputRef={composerInputRef}
              onInputChange={controller.setInputValue}
              onSubmit={() => handleSubmitMessage(controller.inputValue)}
              onStop={controller.stopMessageGeneration}
              onQuickPrompt={handleQuickPrompt}
              onModelChange={controller.setSelectedModelId}
            />
          </div>
        </div>
      </main>

      <ChatSessionDialog
        state={dialog.dialogState}
        renameDraftTitle={dialog.renameDraftTitle}
        submitting={dialog.dialogSubmitting}
        onRenameDraftTitleChange={dialog.setRenameDraftTitle}
        onClose={dialog.closeDialog}
        onConfirmRename={dialog.confirmRename}
        onConfirmDeleteSession={dialog.confirmDeleteSession}
        onConfirmDeleteAll={dialog.confirmDeleteAll}
      />

      {activeBannerFeedback ? (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <p className={cn('rounded-md px-3 py-2 text-xs shadow-sm', bannerFeedbackToneClassName)}>
            {activeBannerFeedback.content}
          </p>
        </div>
      ) : null}
    </div>
  );
}
