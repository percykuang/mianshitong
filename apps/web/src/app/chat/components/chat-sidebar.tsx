import type { SessionSummary } from '@mianshitong/shared';
import { ChevronLeft, Plus, Trash } from '@/components/icons';
import Link from 'next/link';
import { GuestMenu } from '@/components/guest-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CHAT_SIDEBAR_COPY } from '../lib/chat-copy';
import { ChatSidebarSessionItem } from './chat-sidebar-session-item';

interface ChatSidebarProps {
  sessionsLoading: boolean;
  sessions: SessionSummary[];
  activeSessionId: string | null;
  sidebarOpen: boolean;
  onSelectSession: (sessionId: string) => Promise<void>;
  onRequestRenameSession: (session: SessionSummary) => void;
  onRequestDeleteSession: (session: SessionSummary) => void;
  onTogglePinSession: (session: SessionSummary, pinned: boolean) => Promise<void>;
  onRequestDeleteAllSessions: () => void;
  onNewChat: () => Promise<void>;
  onCloseSidebar: () => void;
}

function SessionSkeleton() {
  return Array.from({ length: 5 }).map((_, index) => (
    <div key={index} className="rounded-xl border border-sidebar-border/40 px-3 py-3">
      <div className="h-4 w-3/4 rounded-md bg-sidebar-accent-foreground/10" />
    </div>
  ));
}

export function ChatSidebar({
  sessionsLoading,
  sessions,
  activeSessionId,
  sidebarOpen,
  onSelectSession,
  onRequestRenameSession,
  onRequestDeleteSession,
  onTogglePinSession,
  onRequestDeleteAllSessions,
  onNewChat,
  onCloseSidebar,
}: ChatSidebarProps) {
  return (
    <>
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 cursor-pointer bg-black/20 md:hidden"
          aria-label={CHAT_SIDEBAR_COPY.closeSidebar}
          onClick={onCloseSidebar}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-linear',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div
          className="flex flex-col gap-0.5 border-b border-sidebar-border/80 p-3"
          data-sidebar="header"
        >
          <div className="flex items-center justify-between gap-2">
            <Link href="/" className="flex min-w-0 flex-row items-center gap-3">
              <span className="cursor-pointer rounded-md px-2 text-lg font-semibold text-blue-600 hover:bg-muted">
                面试通
              </span>
            </Link>
            <div className="flex flex-row gap-1">
              <Button
                variant="ghost"
                className="h-8 p-1 text-foreground/62 transition-colors hover:text-destructive md:h-fit md:p-2 dark:hover:text-red-500"
                aria-label={CHAT_SIDEBAR_COPY.deleteAllSessions}
                onClick={onRequestDeleteAllSessions}
              >
                <Trash className="size-4" />
              </Button>
              <Button
                variant="ghost"
                className="mr-1.25 h-8 p-1 text-foreground/62 transition-colors hover:text-foreground md:h-fit md:p-2"
                aria-label={CHAT_SIDEBAR_COPY.newChat}
                onClick={() => void onNewChat()}
              >
                <Plus className="size-4" />
              </Button>
              <Button
                variant="ghost"
                className="h-8 p-1 text-foreground/62 transition-colors hover:text-foreground md:hidden"
                onClick={onCloseSidebar}
              >
                <ChevronLeft className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-auto px-2 py-2">
          <div className="flex flex-col gap-1">
            {sessionsLoading && sessions.length === 0 ? <SessionSkeleton /> : null}

            {!sessionsLoading && sessions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-sidebar-border px-3 py-4 text-xs leading-6 text-sidebar-foreground/55">
                {CHAT_SIDEBAR_COPY.emptyState}
              </p>
            ) : null}

            {sessions.map((item) => (
              <ChatSidebarSessionItem
                key={item.id}
                session={item}
                active={item.id === activeSessionId}
                onSelect={onSelectSession}
                onRequestRename={onRequestRenameSession}
                onRequestDelete={onRequestDeleteSession}
                onTogglePin={onTogglePinSession}
              />
            ))}
          </div>
        </div>

        <div className="mt-auto border-t border-sidebar-border p-2">
          <GuestMenu />
        </div>
      </aside>
    </>
  );
}
