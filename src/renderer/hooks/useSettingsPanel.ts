import { useCallback, useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { AppLanguage, Settings } from '@shared/types';
import { useI18n } from '@renderer/i18n';
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
  language: AppLanguage;
  setLanguage: Dispatch<SetStateAction<AppLanguage>>;
  busy: boolean;
  pickStorageRoot: () => Promise<void>;
  pickDataRoot: () => Promise<void>;
  handleSubmit: (event: FormEvent) => Promise<void>;
};

export function useSettingsPanel({ settings, onError, onSaved }: UseSettingsPanelParams): UseSettingsPanelResult {
  const { t } = useI18n();
  const [backupFrequencyMinutes, setBackupFrequencyMinutes] = useState(settings.backupFrequencyMinutes);
  const [retentionCount, setRetentionCount] = useState(settings.retentionCount);
  const [storageRoot, setStorageRoot] = useState(settings.storageRoot);
  const [dataRoot, setDataRoot] = useState(settings.dataRoot);
  const [language, setLanguage] = useState<AppLanguage>(settings.language);
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
          dataRoot,
          language
        });
        onSaved(next);
      } catch (error) {
        onError(getErrorMessage(error, t('settings_error_failed')));
      } finally {
        setBusy(false);
      }
    },
    [backupFrequencyMinutes, dataRoot, language, onError, onSaved, retentionCount, storageRoot, t]
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
    language,
    setLanguage,
    busy,
    pickStorageRoot,
    pickDataRoot,
    handleSubmit
  };
}
