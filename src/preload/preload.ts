import { contextBridge, ipcRenderer } from 'electron';
import {
  AddGamePayload,
  BackupScanResult,
  Game,
  GameDetail,
  GameSummary,
  Settings,
  StartupState,
  VerifyResult,
  SaveLocation
} from '../shared/types';

const api = {
  listGames: (): Promise<GameSummary[]> => ipcRenderer.invoke('games:list'),
  getGame: (gameId: string): Promise<GameDetail> => ipcRenderer.invoke('games:get', gameId),
  addGame: (payload: AddGamePayload): Promise<Game> => ipcRenderer.invoke('games:add', payload),
  removeGame: (gameId: string): Promise<void> => ipcRenderer.invoke('games:remove', gameId),
  launchGame: (gameId: string): Promise<void> => ipcRenderer.invoke('games:launch', gameId),
  addSaveLocation: (gameId: string, locationPath: string): Promise<SaveLocation> =>
    ipcRenderer.invoke('savelocations:add', { gameId, path: locationPath }),
  toggleSaveLocation: (id: string, enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('savelocations:toggle', { id, enabled }),
  removeSaveLocation: (id: string): Promise<void> =>
    ipcRenderer.invoke('savelocations:remove', { id }),
  backupNow: (gameId: string): Promise<void> => ipcRenderer.invoke('backup:now', { gameId }),
  scanBackups: (): Promise<BackupScanResult> => ipcRenderer.invoke('backup:scan'),
  restoreSnapshot: (snapshotId: string): Promise<void> => ipcRenderer.invoke('restore:snapshot', { snapshotId }),
  verifySnapshot: (snapshotId: string): Promise<VerifyResult> => ipcRenderer.invoke('snapshot:verify', { snapshotId }),
  deleteSnapshot: (snapshotId: string): Promise<void> => ipcRenderer.invoke('snapshot:remove', { snapshotId }),
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  updateSettings: (payload: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke('settings:update', payload),
  pickExe: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickExe'),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickFolder'),
  pickSaveLocation: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickSaveLocation'),
  onGameStatus: (callback: (payload: { gameId: string; isRunning: boolean }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: { gameId: string; isRunning: boolean }) => {
      callback(payload);
    };
    ipcRenderer.on('games:status', handler);
    return () => ipcRenderer.removeListener('games:status', handler);
  },
  windowControls: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: (): Promise<boolean> => ipcRenderer.invoke('window:toggle-maximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
    getLayoutMode: (): Promise<'normal' | 'widget'> => ipcRenderer.invoke('window:get-layout-mode'),
    setLayoutMode: (mode: 'normal' | 'widget'): Promise<'normal' | 'widget'> =>
      ipcRenderer.invoke('window:set-layout-mode', mode),
    onWindowState: (callback: (payload: { isMaximized: boolean }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: { isMaximized: boolean }) => {
        callback(payload);
      };
      ipcRenderer.on('window:state', handler);
      return () => ipcRenderer.removeListener('window:state', handler);
    }
  },
  relaunchApp: (): Promise<void> => ipcRenderer.invoke('app:relaunch'),
  getStartupState: (): Promise<StartupState> => ipcRenderer.invoke('app:get-startup-state'),
  onRestartRequired: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on('app:restart-required', handler);
    return () => ipcRenderer.removeListener('app:restart-required', handler);
  }
};

contextBridge.exposeInMainWorld('gamesaver', api);

