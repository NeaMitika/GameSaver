import { useCallback, useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { Settings } from '@shared/types';
import { getErrorMessage } from '@renderer/lib/error';

type UseSettingsPanelParams = {
  settings: Settings;
  onError: (message: string) => void;
  onSaved: (settings: Settings) => void;
};

type UseSettingsPanelResult = {
  backupFrequencyMinutes: number;
  setBackupFrequencyMinutes: Dispatch<SetStateAction<number>>;
  retentionCount: number;
  setRetentionCount: Dispatch<SetStateAction<number>>;
  storageRoot: string;
  setStorageRoot: Dispatch<SetStateAction<string>>;
  dataRoot: string;
  setDataRoot: Dispatch<SetStateAction<string>>;
  busy: boolean;
  pickStorageRoot: () => Promise<void>;
  pickDataRoot: () => Promise<void>;
  handleSubmit: (event: FormEvent) => Promise<void>;
};

export function useSettingsPanel({ settings, onError, onSaved }: UseSettingsPanelParams): UseSettingsPanelResult {
  const [backupFrequencyMinutes, setBackupFrequencyMinutes] = useState(settings.backupFrequencyMinutes);
  const [retentionCount, setRetentionCount] = useState(settings.retentionCount);
  const [storageRoot, setStorageRoot] = useState(settings.storageRoot);
  const [dataRoot, setDataRoot] = useState(settings.dataRoot);
  const [busy, setBusy] = useState(false);

  const pickStorageRoot = useCallback(async () => {
    const result = await window.gamesaver.pickFolder();
    if (result) {
      setStorageRoot(result);
    }
  }, []);

  const pickDataRoot = useCallback(async () => {
    const result = await window.gamesaver.pickFolder();
    if (result) {
      setDataRoot(result);
      setStorageRoot(`${result}\\Backups`);
    }
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setBusy(true);
      try {
        const next = await window.gamesaver.updateSettings({
          backupFrequencyMinutes: Number(backupFrequencyMinutes),
          retentionCount: Number(retentionCount),
          storageRoot,
          dataRoot
        });
        onSaved(next);
      } catch (error) {
        onError(getErrorMessage(error, 'Failed to save settings.'));
      } finally {
        setBusy(false);
      }
    },
    [backupFrequencyMinutes, dataRoot, onError, onSaved, retentionCount, storageRoot]
  );

  return {
    backupFrequencyMinutes,
    setBackupFrequencyMinutes,
    retentionCount,
    setRetentionCount,
    storageRoot,
    setStorageRoot,
    dataRoot,
    setDataRoot,
    busy,
    pickStorageRoot,
    pickDataRoot,
    handleSubmit
  };
}
