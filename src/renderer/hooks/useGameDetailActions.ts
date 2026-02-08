import { useCallback, useState } from 'react';
import type { GameDetail, SaveLocation, Snapshot } from '@shared/types';
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
  const [busySnapshot, setBusySnapshot] = useState<string | null>(null);

  const handleLaunch = useCallback(async () => {
    try {
      await window.gamesaver.launchGame(detail.game.id);
      onSuccess('Game launch requested.');
    } catch (error) {
      onError(getErrorMessage(error, 'Failed to launch the game.'));
    }
  }, [detail.game.id, onError, onSuccess]);

  const handleBackup = useCallback(async () => {
    try {
      await window.gamesaver.backupNow(detail.game.id);
      await onRefresh();
      onSuccess('Backup request completed.');
    } catch (error) {
      onError(getErrorMessage(error, 'Failed to back up this game.'));
    }
  }, [detail.game.id, onError, onRefresh, onSuccess]);

  const handleAddLocation = useCallback(async () => {
    try {
      const picked = await window.gamesaver.pickSaveLocation();
      if (picked) {
        await window.gamesaver.addSaveLocation(detail.game.id, picked);
        await onRefresh();
        onSuccess('Save location added.');
      }
    } catch (error) {
      onError(getErrorMessage(error, 'Failed to add save location.'));
    }
  }, [detail.game.id, onError, onRefresh, onSuccess]);

  const handleToggle = useCallback(
    async (location: SaveLocation) => {
      try {
        await window.gamesaver.toggleSaveLocation(location.id, !location.enabled);
        await onRefresh();
        onSuccess(`Save location ${location.enabled ? 'disabled' : 'enabled'}.`);
      } catch (error) {
        onError(getErrorMessage(error, 'Failed to update save location.'));
      }
    },
    [onError, onRefresh, onSuccess]
  );

  const handleRemoveLocation = useCallback(
    async (location: SaveLocation) => {
      const confirmed = confirm('Remove this save location? It will no longer be backed up.');
      if (!confirmed) return;
      try {
        await window.gamesaver.removeSaveLocation(location.id);
        await onRefresh();
        onSuccess('Save location removed.');
      } catch (error) {
        onError(getErrorMessage(error, 'Failed to remove save location.'));
      }
    },
    [onError, onRefresh, onSuccess]
  );

  const handleRestore = useCallback(
    async (snapshot: Snapshot) => {
      setBusySnapshot(snapshot.id);
      try {
        await window.gamesaver.restoreSnapshot(snapshot.id);
        await onRefresh();
        onSuccess('Snapshot restored.');
      } catch (error) {
        onError(getErrorMessage(error, 'Failed to restore snapshot.'));
      } finally {
        setBusySnapshot(null);
      }
    },
    [onError, onRefresh, onSuccess]
  );

  const handleDeleteSnapshot = useCallback(
    async (snapshot: Snapshot) => {
      const confirmed = confirm('Delete this snapshot? This cannot be undone.');
      if (!confirmed) return;
      setBusySnapshot(snapshot.id);
      try {
        await window.gamesaver.deleteSnapshot(snapshot.id);
        await onRefresh();
        onSuccess('Snapshot deleted.');
      } catch (error) {
        onError(getErrorMessage(error, 'Failed to delete snapshot.'));
      } finally {
        setBusySnapshot(null);
      }
    },
    [onError, onRefresh, onSuccess]
  );

  const handleVerify = useCallback(
    async (snapshot: Snapshot) => {
      setBusySnapshot(snapshot.id);
      try {
        const result = await window.gamesaver.verifySnapshot(snapshot.id);
        if (result.ok) {
          onSuccess('Snapshot verified.');
        } else {
          onError(`Snapshot has ${result.issues} issue(s).`);
        }
      } catch (error) {
        onError(getErrorMessage(error, 'Failed to verify snapshot.'));
      } finally {
        setBusySnapshot(null);
      }
    },
    [onError, onSuccess]
  );

  const handleRemove = useCallback(async () => {
    const confirmed = confirm('Remove this game from GameSaver? Backups will be deleted.');
    if (!confirmed) return;
    try {
      await window.gamesaver.removeGame(detail.game.id);
      onRemove();
      onSuccess('Game removed.');
    } catch (error) {
      onError(getErrorMessage(error, 'Failed to remove game.'));
    }
  }, [detail.game.id, onError, onRemove, onSuccess]);

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
