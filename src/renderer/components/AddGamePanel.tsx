import type { Game } from '@shared/types';
import { useAddGamePanel } from '@renderer/hooks/useAddGamePanel';
import { useI18n } from '@renderer/i18n';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

type AddGamePanelProps = {
  onCancel: () => void;
  onCreated: (game: Game) => void;
  onError: (message: string) => void;
};

export default function AddGamePanel({ onCancel, onCreated, onError }: AddGamePanelProps) {
  const { t } = useI18n();
  const { name, setName, exePath, setExePath, installPath, setInstallPath, busy, canSubmit, pickExe, pickInstall, handleSubmit } =
    useAddGamePanel({ onCreated, onError });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{t('add_title')}</CardTitle>
          <CardDescription>{t('add_description')}</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t('common_close')}
        </Button>
      </CardHeader>

      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="game-name">{t('add_game_name')}</Label>
            <Input
              id="game-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('add_game_name_placeholder')}
              autoComplete="off"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="exe-path">{t('add_exe_optional')}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="exe-path"
                className="sm:flex-1"
                value={exePath}
                onChange={(event) => setExePath(event.target.value)}
                placeholder={t('add_exe_placeholder')}
                autoComplete="off"
              />
              <Button type="button" variant="outline" onClick={pickExe}>
                {t('common_browse')}
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="install-path">{t('add_install_optional')}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="install-path"
                className="sm:flex-1"
                value={installPath}
                onChange={(event) => setInstallPath(event.target.value)}
                placeholder={t('add_install_placeholder')}
                autoComplete="off"
              />
              <Button type="button" variant="outline" onClick={pickInstall}>
                {t('common_browse')}
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={!canSubmit || busy}>
              {busy ? t('add_adding') : t('add_submit')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
