import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryDb } from '../src/main/services/db';
import { Settings } from '../src/shared/types';

vi.mock('../src/main/services/saveLocationService', () => ({
  listSaveLocations: vi.fn()
}));

vi.mock('../src/main/services/storage', () => ({
  getSnapshotRoot: vi.fn(() => path.join('tmp', 'snapshot-root')),
  ensureDir: vi.fn(),
  toSafeGameFolderName: vi.fn((name: string) => name)
}));

vi.mock('../src/main/services/fileOps', () => ({
  copyFileWithRetries: vi.fn(),
  walkFiles: vi.fn(),
  removeDirSafe: vi.fn(async () => undefined)
}));

vi.mock('../src/main/services/hash', () => ({
  hashFile: vi.fn(),
  hashText: vi.fn(() => 'snapshot-checksum')
}));

vi.mock('../src/main/services/eventLogService', () => ({
  logEvent: vi.fn()
}));

vi.mock('../src/main/services/gameService', () => ({
  updateGameStatus: vi.fn(),
  getStoredGameById: vi.fn((db: { state?: { games?: Array<{ id: string }> } }, gameId: string) =>
    db.state?.games?.find((game) => game.id === gameId)
  )
}));

import { backupGame } from '../src/main/services/backupService';
import { logEvent } from '../src/main/services/eventLogService';
import { removeDirSafe, walkFiles } from '../src/main/services/fileOps';
import { updateGameStatus } from '../src/main/services/gameService';
import { listSaveLocations } from '../src/main/services/saveLocationService';
import { getSnapshotRoot } from '../src/main/services/storage';

const settings: Settings = {
  backupFrequencyMinutes: 5,
  retentionCount: 10,
  storageRoot: path.join('tmp', 'storage'),
  compressionEnabled: false,
  dataRoot: path.join('tmp', 'data')
};

describe('backupService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks warning and skips when no enabled save locations exist', async () => {
    vi.mocked(listSaveLocations).mockReturnValue([]);
    const db = createMemoryDb({
      games: [
        {
          id: 'game-1',
          name: 'Game One',
          install_path: 'C:\\Games\\One',
          exe_path: 'C:\\Games\\One\\one.exe',
          created_at: new Date().toISOString(),
          last_seen_at: null,
          status: 'protected',
          folder_name: 'game-1'
        }
      ]
    });

    const snapshot = await backupGame(db, settings, 'game-1', 'manual');

    expect(snapshot).toBeNull();
    const snapshotFolderArg = vi.mocked(getSnapshotRoot).mock.calls[0]?.[2];
    expect(snapshotFolderArg).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}(?:_\d+)?$/);
    expect(updateGameStatus).toHaveBeenCalledWith(db, 'game-1', 'warning');
    expect(logEvent).toHaveBeenCalledWith(db, 'game-1', 'error', 'Backup skipped: no enabled save locations.');
    expect(removeDirSafe).not.toHaveBeenCalled();
  });

  it('does not persist empty snapshots when enabled locations have no files', async () => {
    vi.mocked(listSaveLocations).mockReturnValue([
      {
        id: 'loc-1',
        game_id: 'game-1',
        path: 'C:\\Saves',
        type: 'folder',
        auto_detected: false,
        enabled: true,
        exists: true
      }
    ]);
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.mocked(walkFiles).mockResolvedValue([]);
    const db = createMemoryDb({
      games: [
        {
          id: 'game-1',
          name: 'Game One',
          install_path: 'C:\\Games\\One',
          exe_path: 'C:\\Games\\One\\one.exe',
          created_at: new Date().toISOString(),
          last_seen_at: null,
          status: 'protected',
          folder_name: 'game-1'
        }
      ]
    });

    const snapshot = await backupGame(db, settings, 'game-1', 'manual');

    expect(snapshot).toBeNull();
    expect(updateGameStatus).toHaveBeenCalledWith(db, 'game-1', 'warning');
    expect(logEvent).toHaveBeenCalledWith(
      db,
      'game-1',
      'error',
      'Backup skipped: no files found in enabled save locations.'
    );
    expect(removeDirSafe).toHaveBeenCalledWith(path.join('tmp', 'snapshot-root'));
  });
});
