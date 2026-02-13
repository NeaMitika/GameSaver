import { useCallback, useState } from 'react';
import type { GameDetail, SaveLocation, Snapshot } from '@shared/types';
import { useI18n } from '@renderer/i18n';
import { getErrorMessage } from '@renderer/lib/error';

type UseGameDetailActionsParams = {
  detail: GameDetail;
  onRefresh: () => void | Promise<void>;
  onRemove: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

type UseGameDetailActionsResult = {
  busySnapshot: string | null;
  handleLaunch: () => Promise<void>;
  handleBackup: () => Promise<void>;
  handleAddLocation: () => Promise<void>;
  handleToggle: (location: SaveLocation) => Promise<void>;
  handleRemoveLocation: (location: SaveLocation) => Promise<void>;
  handleRestore: (snapshot: Snapshot) => Promise<void>;
  handleDeleteSnapshot: (snapshot: Snapshot) => Promise<void>;
  handleVerify: (snapshot: Snapshot) => Promise<void>;
  handleRemove: () => Promise<void>;
};

export function useGameDetailActions({
  detail,
  onRefresh,
  onRemove,
  onError,
  onSuccess
}: UseGameDetailActionsParams): UseGameDetailActionsResult {
  const { t } = useI18n();
  const [busySnapshot, setBusySnapshot] = useState<string | null>(null);

  const handleLaunch = useCallback(async () => {
    try {
      await window.gamesaver.launchGame(detail.game.id);
      onSuccess(t('action_success_launch_requested'));
    } catch (error) {
      onError(getErrorMessage(error, t('action_error_launch_failed')));
    }
  }, [detail.game.id, onError, onSuccess, t]);

  const handleBackup = useCallback(async () => {
    try {
      await window.gamesaver.backupNow(detail.game.id);
      await onRefresh();
      onSuccess(t('action_success_backup_completed'));
    } catch (error) {
      onError(getErrorMessage(error, t('action_error_backup_failed')));
    }
  }, [detail.game.id, onError, onRefresh, onSuccess, t]);

  const handleAddLocation = useCallback(async () => {
    try {
      const picked = await window.gamesaver.pickSaveLocation();
      if (picked) {
        await window.gamesaver.addSaveLocation(detail.game.id, picked);
        await onRefresh();
        onSuccess(t('action_success_location_added'));
      }
    } catch (error) {
      onError(getErrorMessage(error, t('action_error_location_add_failed')));
    }
  }, [detail.game.id, onError, onRefresh, onSuccess, t]);

  const handleToggle = useCallback(
    async (location: SaveLocation) => {
      try {
        await window.gamesaver.toggleSaveLocation(location.id, !location.enabled);
        await onRefresh();
        onSuccess(location.enabled ? t('action_success_location_disabled') : t('action_success_location_enabled'));
      } catch (error) {
        onError(getErrorMessage(error, t('action_error_location_update_failed')));
      }
    },
    [onError, onRefresh, onSuccess, t]
  );

  const handleRemoveLocation = useCallback(
    async (location: SaveLocation) => {
      const confirmed = confirm(t('action_confirm_remove_location'));
      if (!confirmed) return;
      try {
        await window.gamesaver.removeSaveLocation(location.id);
        await onRefresh();
        onSuccess(t('action_success_location_removed'));
      } catch (error) {
        onError(getErrorMessage(error, t('action_error_location_remove_failed')));
      }
    },
    [onError, onRefresh, onSuccess, t]
  );

  const handleRestore = useCallback(
    async (snapshot: Snapshot) => {
      setBusySnapshot(snapshot.id);
      try {
        await window.gamesaver.restoreSnapshot(snapshot.id);
        await onRefresh();
        onSuccess(t('action_success_snapshot_restored'));
      } catch (error) {
        onError(getErrorMessage(error, t('action_error_snapshot_restore_failed')));
      } finally {
        setBusySnapshot(null);
      }
    },
    [onError, onRefresh, onSuccess, t]
  );

  const handleDeleteSnapshot = useCallback(
    async (snapshot: Snapshot) => {
      const confirmed = confirm(t('action_confirm_delete_snapshot'));
      if (!confirmed) return;
      setBusySnapshot(snapshot.id);
      try {
        await window.gamesaver.deleteSnapshot(snapshot.id);
        await onRefresh();
        onSuccess(t('action_success_snapshot_deleted'));
      } catch (error) {
        onError(getErrorMessage(error, t('action_error_snapshot_delete_failed')));
      } finally {
        setBusySnapshot(null);
      }
    },
    [onError, onRefresh, onSuccess, t]
  );

  const handleVerify = useCallback(
    async (snapshot: Snapshot) => {
      setBusySnapshot(snapshot.id);
      try {
        const result = await window.gamesaver.verifySnapshot(snapshot.id);
        if (result.ok) {
          onSuccess(t('action_success_snapshot_verified'));
        } else {
          onError(t('action_error_snapshot_issues', { count: result.issues }));
        }
      } catch (error) {
        onError(getErrorMessage(error, t('action_error_snapshot_verify_failed')));
      } finally {
        setBusySnapshot(null);
      }
    },
    [onError, onSuccess, t]
  );

  const handleRemove = useCallback(async () => {
    const confirmed = confirm(t('action_confirm_remove_game'));
    if (!confirmed) return;
    try {
      await window.gamesaver.removeGame(detail.game.id);
      onRemove();
      onSuccess(t('action_success_game_removed'));
    } catch (error) {
      onError(getErrorMessage(error, t('action_error_game_remove_failed')));
    }
  }, [detail.game.id, onError, onRemove, onSuccess, t]);

  return {
    busySnapshot,
    handleLaunch,
    handleBackup,
    handleAddLocation,
    handleToggle,
    handleRemoveLocation,
    handleRestore,
    handleDeleteSnapshot,
    handleVerify,
    handleRemove
  };
}
