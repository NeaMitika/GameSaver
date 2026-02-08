import type { Settings, StartupState } from '@shared/types';

export type Screen = 'dashboard' | 'add' | 'detail' | 'settings';
export type NoticeTone = 'info' | 'success' | 'error';
export type LayoutMode = 'normal' | 'widget';

export const EMPTY_SETTINGS: Settings = {
  backupFrequencyMinutes: 5,
  retentionCount: 10,
  storageRoot: '',
  compressionEnabled: false,
  dataRoot: ''
};

export const EMPTY_STARTUP_STATE: StartupState = {
  recoveryMode: false,
  reason: null,
  missingPath: null
};
