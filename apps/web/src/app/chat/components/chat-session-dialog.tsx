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

export type ChatSessionDialogState =
  | { type: 'closed' }
  | { type: 'rename'; sessionId: string; title: string }
  | { type: 'delete-session'; sessionId: string; title: string }
  | { type: 'delete-all' };

interface ChatSessionDialogProps {
  state: ChatSessionDialogState;
  renameValue: string;
  submitting: boolean;
  onRenameValueChange: (value: string) => void;
  onClose: () => void;
  onConfirmRename: () => Promise<void>;
  onConfirmDeleteSession: () => Promise<void>;
  onConfirmDeleteAll: () => Promise<void>;
}

export function ChatSessionDialog({
  state,
  renameValue,
  submitting,
  onRenameValueChange,
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
              <DialogTitle>重命名会话</DialogTitle>
              <DialogDescription>修改后的名称会同步更新到侧边栏和当前会话标题。</DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <Input
                autoFocus
                value={renameValue}
                maxLength={60}
                placeholder="请输入新的会话名称"
                onChange={(event) => onRenameValueChange(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                取消
              </Button>
              <Button type="submit" disabled={submitting || !renameValue.trim()}>
                确定
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      ) : null}

      {state.type === 'delete-session' ? (
        <DialogContent className="sm:max-w-md" showClose={!submitting}>
          <DialogHeader>
            <DialogTitle>删除当前会话？</DialogTitle>
            <DialogDescription>
              会话“{state.title}”删除后将无法恢复，请确认是否继续。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={submitting}
              onClick={() => void onConfirmDeleteSession()}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}

      {state.type === 'delete-all' ? (
        <DialogContent className="sm:max-w-md" showClose={!submitting}>
          <DialogHeader>
            <DialogTitle>删除所有会话记录？</DialogTitle>
            <DialogDescription>
              这会清空当前账号或当前浏览器下的全部会话记录，且无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={submitting}
              onClick={() => void onConfirmDeleteAll()}
            >
              全部删除
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
