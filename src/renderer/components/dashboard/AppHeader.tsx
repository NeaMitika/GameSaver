import { Plus, Proportions, RefreshCw, Settings2, X } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import type { LayoutMode } from '@renderer/types/app';

type AppHeaderProps = {
  isRecoveryMode: boolean;
  layoutMode: LayoutMode;
  isScanningBackups: boolean;
  onAddGame: () => void;
  onOpenSettings: () => void;
  onScanBackups: () => void;
  onToggleLayoutMode: () => void;
  onCloseToTray: () => void;
  onToggleMaximize: () => void;
};

export default function AppHeader({
  isRecoveryMode,
  layoutMode,
  isScanningBackups,
  onAddGame,
  onOpenSettings,
  onScanBackups,
  onToggleLayoutMode,
  onCloseToTray,
  onToggleMaximize
}: AppHeaderProps) {
  return (
    <header className="app-drag sticky top-0 z-30 border-b bg-background/95 backdrop-blur" onDoubleClick={onToggleMaximize}>
      <div className="mx-auto flex w-full items-center justify-between gap-4 px-4 py-3">
        <div className="app-no-drag flex items-center gap-2">
          {!isRecoveryMode && (
            <Button variant="outline" size="sm" onClick={onAddGame}>
              <Plus />
              Add Game
            </Button>
          )}
          {layoutMode === 'normal' && (
            <Button variant="ghost" size="sm" onClick={onOpenSettings}>
              <Settings2 />
              Settings
            </Button>
          )}
        </div>

        <div className="app-no-drag flex items-center gap-1">
          <Button variant="ghost" size="icon" disabled={isScanningBackups} onClick={onScanBackups}>
            <RefreshCw className={isScanningBackups ? 'animate-spin' : ''} />
          </Button>
          {!isRecoveryMode && (
            <Button variant="ghost" size="icon" aria-label="Widget mode" onClick={onToggleLayoutMode}>
              <Proportions />
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label="Hide to tray" onClick={onCloseToTray}>
            <X />
          </Button>
        </div>
      </div>
    </header>
  );
}
