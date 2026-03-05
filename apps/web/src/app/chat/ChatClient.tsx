'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { ChatComposer } from './components/chat-composer';
import { ChatHeader } from './components/chat-header';
import { ChatMessageList } from './components/chat-message-list';
import { ChatSidebar } from './components/chat-sidebar';
import { useAutoScroll } from './hooks/use-auto-scroll';
import { useChatController } from './hooks/use-chat-controller';

export function ChatClient() {
  const controller = useChatController();
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const latestMessages = controller.activeSession?.messages ?? [];
  const hasConversation = latestMessages.some((message) => message.role === 'user');
  const lastMessageContent = latestMessages.at(-1)?.content;
  const activeEditingMessageId = latestMessages.some(
    (item) => item.id === controller.editingMessageId,
  )
    ? controller.editingMessageId
    : null;

  const { scrollContainerRef } = useAutoScroll({
    activeSessionId: controller.activeSessionId,
    messageCount: latestMessages.length,
    lastMessageContent,
    sending: controller.sending,
  });

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
        loading={controller.loading}
        sessions={controller.sessions}
        activeSessionId={controller.activeSessionId}
        sidebarOpen={controller.sidebarOpen}
        onSelectSession={controller.handlePickSession}
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
            privateMode={controller.privateMode}
            onToggleSidebar={() => controller.setSidebarOpen((value) => !value)}
            onTogglePrivateMode={controller.togglePrivateMode}
          />

          <div className="flex min-h-0 flex-1 flex-col">
            <ChatMessageList
              messages={latestMessages}
              hasConversation={hasConversation}
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

            <ChatComposer
              hasConversation={hasConversation}
              quickPrompts={controller.quickPrompts}
              inputValue={controller.inputValue}
              selectedModelId={controller.selectedModelId}
              sending={controller.sending}
              loading={controller.loading}
              inputRef={composerInputRef}
              onInputChange={controller.setInputValue}
              onSubmit={() => controller.sendMessage(controller.inputValue)}
              onQuickPrompt={controller.handleQuickPrompt}
              onModelChange={controller.setSelectedModelId}
            />
          </div>
        </div>

        {controller.notice ? (
          <p className="px-4 pb-3 text-[13px] text-red-600">{controller.notice}</p>
        ) : null}
      </main>

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
