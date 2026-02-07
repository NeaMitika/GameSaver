import chokidar, { FSWatcher } from 'chokidar';
import fs from 'fs';
import path from 'path';
import { Settings } from '../../shared/types';
import { backupGame } from './backupService';
import { AppDb } from './db';
import { logEvent } from './eventLogService';
import { listSaveLocations } from './saveLocationService';

const watchers = new Map<string, FSWatcher>();
const pendingBackups = new Map<string, NodeJS.Timeout>();
let scanTimer: NodeJS.Timeout | null = null;

export function startWatcher(db: AppDb, settings: Settings): void {
  refreshWatcher(db, settings);
  startPeriodicScan(db, settings);
}

export function refreshWatcher(db: AppDb, settings: Settings): void {
  for (const watcher of watchers.values()) {
    watcher.close().catch(() => undefined);
  }
  watchers.clear();

  for (const game of db.state.games) {
    const locations = listSaveLocations(db, game.id).filter((loc) => loc.enabled);
    const pathsToWatch = locations.map((loc) => loc.path).filter((target) => fs.existsSync(target));
    if (pathsToWatch.length === 0) continue;

    const watcher = chokidar.watch(pathsToWatch, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 800,
        pollInterval: 200
      }
    });

    const schedule = () => scheduleBackup(db, settings, game.id, 'auto');
    watcher.on('add', schedule);
    watcher.on('change', schedule);
    watcher.on('unlink', schedule);
    watcher.on('error', (error) => {
      logEvent(db, game.id, 'error', `Watcher error: ${error}`);
    });

    watchers.set(game.id, watcher);
  }
}

function scheduleBackup(db: AppDb, settings: Settings, gameId: string, reason: 'auto' | 'manual'): void {
  const existing = pendingBackups.get(gameId);
  if (existing) {
    clearTimeout(existing);
  }

  const timeout = setTimeout(() => {
    pendingBackups.delete(gameId);
    backupGame(db, settings, gameId, reason).catch((error) => {
      logEvent(db, gameId, 'error', `Auto backup failed: ${error.message || error}`);
    });
  }, 15000);

  pendingBackups.set(gameId, timeout);
}

function startPeriodicScan(db: AppDb, settings: Settings): void {
  if (scanTimer) {
    clearInterval(scanTimer);
  }

  const intervalMs = Math.max(1, settings.backupFrequencyMinutes) * 60 * 1000;
  scanTimer = setInterval(() => {
    scanForChanges(db, settings).catch(() => undefined);
  }, intervalMs);
}

async function scanForChanges(db: AppDb, settings: Settings): Promise<void> {
  for (const game of db.state.games) {
    const lastSnapshot = db.state.snapshots
      .filter((snapshot) => snapshot.game_id === game.id)
      .slice()
      .sort((left, right) => right.created_at.localeCompare(left.created_at))[0];

    if (!lastSnapshot?.created_at) {
      continue;
    }

    const since = new Date(lastSnapshot.created_at).getTime();
    const locations = listSaveLocations(db, game.id).filter((loc) => loc.enabled);
    let changed = false;

    for (const location of locations) {
      if (!fs.existsSync(location.path)) continue;
      if (location.type === 'file') {
        const stats = fs.statSync(location.path);
        if (stats.mtimeMs > since) {
          changed = true;
          break;
        }
      } else {
        const hasChanges = await folderChangedSince(location.path, since);
        if (hasChanges) {
          changed = true;
          break;
        }
      }
    }

    if (changed) {
      await backupGame(db, settings, game.id, 'auto');
    }
  }
}

async function folderChangedSince(root: string, since: number): Promise<boolean> {
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        const stats = await fs.promises.stat(fullPath);
        if (stats.mtimeMs > since) {
          return true;
        }
      }
    }
  }
  return false;
}

