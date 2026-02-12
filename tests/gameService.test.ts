import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addGame, renameGame } from '../src/main/services/gameService';
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

  it('allows adding a game without executable and install paths', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-game-service-'));
    tempRoots.push(root);
    const storageRoot = path.join(root, 'Backups');
    fs.mkdirSync(storageRoot, { recursive: true });

    const db = createMemoryDb();
    const created = addGame(
      db,
      {
        name: 'No Path Game',
        installPath: '',
        exePath: ''
      },
      storageRoot
    );

    expect(created.name).toBe('No Path Game');
    expect(created.install_path).toBe('');
    expect(created.exe_path).toBe('');

    const metadataPath = path.join(storageRoot, 'No Path Game', 'metadata.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as {
      install_path?: string;
      exe_path?: string;
    };
    expect(metadata.install_path).toBe('');
    expect(metadata.exe_path).toBe('');
  });

  it('renames a game and updates metadata', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-game-service-'));
    tempRoots.push(root);
    const storageRoot = path.join(root, 'Backups');
    fs.mkdirSync(path.join(storageRoot, 'Portal'), { recursive: true });
    fs.writeFileSync(
      path.join(storageRoot, 'Portal', 'metadata.json'),
      JSON.stringify(
        {
          id: 'game-1',
          name: 'Portal',
          install_path: '',
          exe_path: ''
        },
        null,
        2
      ),
      'utf-8'
    );

    const db = createMemoryDb({
      games: [
        {
          id: 'game-1',
          name: 'Portal',
          install_path: '',
          exe_path: '',
          created_at: new Date().toISOString(),
          last_seen_at: null,
          status: 'protected',
          folder_name: 'Portal'
        }
      ]
    });

    const renamed = renameGame(db, 'game-1', 'Portal Remastered', storageRoot);
    expect(renamed.name).toBe('Portal Remastered');
    expect(db.state.games[0]?.name).toBe('Portal Remastered');

    const metadataPath = path.join(storageRoot, 'Portal', 'metadata.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as { name?: string };
    expect(metadata.name).toBe('Portal Remastered');
  });

  it('rejects renaming to an existing game name', () => {
    const db = createMemoryDb({
      games: [
        {
          id: 'game-1',
          name: 'Portal',
          install_path: '',
          exe_path: '',
          created_at: new Date().toISOString(),
          last_seen_at: null,
          status: 'protected',
          folder_name: 'Portal'
        },
        {
          id: 'game-2',
          name: 'Half-Life',
          install_path: '',
          exe_path: '',
          created_at: new Date().toISOString(),
          last_seen_at: null,
          status: 'protected',
          folder_name: 'Half-Life'
        }
      ]
    });

    expect(() => renameGame(db, 'game-1', 'half-life', 'X:\\Backups')).toThrow(
      'A game with this name already exists.'
    );
  });
});
