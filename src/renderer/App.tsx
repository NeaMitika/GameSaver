import React, { useEffect, useMemo, useState } from 'react';
import { Maximize2, Minimize2, Plus, Proportions, RefreshCw, Settings2, Square, X } from 'lucide-react';
import { BackupScanResult, Game, GameDetail, GameSummary, Settings, StartupState } from '@shared/types';
import AddGamePanel from './components/AddGamePanel';
import SettingsPanel from './components/SettingsPanel';
import GameDetailPanel from './components/GameDetailPanel';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { toast } from './components/ui/sonner';

const emptySettings: Settings = {
	backupFrequencyMinutes: 5,
	retentionCount: 10,
	storageRoot: '',
	compressionEnabled: false,
	dataRoot: '',
};

const emptyStartupState: StartupState = {
	recoveryMode: false,
	reason: null,
	missingPath: null,
};

type Screen = 'dashboard' | 'add' | 'detail' | 'settings';
type NoticeTone = 'info' | 'success' | 'error';
type LayoutMode = 'normal' | 'widget';

interface GameOverview {
	total: number;
	protectedCount: number;
	warningCount: number;
	errorCount: number;
	runningCount: number;
	issueTotal: number;
	latestBackupAt: string | null;
}

export default function App() {
	const [screen, setScreen] = useState<Screen>('dashboard');
	const [games, setGames] = useState<GameSummary[]>([]);
	const [selectedDetail, setSelectedDetail] = useState<GameDetail | null>(null);
	const [settings, setSettings] = useState<Settings>(emptySettings);
	const [isMaximized, setIsMaximized] = useState(false);
	const [restartRequired, setRestartRequired] = useState(false);
	const [layoutMode, setLayoutMode] = useState<LayoutMode>('normal');
	const [showStartupScanPrompt, setShowStartupScanPrompt] = useState(true);
	const [isScanningBackups, setIsScanningBackups] = useState(false);
	const [startupState, setStartupState] = useState<StartupState>(emptyStartupState);
	const isRecoveryMode = startupState.recoveryMode;

	const showNotice = (tone: NoticeTone, message: string, durationMs = 3000) => {
		const options = durationMs > 0 ? { duration: durationMs } : { duration: Infinity };
		if (tone === 'error') {
			toast.error(message, options);
			return;
		}
		if (tone === 'success') {
			toast.success(message, options);
			return;
		}
		toast(message, options);
	};

	const showError = (error: unknown, fallback: string) => {
		showNotice('error', getErrorMessage(error, fallback), 5000);
	};

	useEffect(() => {
		let disposed = false;
		const initialize = async () => {
			let startup = emptyStartupState;
			try {
				startup = await window.gamesaver.getStartupState();
			} catch {
				// Ignore startup-state read errors and continue as normal mode.
			}
			if (disposed) return;
			setStartupState(startup);
			window.gamesaver
				.getSettings()
				.then((nextSettings) => {
					if (!disposed) {
						setSettings(nextSettings);
					}
				})
				.catch(() => undefined);

			if (startup.recoveryMode) {
				setScreen('settings');
				setShowStartupScanPrompt(false);
				return;
			}

			await refreshGames();
		};
		void initialize();

		const unsubscribe = window.gamesaver.onGameStatus((payload) => {
			setGames((prev) =>
				prev.map((game) => (game.id === payload.gameId ? { ...game, is_running: payload.isRunning } : game)),
			);
		});

		window.gamesaver.windowControls
			.isMaximized()
			.then(setIsMaximized)
			.catch(() => undefined);
		window.gamesaver.windowControls
			.getLayoutMode()
			.then(setLayoutMode)
			.catch(() => undefined);
		const unsubscribeWindow = window.gamesaver.windowControls.onWindowState((payload) => {
			setIsMaximized(payload.isMaximized);
		});

		const unsubscribeRestart = window.gamesaver.onRestartRequired(() => {
			setRestartRequired(true);
		});

		return () => {
			disposed = true;
			unsubscribe();
			unsubscribeWindow();
			unsubscribeRestart();
		};
	}, []);

	const runningMap = useMemo(() => {
		const map = new Map<string, boolean>();
		games.forEach((game) => map.set(game.id, game.is_running));
		return map;
	}, [games]);

	const overview = useMemo<GameOverview>(() => {
		let protectedCount = 0;
		let warningCount = 0;
		let errorCount = 0;
		let runningCount = 0;
		let issueTotal = 0;
		let latestBackupAt: string | null = null;
		let latestBackupAtMs = -1;

		games.forEach((game) => {
			if (game.status === 'protected') protectedCount += 1;
			if (game.status === 'warning') warningCount += 1;
			if (game.status === 'error') errorCount += 1;
			if (game.is_running) runningCount += 1;
			issueTotal += game.issue_count;

			if (game.last_backup_at) {
				const backupTimeMs = Date.parse(game.last_backup_at);
				if (!Number.isNaN(backupTimeMs) && backupTimeMs > latestBackupAtMs) {
					latestBackupAtMs = backupTimeMs;
					latestBackupAt = game.last_backup_at;
				}
			}
		});

		return {
			total: games.length,
			protectedCount,
			warningCount,
			errorCount,
			runningCount,
			issueTotal,
			latestBackupAt,
		};
	}, [games]);

	const refreshGames = async () => {
		if (isRecoveryMode) {
			setGames([]);
			return;
		}
		try {
			const list = await window.gamesaver.listGames();
			setGames(list);
		} catch (error) {
			showError(error, 'Failed to load games.');
		}
	};

	const openDetail = async (gameId: string) => {
		try {
			const detail = await window.gamesaver.getGame(gameId);
			setSelectedDetail(detail);
			setScreen('detail');
		} catch (error) {
			showError(error, 'Failed to open game details.');
		}
	};

	const refreshDetail = async () => {
		if (!selectedDetail) return;
		try {
			const detail = await window.gamesaver.getGame(selectedDetail.game.id);
			setSelectedDetail(detail);
			await refreshGames();
		} catch (error) {
			showError(error, 'Failed to refresh game details.');
		}
	};

	const handleCreated = (game: Game) => {
		void refreshGames();
		void openDetail(game.id);
	};

	const handleRemove = () => {
		setSelectedDetail(null);
		setScreen('dashboard');
		void refreshGames();
	};

	const handleBackupNow = async (gameId: string) => {
		const loadingToastId = toast.loading('Backup in progress...');
		try {
			await window.gamesaver.backupNow(gameId);
			await refreshGames();
			if (selectedDetail) {
				await refreshDetail();
			}
			toast.success('Backup request completed.', { id: loadingToastId });
		} catch (error) {
			toast.error(getErrorMessage(error, 'Backup failed.'), { id: loadingToastId, duration: 5000 });
		}
	};

	const handleScanBackups = async () => {
		if (isScanningBackups) return;
		setIsScanningBackups(true);
		const loadingToastId = toast.loading('Scanning backups...');
		try {
			const result = await window.gamesaver.scanBackups();
			await refreshGames();
			if (selectedDetail) {
				try {
					const detail = await window.gamesaver.getGame(selectedDetail.game.id);
					setSelectedDetail(detail);
				} catch (error) {
					showError(error, 'Scan finished, but game details failed to refresh.');
				}
			}
			toast.success(formatScanResultMessage(result), { id: loadingToastId, duration: 5000 });
			setShowStartupScanPrompt(false);
		} catch (error) {
			toast.error(getErrorMessage(error, 'Failed to scan existing backups.'), { id: loadingToastId, duration: 5000 });
		} finally {
			setIsScanningBackups(false);
		}
	};

	const toggleLayoutMode = async () => {
		const nextMode: LayoutMode = layoutMode === 'widget' ? 'normal' : 'widget';
		try {
			const appliedMode = await window.gamesaver.windowControls.setLayoutMode(nextMode);
			setLayoutMode(appliedMode);
			if (appliedMode === 'widget') {
				setScreen('dashboard');
				setSelectedDetail(null);
			}
		} catch (error) {
			showError(error, 'Failed to switch view mode.');
		}
	};

	return (
		<div className='min-h-full bg-background text-foreground'>
			<header
				className='app-drag sticky top-0 z-30 border-b bg-background/95 backdrop-blur'
				onDoubleClick={() => void window.gamesaver.windowControls.toggleMaximize()}
			>
				<div className='mx-auto flex w-full items-center justify-between gap-4 px-4 py-3'>
					<div className='app-no-drag items-center flex gap-2'>
						{!isRecoveryMode && (
							<Button variant='outline' size='sm' onClick={() => setScreen('add')}>
								<Plus />
								Add Game
							</Button>
						)}
						{layoutMode === 'normal' && (
							<Button variant='ghost' size='sm' onClick={() => setScreen('settings')}>
								<Settings2 />
								Settings
							</Button>
						)}
					</div>

					<div className='app-no-drag flex items-center gap-1'>
						{!isRecoveryMode && (
							<Button variant='ghost' size='icon' aria-label='Widget mode' onClick={() => void toggleLayoutMode()}>
								<Proportions />
							</Button>
						)}
						<Button
							variant='ghost'
							size='icon'
							aria-label='Hide to tray'
							onClick={() => window.gamesaver.windowControls.close()}
						>
							<X />
						</Button>
					</div>
				</div>
			</header>

			<main className='mx-auto flex w-full flex-col gap-4 p-4'>
				{isRecoveryMode && (
					<div className='flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm'>
						<span>
							Recovery mode: {startupState.missingPath ? `Could not access ${startupState.missingPath}.` : 'Saved data path is unavailable.'}
						</span>
						<Button variant='outline' size='sm' onClick={() => setScreen('settings')}>
							Open Settings
						</Button>
					</div>
				)}

				{restartRequired && (
					<div className='flex flex-wrap items-center justify-between gap-3 rounded-md border bg-secondary px-3 py-2 text-sm text-secondary-foreground'>
						<span>Data folder updated. Restart required to fully switch app data.</span>
						<Button variant='outline' size='sm' onClick={() => window.gamesaver.relaunchApp()}>
							Restart Now
						</Button>
					</div>
				)}

				{showStartupScanPrompt && !isRecoveryMode && (
					<div className='flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm'>
						<span>Check GameSaverData backups and sync the database?</span>
						<div className='flex items-center gap-2'>
							<Button
								variant='outline'
								size='sm'
								disabled={isScanningBackups}
								onClick={() => void handleScanBackups()}
							>
								<RefreshCw className={isScanningBackups ? 'animate-spin' : ''} />
								Scan Backups
							</Button>
							<Button
								variant='ghost'
								size='sm'
								disabled={isScanningBackups}
								onClick={() => setShowStartupScanPrompt(false)}
							>
								Later
							</Button>
						</div>
					</div>
				)}

				{screen === 'dashboard' && (
					<>
						{isRecoveryMode ? (
							<div className='rounded-lg border border-dashed bg-card/50 px-4 py-8 text-center'>
								<p className='text-base font-semibold'>Recovery mode enabled</p>
								<p className='mt-1 text-sm text-muted-foreground'>
									Set a valid Data Folder in Settings to restore your games and backups.
								</p>
								<div className='mt-4'>
									<Button variant='outline' onClick={() => setScreen('settings')}>
										<Settings2 />
										Open Settings
									</Button>
								</div>
							</div>
						) : layoutMode === 'widget' ? (
							<WidgetOverview overview={overview} onAddGame={() => setScreen('add')} />
						) : games.length > 0 ? (
							<div className='flex flex-col gap-2'>
								{games.map((game) => (
									<div
										key={game.id}
										role='button'
										tabIndex={0}
										aria-label={`Open details for ${game.name}`}
										onClick={() => {
											void openDetail(game.id);
										}}
										onKeyDown={(event) => {
											if (event.key === 'Enter' || event.key === ' ') {
												event.preventDefault();
												void openDetail(game.id);
											}
										}}
										className='cursor-pointer rounded-xl border bg-card px-3 py-2.5 shadow-sm transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
									>
										<div className='flex flex-wrap items-center gap-3 lg:flex-nowrap'>
											<div className='flex min-w-0 flex-1 items-center gap-3'>
												<GameExeIcon icon={game.exe_icon ?? null} name={game.name} />
												<div className='flex min-w-0 flex-col justify-start items-start gap-2'>
													<div className='flex items-center '>
														<p className='max-w-56 truncate text-sm font-semibold tracking-tight'>{game.name}</p>
														<div className='shrink-0'>
															<Badge variant={getGameStatusVariant(game.status)}>{game.status.toUpperCase()}</Badge>
														</div>
													</div>
													<p className='min-w-0 flex-1 truncate text-xs text-muted-foreground'>{game.install_path}</p>
												</div>
											</div>

											<div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm lg:flex-nowrap'>
												<div className='inline-flex items-center gap-1.5 whitespace-nowrap'>
													<span className='text-muted-foreground'>Backup</span>
													<span className='font-medium'>
														{game.last_backup_at ? formatDate(game.last_backup_at) : 'Never'}
													</span>
												</div>

												<div className='inline-flex items-center gap-1.5 whitespace-nowrap'>
													<span className='text-muted-foreground'>Issues</span>
													<span className='font-medium'>{game.issue_count}</span>
												</div>
											</div>

											<div className='flex items-center gap-2 lg:ml-auto'>
												<Button
													variant='outline'
													size='sm'
													onClick={(event) => {
														event.stopPropagation();
														void handleBackupNow(game.id);
													}}
												>
													Backup Now
												</Button>
											</div>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className='rounded-lg border border-dashed bg-card/50 px-4 py-8 text-center'>
								<p className='text-base font-semibold'>No games yet</p>
								<p className='mt-1 text-sm text-muted-foreground'>
									Add your first standalone game to start protecting saves.
								</p>
								<div className='mt-4'>
									<Button onClick={() => setScreen('add')}>
										<Plus />
										Add Game
									</Button>
								</div>
							</div>
						)}
					</>
				)}

				{screen === 'add' && (
					<AddGamePanel
						onCancel={() => setScreen('dashboard')}
						onCreated={handleCreated}
						onError={(message) => showNotice('error', message, 5000)}
					/>
				)}

				{screen === 'settings' && (
					<SettingsPanel
						settings={settings}
						onCancel={() => setScreen('dashboard')}
						onError={(message) => showNotice('error', message, 5000)}
						onSaved={async (next) => {
							setSettings(next);
							const nextStartupState = await window.gamesaver.getStartupState().catch(() => emptyStartupState);
							setStartupState(nextStartupState);
							if (!nextStartupState.recoveryMode) {
								await refreshGames();
								setShowStartupScanPrompt(true);
								showNotice('success', 'Settings saved.');
							} else {
								showNotice('error', 'Recovery mode is still active. Choose a reachable data folder.', 5000);
							}
							setScreen('dashboard');
						}}
					/>
				)}

				{screen === 'detail' && selectedDetail && (
					<GameDetailPanel
						detail={selectedDetail}
						isRunning={runningMap.get(selectedDetail.game.id) ?? false}
						onBack={() => {
							setScreen('dashboard');
							setSelectedDetail(null);
						}}
						onRefresh={refreshDetail}
						onRemove={handleRemove}
						onError={(message) => showNotice('error', message, 5000)}
						onSuccess={(message) => showNotice('success', message)}
					/>
				)}
			</main>
		</div>
	);
}

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}
	if (typeof error === 'string' && error.trim().length > 0) {
		return error;
	}
	return fallback;
}

function getGameStatusVariant(status: GameSummary['status']): 'secondary' | 'outline' | 'destructive' {
	if (status === 'protected') return 'secondary';
	if (status === 'error') return 'destructive';
	return 'outline';
}

function formatDate(value: string): string {
	const date = new Date(value);
	return new Intl.DateTimeFormat('en-US', {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(date);
}

function formatScanResultMessage(result: BackupScanResult): string {
	const parts = [`${result.addedSnapshots} imported`, `${result.removedSnapshots} removed`];
	if (result.skippedUnknownGames > 0) {
		parts.push(`${result.skippedUnknownGames} skipped (unknown game)`);
	}
	if (result.skippedInvalidSnapshots > 0) {
		parts.push(`${result.skippedInvalidSnapshots} skipped (invalid snapshot)`);
	}
	return `Scan complete: ${parts.join(', ')}.`;
}

function WidgetOverview({ overview, onAddGame }: { overview: GameOverview; onAddGame: () => void }) {
	if (overview.total === 0) {
		return (
			<div className='rounded-lg border h-full border-dashed bg-card/50 px-4 py-8 text-center'>
				<p className='text-base font-semibold'>No games yet</p>
				<p className='mt-1 text-sm text-muted-foreground'>Add your first standalone game to start protecting saves.</p>
				<div className='mt-4'>
					<Button onClick={onAddGame}>
						<Plus />
						Add Game
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className='rounded-xl border h-full bg-card p-4 shadow-sm'>
			<div className='flex items-center justify-between gap-2'>
				<div>
					<p className='text-base font-semibold'>Games Overview</p>
					<p className='text-xs text-muted-foreground'>Compact widget summary</p>
				</div>
				<Badge variant='outline'>{overview.total} tracked</Badge>
			</div>

			<div className='mt-4 grid grid-cols-2 gap-2 text-sm'>
				<OverviewStat label='Protected' value={overview.protectedCount} />
				<OverviewStat label='Warnings' value={overview.warningCount} />
				<OverviewStat label='Errors' value={overview.errorCount} />
				<OverviewStat label='Running' value={overview.runningCount} />
				<OverviewStat label='Total Issues' value={overview.issueTotal} />
				<OverviewStat
					label='Last Backup'
					value={overview.latestBackupAt ? formatDate(overview.latestBackupAt) : 'Never'}
				/>
			</div>
		</div>
	);
}

function OverviewStat({ label, value }: { label: string; value: string | number }) {
	return (
		<div className='rounded-md border bg-muted/40 px-3 py-2'>
			<p className='text-[11px] uppercase tracking-wide text-muted-foreground'>{label}</p>
			<p className='mt-0.5 font-medium'>{value}</p>
		</div>
	);
}

function GameExeIcon({ icon, name }: { icon: string | null; name: string }) {
	const fallback = name.trim().charAt(0).toUpperCase() || '?';

	return (
		<div className='flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/60 text-[10px] font-semibold text-muted-foreground'>
			{icon ? <img src={icon} alt='' className='size-full object-cover' /> : fallback}
		</div>
	);
}
