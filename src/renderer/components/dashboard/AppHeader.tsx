import { Plus, Proportions, RefreshCw, Settings2, X } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { useI18n } from '@renderer/i18n';
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
	onToggleMaximize,
}: AppHeaderProps) {
	const { t } = useI18n();

	return (
		<header
			className='app-drag sticky top-0 z-30 border-b bg-background/95 backdrop-blur'
			onDoubleClick={onToggleMaximize}
		>
			<div className='mx-auto flex w-full items-center justify-between gap-4 px-4 py-3'>
				<div className='app-no-drag flex items-center gap-2'>
					{!isRecoveryMode && (
						<Button variant='outline' size='sm' onClick={onAddGame}>
							<Plus />
							{t('common_add_game')}
						</Button>
					)}
					{layoutMode === 'normal' && (
						<Button variant='ghost' size='sm' onClick={onOpenSettings}>
							<Settings2 />
							{t('header_settings')}
						</Button>
					)}
				</div>

				<div className='app-no-drag flex items-center gap-1'>
					<span
						className='px-1 text-xs text-muted-foreground'
						aria-label={t('header_app_version', { version: __APP_VERSION__ })}
					>
						v{__APP_VERSION__}
					</span>
					<Button
						variant='ghost'
						size='icon'
						disabled={isScanningBackups}
						onClick={onScanBackups}
						aria-label={t('header_scan_backups')}
						title={t('header_scan_backups')}
					>
						<RefreshCw className={isScanningBackups ? 'animate-spin' : ''} />
					</Button>
					{!isRecoveryMode && (
						<Button
							variant='ghost'
							size='icon'
							aria-label={t('header_widget_mode')}
							title={t('header_widget_mode')}
							onClick={onToggleLayoutMode}
						>
							<Proportions />
						</Button>
					)}
					<Button
						variant='ghost'
						size='icon'
						aria-label={t('header_hide_to_tray')}
						title={t('header_hide_to_tray')}
						onClick={onCloseToTray}
					>
						<X />
					</Button>
				</div>
			</div>
		</header>
	);
}
