'use client';

import { cn } from '@/lib/utils';
import { ChatComposer } from './components/chat-composer';
import { ChatHeader } from './components/chat-header';
import { ChatMessageList } from './components/chat-message-list';
import { ChatSidebar } from './components/chat-sidebar';
import { useAutoScroll } from './hooks/use-auto-scroll';
import { useChatController } from './hooks/use-chat-controller';

export function ChatClient() {
  const controller = useChatController();
  const latestMessages = controller.activeSession?.messages ?? [];
  const hasConversation = latestMessages.some((message) => message.role === 'user');
  const lastMessageContent = latestMessages.at(-1)?.content;

  const { scrollContainerRef } = useAutoScroll({
    activeSessionId: controller.activeSessionId,
    messageCount: latestMessages.length,
    lastMessageContent,
    sending: controller.sending,
  });

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
              scrollContainerRef={scrollContainerRef}
              onCopy={controller.handleCopy}
              onEditUserMessage={controller.setInputValue}
              onNotice={controller.showNotice}
            />

            <ChatComposer
              hasConversation={hasConversation}
              quickPrompts={controller.quickPrompts}
              inputValue={controller.inputValue}
              selectedModelId={controller.selectedModelId}
              sending={controller.sending}
              loading={controller.loading}
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
    </div>
  );
}
