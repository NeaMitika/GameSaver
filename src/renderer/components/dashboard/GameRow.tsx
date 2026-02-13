import type { GameSummary } from '@shared/types';
import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { useI18n } from '@renderer/i18n';
import { formatDate } from '@renderer/lib/format';
import GameExeIcon from './GameExeIcon';
import { middleEllipsis } from '@renderer/lib/utils';

type GameRowProps = {
	game: GameSummary;
	onOpenDetail: (gameId: string) => void;
	onBackupNow: (gameId: string) => void;
};

export default function GameRow({ game, onOpenDetail, onBackupNow }: GameRowProps) {
	const { t, locale } = useI18n();
	const installPathLabel =
		game.install_path.trim().length > 0 ? middleEllipsis(game.install_path, 20, 20) : t('row_no_install_folder');

	return (
		<div
			role='button'
			tabIndex={0}
			aria-label={t('row_open_details_for', { name: game.name })}
			onClick={() => onOpenDetail(game.id)}
			onKeyDown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					onOpenDetail(game.id);
				}
			}}
			className='cursor-pointer rounded-xl border bg-card px-3 py-2.5 shadow-sm transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
		>
			<div className='flex flex-wrap items-center gap-3 lg:flex-nowrap'>
				<div className='flex min-w-0 flex-1 items-center gap-3'>
					<GameExeIcon icon={game.exe_icon ?? null} name={game.name} />
					<div className='flex min-w-0 flex-col items-start justify-start gap-2'>
						<div className='flex items-center'>
							<p className='max-w-56 truncate text-sm font-semibold tracking-tight'>{game.name}</p>
							<div className='shrink-0'>
								<Badge variant={getGameStatusVariant(game.status)}>
									{game.status === 'protected'
										? t('status_protected')
										: game.status === 'warning'
											? t('status_warning')
											: t('status_error')}
								</Badge>
							</div>
						</div>
						<p className='min-w-0 flex-1 truncate text-xs text-muted-foreground'>
							{installPathLabel}
						</p>
					</div>
				</div>

				<div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm lg:flex-nowrap'>
					<div className='inline-flex items-center gap-1.5 whitespace-nowrap'>
						<span className='text-muted-foreground'>{t('row_backup')}</span>
						<span className='font-medium'>{game.last_backup_at ? formatDate(game.last_backup_at, locale) : t('common_never')}</span>
					</div>
				</div>

				<div className='flex items-center gap-2 lg:ml-auto'>
					<Button
						variant='outline'
						size='sm'
						onClick={(event) => {
							event.stopPropagation();
							onBackupNow(game.id);
						}}
					>
						{t('row_backup_now')}
					</Button>
				</div>
			</div>
		</div>
	);
}

function getGameStatusVariant(status: GameSummary['status']): 'secondary' | 'outline' | 'destructive' {
	if (status === 'protected') return 'secondary';
	if (status === 'error') return 'destructive';
	return 'outline';
}
