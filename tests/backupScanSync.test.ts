import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanSnapshotsFromDisk } from '../src/main/services/backupService';
import { createMemoryDb } from '../src/main/services/db';
import { Settings } from '../src/shared/types';

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const next = tempRoots.pop();
    if (!next) continue;
    fs.rmSync(next, { recursive: true, force: true });
  }
});

describe('scanSnapshotsFromDisk', () => {
  it('syncs snapshot rows against what exists on disk', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-scan-'));
    tempRoots.push(root);
    const storageRoot = path.join(root, 'Backups');
    fs.mkdirSync(storageRoot, { recursive: true });

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
        },
        {
          id: 'game-2',
          name: 'Game Two',
          install_path: 'C:\\Games\\Two',
          exe_path: 'C:\\Games\\Two\\two.exe',
          created_at: new Date().toISOString(),
          last_seen_at: null,
          status: 'protected',
          folder_name: 'game-2'
        }
      ],
      snapshots: [
        {
          id: 'snap-db-only',
          game_id: 'game-1',
          created_at: new Date().toISOString(),
          size_bytes: 99,
          checksum: 'stale-checksum',
          storage_path: path.join(storageRoot, 'game-1', 'Snapshots', 'snap-db-only'),
          reason: 'manual'
        }
      ],
      snapshotFiles: [
        {
          id: 'file-db-only',
          snapshot_id: 'snap-db-only',
          location_id: 'loc-1',
          relative_path: 'save-a.sav',
          size_bytes: 99,
          checksum: 'old'
        }
      ]
    });

    const importedFilePath = path.join(storageRoot, 'game-1', 'Snapshots', 'snap-disk', 'loc-disk', 'save-new.sav');
    fs.mkdirSync(path.dirname(importedFilePath), { recursive: true });
    fs.writeFileSync(importedFilePath, 'new-save', 'utf-8');
    fs.writeFileSync(
      path.join(storageRoot, 'game-1', 'Snapshots', 'snap-disk', 'snapshot.manifest.json'),
      JSON.stringify(
        {
          version: 2,
          snapshot_id: 'snap-disk',
          created_at: '2026-02-07T10:11:12.123Z',
          reason: 'manual',
          locations: {
            'loc-disk': {
              path: 'C:\\Games\\One\\Saves',
              type: 'folder',
              auto_detected: false,
              enabled: true,
              storage_folder: 'loc-disk'
            }
          }
        },
        null,
        2
      ),
      'utf-8'
    );

    const unknownFilePath = path.join(storageRoot, 'unknown-game', 'Snapshots', 'snap-unknown', 'loc', 'ghost.sav');
    fs.mkdirSync(path.dirname(unknownFilePath), { recursive: true });
    fs.writeFileSync(unknownFilePath, 'ghost', 'utf-8');

    fs.mkdirSync(path.join(storageRoot, 'game-2', 'Snapshots', 'snap-empty'), { recursive: true });

    const settings: Settings = {
      backupFrequencyMinutes: 5,
      retentionCount: 10,
      storageRoot,
      compressionEnabled: false,
      dataRoot: root
    };

    const result = await scanSnapshotsFromDisk(db, settings);

    expect(result).toEqual({
      addedSnapshots: 1,
      removedSnapshots: 1,
      removedSnapshotFiles: 1,
      skippedUnknownGames: 1,
      skippedInvalidSnapshots: 1
    });

    expect(db.state.snapshots).toHaveLength(1);
    expect(db.state.snapshots[0]).toMatchObject({
      id: 'snap-disk',
      game_id: 'game-1',
      reason: 'manual'
    });

    expect(db.state.snapshotFiles).toHaveLength(1);
    expect(db.state.snapshotFiles[0]).toMatchObject({
      snapshot_id: 'snap-disk',
      location_id: 'loc-disk',
      relative_path: 'save-new.sav',
      size_bytes: Buffer.byteLength('new-save')
    });
  });

  it('recovers unknown game snapshots when metadata and manifest exist on disk', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-scan-'));
    tempRoots.push(root);
    const storageRoot = path.join(root, 'Backups');
    fs.mkdirSync(storageRoot, { recursive: true });

    const gameId = 'game-recovered';
    const snapshotFolder = '2026-02-07_10-11-12-123';
    const snapshotId = 'snap-recovered';
    const locationId = 'loc-docs';
    const gameRoot = path.join(storageRoot, gameId);
    const snapshotFilePath = path.join(gameRoot, 'Snapshots', snapshotFolder, 'Documents', 'save-a.sav');
    fs.mkdirSync(path.dirname(snapshotFilePath), { recursive: true });
    fs.writeFileSync(snapshotFilePath, 'save-content', 'utf-8');
    fs.writeFileSync(
      path.join(gameRoot, 'Snapshots', snapshotFolder, 'snapshot.manifest.json'),
      JSON.stringify(
        {
          version: 2,
          snapshot_id: snapshotId,
          created_at: '2026-02-07T10:11:12.123Z',
          reason: 'manual',
          locations: {
            [locationId]: {
              path: 'C:\\Users\\Player\\Documents\\Recovered',
              type: 'folder',
              auto_detected: false,
              enabled: true,
              storage_folder: 'Documents'
            }
          }
        },
        null,
        2
      ),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(gameRoot, 'metadata.json'),
      JSON.stringify(
        {
          id: gameId,
          name: 'Legacy Game',
          install_path: 'C:\\Games\\Legacy',
          exe_path: 'C:\\Games\\Legacy\\legacy.exe',
          created_at: new Date('2025-10-10T10:00:00.000Z').toISOString()
        },
        null,
        2
      ),
      'utf-8'
    );

    const db = createMemoryDb();
    const settings: Settings = {
      backupFrequencyMinutes: 5,
      retentionCount: 10,
      storageRoot,
      compressionEnabled: false,
      dataRoot: root
    };

    const result = await scanSnapshotsFromDisk(db, settings);

    expect(result.skippedUnknownGames).toBe(0);
    expect(result.addedSnapshots).toBe(1);
    expect(db.state.games).toHaveLength(1);
    expect(db.state.games[0]?.id).toBe(gameId);
    expect(db.state.snapshots[0]?.id).toBe(snapshotId);
    expect(db.state.saveLocations).toHaveLength(1);
    expect(db.state.saveLocations[0]?.id).toBe(locationId);
    expect(db.state.saveLocations[0]?.path).toBe('C:\\Users\\Player\\Documents\\Recovered');
    expect(db.state.saveLocations[0]?.enabled).toBe(true);
  });

  it('imports timestamp snapshot folders and maps storage folders via manifest', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-scan-'));
    tempRoots.push(root);
    const storageRoot = path.join(root, 'Backups');
    fs.mkdirSync(storageRoot, { recursive: true });

    const gameId = 'game-1';
    const snapshotFolder = '2026-02-07_10-11-12-123';
    const manifestSnapshotId = 'snap-manifest-id';
    const locationId = 'loc-docs';
    const gameFolder = path.join(storageRoot, 'game-1');
    const snapshotRoot = path.join(gameFolder, 'Snapshots', snapshotFolder);
    const backupFilePath = path.join(snapshotRoot, 'Documents', 'profile1.sav');
    fs.mkdirSync(path.dirname(backupFilePath), { recursive: true });
    fs.writeFileSync(backupFilePath, 'save-content', 'utf-8');
    fs.writeFileSync(
      path.join(snapshotRoot, 'snapshot.manifest.json'),
      JSON.stringify(
        {
          version: 2,
          snapshot_id: manifestSnapshotId,
          created_at: '2026-02-07T10:11:12.123Z',
          reason: 'manual',
          locations: {
            [locationId]: {
              path: 'C:\\Users\\Player\\Documents\\Age3',
              type: 'folder',
              auto_detected: false,
              enabled: true,
              storage_folder: 'Documents'
            }
          }
        },
        null,
        2
      ),
      'utf-8'
    );

    const db = createMemoryDb({
      games: [
        {
          id: gameId,
          name: 'Age3',
          install_path: 'C:\\Games\\Age3',
          exe_path: 'C:\\Games\\Age3\\age3.exe',
          created_at: new Date().toISOString(),
          last_seen_at: null,
          status: 'protected',
          folder_name: 'game-1'
        }
      ]
    });

    const settings: Settings = {
      backupFrequencyMinutes: 5,
      retentionCount: 10,
      storageRoot,
      compressionEnabled: false,
      dataRoot: root
    };

    const result = await scanSnapshotsFromDisk(db, settings);

    expect(result.addedSnapshots).toBe(1);
    expect(db.state.snapshots).toHaveLength(1);
    expect(db.state.snapshots[0]?.id).toBe(manifestSnapshotId);
    expect(db.state.snapshots[0]?.storage_path).toBe(snapshotRoot);
    expect(db.state.snapshotFiles).toHaveLength(1);
    expect(db.state.snapshotFiles[0]?.location_id).toBe(locationId);
    expect(db.state.snapshotFiles[0]?.relative_path).toBe('profile1.sav');
    expect(db.state.saveLocations).toHaveLength(1);
    expect(db.state.saveLocations[0]?.id).toBe(locationId);
    expect(db.state.saveLocations[0]?.path).toBe('C:\\Users\\Player\\Documents\\Age3');
  });
});
