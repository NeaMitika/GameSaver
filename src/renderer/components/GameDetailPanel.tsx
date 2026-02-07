import { useState } from 'react';
import { GameDetail, Snapshot, SaveLocation } from '@shared/types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { cn } from '@renderer/lib/utils';

interface GameDetailPanelProps {
  detail: GameDetail;
  isRunning: boolean;
  onBack: () => void;
  onRefresh: () => void | Promise<void>;
  onRemove: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export default function GameDetailPanel({
  detail,
  isRunning,
  onBack,
  onRefresh,
  onRemove,
  onError,
  onSuccess
}: GameDetailPanelProps) {
  const [busySnapshot, setBusySnapshot] = useState<string | null>(null);

  const handleLaunch = async () => {
    try {
      await window.gamesaver.launchGame(detail.game.id);
      onSuccess('Game launch requested.');
    } catch (error) {
      onError(getErrorMessage(error, 'Failed to launch the game.'));
    }
  };

  const handleBackup = async () => {
    try {
      await window.gamesaver.backupNow(detail.game.id);
      await onRefresh();
      onSuccess('Backup request completed.');
    } catch (error) {
      onError(getErrorMessage(error, 'Failed to back up this game.'));
    }
  };

  const handleAddLocation = async () => {
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
  };

  const handleToggle = async (location: SaveLocation) => {
    try {
      await window.gamesaver.toggleSaveLocation(location.id, !location.enabled);
      await onRefresh();
      onSuccess(`Save location ${location.enabled ? 'disabled' : 'enabled'}.`);
    } catch (error) {
      onError(getErrorMessage(error, 'Failed to update save location.'));
    }
  };

  const handleRemoveLocation = async (location: SaveLocation) => {
    const confirmed = confirm('Remove this save location? It will no longer be backed up.');
    if (!confirmed) return;
    try {
      await window.gamesaver.removeSaveLocation(location.id);
      await onRefresh();
      onSuccess('Save location removed.');
    } catch (error) {
      onError(getErrorMessage(error, 'Failed to remove save location.'));
    }
  };

  const handleRestore = async (snapshot: Snapshot) => {
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
  };

  const handleDeleteSnapshot = async (snapshot: Snapshot) => {
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
  };

  const handleVerify = async (snapshot: Snapshot) => {
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
  };

  const handleRemove = async () => {
    const confirmed = confirm('Remove this game from GameSaver? Backups will be deleted.');
    if (!confirmed) return;
    try {
      await window.gamesaver.removeGame(detail.game.id);
      onRemove();
      onSuccess('Game removed.');
    } catch (error) {
      onError(getErrorMessage(error, 'Failed to remove game.'));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <CardTitle>{detail.game.name}</CardTitle>
              <CardDescription className="break-all">{detail.game.install_path}</CardDescription>
              <Badge variant={isRunning ? 'secondary' : 'outline'}>{isRunning ? 'Running' : 'Idle'}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleLaunch} disabled={isRunning}>
                Launch Game
              </Button>
              <Button variant="secondary" onClick={handleBackup}>
                Backup Now
              </Button>
              <Button variant="ghost" onClick={onBack}>
                Back
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Save Locations</CardTitle>
            <CardDescription>Sources monitored and included in backups.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleAddLocation}>
            Add Location
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {detail.saveLocations.map((location) => {
            return (
              <div
                key={location.id}
                className={cn(
                  'flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between',
                  !location.exists && 'border-destructive/40'
                )}
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium break-all">{location.path}</p>
                  <p className="text-xs text-muted-foreground">
                    {`${location.type.toUpperCase()} · ${location.auto_detected ? 'Auto-detected' : 'Manual'}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!location.exists && <Badge variant="destructive">Missing</Badge>}
                  <Button variant="ghost" size="sm" onClick={() => handleToggle(location)}>
                    {location.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveLocation(location)}>
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
          {detail.saveLocations.length === 0 && (
            <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              No save locations configured.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Snapshots</CardTitle>
            <CardDescription>{detail.snapshots.length} total</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {detail.snapshots.map((snapshot) => (
            <div key={snapshot.id} className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">{formatDate(snapshot.created_at)}</p>
                <p className="text-xs text-muted-foreground">
                  {snapshot.reason.toUpperCase()} · {formatBytes(snapshot.size_bytes)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" disabled={busySnapshot === snapshot.id} onClick={() => handleVerify(snapshot)}>
                  Verify
                </Button>
                <Button variant="secondary" size="sm" disabled={busySnapshot === snapshot.id} onClick={() => handleRestore(snapshot)}>
                  Restore
                </Button>
                <Button variant="ghost" size="sm" disabled={busySnapshot === snapshot.id} onClick={() => handleDeleteSnapshot(snapshot)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {detail.snapshots.length === 0 && (
            <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              No snapshots yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 text-slate-100 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)]">
            <div className="flex items-center justify-between border-b border-slate-800/90 bg-slate-900/80 px-3 py-2 font-mono text-[11px] tracking-wide text-slate-400">
              <span>activity.log</span>
              <span className="text-slate-500">{detail.eventLogs.length} entries</span>
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto p-2 font-mono text-[12px] leading-relaxed">
              {detail.eventLogs.map((log, index) => {
                const style = getEventLogStyle(log.type);
                return (
                  <div
                    key={log.id}
                    className={cn(
                      'grid grid-cols-[auto_auto_1fr] items-start gap-2 rounded border px-2 py-1.5',
                      style.row
                    )}
                  >
                    <span className={cn('pt-[1px] text-[11px]', style.symbol)}>{'>'}</span>
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider', style.chip)}>
                      {style.label}
                    </span>
                    <div className="min-w-0">
                      <p className={cn('break-words text-[12px]', style.message)}>{log.message}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        #{String(detail.eventLogs.length - index).padStart(3, '0')} · {formatDate(log.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              {detail.eventLogs.length === 0 && (
                <div className="rounded border border-dashed border-slate-800 px-3 py-6 text-center text-[11px] text-slate-500">
                  No recent events.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
          <CardDescription>Remove this game and delete its backups from disk.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleRemove}>
            Remove Game
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function getEventLogStyle(type: 'backup' | 'restore' | 'error'): {
  label: string;
  row: string;
  chip: string;
  symbol: string;
  message: string;
} {
  if (type === 'error') {
    return {
      label: 'ERR',
      row: 'border-rose-500/25 bg-rose-500/8',
      chip: 'border border-rose-500/40 bg-rose-500/20 text-rose-200',
      symbol: 'text-rose-400',
      message: 'text-rose-100'
    };
  }
  if (type === 'restore') {
    return {
      label: 'RST',
      row: 'border-cyan-500/25 bg-cyan-500/8',
      chip: 'border border-cyan-500/40 bg-cyan-500/20 text-cyan-200',
      symbol: 'text-cyan-400',
      message: 'text-cyan-100'
    };
  }
  return {
    label: 'BKP',
    row: 'border-emerald-500/25 bg-emerald-500/8',
    chip: 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-200',
    symbol: 'text-emerald-400',
    message: 'text-emerald-100'
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function formatBytes(value: number): string {
  if (value === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(value) / Math.log(k));
  return `${(value / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }
  return fallback;
}
