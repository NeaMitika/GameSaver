import { Plus, Settings2 } from 'lucide-react';
import type { GameSummary } from '@shared/types';
import type { GameOverview } from '@renderer/hooks/useDashboardOverview';
import { useI18n } from '@renderer/i18n';
import type { LayoutMode } from '@renderer/types/app';
import { Button } from '@renderer/components/ui/button';
import GameRow from './GameRow';
import WidgetOverview from './WidgetOverview';

type DashboardScreenProps = {
  isRecoveryMode: boolean;
  layoutMode: LayoutMode;
  games: GameSummary[];
  overview: GameOverview;
  onAddGame: () => void;
  onOpenSettings: () => void;
  onOpenDetail: (gameId: string) => void;
  onBackupNow: (gameId: string) => void;
};

export default function DashboardScreen({
  isRecoveryMode,
  layoutMode,
  games,
  overview,
  onAddGame,
  onOpenSettings,
	onOpenDetail,
	onBackupNow
}: DashboardScreenProps) {
  const { t } = useI18n();

  if (isRecoveryMode) {
    return (
      <div className="rounded-lg border border-dashed bg-card/50 px-4 py-8 text-center">
        <p className="text-base font-semibold">{t('dashboard_recovery_title')}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('dashboard_recovery_description')}
        </p>
        <div className="mt-4">
          <Button variant="outline" onClick={onOpenSettings}>
            <Settings2 />
            {t('common_open_settings')}
          </Button>
        </div>
      </div>
    );
  }

  if (layoutMode === 'widget') {
    return <WidgetOverview overview={overview} onAddGame={onAddGame} />;
  }

  if (games.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card/50 px-4 py-8 text-center">
        <p className="text-base font-semibold">{t('dashboard_no_games_title')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('dashboard_no_games_description')}</p>
        <div className="mt-4">
          <Button onClick={onAddGame}>
            <Plus />
            {t('common_add_game')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {games.map((game) => (
        <GameRow key={game.id} game={game} onOpenDetail={onOpenDetail} onBackupNow={onBackupNow} />
      ))}
    </div>
  );
}
