import { useEffect, useState } from 'react';
import type { GameDetail } from '@shared/types';
import { useGameDetailActions } from '@renderer/hooks/useGameDetailActions';
import { useI18n } from '@renderer/i18n';
import { getErrorMessage } from '@renderer/lib/error';
import { formatBytes, formatDate } from '@renderer/lib/format';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { cn, middleEllipsis } from '@renderer/lib/utils';
import { ArrowLeftIcon, HardDriveIcon, PlayIcon } from 'lucide-react';

type GameDetailPanelProps = {
	detail: GameDetail;
	isRunning: boolean;
	onBack: () => void;
	onRefresh: () => void | Promise<void>;
	onRemove: () => void;
	onError: (message: string) => void;
	onSuccess: (message: string) => void;
};

export default function GameDetailPanel({
	detail,
	isRunning,
	onBack,
	onRefresh,
	onRemove,
	onError,
	onSuccess,
}: GameDetailPanelProps) {
	const { t, locale } = useI18n();
	const [nameDraft, setNameDraft] = useState(detail.game.name);
	const [editingName, setEditingName] = useState(false);
	const [busyRename, setBusyRename] = useState(false);
	const [exePathDraft, setExePathDraft] = useState(detail.game.exe_path);
	const [editingExePath, setEditingExePath] = useState(false);
	const [busyExePath, setBusyExePath] = useState(false);
	const {
		busySnapshot,
		handleLaunch,
		handleBackup,
		handleAddLocation,
		handleToggle,
		handleRemoveLocation,
		handleRestore,
		handleDeleteSnapshot,
		handleVerify,
		handleRemove,
	} = useGameDetailActions({
		detail,
		onRefresh,
		onRemove,
		onError,
		onSuccess,
	});
	const hasExecutablePath = detail.game.exe_path.trim().length > 0;
	const installPathLabel =
		detail.game.install_path.trim().length > 0
			? middleEllipsis(detail.game.install_path, 30, 30)
			: t('row_no_install_folder');
	const trimmedName = nameDraft.trim();
	const canSaveName = trimmedName.length > 0 && trimmedName !== detail.game.name;
	const trimmedExePath = exePathDraft.trim();
	const inferredInstallPath =
		trimmedExePath.length > 0 ? trimmedExePath.split('\\').slice(0, -1).join('\\') : detail.game.install_path;
	const canSaveExePath = trimmedExePath !== detail.game.exe_path || inferredInstallPath !== detail.game.install_path;

	useEffect(() => {
		setNameDraft(detail.game.name);
		setEditingName(false);
		setBusyRename(false);
		setExePathDraft(detail.game.exe_path);
		setEditingExePath(false);
		setBusyExePath(false);
	}, [detail.game.id, detail.game.name, detail.game.exe_path]);

	const handleRename = async () => {
		if (!canSaveName || busyRename) {
			return;
		}
		setBusyRename(true);
		try {
			await window.gamesaver.renameGame(detail.game.id, trimmedName);
			await onRefresh();
			setEditingName(false);
			onSuccess(t('detail_success_game_name_updated'));
		} catch (error) {
			onError(getErrorMessage(error, t('detail_error_failed_update_name')));
		} finally {
			setBusyRename(false);
		}
	};

	const handlePickExe = async () => {
		try {
			const picked = await window.gamesaver.pickExe();
			if (picked) {
				setExePathDraft(picked);
			}
		} catch (error) {
			onError(getErrorMessage(error, t('detail_error_failed_pick_exe')));
		}
	};

	const handleSaveExePath = async () => {
		if (!canSaveExePath || busyExePath) {
			return;
		}
		setBusyExePath(true);
		try {
			await window.gamesaver.updateGamePaths({
				gameId: detail.game.id,
				exePath: trimmedExePath,
				installPath: inferredInstallPath,
			});
			await onRefresh();
			setEditingExePath(false);
			onSuccess(trimmedExePath ? t('detail_success_exe_and_install_updated') : t('detail_success_exe_cleared'));
		} catch (error) {
			onError(getErrorMessage(error, t('detail_error_failed_update_exe')));
		} finally {
			setBusyExePath(false);
		}
	};

	return (
		<div className='space-y-4'>
			<div className='w-full flex items-center justify-between'>
				<h2 className='text-lg font-bold'>{t('detail_title')}</h2>
				<Button variant='ghost' onClick={onBack}>
					<ArrowLeftIcon className=' h-4 w-4' />
					{t('common_back')}
				</Button>
			</div>
			<Card>
				<CardHeader className='gap-3'>
					<div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
						<div className='space-y-2'>
							{editingName ? (
								<div className='flex flex-col gap-2 sm:flex-row'>
									<Input
										value={nameDraft}
										onChange={(event) => setNameDraft(event.target.value)}
										autoComplete='off'
										placeholder={t('add_game_name')}
									/>
									<div className='flex gap-2'>
										<Button
											type='button'
											size='sm'
											onClick={() => void handleRename()}
											disabled={!canSaveName || busyRename}
										>
											{busyRename ? t('common_saving') : t('common_save')}
										</Button>
										<Button
											type='button'
											variant='ghost'
											size='sm'
											disabled={busyRename}
											onClick={() => {
												setNameDraft(detail.game.name);
												setEditingName(false);
											}}
										>
											{t('common_cancel')}
										</Button>
									</div>
								</div>
							) : (
								<div className='flex items-center gap-2'>
									<CardTitle>{detail.game.name}</CardTitle>
									<Badge variant={isRunning ? 'secondary' : 'outline'}>
										{isRunning ? t('detail_running') : t('detail_idle')}
									</Badge>
									<Button type='button' variant='ghost' size='sm' onClick={() => setEditingName(true)}>
										{t('detail_rename')}
									</Button>
								</div>
							)}

							{/* <CardDescription className='break-all line-clamp-1'>{installPathLabel}</CardDescription> */}
							<div className='space-y-2'>
								{editingExePath ? (
									<div className='space-y-2'>
										<div className='flex flex-col gap-2 sm:flex-row'>
											<Input
												value={exePathDraft}
												onChange={(event) => setExePathDraft(event.target.value)}
												autoComplete='off'
												placeholder={t('add_exe_placeholder')}
											/>
											<Button
												type='button'
												variant='outline'
												size='sm'
												onClick={() => void handlePickExe()}
												disabled={busyExePath}
											>
												{t('common_browse')}
											</Button>
										</div>
										<div className='flex gap-2'>
											<Button
												type='button'
												size='sm'
												onClick={() => void handleSaveExePath()}
												disabled={!canSaveExePath || busyExePath}
											>
												{busyExePath ? t('common_saving') : t('common_save')}
											</Button>
											<Button
												type='button'
												variant='ghost'
												size='sm'
												disabled={busyExePath}
												onClick={() => {
													setExePathDraft(detail.game.exe_path);
													setEditingExePath(false);
												}}
											>
												{t('common_cancel')}
											</Button>
										</div>
									</div>
								) : (
									<div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
										<CardDescription className='break-all'>
											{hasExecutablePath ? detail.game.exe_path : t('detail_no_executable')}
										</CardDescription>
										<Button type='button' variant='ghost' size='sm' onClick={() => setEditingExePath(true)}>
											{hasExecutablePath ? t('detail_change_exe') : t('detail_set_exe')}
										</Button>
									</div>
								)}
							</div>
						</div>
						<div className='flex flex-wrap gap-2'>
							<Button
								variant='outline'
								size='icon'
								onClick={handleLaunch}
								disabled={isRunning || !hasExecutablePath}
								aria-label={t('detail_launch_game')}
								title={t('detail_launch_game')}
							>
								<PlayIcon />
							</Button>
							<Button
								variant='secondary'
								size='icon'
								onClick={handleBackup}
								aria-label={t('detail_backup_now')}
								title={t('detail_backup_now')}
							>
								<HardDriveIcon />
							</Button>
						</div>
					</div>
				</CardHeader>
			</Card>

			<Card>
				<CardHeader className='flex flex-row items-center justify-between gap-4 space-y-0'>
					<div>
						<CardTitle>{t('detail_save_locations_title')}</CardTitle>
						<CardDescription>{t('detail_save_locations_description')}</CardDescription>
					</div>
					<Button variant='outline' size='sm' onClick={handleAddLocation}>
						{t('detail_add_location')}
					</Button>
				</CardHeader>
				<CardContent className='space-y-2'>
					{detail.saveLocations.map((location) => {
						return (
							<div
								key={location.id}
								className={cn(
									'flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between',
									!location.exists && 'border-destructive/40',
								)}
							>
								<div className='space-y-1'>
									<p className='text-sm font-medium break-all'>{location.path}</p>
									<p className='text-xs text-muted-foreground'>
										{`${location.type.toUpperCase()} · ${
											location.auto_detected ? t('detail_auto_detected') : t('detail_manual')
										}`}
									</p>
								</div>
								<div className='flex flex-wrap items-center gap-2'>
									{!location.exists && <Badge variant='destructive'>{t('detail_missing')}</Badge>}
									<Button variant='ghost' size='sm' onClick={() => handleToggle(location)}>
										{location.enabled ? t('detail_disable') : t('detail_enable')}
									</Button>
									<Button variant='ghost' size='sm' onClick={() => handleRemoveLocation(location)}>
										{t('detail_remove')}
									</Button>
								</div>
							</div>
						);
					})}
					{detail.saveLocations.length === 0 && (
						<div className='rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground'>
							{t('detail_no_save_locations')}
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader className='flex flex-row items-center justify-between gap-4 space-y-0'>
					<div>
						<CardTitle>{t('detail_snapshots_title')}</CardTitle>
						<CardDescription>{t('detail_total_count', { count: detail.snapshots.length })}</CardDescription>
					</div>
				</CardHeader>
				<CardContent className='space-y-2'>
					{detail.snapshots.map((snapshot) => (
						<div
							key={snapshot.id}
							className='flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between'
						>
							<div className='space-y-1'>
								<p className='text-sm font-medium'>{formatDate(snapshot.created_at, locale)}</p>
								<p className='text-xs text-muted-foreground'>
									{snapshot.reason.toUpperCase()} · {formatBytes(snapshot.size_bytes)}
								</p>
							</div>
							<div className='flex flex-wrap gap-2'>
								<Button
									variant='ghost'
									size='sm'
									disabled={busySnapshot === snapshot.id}
									onClick={() => handleVerify(snapshot)}
								>
									{t('detail_verify')}
								</Button>
								<Button
									variant='secondary'
									size='sm'
									disabled={busySnapshot === snapshot.id}
									onClick={() => handleRestore(snapshot)}
								>
									{t('detail_restore')}
								</Button>
								<Button
									variant='ghost'
									size='sm'
									disabled={busySnapshot === snapshot.id}
									onClick={() => handleDeleteSnapshot(snapshot)}
								>
									{t('detail_delete')}
								</Button>
							</div>
						</div>
					))}
					{detail.snapshots.length === 0 && (
						<div className='rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground'>
							{t('detail_no_snapshots')}
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t('detail_recent_activity')}</CardTitle>
				</CardHeader>
				<CardContent className='space-y-3'>
					<div className='overflow-hidden rounded-lg border border-slate-800 bg-slate-950 text-slate-100 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)]'>
						<div className='flex items-center justify-between border-b border-slate-800/90 bg-slate-900/80 px-3 py-2 font-mono text-[11px] tracking-wide text-slate-400'>
							<span>{t('detail_activity_log')}</span>
							<span className='text-slate-500'>{t('detail_entries_count', { count: detail.eventLogs.length })}</span>
						</div>
						<div className='max-h-72 space-y-1 overflow-y-auto p-2 font-mono text-[12px] leading-relaxed'>
							{detail.eventLogs.map((log, index) => {
								const style = getEventLogStyle(log.type);
								return (
									<div
										key={log.id}
										className={cn(
											'grid grid-cols-[auto_auto_1fr] items-start gap-2 rounded border px-2 py-1.5',
											style.row,
										)}
									>
										<span className={cn('pt-px text-[11px]', style.symbol)}>{'>'}</span>
										<span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider', style.chip)}>
											{style.label}
										</span>
										<div className='min-w-0'>
											<p className={cn('wrap-break-word text-[12px]', style.message)}>{log.message}</p>
											<p className='mt-0.5 text-[10px] text-slate-500'>
												#{String(detail.eventLogs.length - index).padStart(3, '0')} ·{' '}
												{formatDate(log.created_at, locale)}
											</p>
										</div>
									</div>
								);
							})}
							{detail.eventLogs.length === 0 && (
								<div className='rounded border border-dashed border-slate-800 px-3 py-6 text-center text-[11px] text-slate-500'>
									{t('detail_no_recent_events')}
								</div>
							)}
						</div>
					</div>
				</CardContent>
			</Card>

			<Card className='border-destructive/40'>
				<CardHeader>
					<CardTitle>{t('detail_danger_zone')}</CardTitle>
					<CardDescription>{t('detail_danger_description')}</CardDescription>
				</CardHeader>
				<CardContent>
					<Button variant='destructive' onClick={handleRemove}>
						{t('detail_remove_game')}
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}

type EventLogStyle = {
	label: string;
	row: string;
	chip: string;
	symbol: string;
	message: string;
};

function getEventLogStyle(type: 'backup' | 'restore' | 'error'): EventLogStyle {
	if (type === 'error') {
		return {
			label: 'ERR',
			row: 'border-rose-500/25 bg-rose-500/8',
			chip: 'border border-rose-500/40 bg-rose-500/20 text-rose-200',
			symbol: 'text-rose-400',
			message: 'text-rose-100',
		};
	}
	if (type === 'restore') {
		return {
			label: 'RST',
			row: 'border-cyan-500/25 bg-cyan-500/8',
			chip: 'border border-cyan-500/40 bg-cyan-500/20 text-cyan-200',
			symbol: 'text-cyan-400',
			message: 'text-cyan-100',
		};
	}
	return {
		label: 'BKP',
		row: 'border-emerald-500/25 bg-emerald-500/8',
		chip: 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-200',
		symbol: 'text-emerald-400',
		message: 'text-emerald-100',
	};
}
