import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface ElectronAppMock {
  isPackaged: boolean;
  getName: () => string;
  getPath: (name: string) => string;
  setPath: (name: string, value: string) => void;
}

interface MockedElectron {
  app: ElectronAppMock;
  getUserDataPath: () => string;
}

const appStateFolderName = 'AppState';

const originalExecPath = process.execPath;
const tempRoots: string[] = [];

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.execPath = originalExecPath;
  vi.clearAllMocks();
  vi.unmock('electron');
  while (tempRoots.length > 0) {
    const next = tempRoots.pop();
    if (next) {
      fs.rmSync(next, { recursive: true, force: true });
    }
  }
});

describe('dataRootService applyBootstrapUserDataPath', () => {
  it('uses install-local data root when packaged install already has portable data', async () => {
    const paths = createPaths();
    fs.mkdirSync(paths.installDir, { recursive: true });
    fs.mkdirSync(path.join(paths.portableUserData, appStateFolderName), { recursive: true });
    fs.writeFileSync(
      path.join(paths.portableUserData, appStateFolderName, 'settings.json'),
      JSON.stringify({ dataRoot: paths.portableUserData }, null, 2),
      'utf-8'
    );

    process.execPath = path.join(paths.installDir, 'GameSaver.exe');
    const mockedElectron = setupElectronMock({ isPackaged: true, appDataPath: paths.appDataPath });
    const service = await importWithElectronMock(mockedElectron.app);

    service.applyBootstrapUserDataPath();

    expect(mockedElectron.getUserDataPath()).toBe(path.join(paths.portableUserData, appStateFolderName));
    expect(readBootstrapDataRoot(paths.bootstrapPath)).toBe(paths.portableUserData);
  });

  it('does not copy default user-data content into install-local root when packaging is enabled', async () => {
    const paths = createPaths();
    fs.mkdirSync(paths.defaultUserData, { recursive: true });
    fs.mkdirSync(path.join(paths.defaultUserData, 'Backups'), { recursive: true });
    fs.mkdirSync(path.join(paths.defaultUserData, appStateFolderName), { recursive: true });
    fs.writeFileSync(path.join(paths.defaultUserData, 'Backups', 'index.db'), 'db', 'utf-8');
    fs.writeFileSync(
      path.join(paths.defaultUserData, appStateFolderName, 'settings.json'),
      JSON.stringify({ dataRoot: paths.defaultUserData, storageRoot: path.join(paths.defaultUserData, 'Backups') }, null, 2),
      'utf-8'
    );
    fs.mkdirSync(paths.installDir, { recursive: true });

    process.execPath = path.join(paths.installDir, 'GameSaver.exe');
    const mockedElectron = setupElectronMock({ isPackaged: true, appDataPath: paths.appDataPath });
    const service = await importWithElectronMock(mockedElectron.app);

    service.applyBootstrapUserDataPath();

    expect(mockedElectron.getUserDataPath()).toBe(path.join(paths.portableUserData, appStateFolderName));
    expect(fs.existsSync(path.join(paths.portableUserData, appStateFolderName, 'settings.json'))).toBe(false);
    expect(fs.existsSync(path.join(paths.portableUserData, 'Backups', 'index.db'))).toBe(false);
    expect(readBootstrapDataRoot(paths.bootstrapPath)).toBe(paths.portableUserData);
  });

  it('respects bootstrap data root when portable data exists but points elsewhere', async () => {
    const paths = createPaths();
    fs.mkdirSync(paths.installDir, { recursive: true });
    fs.mkdirSync(paths.customDataRoot, { recursive: true });
    fs.mkdirSync(path.join(paths.portableUserData, appStateFolderName), { recursive: true });
    fs.writeFileSync(
      path.join(paths.portableUserData, appStateFolderName, 'settings.json'),
      JSON.stringify({ dataRoot: paths.customDataRoot }, null, 2),
      'utf-8'
    );
    fs.mkdirSync(path.dirname(paths.bootstrapPath), { recursive: true });
    fs.writeFileSync(paths.bootstrapPath, JSON.stringify({ dataRoot: paths.customDataRoot }, null, 2), 'utf-8');

    process.execPath = path.join(paths.installDir, 'GameSaver.exe');
    const mockedElectron = setupElectronMock({ isPackaged: true, appDataPath: paths.appDataPath });
    const service = await importWithElectronMock(mockedElectron.app);

    service.applyBootstrapUserDataPath();

    expect(mockedElectron.getUserDataPath()).toBe(path.join(paths.customDataRoot, appStateFolderName));
    expect(readBootstrapDataRoot(paths.bootstrapPath)).toBe(paths.customDataRoot);
  });

  it('falls back to bootstrap path in development mode', async () => {
    const paths = createPaths();
    fs.mkdirSync(paths.customDataRoot, { recursive: true });
    fs.mkdirSync(path.dirname(paths.bootstrapPath), { recursive: true });
    fs.writeFileSync(paths.bootstrapPath, JSON.stringify({ dataRoot: paths.customDataRoot }, null, 2), 'utf-8');

    process.execPath = path.join(paths.installDir, 'GameSaver.exe');
    const mockedElectron = setupElectronMock({ isPackaged: false, appDataPath: paths.appDataPath });
    const service = await importWithElectronMock(mockedElectron.app);

    service.applyBootstrapUserDataPath();

    expect(mockedElectron.getUserDataPath()).toBe(path.join(paths.customDataRoot, appStateFolderName));
  });
});

async function importWithElectronMock(appMock: ElectronAppMock) {
  vi.doMock('electron', () => ({ app: appMock }));
  return await import('../src/main/services/dataRootService');
}

function setupElectronMock(options: { isPackaged: boolean; appDataPath: string }): MockedElectron {
  const { isPackaged, appDataPath } = options;
  let userDataPath = path.join(appDataPath, 'GameSaver');

  const app: ElectronAppMock = {
    isPackaged,
    getName: () => 'GameSaver',
    getPath: (name: string) => {
      if (name === 'appData') {
        return appDataPath;
      }
      if (name === 'userData') {
        return userDataPath;
      }
      throw new Error(`Unhandled app path: ${name}`);
    },
    setPath: (name: string, value: string) => {
      if (name !== 'userData') {
        throw new Error(`Unhandled setPath target: ${name}`);
      }
      userDataPath = value;
    }
  };

  return {
    app,
    getUserDataPath: () => userDataPath
  };
}

function createPaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gamesaver-data-root-'));
  tempRoots.push(root);

  const appDataPath = path.join(root, 'AppData');
  const defaultUserData = path.join(appDataPath, 'GameSaver');
  const bootstrapPath = path.join(defaultUserData, 'bootstrap.json');
  const installDir = path.join(root, 'USB', 'GameSaver');
  const portableUserData = path.join(installDir, 'GameSaverData');
  const customDataRoot = path.join(root, 'CustomData');

  return {
    appDataPath,
    bootstrapPath,
    customDataRoot,
    defaultUserData,
    installDir,
    portableUserData
  };
}

function readBootstrapDataRoot(bootstrapPath: string): string | null {
  if (!fs.existsSync(bootstrapPath)) {
    return null;
  }
  const raw = fs.readFileSync(bootstrapPath, 'utf-8');
  const parsed = JSON.parse(raw) as { dataRoot?: string };
  return parsed.dataRoot ?? null;
}
