import type { Game } from '@shared/types';
import { useAddGamePanel } from '@renderer/hooks/useAddGamePanel';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

type AddGamePanelProps = {
  onCancel: () => void;
  onCreated: (game: Game) => void;
  onError: (message: string) => void;
};

export default function AddGamePanel({ onCancel, onCreated, onError }: AddGamePanelProps) {
  const { name, setName, exePath, setExePath, installPath, setInstallPath, busy, canSubmit, pickExe, pickInstall, handleSubmit } =
    useAddGamePanel({ onCreated, onError });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Add Game</CardTitle>
          <CardDescription>Add by name, then optionally link the executable and install folder.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Close
        </Button>
      </CardHeader>

      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="game-name">Game Name</Label>
            <Input
              id="game-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="My Favorite RPG"
              autoComplete="off"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="exe-path">Executable Path (Optional)</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="exe-path"
                className="sm:flex-1"
                value={exePath}
                onChange={(event) => setExePath(event.target.value)}
                placeholder="C:\\Games\\MyGame\\Game.exe"
                autoComplete="off"
              />
              <Button type="button" variant="outline" onClick={pickExe}>
                Browse
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="install-path">Install Folder (Optional)</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="install-path"
                className="sm:flex-1"
                value={installPath}
                onChange={(event) => setInstallPath(event.target.value)}
                placeholder="C:\\Games\\MyGame"
                autoComplete="off"
              />
              <Button type="button" variant="outline" onClick={pickInstall}>
                Browse
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={!canSubmit || busy}>
              {busy ? 'Adding...' : 'Add Game'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
