'use client';

import type { SessionSummary } from '@mianshitong/shared';
import { MoreHorizontal, Pencil, Pin, Trash } from '@/components/icons';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CHAT_SESSION_ITEM_COPY } from '../lib/chat-copy';

interface ChatSidebarSessionItemProps {
  session: SessionSummary;
  active: boolean;
  onSelect: (sessionId: string) => Promise<void>;
  onRequestRename: (session: SessionSummary) => void;
  onRequestDelete: (session: SessionSummary) => void;
  onTogglePin: (session: SessionSummary, pinned: boolean) => Promise<void>;
}

export function ChatSidebarSessionItem({
  session,
  active,
  onSelect,
  onRequestRename,
  onRequestDelete,
  onTogglePin,
}: ChatSidebarSessionItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pinned = Boolean(session.pinnedAt);

  return (
    <div
      className={cn(
        'group/session flex min-w-0 items-center rounded-[18px] px-3 py-0.5 transition-colors',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent',
      )}
    >
      <button
        type="button"
        onClick={() => void onSelect(session.id)}
        className="flex min-w-0 flex-1 cursor-pointer items-center rounded-[14px] py-1 text-left"
      >
        <span className="block min-w-0 flex-1 truncate text-sm leading-6 font-medium">
          {session.title}
        </span>
      </button>

      <div
        className={cn(
          'flex h-8 shrink-0 items-center justify-center self-center overflow-hidden transition-[width,margin,opacity] duration-150',
          menuOpen
            ? 'ml-1 w-8 opacity-100'
            : 'ml-0 w-0 opacity-0 group-hover/session:ml-1 group-hover/session:w-8 group-hover/session:opacity-100',
        )}
      >
        <DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              aria-label={CHAT_SESSION_ITEM_COPY.moreActions}
              onClick={(event) => event.stopPropagation()}
              className={cn(
                'h-7 w-7 cursor-pointer rounded-xl p-0 text-sidebar-foreground/56 transition-colors hover:bg-black/5 hover:text-sidebar-foreground dark:hover:bg-white/7',
                menuOpen
                  ? 'pointer-events-auto'
                  : 'pointer-events-none group-hover/session:pointer-events-auto',
              )}
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="start"
            sideOffset={6}
            className="w-28 rounded-lg p-1 shadow-md"
            data-testid="session-actions-menu"
          >
            <DropdownMenuItem
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-muted"
              onSelect={() => {
                void onTogglePin(session, !pinned);
              }}
            >
              <Pin className="size-3.5" />
              <span>{pinned ? CHAT_SESSION_ITEM_COPY.unpin : CHAT_SESSION_ITEM_COPY.pin}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-muted"
              onSelect={() => {
                onRequestRename(session);
              }}
            >
              <Pencil className="size-3.5" />
              <span>{CHAT_SESSION_ITEM_COPY.rename}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-destructive transition-colors hover:bg-destructive/10 dark:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-500"
              onSelect={() => {
                onRequestDelete(session);
              }}
            >
              <Trash className="size-3.5" />
              <span>{CHAT_SESSION_ITEM_COPY.delete}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
