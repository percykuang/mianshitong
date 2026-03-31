'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CHAT_SESSION_DIALOG_COPY, CHAT_SESSION_ITEM_COPY } from '../lib/chat-copy';

export type ChatSessionDialogState =
  | { type: 'closed' }
  | { type: 'rename'; sessionId: string; title: string }
  | { type: 'delete-session'; sessionId: string; title: string }
  | { type: 'delete-all' };

interface ChatSessionDialogProps {
  state: ChatSessionDialogState;
  renameDraftTitle: string;
  submitting: boolean;
  onRenameDraftTitleChange: (value: string) => void;
  onClose: () => void;
  onConfirmRename: () => Promise<void>;
  onConfirmDeleteSession: () => Promise<void>;
  onConfirmDeleteAll: () => Promise<void>;
}

export function ChatSessionDialog({
  state,
  renameDraftTitle,
  submitting,
  onRenameDraftTitleChange,
  onClose,
  onConfirmRename,
  onConfirmDeleteSession,
  onConfirmDeleteAll,
}: ChatSessionDialogProps) {
  const open = state.type !== 'closed';

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen && !submitting ? onClose() : null)}>
      {state.type === 'rename' ? (
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void onConfirmRename();
            }}
          >
            <DialogHeader>
              <DialogTitle>{CHAT_SESSION_DIALOG_COPY.renameTitle}</DialogTitle>
              <DialogDescription>{CHAT_SESSION_DIALOG_COPY.renameDescription}</DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <Input
                autoFocus
                value={renameDraftTitle}
                maxLength={60}
                placeholder={CHAT_SESSION_DIALOG_COPY.renamePlaceholder}
                onChange={(event) => onRenameDraftTitleChange(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                {CHAT_SESSION_DIALOG_COPY.cancel}
              </Button>
              <Button type="submit" disabled={submitting || !renameDraftTitle.trim()}>
                {CHAT_SESSION_DIALOG_COPY.confirm}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      ) : null}

      {state.type === 'delete-session' ? (
        <DialogContent className="sm:max-w-md" showClose={!submitting}>
          <DialogHeader>
            <DialogTitle>{CHAT_SESSION_DIALOG_COPY.deleteSessionTitle}</DialogTitle>
            <DialogDescription>
              {CHAT_SESSION_DIALOG_COPY.deleteSessionDescription(state.title)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              {CHAT_SESSION_DIALOG_COPY.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="bg-red-500"
              disabled={submitting}
              onClick={() => void onConfirmDeleteSession()}
            >
              {CHAT_SESSION_ITEM_COPY.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}

      {state.type === 'delete-all' ? (
        <DialogContent className="sm:max-w-md" showClose={!submitting}>
          <DialogHeader>
            <DialogTitle>{CHAT_SESSION_DIALOG_COPY.deleteAllTitle}</DialogTitle>
            <DialogDescription>{CHAT_SESSION_DIALOG_COPY.deleteAllDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              {CHAT_SESSION_DIALOG_COPY.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={submitting}
              onClick={() => void onConfirmDeleteAll()}
            >
              {CHAT_SESSION_DIALOG_COPY.deleteAllConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
