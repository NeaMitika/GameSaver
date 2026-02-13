import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryDb } from '../src/main/services/db';
import { BackupProgressPayload, Settings } from '../src/shared/types';

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

import { backupGame, deleteSnapshot, onBackupProgress, restoreSnapshot } from '../src/main/services/backupService';
import { logEvent } from '../src/main/services/eventLogService';
import { copyFileWithRetries, removeDirSafe, walkFiles } from '../src/main/services/fileOps';
import { updateGameStatus } from '../src/main/services/gameService';
import { hashFile } from '../src/main/services/hash';
import { listSaveLocations } from '../src/main/services/saveLocationService';
import { getSnapshotRoot } from '../src/main/services/storage';

const settings: Settings = {
  backupFrequencyMinutes: 5,
  retentionCount: 10,
  storageRoot: path.join('tmp', 'storage'),
  compressionEnabled: false,
  dataRoot: path.join('tmp', 'data'),
  language: 'en'
};

const tempRoots: string[] = [];

describe('backupService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.mocked(copyFileWithRetries).mockResolvedValue(undefined);
  });

  afterEach(() => {
    while (tempRoots.length > 0) {
      const next = tempRoots.pop();
      if (!next) continue;
      fs.rmSync(next, { recursive: true, force: true });
    }
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

  it('fails and rolls back when writing the snapshot manifest fails', async () => {
    vi.mocked(listSaveLocations).mockReturnValue([
      {
        id: 'loc-1',
        game_id: 'game-1',
        path: 'C:\\Saves\\profile.sav',
        type: 'file',
        auto_detected: false,
        enabled: true,
        exists: true
      }
    ]);
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 12 } as fs.Stats);
    const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockRejectedValue(new Error('disk full'));
    vi.mocked(hashFile).mockResolvedValue('file-checksum');

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

    await expect(backupGame(db, settings, 'game-1', 'manual')).rejects.toThrow('disk full');
    expect(db.state.snapshots).toHaveLength(0);
    expect(db.state.snapshotFiles).toHaveLength(0);
    expect(removeDirSafe).toHaveBeenCalledWith(path.join('tmp', 'snapshot-root'));

    existsSpy.mockRestore();
    statSpy.mockRestore();
    writeSpy.mockRestore();
  });

  it('emits file/byte progress events while creating a snapshot', async () => {
    vi.mocked(listSaveLocations).mockReturnValue([
      {
        id: 'loc-1',
        game_id: 'game-1',
        path: 'C:\\Saves\\profile.sav',
        type: 'file',
        auto_detected: false,
        enabled: true,
        exists: true
      }
    ]);
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 12 } as fs.Stats);
    const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
    vi.mocked(hashFile).mockResolvedValue('file-checksum');

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

    const events: BackupProgressPayload[] = [];
    const unsubscribe = onBackupProgress((payload) => events.push(payload));
    const snapshot = await backupGame(db, settings, 'game-1', 'manual');
    unsubscribe();

    expect(snapshot).not.toBeNull();
    expect(events.map((event) => event.stage)).toEqual(['started', 'progress', 'completed']);
    expect(events[0]).toMatchObject({
      gameId: 'game-1',
      reason: 'manual',
      totalFiles: 1,
      completedFiles: 0,
      totalBytes: 12,
      copiedBytes: 0,
      percent: 0
    });
    expect(events[1]).toMatchObject({
      stage: 'progress',
      completedFiles: 1,
      totalBytes: 12,
      copiedBytes: 12,
      percent: 100
    });
    expect(events[2]).toMatchObject({
      stage: 'completed',
      completedFiles: 1,
      totalBytes: 12,
      copiedBytes: 12,
      percent: 100
    });
    expect(events[2]?.snapshotId).toBe(snapshot?.id);

    existsSpy.mockRestore();
    statSpy.mockRestore();
    writeSpy.mockRestore();
  });

  it('continues backup when one file copy fails with EINVAL', async () => {
    vi.mocked(listSaveLocations).mockReturnValue([
      {
        id: 'loc-1',
        game_id: 'game-1',
        path: 'C:\\Users\\Luciano\\Desktop',
        type: 'folder',
        auto_detected: false,
        enabled: true,
        exists: true
      }
    ]);
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.mocked(walkFiles).mockResolvedValue([
      'C:\\Users\\Luciano\\Desktop\\ok.sav',
      'C:\\Users\\Luciano\\Desktop\\Windows.iso'
    ]);
    vi.spyOn(fs.promises, 'stat').mockImplementation(async (target: fs.PathLike) => {
      const value = String(target);
      if (value.toLowerCase().includes('windows.iso')) {
        return { size: 700 } as fs.Stats;
      }
      return { size: 120 } as fs.Stats;
    });
    vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
    vi.mocked(hashFile).mockResolvedValue('file-checksum');
    vi.mocked(copyFileWithRetries).mockImplementation(async (src: string) => {
      if (src.toLowerCase().includes('windows.iso')) {
        throw new Error('EINVAL: invalid argument, copyfile');
      }
    });

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
    expect(snapshot).not.toBeNull();
    expect(snapshot?.size_bytes).toBe(120);
    expect(db.state.snapshotFiles.filter((file) => file.snapshot_id === snapshot?.id)).toHaveLength(1);
    expect(updateGameStatus).toHaveBeenCalledWith(db, 'game-1', 'warning');
    expect(logEvent).toHaveBeenCalledWith(
      db,
      'game-1',
      'error',
      expect.stringContaining('Backup skipped file "Windows.iso"')
    );
  });

  it('returns null when all planned file copies fail', async () => {
    vi.mocked(listSaveLocations).mockReturnValue([
      {
        id: 'loc-1',
        game_id: 'game-1',
        path: 'C:\\Users\\Luciano\\Desktop',
        type: 'folder',
        auto_detected: false,
        enabled: true,
        exists: true
      }
    ]);
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.mocked(walkFiles).mockResolvedValue(['C:\\Users\\Luciano\\Desktop\\Windows.iso']);
    vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 700 } as fs.Stats);
    vi.mocked(copyFileWithRetries).mockRejectedValue(new Error('EINVAL: invalid argument, copyfile'));

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
      'Backup skipped: failed to copy files from enabled save locations.'
    );
    expect(removeDirSafe).toHaveBeenCalledWith(path.join('tmp', 'snapshot-root'));
  });

  it('rejects verification when snapshot manifest is missing', async () => {
    const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-snapshot-missing-manifest-'));
    tempRoots.push(snapshotRoot);
    const db = createMemoryDb({
      snapshots: [
        {
          id: 'snap-1',
          game_id: 'game-1',
          created_at: new Date().toISOString(),
          size_bytes: 1,
          checksum: 'snapshot-checksum',
          storage_path: snapshotRoot,
          reason: 'manual'
        }
      ],
      snapshotFiles: [
        {
          id: 'file-1',
          snapshot_id: 'snap-1',
          location_id: 'loc-1',
          relative_path: 'save.sav',
          size_bytes: 1,
          checksum: 'file-checksum'
        }
      ]
    });

    const { verifySnapshot } = await import('../src/main/services/backupService');
    await expect(verifySnapshot(db, 'snap-1')).rejects.toThrow('Snapshot manifest is missing or invalid.');
  });

  it('blocks verification when manifest paths escape snapshot root', async () => {
    const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-snapshot-traversal-'));
    tempRoots.push(snapshotRoot);
    fs.writeFileSync(
      path.join(snapshotRoot, 'snapshot.manifest.json'),
      JSON.stringify(
        {
          version: 2,
          snapshot_id: 'snap-1',
          created_at: new Date().toISOString(),
          reason: 'manual',
          locations: {
            'loc-1': {
              path: 'C:\\Saves',
              type: 'folder',
              auto_detected: false,
              enabled: true,
              storage_folder: '..\\..\\outside'
            }
          }
        },
        null,
        2
      ),
      'utf-8'
    );

    const db = createMemoryDb({
      snapshots: [
        {
          id: 'snap-1',
          game_id: 'game-1',
          created_at: new Date().toISOString(),
          size_bytes: 1,
          checksum: 'snapshot-checksum',
          storage_path: snapshotRoot,
          reason: 'manual'
        }
      ],
      snapshotFiles: [
        {
          id: 'file-1',
          snapshot_id: 'snap-1',
          location_id: 'loc-1',
          relative_path: 'save.sav',
          size_bytes: 1,
          checksum: 'file-checksum'
        }
      ]
    });

    const { verifySnapshot } = await import('../src/main/services/backupService');
    await expect(verifySnapshot(db, 'snap-1')).rejects.toThrow(
      'Snapshot file path resolves outside its allowed root.'
    );
  });

  it('continues restore when pre-restore safety snapshot cannot be created', async () => {
    const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-restore-safety-block-'));
    tempRoots.push(snapshotRoot);
    const restoreTargetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-restore-target-'));
    tempRoots.push(restoreTargetRoot);
    const sourceBackupFile = path.join(snapshotRoot, 'loc-1', 'save.sav');
    fs.mkdirSync(path.dirname(sourceBackupFile), { recursive: true });
    fs.writeFileSync(sourceBackupFile, 'backup-data', 'utf-8');
    fs.writeFileSync(
      path.join(snapshotRoot, 'snapshot.manifest.json'),
      JSON.stringify(
        {
          version: 2,
          snapshot_id: 'snap-1',
          created_at: new Date().toISOString(),
          reason: 'manual',
          locations: {
            'loc-1': {
              path: restoreTargetRoot,
              type: 'folder',
              auto_detected: false,
              enabled: true,
              storage_folder: 'loc-1'
            }
          }
        },
        null,
        2
      ),
      'utf-8'
    );
    vi.mocked(listSaveLocations).mockReturnValue([
      {
        id: 'loc-1',
        game_id: 'game-1',
        path: restoreTargetRoot,
        type: 'folder',
        auto_detected: false,
        enabled: true,
        exists: true
      }
    ]);
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
      ],
      snapshots: [
        {
          id: 'snap-1',
          game_id: 'game-1',
          created_at: new Date().toISOString(),
          size_bytes: 0,
          checksum: 'snapshot-checksum',
          storage_path: snapshotRoot,
          reason: 'manual'
        }
      ],
      snapshotFiles: [
        {
          id: 'file-1',
          snapshot_id: 'snap-1',
          location_id: 'loc-1',
          relative_path: 'save.sav',
          size_bytes: Buffer.byteLength('backup-data'),
          checksum: 'file-checksum'
        }
      ]
    });

    await expect(restoreSnapshot(db, settings, 'snap-1')).resolves.toBeUndefined();
    expect(copyFileWithRetries).toHaveBeenCalledWith(
      sourceBackupFile,
      path.join(restoreTargetRoot, 'save.sav'),
      3
    );
    expect(logEvent).toHaveBeenCalledWith(
      db,
      'game-1',
      'error',
      expect.stringContaining('Proceeding with restore without safety backup')
    );
    expect(logEvent).toHaveBeenCalledWith(
      db,
      'game-1',
      'restore',
      expect.stringContaining('Snapshot restored (')
    );
  });

  it('restores using manifest destination when snapshot location id no longer exists', async () => {
    const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-restore-manifest-fallback-'));
    tempRoots.push(snapshotRoot);
    const restoreTargetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-restore-manifest-target-'));
    tempRoots.push(restoreTargetRoot);

    const sourceBackupFile = path.join(snapshotRoot, 'legacy-storage', 'save.sav');
    fs.mkdirSync(path.dirname(sourceBackupFile), { recursive: true });
    fs.writeFileSync(sourceBackupFile, 'backup-data', 'utf-8');
    fs.writeFileSync(
      path.join(snapshotRoot, 'snapshot.manifest.json'),
      JSON.stringify(
        {
          version: 2,
          snapshot_id: 'snap-legacy',
          created_at: new Date().toISOString(),
          reason: 'manual',
          locations: {
            'legacy-loc-id': {
              path: restoreTargetRoot,
              type: 'folder',
              auto_detected: false,
              enabled: true,
              storage_folder: 'legacy-storage'
            }
          }
        },
        null,
        2
      ),
      'utf-8'
    );

    vi.mocked(listSaveLocations).mockReturnValue([]);
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
      ],
      snapshots: [
        {
          id: 'snap-legacy',
          game_id: 'game-1',
          created_at: new Date().toISOString(),
          size_bytes: Buffer.byteLength('backup-data'),
          checksum: 'snapshot-checksum',
          storage_path: snapshotRoot,
          reason: 'manual'
        }
      ],
      snapshotFiles: [
        {
          id: 'file-legacy',
          snapshot_id: 'snap-legacy',
          location_id: 'legacy-loc-id',
          relative_path: 'save.sav',
          size_bytes: Buffer.byteLength('backup-data'),
          checksum: 'file-checksum'
        }
      ]
    });

    await expect(restoreSnapshot(db, settings, 'snap-legacy')).resolves.toBeUndefined();
    expect(copyFileWithRetries).toHaveBeenCalledWith(
      sourceBackupFile,
      path.join(restoreTargetRoot, 'save.sav'),
      3
    );
    expect(logEvent).toHaveBeenCalledWith(
      db,
      'game-1',
      'restore',
      expect.stringContaining('Snapshot restored (')
    );
  });

  it('prefers current save location when snapshot location id is stale and path changed', async () => {
    const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-restore-current-location-'));
    tempRoots.push(snapshotRoot);
    const oldPathFromManifest = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-restore-old-manifest-'));
    tempRoots.push(oldPathFromManifest);
    const currentSavePath = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-restore-current-target-'));
    tempRoots.push(currentSavePath);

    const sourceBackupFile = path.join(snapshotRoot, 'backup', 'save.sav');
    fs.mkdirSync(path.dirname(sourceBackupFile), { recursive: true });
    fs.writeFileSync(sourceBackupFile, 'backup-data', 'utf-8');
    fs.writeFileSync(
      path.join(snapshotRoot, 'snapshot.manifest.json'),
      JSON.stringify(
        {
          version: 2,
          snapshot_id: 'snap-stale-id',
          created_at: new Date().toISOString(),
          reason: 'manual',
          locations: {
            'legacy-loc-id': {
              path: oldPathFromManifest,
              type: 'folder',
              auto_detected: false,
              enabled: true,
              storage_folder: 'backup'
            }
          }
        },
        null,
        2
      ),
      'utf-8'
    );

    vi.mocked(listSaveLocations).mockReturnValue([
      {
        id: 'new-loc-id',
        game_id: 'game-1',
        path: currentSavePath,
        type: 'folder',
        auto_detected: false,
        enabled: true,
        exists: true
      }
    ]);
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
      ],
      snapshots: [
        {
          id: 'snap-stale-id',
          game_id: 'game-1',
          created_at: new Date().toISOString(),
          size_bytes: Buffer.byteLength('backup-data'),
          checksum: 'snapshot-checksum',
          storage_path: snapshotRoot,
          reason: 'manual'
        }
      ],
      snapshotFiles: [
        {
          id: 'file-stale-id',
          snapshot_id: 'snap-stale-id',
          location_id: 'legacy-loc-id',
          relative_path: 'save.sav',
          size_bytes: Buffer.byteLength('backup-data'),
          checksum: 'file-checksum'
        }
      ]
    });

    await expect(restoreSnapshot(db, settings, 'snap-stale-id')).resolves.toBeUndefined();
    expect(copyFileWithRetries).toHaveBeenCalledWith(
      sourceBackupFile,
      path.join(currentSavePath, 'save.sav'),
      3
    );
  });

  it('restores to single current location when stale manifest location type differs', async () => {
    const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-restore-type-mismatch-'));
    tempRoots.push(snapshotRoot);
    const oldFileParent = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-restore-old-file-parent-'));
    tempRoots.push(oldFileParent);
    const currentFolderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-restore-current-folder-'));
    tempRoots.push(currentFolderPath);

    const sourceBackupFile = path.join(snapshotRoot, 'legacy-file', 'FishSaveGame1.pts');
    fs.mkdirSync(path.dirname(sourceBackupFile), { recursive: true });
    fs.writeFileSync(sourceBackupFile, 'backup-data', 'utf-8');
    fs.writeFileSync(
      path.join(snapshotRoot, 'snapshot.manifest.json'),
      JSON.stringify(
        {
          version: 2,
          snapshot_id: 'snap-type-mismatch',
          created_at: new Date().toISOString(),
          reason: 'manual',
          locations: {
            'legacy-loc-id': {
              path: path.join(oldFileParent, 'FishSaveGame1.pts'),
              type: 'file',
              auto_detected: false,
              enabled: true,
              storage_folder: 'legacy-file'
            }
          }
        },
        null,
        2
      ),
      'utf-8'
    );

    vi.mocked(listSaveLocations).mockReturnValue([
      {
        id: 'new-loc-id',
        game_id: 'game-1',
        path: currentFolderPath,
        type: 'folder',
        auto_detected: false,
        enabled: true,
        exists: true
      }
    ]);
    vi.mocked(walkFiles).mockResolvedValue([]);

    const db = createMemoryDb({
      games: [
        {
          id: 'game-1',
          name: 'FishTycoon',
          install_path: 'C:\\Program Files (x86)\\Fish Tycoon',
          exe_path: 'C:\\Program Files (x86)\\Fish Tycoon\\FishTycoon.exe',
          created_at: new Date().toISOString(),
          last_seen_at: null,
          status: 'protected',
          folder_name: 'FishTycoon'
        }
      ],
      snapshots: [
        {
          id: 'snap-type-mismatch',
          game_id: 'game-1',
          created_at: new Date().toISOString(),
          size_bytes: Buffer.byteLength('backup-data'),
          checksum: 'snapshot-checksum',
          storage_path: snapshotRoot,
          reason: 'manual'
        }
      ],
      snapshotFiles: [
        {
          id: 'file-type-mismatch',
          snapshot_id: 'snap-type-mismatch',
          location_id: 'legacy-loc-id',
          relative_path: 'FishSaveGame1.pts',
          size_bytes: Buffer.byteLength('backup-data'),
          checksum: 'file-checksum'
        }
      ]
    });

    await expect(restoreSnapshot(db, settings, 'snap-type-mismatch')).resolves.toBeUndefined();
    expect(copyFileWithRetries).toHaveBeenCalledWith(
      sourceBackupFile,
      path.join(currentFolderPath, 'FishSaveGame1.pts'),
      3
    );
  });

  it('throws when no files can be restored to any destination', async () => {
    const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-restore-empty-result-'));
    tempRoots.push(snapshotRoot);
    fs.writeFileSync(
      path.join(snapshotRoot, 'snapshot.manifest.json'),
      JSON.stringify(
        {
          version: 2,
          snapshot_id: 'snap-empty-result',
          created_at: new Date().toISOString(),
          reason: 'manual',
          locations: {}
        },
        null,
        2
      ),
      'utf-8'
    );

    vi.mocked(listSaveLocations).mockReturnValue([]);
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
      ],
      snapshots: [
        {
          id: 'snap-empty-result',
          game_id: 'game-1',
          created_at: new Date().toISOString(),
          size_bytes: 1,
          checksum: 'snapshot-checksum',
          storage_path: snapshotRoot,
          reason: 'manual'
        }
      ],
      snapshotFiles: [
        {
          id: 'file-1',
          snapshot_id: 'snap-empty-result',
          location_id: 'unknown-loc',
          relative_path: 'save.sav',
          size_bytes: 1,
          checksum: 'file-checksum'
        }
      ]
    });

    await expect(restoreSnapshot(db, settings, 'snap-empty-result')).rejects.toThrow(
      'Restore failed: no files could be restored to destination paths.'
    );
  });

  it('keeps snapshot metadata when disk deletion fails', async () => {
    vi.mocked(removeDirSafe).mockRejectedValueOnce(new Error('locked'));
    const db = createMemoryDb({
      snapshots: [
        {
          id: 'snap-1',
          game_id: 'game-1',
          created_at: new Date().toISOString(),
          size_bytes: 1,
          checksum: 'snapshot-checksum',
          storage_path: 'C:\\Backups\\Game\\Snapshots\\snap-1',
          reason: 'manual'
        }
      ],
      snapshotFiles: [
        {
          id: 'file-1',
          snapshot_id: 'snap-1',
          location_id: 'loc-1',
          relative_path: 'save.sav',
          size_bytes: 1,
          checksum: 'file-checksum'
        }
      ]
    });

    await expect(deleteSnapshot(db, 'snap-1')).rejects.toThrow('locked');
    expect(db.state.snapshots).toHaveLength(1);
    expect(db.state.snapshotFiles).toHaveLength(1);
  });
});
