import { CHAT_CONTENT_SHELL_CLASS } from './chat-layout';

export function ChatConversationTransition() {
  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto bg-background"
      data-testid="chat-transition-blank"
    >
      <div className={`${CHAT_CONTENT_SHELL_CLASS} flex h-full min-w-0 py-4`} />
    </div>
  );
}
