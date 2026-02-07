import path from 'path';
import fs from 'fs';

export function ensureDir(targetPath: string): void {
  fs.mkdirSync(targetPath, { recursive: true });
}

export function getGameRoot(storageRoot: string, gameFolder: string): string {
  return path.join(storageRoot, gameFolder);
}

export function getSnapshotRoot(storageRoot: string, gameFolder: string, snapshotId: string): string {
  return path.join(storageRoot, gameFolder, 'Snapshots', snapshotId);
}

export function getMetadataPath(storageRoot: string, gameFolder: string): string {
  return path.join(storageRoot, gameFolder, 'metadata.json');
}

export function toSafeGameFolderName(name: string): string {
  const trimmed = name.trim();
  const cleaned = trimmed.replace(/[\\/:*?"<>|]/g, '').replace(/\.+$/g, '').trim();
  const base = cleaned.length > 0 ? cleaned : 'Game';
  return base.replace(/\s+/g, ' ');
}
