import type { SessionSummary } from '@mianshitong/shared';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { GuestMenu } from '@/components/guest-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatSidebarProps {
  loading: boolean;
  sessions: SessionSummary[];
  activeSessionId: string | null;
  sidebarOpen: boolean;
  onSelectSession: (sessionId: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onDeleteAllSessions: () => Promise<void>;
  onNewChat: () => Promise<void>;
  onCloseSidebar: () => void;
}

function SessionSkeleton() {
  return Array.from({ length: 5 }).map((_, index) => (
    <div key={index} className="flex h-8 items-center gap-2 rounded-md px-2">
      <div className="h-4 flex-1 rounded-md bg-sidebar-accent-foreground/10" />
    </div>
  ));
}

export function ChatSidebar({
  loading,
  sessions,
  activeSessionId,
  sidebarOpen,
  onSelectSession,
  onDeleteSession,
  onDeleteAllSessions,
  onNewChat,
  onCloseSidebar,
}: ChatSidebarProps) {
  return (
    <>
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 cursor-pointer bg-black/20 md:hidden"
          aria-label="关闭侧栏"
          onClick={onCloseSidebar}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-linear',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex flex-col gap-2 p-2" data-sidebar="header">
          <div className="flex flex-row items-center justify-between">
            <Link href="/" className="flex flex-row items-center gap-3">
              <span className="cursor-pointer rounded-md px-2 text-lg font-semibold text-blue-600 hover:bg-muted">
                面试通
              </span>
            </Link>
            <div className="flex flex-row gap-1">
              <Button
                variant="ghost"
                className="h-8 p-1 md:h-fit md:p-2"
                title="删除所有聊天记录"
                aria-label="删除所有聊天记录"
                onClick={() => void onDeleteAllSessions()}
              >
                <Trash2 className="size-4" />
              </Button>
              <Button
                variant="ghost"
                className="h-8 p-1 md:h-fit md:p-2"
                onClick={() => void onNewChat()}
              >
                <Plus className="size-4" />
              </Button>
              <Button variant="ghost" className="h-8 p-1 md:hidden" onClick={onCloseSidebar}>
                <ChevronLeft className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
          <div className="relative flex w-full min-w-0 flex-col p-2" data-sidebar="group">
            <div className="px-2 py-1 text-xs text-sidebar-foreground/50">Today</div>
            <div className="w-full text-sm" data-sidebar="group-content">
              <div className="flex flex-col gap-1">
                {loading && sessions.length === 0 ? <SessionSkeleton /> : null}

                {!loading && sessions.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-muted-foreground">
                    Your conversations will appear here once you start chatting!
                  </p>
                ) : null}

                {sessions.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      'group/item flex h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors hover:bg-sidebar-accent',
                      item.id === activeSessionId
                        ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => void onSelectSession(item.id)}
                      className="line-clamp-1 flex flex-1 cursor-pointer items-center text-left"
                    >
                      {item.title}
                    </button>
                    <button
                      type="button"
                      title="删除当前会话"
                      aria-label="删除当前会话"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onDeleteSession(item.id);
                      }}
                      className="flex size-6 cursor-pointer items-center justify-center rounded-md text-sidebar-foreground/60 opacity-0 transition-opacity group-hover/item:opacity-100 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 p-2" data-sidebar="footer">
          <GuestMenu />
        </div>
      </aside>
    </>
  );
}
