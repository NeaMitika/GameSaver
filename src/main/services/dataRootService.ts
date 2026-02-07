import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { Settings } from '../../shared/types';

interface BootstrapState {
  dataRoot?: string;
}

const bootstrapFileName = 'bootstrap.json';
const settingsFileName = 'settings.json';
const portableDataFolderName = 'GameSaverData';
const appStateFolderName = 'AppState';

export function getDefaultUserDataPath(): string {
  return path.join(app.getPath('appData'), app.getName());
}

export function getBootstrapPath(): string {
  return path.join(getDefaultUserDataPath(), bootstrapFileName);
}

export function applyBootstrapUserDataPath(): void {
  const bootstrapDataRoot = readBootstrapDataRoot();
  const portableDataRoot = getInstalledPortableDataRoot();

  if (portableDataRoot) {
    const portableSettingsDataRoot = readSettingsDataRoot(portableDataRoot);
    const portableSelfManaged =
      portableSettingsDataRoot !== null && isSamePath(portableSettingsDataRoot, portableDataRoot);
    const portableHasData = hasDataMarker(portableDataRoot);

    if (portableSelfManaged && setUserDataPath(portableDataRoot)) {
      writeBootstrapDataRoot(portableDataRoot);
      return;
    }

    if (bootstrapDataRoot) {
      setUserDataPath(bootstrapDataRoot);
      return;
    }

    if (portableHasData && setUserDataPath(portableDataRoot)) {
      writeBootstrapDataRoot(portableDataRoot);
      return;
    }

    if (setUserDataPath(portableDataRoot)) {
      writeBootstrapDataRoot(portableDataRoot);
      return;
    }
  }

  if (bootstrapDataRoot) {
    setUserDataPath(bootstrapDataRoot);
  }
}

function getInstalledPortableDataRoot(): string | null {
  if (!app.isPackaged) {
    return null;
  }
  return path.join(path.dirname(process.execPath), portableDataFolderName);
}

function toUserDataPath(dataRoot: string): string {
  return path.join(dataRoot, appStateFolderName);
}

function toDataRootPath(candidatePath: string): string {
  const resolved = path.resolve(candidatePath);
  if (path.basename(resolved).toLowerCase() === appStateFolderName.toLowerCase()) {
    return path.dirname(resolved);
  }
  return resolved;
}

function readBootstrapDataRoot(): string | null {
  const bootstrapPath = getBootstrapPath();
  if (!fs.existsSync(bootstrapPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(bootstrapPath, 'utf-8');
    const parsed = JSON.parse(raw) as BootstrapState;
    if (typeof parsed.dataRoot !== 'string' || parsed.dataRoot.length === 0) {
      return null;
    }
    const dataRoot = toDataRootPath(parsed.dataRoot);
    if (!fs.existsSync(dataRoot)) {
      return null;
    }
    return dataRoot;
  } catch {
    return null;
  }
}

function readSettingsDataRoot(dataRoot: string): string | null {
  const settingsPath = path.join(toUserDataPath(dataRoot), settingsFileName);
  if (!fs.existsSync(settingsPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    const parsed = JSON.parse(raw) as BootstrapState;
    if (typeof parsed.dataRoot !== 'string' || parsed.dataRoot.length === 0) {
      return null;
    }
    return toDataRootPath(parsed.dataRoot);
  } catch {
    return null;
  }
}

function hasDataMarker(dataRoot: string): boolean {
  return (
    fs.existsSync(path.join(toUserDataPath(dataRoot), settingsFileName)) ||
    fs.existsSync(path.join(dataRoot, settingsFileName)) ||
    fs.existsSync(path.join(dataRoot, 'Backups'))
  );
}

function setUserDataPath(dataRoot: string): boolean {
  const userDataPath = toUserDataPath(dataRoot);
  if (!ensureWritableDirectory(userDataPath)) {
    return false;
  }

  try {
    app.setPath('userData', userDataPath);
    return true;
  } catch {
    return false;
  }
}

function ensureWritableDirectory(targetPath: string): boolean {
  try {
    fs.mkdirSync(targetPath, { recursive: true });
    const probePath = path.join(targetPath, `.gamesaver-write-${process.pid}.tmp`);
    fs.writeFileSync(probePath, 'ok', 'utf-8');
    fs.rmSync(probePath, { force: true });
    return true;
  } catch {
    return false;
  }
}

function writeBootstrapDataRoot(dataRoot: string): void {
  try {
    const bootstrapPath = getBootstrapPath();
    fs.mkdirSync(path.dirname(bootstrapPath), { recursive: true });
    fs.writeFileSync(bootstrapPath, JSON.stringify({ dataRoot }, null, 2), 'utf-8');
  } catch {
    // ignore bootstrap write failures
  }
}

function isSamePath(left: string, right: string): boolean {
  return normalizeForComparison(left) === normalizeForComparison(right);
}

function normalizeForComparison(targetPath: string): string {
  const resolved = path.resolve(targetPath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export async function stageDataRootMigration(options: {
  oldUserData: string;
  newUserData: string;
  oldStorageRoot: string;
  newStorageRoot: string;
  settingsToWrite: Settings;
}): Promise<void> {
  const oldDataRoot = toDataRootPath(options.oldUserData);
  const newDataRoot = toDataRootPath(options.newUserData);
  const oldAppState = toUserDataPath(oldDataRoot);
  const newAppState = toUserDataPath(newDataRoot);

  await fs.promises.mkdir(newDataRoot, { recursive: true });
  await fs.promises.mkdir(newAppState, { recursive: true });

  const bootstrapPath = getBootstrapPath();
  await fs.promises.mkdir(path.dirname(bootstrapPath), { recursive: true });
  await fs.promises.writeFile(bootstrapPath, JSON.stringify({ dataRoot: newDataRoot }, null, 2), 'utf-8');

  const targetSettingsPath = path.join(newAppState, settingsFileName);
  await fs.promises.writeFile(targetSettingsPath, JSON.stringify(options.settingsToWrite, null, 2), 'utf-8');

  if (!isSamePath(oldAppState, newAppState) && (await pathExists(oldAppState))) {
    await copyMissingEntries(oldAppState, newAppState, [settingsFileName]);
  }

  if (options.oldStorageRoot === options.newStorageRoot) return;
  if (!(await pathExists(options.oldStorageRoot))) return;

  try {
    await fs.promises.mkdir(path.dirname(options.newStorageRoot), { recursive: true });
    await fs.promises.rename(options.oldStorageRoot, options.newStorageRoot);
  } catch {
    try {
      await fs.promises.mkdir(options.newStorageRoot, { recursive: true });
      await fs.promises.cp(options.oldStorageRoot, options.newStorageRoot, { recursive: true });
      await fs.promises.rm(options.oldStorageRoot, { recursive: true, force: true });
    } catch {
      // ignore migration failures; user can re-point later
    }
  }
}

async function copyMissingEntries(sourceRoot: string, destinationRoot: string, excludedNames: string[]): Promise<void> {
  const entries = await fs.promises.readdir(sourceRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (excludedNames.includes(entry.name)) {
      continue;
    }
    const source = path.join(sourceRoot, entry.name);
    const destination = path.join(destinationRoot, entry.name);
    if (await pathExists(destination)) {
      continue;
    }
    if (entry.isDirectory()) {
      await fs.promises.cp(source, destination, { recursive: true });
    } else if (entry.isFile()) {
      await fs.promises.copyFile(source, destination);
    }
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.promises.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
