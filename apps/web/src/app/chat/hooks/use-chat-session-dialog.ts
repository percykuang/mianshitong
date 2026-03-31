import type { SessionSummary } from '@mianshitong/shared';
import { useCallback, useState } from 'react';
import type { ChatSessionDialogState } from '../components/chat-session-dialog';

interface UseChatSessionDialogInput {
  onRenameSession: (sessionId: string, title: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onDeleteAllSessions: () => Promise<void>;
}

export function useChatSessionDialog(input: UseChatSessionDialogInput) {
  const [dialogState, setDialogState] = useState<ChatSessionDialogState>({ type: 'closed' });
  const [renameDraftTitle, setRenameDraftTitle] = useState('');
  const [dialogSubmitting, setDialogSubmitting] = useState(false);

  const resetDialog = useCallback(() => {
    setDialogState({ type: 'closed' });
    setRenameDraftTitle('');
  }, []);

  const closeDialog = useCallback(() => {
    if (dialogSubmitting) {
      return;
    }

    resetDialog();
  }, [dialogSubmitting, resetDialog]);

  const openRenameDialog = useCallback((session: SessionSummary) => {
    setDialogState({ type: 'rename', sessionId: session.id, title: session.title });
    setRenameDraftTitle(session.title);
  }, []);

  const openDeleteSessionDialog = useCallback((session: SessionSummary) => {
    setDialogState({ type: 'delete-session', sessionId: session.id, title: session.title });
    setRenameDraftTitle('');
  }, []);

  const openDeleteAllDialog = useCallback(() => {
    setDialogState({ type: 'delete-all' });
    setRenameDraftTitle('');
  }, []);

  const confirmRename = useCallback(async () => {
    if (dialogState.type !== 'rename') {
      return;
    }

    setDialogSubmitting(true);
    try {
      await input.onRenameSession(dialogState.sessionId, renameDraftTitle);
      resetDialog();
    } catch {
      return;
    } finally {
      setDialogSubmitting(false);
    }
  }, [dialogState, input, renameDraftTitle, resetDialog]);

  const confirmDeleteSession = useCallback(async () => {
    if (dialogState.type !== 'delete-session') {
      return;
    }

    setDialogSubmitting(true);
    try {
      await input.onDeleteSession(dialogState.sessionId);
      resetDialog();
    } finally {
      setDialogSubmitting(false);
    }
  }, [dialogState, input, resetDialog]);

  const confirmDeleteAll = useCallback(async () => {
    if (dialogState.type !== 'delete-all') {
      return;
    }

    setDialogSubmitting(true);
    try {
      await input.onDeleteAllSessions();
      resetDialog();
    } finally {
      setDialogSubmitting(false);
    }
  }, [dialogState, input, resetDialog]);

  return {
    dialogState,
    renameDraftTitle,
    dialogSubmitting,
    setRenameDraftTitle,
    closeDialog,
    openRenameDialog,
    openDeleteSessionDialog,
    openDeleteAllDialog,
    confirmRename,
    confirmDeleteSession,
    confirmDeleteAll,
  };
}
