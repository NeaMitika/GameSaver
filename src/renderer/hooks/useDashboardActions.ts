import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Game, GameDetail, GameSummary } from '@shared/types';
import { useI18n } from '@renderer/i18n';
import { toast } from '@renderer/components/ui/sonner';
import { getErrorMessage } from '@renderer/lib/error';
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
  const { t } = useI18n();

  const formatScanResultMessage = useCallback(
    (result: Awaited<ReturnType<typeof window.gamesaver.scanBackups>>) => {
      const parts = [
        `${result.addedSnapshots} imported`,
        `${result.removedSnapshots} removed`
      ];
      if (result.skippedUnknownGames > 0) {
        parts.push(`${result.skippedUnknownGames} skipped (unknown game)`);
      }
      if (result.skippedInvalidSnapshots > 0) {
        parts.push(`${result.skippedInvalidSnapshots} skipped (invalid snapshot)`);
      }
      return `Scan complete: ${parts.join(', ')}.`;
    },
    []
  );

  const refreshGames = useCallback(async () => {
    if (isRecoveryMode) {
      setGames([]);
      return;
    }
    try {
      const list = await window.gamesaver.listGames();
      setGames(list);
    } catch (error) {
      showError(error, t('dashboard_error_load_games_failed'));
    }
  }, [isRecoveryMode, setGames, showError, t]);

  const openDetail = useCallback(
    async (gameId: string) => {
      try {
        const detail = await window.gamesaver.getGame(gameId);
        setSelectedDetail(detail);
        setScreen('detail');
      } catch (error) {
        showError(error, t('dashboard_error_open_detail_failed'));
      }
    },
    [setScreen, setSelectedDetail, showError, t]
  );

  const refreshDetail = useCallback(async () => {
    if (!selectedDetail) return;
    try {
      const detail = await window.gamesaver.getGame(selectedDetail.game.id);
      setSelectedDetail(detail);
      await refreshGames();
    } catch (error) {
      showError(error, t('dashboard_error_refresh_detail_failed'));
    }
  }, [refreshGames, selectedDetail, setSelectedDetail, showError, t]);

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
        toast.success(t('action_success_backup_completed'));
      } catch (error) {
        toast.error(getErrorMessage(error, t('action_error_backup_failed')), { duration: 5000 });
      }
    },
    [refreshDetail, refreshGames, selectedDetail, t]
  );

  const handleScanBackups = useCallback(async () => {
    if (isScanningBackups) return;
    setIsScanningBackups(true);
    const loadingToastId = toast.loading(t('dashboard_loading_scan_backups'));
    try {
      const result = await window.gamesaver.scanBackups();
      await refreshGames();
      if (selectedDetail) {
        try {
          const detail = await window.gamesaver.getGame(selectedDetail.game.id);
          setSelectedDetail(detail);
        } catch (error) {
          showError(error, t('dashboard_error_scan_detail_refresh_failed'));
        }
      }
      toast.success(formatScanResultMessage(result), { id: loadingToastId, duration: 5000 });
    } catch (error) {
      toast.error(getErrorMessage(error, t('dashboard_error_scan_failed')), { id: loadingToastId, duration: 5000 });
    } finally {
      setIsScanningBackups(false);
    }
  }, [formatScanResultMessage, isScanningBackups, refreshGames, selectedDetail, setIsScanningBackups, setSelectedDetail, showError, t]);

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
      showError(error, t('dashboard_error_switch_layout_failed'));
    }
  }, [layoutMode, setLayoutMode, setScreen, setSelectedDetail, showError, t]);

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
