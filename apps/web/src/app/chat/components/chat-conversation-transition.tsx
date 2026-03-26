import { CHAT_CONTENT_SHELL_CLASS } from './chat-layout';

export function ChatConversationTransition() {
  return (
    <div
      className="absolute inset-0 touch-pan-y overflow-y-auto bg-background"
      data-testid="chat-transition-blank"
    >
      <div className={`${CHAT_CONTENT_SHELL_CLASS} flex h-full min-w-0 py-4`} />
    </div>
  );
}
