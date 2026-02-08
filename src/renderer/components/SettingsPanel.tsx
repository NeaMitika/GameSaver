import type { Settings } from '@shared/types';
import { useSettingsPanel } from '@renderer/hooks/useSettingsPanel';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

type SettingsPanelProps = {
  settings: Settings;
  onCancel: () => void;
  onError: (message: string) => void;
  onSaved: (settings: Settings) => void;
};

export default function SettingsPanel({ settings, onCancel, onError, onSaved }: SettingsPanelProps) {
  const {
    backupFrequencyMinutes,
    setBackupFrequencyMinutes,
    retentionCount,
    setRetentionCount,
    storageRoot,
    setStorageRoot,
    dataRoot,
    setDataRoot,
    busy,
    pickStorageRoot,
    pickDataRoot,
    handleSubmit
  } = useSettingsPanel({ settings, onError, onSaved });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Control retention and backup cadence.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Close
        </Button>
      </CardHeader>

      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="backup-frequency">Backup Frequency (minutes)</Label>
            <Input
              id="backup-frequency"
              type="number"
              min={1}
              value={backupFrequencyMinutes}
              onChange={(event) => setBackupFrequencyMinutes(Number(event.target.value))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="retention-count">Retention Count (snapshots per game)</Label>
            <Input
              id="retention-count"
              type="number"
              min={1}
              value={retentionCount}
              onChange={(event) => setRetentionCount(Number(event.target.value))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="storage-root">Storage Root</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="storage-root"
                className="sm:flex-1"
                value={storageRoot}
                onChange={(event) => setStorageRoot(event.target.value)}
                autoComplete="off"
              />
              <Button type="button" variant="outline" onClick={pickStorageRoot}>
                Browse
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Changing storage root moves existing backups to the new folder.</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="data-root">Data Folder (Settings + DB + Backups)</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="data-root"
                className="sm:flex-1"
                value={dataRoot}
                onChange={(event) => setDataRoot(event.target.value)}
                autoComplete="off"
              />
              <Button type="button" variant="outline" onClick={pickDataRoot}>
                Browse
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Changing this will restart the app and move data if needed.</p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
