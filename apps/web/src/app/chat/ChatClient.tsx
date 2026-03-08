'use client';

import { ArrowDown } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChatComposer } from './components/chat-composer';
import { ChatConversationTransition } from './components/chat-conversation-transition';
import { ChatHeader } from './components/chat-header';
import { ChatMessageList } from './components/chat-message-list';
import { ChatSessionDialog } from './components/chat-session-dialog';
import { ChatSidebar } from './components/chat-sidebar';
import { useAutoScroll } from './hooks/use-auto-scroll';
import { useChatController } from './hooks/use-chat-controller';
import { useChatSessionDialog } from './hooks/use-chat-session-dialog';
import { useChatSessionPin } from './hooks/use-chat-session-pin';
import { useChatSessionRename } from './hooks/use-chat-session-rename';
import { getRouteSessionIdFromPathname } from './lib/chat-route';

export function ChatClient() {
  const pathname = usePathname();
  const routeSessionId = getRouteSessionIdFromPathname(pathname);
  const controller = useChatController();
  const renameSession = useChatSessionRename(controller.showNotice);
  const pinSession = useChatSessionPin(controller.showNotice);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const latestMessages = controller.activeSession?.messages ?? [];
  const hasConversation = latestMessages.some((message) => message.role === 'user');
  const showConversationTransition =
    Boolean(routeSessionId) &&
    controller.activeSessionLoading &&
    controller.activeSession?.id !== routeSessionId;
  const lastMessageContent = latestMessages.at(-1)?.content;
  const activeEditingMessageId = latestMessages.some(
    (item) => item.id === controller.editingMessageId,
  )
    ? controller.editingMessageId
    : null;

  const dialog = useChatSessionDialog({
    onRenameSession: renameSession,
    onDeleteSession: controller.handleDeleteSession,
    onDeleteAllSessions: controller.handleDeleteAllSessions,
  });

  const { scrollContainerRef, isPinnedToBottom, scrollToBottom } = useAutoScroll({
    activeSessionId: controller.activeSessionId,
    activeSessionLoading: controller.activeSessionLoading,
    messageCount: latestMessages.length,
    lastMessageContent,
    sending: controller.sending,
  });

  const handleSubmitMessage = async (content: string) => {
    if (!controller.sending && content.trim()) {
      scrollToBottom();
    }

    await controller.sendMessage(content);
  };

  const handleQuickPrompt = async (prompt: string) => {
    scrollToBottom();
    await controller.handleQuickPrompt(prompt);
  };

  const handleSubmitEditUserMessage = async () => {
    const success = await controller.submitEditingUserMessage();
    if (!success) {
      return;
    }

    requestAnimationFrame(() => {
      const input = composerInputRef.current;
      if (!input) {
        return;
      }

      input.focus();
    });
  };

  return (
    <div className="group/sidebar-wrapper flex min-h-svh w-full overflow-hidden has-[[data-variant=inset]]:bg-sidebar">
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
          'relative flex min-h-svh w-full flex-1 flex-col bg-background transition-[margin] duration-200 ease-linear',
          controller.sidebarOpen ? 'md:ml-64' : 'md:ml-0',
        )}
      >
        <div className="overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
          <ChatHeader
            sidebarOpen={controller.sidebarOpen}
            onToggleSidebar={() => controller.setSidebarOpen((value) => !value)}
          />

          <div className="relative flex min-h-0 flex-1 flex-col">
            {showConversationTransition ? (
              <ChatConversationTransition />
            ) : (
              <ChatMessageList
                sessionId={controller.activeSessionId}
                messages={latestMessages}
                hasConversation={hasConversation}
                suppressEmptyState={showConversationTransition}
                sending={controller.sending}
                editingMessageId={activeEditingMessageId}
                editingValue={controller.editingValue}
                scrollContainerRef={scrollContainerRef}
                onCopy={controller.handleCopy}
                onStartEditUserMessage={controller.startEditingUserMessage}
                onEditingValueChange={controller.setEditingValue}
                onCancelEditUserMessage={controller.cancelEditingUserMessage}
                onSubmitEditUserMessage={handleSubmitEditUserMessage}
                onNotice={controller.showNotice}
              />
            )}

            <div className="relative">
              {hasConversation && !showConversationTransition ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-full z-20 mb-12 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="回到底部"
                    className={cn(
                      '-translate-x-1/2 rounded-full border bg-background p-2 shadow-lg transition-all hover:bg-muted',
                      'pointer-events-auto absolute left-1/2',
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

              <ChatComposer
                hasConversation={hasConversation}
                suppressQuickPrompts={showConversationTransition}
                quickPrompts={controller.quickPrompts}
                inputValue={controller.inputValue}
                selectedModelId={controller.selectedModelId}
                sending={controller.sending}
                loading={controller.activeSessionLoading}
                inputRef={composerInputRef}
                onInputChange={controller.setInputValue}
                onSubmit={() => handleSubmitMessage(controller.inputValue)}
                onStop={controller.stopMessageGeneration}
                onQuickPrompt={handleQuickPrompt}
                onModelChange={controller.setSelectedModelId}
              />
            </div>
          </div>
        </div>

        {controller.notice ? (
          <p className="px-4 pb-3 text-[13px] text-red-600">{controller.notice}</p>
        ) : null}
      </main>

      <ChatSessionDialog
        state={dialog.dialogState}
        renameValue={dialog.renameValue}
        submitting={dialog.dialogSubmitting}
        onRenameValueChange={dialog.setRenameValue}
        onClose={dialog.closeDialog}
        onConfirmRename={dialog.confirmRename}
        onConfirmDeleteSession={dialog.confirmDeleteSession}
        onConfirmDeleteAll={dialog.confirmDeleteAll}
      />

      {controller.toast ? (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <p className="rounded-md bg-zinc-900 px-3 py-2 text-xs text-white shadow-sm">
            {controller.toast}
          </p>
        </div>
      ) : null}
    </div>
  );
}
