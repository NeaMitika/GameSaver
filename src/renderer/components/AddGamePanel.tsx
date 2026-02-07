import React, { useState } from 'react';
import { AddGamePayload, Game } from '@shared/types';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface AddGamePanelProps {
  onCancel: () => void;
  onCreated: (game: Game) => void;
  onError: (message: string) => void;
}

export default function AddGamePanel({ onCancel, onCreated, onError }: AddGamePanelProps) {
  const [name, setName] = useState('');
  const [exePath, setExePath] = useState('');
  const [installPath, setInstallPath] = useState('');
  const [busy, setBusy] = useState(false);

  const pickExe = async () => {
    const result = await window.gamesaver.pickExe();
    if (result) {
      setExePath(result);
      if (!name) {
        const base = result.split('\\').pop()?.replace(/\.exe$/i, '') ?? '';
        setName(base);
      }
      if (!installPath) {
        const folder = result.split('\\').slice(0, -1).join('\\');
        setInstallPath(folder);
      }
    }
  };

  const pickInstall = async () => {
    const result = await window.gamesaver.pickFolder();
    if (result) {
      setInstallPath(result);
    }
  };

  const canSubmit = name.trim().length > 1 && exePath.trim().length > 0 && installPath.trim().length > 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      const payload: AddGamePayload = {
        name: name.trim(),
        exePath,
        installPath
      };
      const game = await window.gamesaver.addGame(payload);
      onCreated(game);
    } catch (error) {
      onError(getErrorMessage(error, 'Failed to add game.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Add Game</CardTitle>
          <CardDescription>Point GameSaver to a game executable and installation folder.</CardDescription>
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
            <Label htmlFor="exe-path">Executable Path</Label>
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
            <Label htmlFor="install-path">Install Folder</Label>
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

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }
  return fallback;
}
