import fs from 'fs';
import path from 'path';
import { EventLog, Game, SaveLocation, Settings, Snapshot, SnapshotFile } from '../../shared/types';
import { ensureDir } from './storage';

const STATE_FILE_NAME = 'library.json';

export interface StoredGame extends Game {
  folder_name: string;
}

export type StoredSaveLocation = Omit<SaveLocation, 'exists'>;

export interface AppStateData {
  schemaVersion: number;
  games: StoredGame[];
  saveLocations: StoredSaveLocation[];
  snapshots: Snapshot[];
  snapshotFiles: SnapshotFile[];
  eventLogs: EventLog[];
}

export interface AppDb {
  settings: Settings;
  statePath: string | null;
  state: AppStateData;
}

let dbInstance: AppDb | null = null;

export function getDb(settings: Settings): AppDb {
  if (dbInstance) {
    dbInstance.settings = settings;
    return dbInstance;
  }

  ensureDir(settings.dataRoot);
  const appStateRoot = path.join(settings.dataRoot, 'AppState');
  ensureDir(appStateRoot);
  ensureDir(settings.storageRoot);

  const statePath = path.join(appStateRoot, STATE_FILE_NAME);
  const state = readStateFile(statePath);
  dbInstance = {
    settings,
    statePath,
    state
  };
  persistDb(dbInstance);
  return dbInstance;
}

export function closeDb(): void {
  dbInstance = null;
}

export function persistDb(db: AppDb): void {
  if (!db.statePath) {
    return;
  }
  ensureDir(path.dirname(db.statePath));
  fs.writeFileSync(db.statePath, JSON.stringify(db.state, null, 2), 'utf-8');
}

export function createMemoryDb(initial?: Partial<AppStateData>): AppDb {
  const state: AppStateData = normalizeState(initial ?? createEmptyState());
  return {
    settings: {
      backupFrequencyMinutes: 5,
      retentionCount: 10,
      storageRoot: '',
      compressionEnabled: false,
      dataRoot: '',
      language: 'en'
    },
    statePath: null,
    state
  };
}

function readStateFile(statePath: string): AppStateData {
  if (!fs.existsSync(statePath)) {
    return createEmptyState();
  }

  try {
    const raw = fs.readFileSync(statePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AppStateData>;
    return normalizeState(parsed);
  } catch {
    return createEmptyState();
  }
}

function createEmptyState(): AppStateData {
  return {
    schemaVersion: 2,
    games: [],
    saveLocations: [],
    snapshots: [],
    snapshotFiles: [],
    eventLogs: []
  };
}

function normalizeState(input: Partial<AppStateData>): AppStateData {
  const state = createEmptyState();
  state.schemaVersion = typeof input.schemaVersion === 'number' ? input.schemaVersion : 2;
  state.games = normalizeGames(input.games);
  state.saveLocations = normalizeSaveLocations(input.saveLocations);
  state.snapshots = normalizeSnapshots(input.snapshots);
  state.snapshotFiles = normalizeSnapshotFiles(input.snapshotFiles);
  state.eventLogs = normalizeEventLogs(input.eventLogs);
  return state;
}

function normalizeGames(input: unknown): StoredGame[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .filter((entry) => Boolean(entry) && typeof entry === 'object')
    .map((entry) => entry as Partial<StoredGame>)
    .filter((entry): entry is StoredGame => {
      return (
        typeof entry.id === 'string' &&
        typeof entry.name === 'string' &&
        typeof entry.install_path === 'string' &&
        typeof entry.exe_path === 'string' &&
        typeof entry.created_at === 'string' &&
        (entry.last_seen_at === null || typeof entry.last_seen_at === 'string') &&
        (entry.status === 'protected' || entry.status === 'warning' || entry.status === 'error') &&
        typeof entry.folder_name === 'string'
      );
    });
}

function normalizeSaveLocations(input: unknown): StoredSaveLocation[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .filter((entry) => Boolean(entry) && typeof entry === 'object')
    .map((entry) => entry as Partial<StoredSaveLocation & { auto_detected?: unknown; enabled?: unknown }>)
    .filter((entry): entry is StoredSaveLocation => {
      return (
        typeof entry.id === 'string' &&
        typeof entry.game_id === 'string' &&
        typeof entry.path === 'string' &&
        (entry.type === 'folder' || entry.type === 'file') &&
        entry.auto_detected !== undefined &&
        entry.enabled !== undefined
      );
    })
    .map((entry) => ({
      ...entry,
      auto_detected: toBooleanLike(entry.auto_detected),
      enabled: toBooleanLike(entry.enabled)
    }));
}

function normalizeSnapshots(input: unknown): Snapshot[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .filter((entry) => Boolean(entry) && typeof entry === 'object')
    .map((entry) => entry as Partial<Snapshot>)
    .filter((entry): entry is Snapshot => {
      return (
        typeof entry.id === 'string' &&
        typeof entry.game_id === 'string' &&
        typeof entry.created_at === 'string' &&
        typeof entry.size_bytes === 'number' &&
        typeof entry.checksum === 'string' &&
        typeof entry.storage_path === 'string' &&
        (entry.reason === 'auto' || entry.reason === 'manual' || entry.reason === 'pre-restore')
      );
    });
}

function normalizeSnapshotFiles(input: unknown): SnapshotFile[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .filter((entry) => Boolean(entry) && typeof entry === 'object')
    .map((entry) => entry as Partial<SnapshotFile>)
    .filter((entry): entry is SnapshotFile => {
      return (
        typeof entry.id === 'string' &&
        typeof entry.snapshot_id === 'string' &&
        typeof entry.location_id === 'string' &&
        typeof entry.relative_path === 'string' &&
        typeof entry.size_bytes === 'number' &&
        typeof entry.checksum === 'string'
      );
    });
}

function normalizeEventLogs(input: unknown): EventLog[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .filter((entry) => Boolean(entry) && typeof entry === 'object')
    .map((entry) => entry as Partial<EventLog>)
    .filter((entry): entry is EventLog => {
      return (
        typeof entry.id === 'string' &&
        (entry.game_id === null || typeof entry.game_id === 'string') &&
        (entry.type === 'backup' || entry.type === 'restore' || entry.type === 'error') &&
        typeof entry.message === 'string' &&
        typeof entry.created_at === 'string'
      );
    });
}

function toBooleanLike(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return Boolean(value);
}
