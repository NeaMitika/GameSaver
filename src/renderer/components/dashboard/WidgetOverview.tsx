import { Plus } from 'lucide-react';
import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { formatDate } from '@renderer/lib/format';
import type { GameOverview } from '@renderer/hooks/useDashboardOverview';
import { useI18n } from '@renderer/i18n';

type WidgetOverviewProps = {
  overview: GameOverview;
  onAddGame: () => void;
};

export default function WidgetOverview({ overview, onAddGame }: WidgetOverviewProps) {
  const { t, locale } = useI18n();

  if (overview.total === 0) {
    return (
      <div className="h-full rounded-lg border border-dashed bg-card/50 px-4 py-8 text-center">
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
    <div className="h-full rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-base font-semibold">{t('widget_games_overview')}</p>
          <p className="text-xs text-muted-foreground">{t('widget_compact_summary')}</p>
        </div>
        <Badge variant="outline">{t('widget_tracked', { count: overview.total })}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <OverviewStat label={t('widget_protected')} value={overview.protectedCount} />
        <OverviewStat label={t('widget_warnings')} value={overview.warningCount} />
        <OverviewStat label={t('widget_errors')} value={overview.errorCount} />
        <OverviewStat label={t('widget_running')} value={overview.runningCount} />
        <OverviewStat label={t('widget_total_issues')} value={overview.issueTotal} />
        <OverviewStat
          label={t('widget_last_backup')}
          value={overview.latestBackupAt ? formatDate(overview.latestBackupAt, locale) : t('common_never')}
        />
      </div>
    </div>
  );
}

type OverviewStatProps = {
  label: string;
  value: string | number;
};

function OverviewStat({ label, value }: OverviewStatProps) {
  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
