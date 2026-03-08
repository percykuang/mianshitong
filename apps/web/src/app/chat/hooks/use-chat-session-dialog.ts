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
  const [renameValue, setRenameValue] = useState('');
  const [dialogSubmitting, setDialogSubmitting] = useState(false);

  const closeDialog = useCallback(() => {
    if (dialogSubmitting) {
      return;
    }

    setDialogState({ type: 'closed' });
    setRenameValue('');
  }, [dialogSubmitting]);

  const openRenameDialog = useCallback((session: SessionSummary) => {
    setDialogState({ type: 'rename', sessionId: session.id, title: session.title });
    setRenameValue(session.title);
  }, []);

  const openDeleteSessionDialog = useCallback((session: SessionSummary) => {
    setDialogState({ type: 'delete-session', sessionId: session.id, title: session.title });
    setRenameValue('');
  }, []);

  const openDeleteAllDialog = useCallback(() => {
    setDialogState({ type: 'delete-all' });
    setRenameValue('');
  }, []);

  const confirmRename = useCallback(async () => {
    if (dialogState.type !== 'rename') {
      return;
    }

    setDialogSubmitting(true);
    try {
      await input.onRenameSession(dialogState.sessionId, renameValue);
      setDialogState({ type: 'closed' });
      setRenameValue('');
    } catch {
      return;
    } finally {
      setDialogSubmitting(false);
    }
  }, [dialogState, input, renameValue]);

  const confirmDeleteSession = useCallback(async () => {
    if (dialogState.type !== 'delete-session') {
      return;
    }

    setDialogSubmitting(true);
    try {
      await input.onDeleteSession(dialogState.sessionId);
      setDialogState({ type: 'closed' });
    } finally {
      setDialogSubmitting(false);
    }
  }, [dialogState, input]);

  const confirmDeleteAll = useCallback(async () => {
    if (dialogState.type !== 'delete-all') {
      return;
    }

    setDialogSubmitting(true);
    try {
      await input.onDeleteAllSessions();
      setDialogState({ type: 'closed' });
    } finally {
      setDialogSubmitting(false);
    }
  }, [dialogState, input]);

  return {
    dialogState,
    renameValue,
    dialogSubmitting,
    setRenameValue,
    closeDialog,
    openRenameDialog,
    openDeleteSessionDialog,
    openDeleteAllDialog,
    confirmRename,
    confirmDeleteSession,
    confirmDeleteAll,
  };
}
