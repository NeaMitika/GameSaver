import { Plus } from 'lucide-react';
import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { formatDate } from '@renderer/lib/format';
import type { GameOverview } from '@renderer/hooks/useDashboardOverview';

type WidgetOverviewProps = {
  overview: GameOverview;
  onAddGame: () => void;
};

export default function WidgetOverview({ overview, onAddGame }: WidgetOverviewProps) {
  if (overview.total === 0) {
    return (
      <div className="h-full rounded-lg border border-dashed bg-card/50 px-4 py-8 text-center">
        <p className="text-base font-semibold">No games yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Add your first standalone game to start protecting saves.</p>
        <div className="mt-4">
          <Button onClick={onAddGame}>
            <Plus />
            Add Game
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-base font-semibold">Games Overview</p>
          <p className="text-xs text-muted-foreground">Compact widget summary</p>
        </div>
        <Badge variant="outline">{overview.total} tracked</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <OverviewStat label="Protected" value={overview.protectedCount} />
        <OverviewStat label="Warnings" value={overview.warningCount} />
        <OverviewStat label="Errors" value={overview.errorCount} />
        <OverviewStat label="Running" value={overview.runningCount} />
        <OverviewStat label="Total Issues" value={overview.issueTotal} />
        <OverviewStat label="Last Backup" value={overview.latestBackupAt ? formatDate(overview.latestBackupAt) : 'Never'} />
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
