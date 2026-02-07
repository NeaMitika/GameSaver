import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { AddGamePayload, EventLog, Game, GameDetail, GameSummary, Snapshot, SnapshotReason } from '../../shared/types';
import { detectSaveLocations } from './detectSaveLocations';
import { AppDb, StoredGame, persistDb } from './db';
import { logEvent } from './eventLogService';
import { addSaveLocation, listSaveLocations } from './saveLocationService';
import { ensureDir, getGameRoot, getMetadataPath, toSafeGameFolderName } from './storage';

export function listGames(db: AppDb, runningMap: Map<string, boolean>): GameSummary[] {
  return db.state.games
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
    .map((stored) => {
      const snapshots = db.state.snapshots
        .filter((snapshot) => snapshot.game_id === stored.id)
        .slice()
        .sort((left, right) => right.created_at.localeCompare(left.created_at));
      const latest = snapshots[0];
      const issueCount = db.state.eventLogs.filter((log) => log.game_id === stored.id && log.type === 'error').length;
      return {
        ...toPublicGame(stored),
        last_backup_at: latest?.created_at ?? null,
        last_snapshot_reason: (latest?.reason as SnapshotReason | undefined) ?? null,
        issue_count: issueCount,
        is_running: runningMap.get(stored.id) ?? false
      };
    });
}

export function getGameDetail(db: AppDb, gameId: string): GameDetail {
  const stored = getStoredGameById(db, gameId);
  if (!stored) {
    throw new Error('Game not found');
  }

  const saveLocations = listSaveLocations(db, gameId);
  const snapshots = db.state.snapshots
    .filter((snapshot) => snapshot.game_id === gameId)
    .slice()
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
  const eventLogs = db.state.eventLogs
    .filter((log) => log.game_id === gameId)
    .slice()
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 50);

  return { game: toPublicGame(stored), saveLocations, snapshots, eventLogs };
}

export function addGame(db: AppDb, payload: AddGamePayload, storageRoot: string): Game {
  const name = payload.name.trim();
  if (!name) {
    throw new Error('Game name is required');
  }

  const duplicate = db.state.games.find((game) => game.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    throw new Error('A game with this name already exists.');
  }

  const folderName = toSafeGameFolderName(name);
  const folderCollision = db.state.games.find(
    (game) => game.folder_name.toLowerCase() === folderName.toLowerCase()
  );
  if (folderCollision) {
    throw new Error('A game folder with this name already exists.');
  }

  const gameRoot = getGameRoot(storageRoot, folderName);
  if (fs.existsSync(gameRoot)) {
    throw new Error('A folder with this game name already exists in Backups.');
  }

  const now = new Date().toISOString();
  const game: StoredGame = {
    id: uuid(),
    name,
    install_path: payload.installPath,
    exe_path: payload.exePath,
    created_at: now,
    last_seen_at: null,
    status: 'protected',
    folder_name: folderName
  };

  db.state.games.push(game);
  persistDb(db);

  const candidates = detectSaveLocations({
    name: game.name,
    installPath: game.install_path
  });
  candidates
    .filter((candidate) => fs.existsSync(candidate))
    .forEach((candidate) => {
      addSaveLocation(db, game.id, candidate, true);
    });

  ensureGameFolder(storageRoot, game.folder_name, game);
  logEvent(db, game.id, 'backup', 'Game added and initial protection enabled.');
  return toPublicGame(game);
}

export function removeGame(db: AppDb, gameId: string, storageRoot: string): void {
  const game = getStoredGameById(db, gameId);
  if (!game) {
    return;
  }

  db.state.games = db.state.games.filter((item) => item.id !== gameId);
  db.state.saveLocations = db.state.saveLocations.filter((item) => item.game_id !== gameId);

  const snapshotIds = new Set(
    db.state.snapshots.filter((snapshot) => snapshot.game_id === gameId).map((snapshot) => snapshot.id)
  );
  db.state.snapshots = db.state.snapshots.filter((snapshot) => snapshot.game_id !== gameId);
  db.state.snapshotFiles = db.state.snapshotFiles.filter((item) => !snapshotIds.has(item.snapshot_id));
  db.state.eventLogs = db.state.eventLogs.filter((log) => log.game_id !== gameId);
  persistDb(db);

  const gameRoot = getGameRoot(storageRoot, game.folder_name);
  if (fs.existsSync(gameRoot)) {
    fs.rmSync(gameRoot, { recursive: true, force: true });
  }
}

export function updateGameStatus(db: AppDb, gameId: string, status: Game['status']): void {
  const game = getStoredGameById(db, gameId);
  if (!game) {
    return;
  }
  game.status = status;
  persistDb(db);
}

export function updateGameLastSeen(db: AppDb, gameId: string, lastSeenAt: string | null): void {
  const game = getStoredGameById(db, gameId);
  if (!game) {
    return;
  }
  game.last_seen_at = lastSeenAt;
  persistDb(db);
}

export function getStoredGameById(db: AppDb, gameId: string): StoredGame | undefined {
  return db.state.games.find((game) => game.id === gameId);
}

export function listStoredGames(db: AppDb): StoredGame[] {
  return db.state.games.slice();
}

export function listStoredSnapshots(db: AppDb): Snapshot[] {
  return db.state.snapshots.slice();
}

export function listStoredEventLogs(db: AppDb): EventLog[] {
  return db.state.eventLogs.slice();
}

export function toPublicGame(stored: StoredGame): Game {
  return {
    id: stored.id,
    name: stored.name,
    install_path: stored.install_path,
    exe_path: stored.exe_path,
    created_at: stored.created_at,
    last_seen_at: stored.last_seen_at,
    status: stored.status
  };
}

function ensureGameFolder(storageRoot: string, gameFolder: string, game: StoredGame): void {
  const gameRoot = getGameRoot(storageRoot, gameFolder);
  ensureDir(gameRoot);
  const metadataPath = getMetadataPath(storageRoot, gameFolder);
  const metadata = {
    id: game.id,
    name: game.name,
    install_path: game.install_path,
    exe_path: game.exe_path,
    created_at: game.created_at
  };
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
}

