import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Game, GameDetail, GameSummary } from '@shared/types';
import { toast } from '@renderer/components/ui/sonner';
import { getErrorMessage } from '@renderer/lib/error';
import { formatScanResultMessage } from '@renderer/lib/format';
import type { LayoutMode, Screen } from '@renderer/types/app';

type UseDashboardActionsParams = {
  isRecoveryMode: boolean;
  isScanningBackups: boolean;
  selectedDetail: GameDetail | null;
  layoutMode: LayoutMode;
  setScreen: Dispatch<SetStateAction<Screen>>;
  setGames: Dispatch<SetStateAction<GameSummary[]>>;
  setSelectedDetail: Dispatch<SetStateAction<GameDetail | null>>;
  setLayoutMode: Dispatch<SetStateAction<LayoutMode>>;
  setIsScanningBackups: Dispatch<SetStateAction<boolean>>;
  showError: (error: unknown, fallback: string) => void;
};

type UseDashboardActionsResult = {
  refreshGames: () => Promise<void>;
  openDetail: (gameId: string) => Promise<void>;
  refreshDetail: () => Promise<void>;
  handleCreated: (game: Game) => void;
  handleRemove: () => void;
  handleBackupNow: (gameId: string) => Promise<void>;
  handleScanBackups: () => Promise<void>;
  toggleLayoutMode: () => Promise<void>;
};

export function useDashboardActions({
  isRecoveryMode,
  isScanningBackups,
  selectedDetail,
  layoutMode,
  setScreen,
  setGames,
  setSelectedDetail,
  setLayoutMode,
  setIsScanningBackups,
  showError
}: UseDashboardActionsParams): UseDashboardActionsResult {
  const refreshGames = useCallback(async () => {
    if (isRecoveryMode) {
      setGames([]);
      return;
    }
    try {
      const list = await window.gamesaver.listGames();
      setGames(list);
    } catch (error) {
      showError(error, 'Failed to load games.');
    }
  }, [isRecoveryMode, setGames, showError]);

  const openDetail = useCallback(
    async (gameId: string) => {
      try {
        const detail = await window.gamesaver.getGame(gameId);
        setSelectedDetail(detail);
        setScreen('detail');
      } catch (error) {
        showError(error, 'Failed to open game details.');
      }
    },
    [setScreen, setSelectedDetail, showError]
  );

  const refreshDetail = useCallback(async () => {
    if (!selectedDetail) return;
    try {
      const detail = await window.gamesaver.getGame(selectedDetail.game.id);
      setSelectedDetail(detail);
      await refreshGames();
    } catch (error) {
      showError(error, 'Failed to refresh game details.');
    }
  }, [refreshGames, selectedDetail, setSelectedDetail, showError]);

  const handleCreated = useCallback(
    (game: Game) => {
      void refreshGames();
      void openDetail(game.id);
    },
    [openDetail, refreshGames]
  );

  const handleRemove = useCallback(() => {
    setSelectedDetail(null);
    setScreen('dashboard');
    void refreshGames();
  }, [refreshGames, setScreen, setSelectedDetail]);

  const handleBackupNow = useCallback(
    async (gameId: string) => {
      try {
        await window.gamesaver.backupNow(gameId);
        await refreshGames();
        if (selectedDetail) {
          await refreshDetail();
        }
        toast.success('Backup request completed.');
      } catch (error) {
        toast.error(getErrorMessage(error, 'Backup failed.'), { duration: 5000 });
      }
    },
    [refreshDetail, refreshGames, selectedDetail]
  );

  const handleScanBackups = useCallback(async () => {
    if (isScanningBackups) return;
    setIsScanningBackups(true);
    const loadingToastId = toast.loading('Scanning backups...');
    try {
      const result = await window.gamesaver.scanBackups();
      await refreshGames();
      if (selectedDetail) {
        try {
          const detail = await window.gamesaver.getGame(selectedDetail.game.id);
          setSelectedDetail(detail);
        } catch (error) {
          showError(error, 'Scan finished, but game details failed to refresh.');
        }
      }
      toast.success(formatScanResultMessage(result), { id: loadingToastId, duration: 5000 });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to scan existing backups.'), { id: loadingToastId, duration: 5000 });
    } finally {
      setIsScanningBackups(false);
    }
  }, [isScanningBackups, refreshGames, selectedDetail, setIsScanningBackups, setSelectedDetail, showError]);

  const toggleLayoutMode = useCallback(async () => {
    const nextMode: LayoutMode = layoutMode === 'widget' ? 'normal' : 'widget';
    try {
      const appliedMode = await window.gamesaver.windowControls.setLayoutMode(nextMode);
      setLayoutMode(appliedMode);
      if (appliedMode === 'widget') {
        setScreen('dashboard');
        setSelectedDetail(null);
      }
    } catch (error) {
      showError(error, 'Failed to switch view mode.');
    }
  }, [layoutMode, setLayoutMode, setScreen, setSelectedDetail, showError]);

  return {
    refreshGames,
    openDetail,
    refreshDetail,
    handleCreated,
    handleRemove,
    handleBackupNow,
    handleScanBackups,
    toggleLayoutMode
  };
}
