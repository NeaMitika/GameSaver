import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addGame } from '../src/main/services/gameService';
import { createMemoryDb } from '../src/main/services/db';

vi.mock('../src/main/services/detectSaveLocations', () => ({
  detectSaveLocations: () => []
}));

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const next = tempRoots.pop();
    if (!next) continue;
    fs.rmSync(next, { recursive: true, force: true });
  }
});

describe('gameService addGame edge cases', () => {
  it('rejects duplicate game names (case-insensitive)', () => {
    const db = createMemoryDb({
      games: [
        {
          id: 'game-1',
          name: 'Portal',
          install_path: 'C:\\Games\\Portal',
          exe_path: 'C:\\Games\\Portal\\portal.exe',
          created_at: new Date().toISOString(),
          last_seen_at: null,
          status: 'protected',
          folder_name: 'Portal'
        }
      ]
    });

    expect(() =>
      addGame(
        db,
        {
          name: 'portal',
          installPath: 'D:\\Games\\Portal',
          exePath: 'D:\\Games\\Portal\\portal.exe'
        },
        'X:\\Backups'
      )
    ).toThrow('A game with this name already exists.');
  });

  it('rejects names that collide after folder-name sanitization', () => {
    const db = createMemoryDb({
      games: [
        {
          id: 'game-1',
          name: 'Game One',
          install_path: 'C:\\Games\\GameOne',
          exe_path: 'C:\\Games\\GameOne\\gameone.exe',
          created_at: new Date().toISOString(),
          last_seen_at: null,
          status: 'protected',
          folder_name: 'Game One'
        }
      ]
    });

    expect(() =>
      addGame(
        db,
        {
          name: 'Game: One',
          installPath: 'D:\\Games\\GameOne',
          exePath: 'D:\\Games\\GameOne\\gameone.exe'
        },
        'X:\\Backups'
      )
    ).toThrow('A game folder with this name already exists.');
  });

  it('rejects when the target backup folder already exists on disk', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-game-service-'));
    tempRoots.push(root);
    const storageRoot = path.join(root, 'Backups');
    fs.mkdirSync(path.join(storageRoot, 'Halo'), { recursive: true });

    const db = createMemoryDb();
    expect(() =>
      addGame(
        db,
        {
          name: 'Halo',
          installPath: 'C:\\Games\\Halo',
          exePath: 'C:\\Games\\Halo\\halo.exe'
        },
        storageRoot
      )
    ).toThrow('A folder with this game name already exists in Backups.');
  });
});
