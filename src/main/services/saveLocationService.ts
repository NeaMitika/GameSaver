import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { SaveLocation, SaveLocationType } from '../../shared/types';
import { AppDb, StoredSaveLocation, persistDb } from './db';

export function listSaveLocations(db: AppDb, gameId: string): SaveLocation[] {
  const rows = db.state.saveLocations
    .filter((row) => row.game_id === gameId)
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path));
  return rows.map(hydrateLocation);
}

export function addSaveLocation(db: AppDb, gameId: string, locationPath: string, autoDetected = false): SaveLocation {
  const normalizedPath = normalizeLocationPath(locationPath.trim());
  if (!normalizedPath) {
    throw new Error('Save location path is required');
  }

  const existing = db.state.saveLocations.find(
    (row) => row.game_id === gameId && row.path.toLowerCase() === normalizedPath.toLowerCase()
  );
  if (existing) {
    return hydrateLocation(existing);
  }

  const stats = fs.existsSync(normalizedPath) ? fs.statSync(normalizedPath) : null;
  const type: SaveLocationType = stats?.isFile() ? 'file' : 'folder';

  const row: StoredSaveLocation = {
    id: uuid(),
    game_id: gameId,
    path: normalizedPath,
    type,
    auto_detected: autoDetected,
    enabled: true
  };
  db.state.saveLocations.push(row);
  persistDb(db);
  return hydrateLocation(row);
}

export function toggleSaveLocation(db: AppDb, id: string, enabled: boolean): void {
  const row = db.state.saveLocations.find((location) => location.id === id);
  if (!row) {
    return;
  }
  row.enabled = enabled;
  persistDb(db);
}

export function removeSaveLocation(db: AppDb, id: string): void {
  const before = db.state.saveLocations.length;
  db.state.saveLocations = db.state.saveLocations.filter((location) => location.id !== id);
  if (db.state.saveLocations.length !== before) {
    persistDb(db);
  }
}

export function resolveSaveLocationType(locationPath: string): SaveLocationType {
  if (fs.existsSync(locationPath)) {
    const stats = fs.statSync(locationPath);
    if (stats.isFile()) return 'file';
  }
  return 'folder';
}

export function normalizeLocationPath(locationPath: string): string {
  return path.normalize(locationPath);
}

function hydrateLocation(row: StoredSaveLocation): SaveLocation {
  return {
    ...row,
    exists: fs.existsSync(row.path)
  };
}
