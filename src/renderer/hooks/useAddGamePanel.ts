import { useCallback, useMemo, useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { AddGamePayload, Game } from '@shared/types';
import { useI18n } from '@renderer/i18n';
import { getErrorMessage } from '@renderer/lib/error';

type UseAddGamePanelParams = {
  onCreated: (game: Game) => void;
  onError: (message: string) => void;
};

type UseAddGamePanelResult = {
  name: string;
  setName: Dispatch<SetStateAction<string>>;
  exePath: string;
  setExePath: Dispatch<SetStateAction<string>>;
  installPath: string;
  setInstallPath: Dispatch<SetStateAction<string>>;
  busy: boolean;
  canSubmit: boolean;
  pickExe: () => Promise<void>;
  pickInstall: () => Promise<void>;
  handleSubmit: (event: FormEvent) => Promise<void>;
};

export function useAddGamePanel({ onCreated, onError }: UseAddGamePanelParams): UseAddGamePanelResult {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [exePath, setExePath] = useState('');
  const [installPath, setInstallPath] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => name.trim().length > 0, [name]);

  const pickExe = useCallback(async () => {
    const result = await window.gamesaver.pickExe();
    if (result) {
      setExePath(result);
      if (!name) {
        const base = result.split('\\').pop()?.replace(/\.exe$/i, '') ?? '';
        setName(base);
      }
      if (!installPath) {
        const folder = result.split('\\').slice(0, -1).join('\\');
        setInstallPath(folder);
      }
    }
  }, [installPath, name]);

  const pickInstall = useCallback(async () => {
    const result = await window.gamesaver.pickFolder();
    if (result) {
      setInstallPath(result);
    }
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!canSubmit) return;
      setBusy(true);
      try {
        const payload: AddGamePayload = {
          name: name.trim(),
          exePath: exePath.trim(),
          installPath: installPath.trim()
        };
        const game = await window.gamesaver.addGame(payload);
        onCreated(game);
      } catch (error) {
        onError(getErrorMessage(error, t('add_error_failed')));
      } finally {
        setBusy(false);
      }
    },
    [canSubmit, exePath, installPath, name, onCreated, onError, t]
  );

  return {
    name,
    setName,
    exePath,
    setExePath,
    installPath,
    setInstallPath,
    busy,
    canSubmit,
    pickExe,
    pickInstall,
    handleSubmit
  };
}
