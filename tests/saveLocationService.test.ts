import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryDb } from '../src/main/services/db';
import { addSaveLocation, listSaveLocations } from '../src/main/services/saveLocationService';

describe('saveLocationService', () => {
  let tempRoot: string | null = null;

  afterEach(() => {
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = null;
    }
  });

  it('normalizes and deduplicates save locations for a game', () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-locations-'));
    const canonicalPath = path.join(tempRoot, 'Saves');
    fs.mkdirSync(canonicalPath, { recursive: true });
    const rawPath = path.join(tempRoot, 'Saves', '..', 'Saves');

    const db = createMemoryDb();
    const first = addSaveLocation(db, 'game-1', rawPath);
    const second = addSaveLocation(db, 'game-1', canonicalPath);

    expect(first.path).toBe(path.normalize(rawPath));
    expect(second.id).toBe(first.id);
    expect(db.state.saveLocations.length).toBe(1);
  });

  it('returns hydrated booleans and existence from listSaveLocations', () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-locations-'));
    const savePath = path.join(tempRoot, 'ProfileSave');
    fs.mkdirSync(savePath, { recursive: true });

    const db = createMemoryDb();
    addSaveLocation(db, 'game-1', savePath, true);
    const rows = listSaveLocations(db, 'game-1');

    expect(rows).toHaveLength(1);
    expect(rows[0]?.enabled).toBe(true);
    expect(rows[0]?.auto_detected).toBe(true);
    expect(rows[0]?.exists).toBe(true);
  });

});
