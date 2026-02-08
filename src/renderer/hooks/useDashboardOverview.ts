import { useMemo } from 'react';
import type { GameSummary } from '@shared/types';

export type GameOverview = {
  total: number;
  protectedCount: number;
  warningCount: number;
  errorCount: number;
  runningCount: number;
  issueTotal: number;
  latestBackupAt: string | null;
};

export type UseDashboardOverviewResult = {
  runningMap: Map<string, boolean>;
  overview: GameOverview;
};

export function useDashboardOverview(games: GameSummary[]): UseDashboardOverviewResult {
  const runningMap = useMemo(() => {
    const map = new Map<string, boolean>();
    games.forEach((game) => map.set(game.id, game.is_running));
    return map;
  }, [games]);

  const overview = useMemo<GameOverview>(() => {
    let protectedCount = 0;
    let warningCount = 0;
    let errorCount = 0;
    let runningCount = 0;
    let issueTotal = 0;
    let latestBackupAt: string | null = null;
    let latestBackupAtMs = -1;

    games.forEach((game) => {
      if (game.status === 'protected') protectedCount += 1;
      if (game.status === 'warning') warningCount += 1;
      if (game.status === 'error') errorCount += 1;
      if (game.is_running) runningCount += 1;
      issueTotal += game.issue_count;

      if (game.last_backup_at) {
        const backupTimeMs = Date.parse(game.last_backup_at);
        if (!Number.isNaN(backupTimeMs) && backupTimeMs > latestBackupAtMs) {
          latestBackupAtMs = backupTimeMs;
          latestBackupAt = game.last_backup_at;
        }
      }
    });

    return {
      total: games.length,
      protectedCount,
      warningCount,
      errorCount,
      runningCount,
      issueTotal,
      latestBackupAt
    };
  }, [games]);

  return { runningMap, overview };
}
