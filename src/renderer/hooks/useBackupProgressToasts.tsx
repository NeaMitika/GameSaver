import { useEffect } from 'react';
import type { BackupProgressPayload } from '@shared/types';
import { BackupProgressToast } from '@renderer/components/toasts/BackupProgressToast';
import { toast } from '@renderer/components/ui/sonner';

const BACKUP_PROGRESS_TOAST_PREFIX = 'backup-progress:';

function getBackupProgressToastId(gameId: string): string {
  return `${BACKUP_PROGRESS_TOAST_PREFIX}${gameId}`;
}

function getBackupReasonLabel(reason: BackupProgressPayload['reason']): string {
  if (reason === 'manual') {
    return 'manual';
  }
  if (reason === 'pre-restore') {
    return 'pre-restore safety';
  }
  return 'automatic';
}

export function useBackupProgressToasts(): void {
  useEffect(() => {
    const unsubscribe = window.gamesaver.onBackupProgress((payload) => {
      const toastId = getBackupProgressToastId(payload.gameId);
      if (payload.stage === 'started' || payload.stage === 'progress') {
        toast.loading(`Creating ${getBackupReasonLabel(payload.reason)} snapshot...`, {
          id: toastId,
          duration: Infinity,
          closeButton: false,
          dismissible: false,
          description: <BackupProgressToast payload={payload} />
        });
        return;
      }

      toast.dismiss(toastId);
      if (payload.stage === 'failed') {
        toast.error(payload.message ?? 'Snapshot creation failed.', { duration: 5000 });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);
}
