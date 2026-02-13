import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryDb } from '../src/main/services/db';
import { Settings } from '../src/shared/types';

vi.mock('../src/main/services/backupService', () => ({
	backupGame: vi.fn(async () => null),
}));

vi.mock('../src/main/services/gameService', () => ({
	updateGameLastSeen: vi.fn(),
}));

vi.mock('ps-list', () => ({
	default: vi.fn(),
}));

vi.mock('child_process', () => ({
	execFile: vi.fn(),
}));

import psList, { type ProcessDescriptor } from 'ps-list';
import { execFile } from 'child_process';
import { backupGame } from '../src/main/services/backupService';
import {
	getRunningMap,
	onSessionStatus,
	registerLaunchedProcess,
	resetSessionServiceForTests,
	startSessionMonitor,
} from '../src/main/services/sessionService';

const settings: Settings = {
	backupFrequencyMinutes: 5,
	retentionCount: 10,
	storageRoot: 'C:\\Storage',
	compressionEnabled: false,
	dataRoot: 'C:\\Data',
	language: 'en',
};

describe('sessionService', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.mocked(psList).mockResolvedValue([]);
		mockExecFileWithEmptyOutput();
	});

	afterEach(() => {
		resetSessionServiceForTests();
		vi.clearAllMocks();
		vi.useRealTimers();
	});

	it('does not overlap poll cycles while a previous cycle is pending', async () => {
		const deferred = createDeferred<ProcessDescriptor[]>();
		vi.mocked(psList).mockImplementation(() => deferred.promise);
		const db = createMockSessionDb();

		startSessionMonitor(db, settings);
		await vi.advanceTimersByTimeAsync(15000);

		expect(vi.mocked(psList)).toHaveBeenCalledTimes(1);

		deferred.resolve([]);
		await vi.advanceTimersByTimeAsync(5000);
		expect(vi.mocked(psList)).toHaveBeenCalledTimes(2);
	});

	it('keeps launched games running until grace expires, then triggers one auto backup', async () => {
		const db = createMockSessionDb();
		const statuses: Array<{ gameId: string; isRunning: boolean }> = [];
		const unsubscribe = onSessionStatus((payload) => statuses.push(payload));

		startSessionMonitor(db, settings);
		await vi.advanceTimersByTimeAsync(4900);

		registerLaunchedProcess('game-1', 1234);
		expect(getRunningMap().get('game-1')).toBe(true);
		expect(statuses).toContainEqual({ gameId: 'game-1', isRunning: true });

		await vi.advanceTimersByTimeAsync(200);
		expect(getRunningMap().get('game-1')).toBe(true);
		expect(vi.mocked(backupGame)).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(5000);
		expect(getRunningMap().get('game-1')).toBe(false);
		expect(vi.mocked(backupGame)).toHaveBeenCalledTimes(1);
		expect(statuses).toContainEqual({ gameId: 'game-1', isRunning: false });

		unsubscribe();
	});

	it('handles games with no executable or install path', async () => {
		const db = createMemoryDb({
			games: [
				{
					id: 'game-1',
					name: 'Name Only Game',
					exe_path: '',
					install_path: '',
					created_at: new Date().toISOString(),
					last_seen_at: null,
					status: 'protected',
					folder_name: 'Name Only Game',
				},
			],
		});

		startSessionMonitor(db, settings);
		await vi.advanceTimersByTimeAsync(6000);

		expect(getRunningMap().get('game-1')).toBeUndefined();
		expect(vi.mocked(backupGame)).not.toHaveBeenCalled();
	});
});

function createMockSessionDb() {
	return createMemoryDb({
		games: [
			{
				id: 'game-1',
				name: 'Game One',
				exe_path: 'C:\\Games\\GameOne\\game1.exe',
				install_path: 'C:\\Games\\GameOne',
				created_at: new Date().toISOString(),
				last_seen_at: null,
				status: 'protected',
				folder_name: 'Game One',
			},
		],
	});
}

function mockExecFileWithEmptyOutput(): void {
	vi.mocked(execFile).mockImplementation(((...args: unknown[]) => {
		const callback = (typeof args[3] === 'function' ? args[3] : args[2]) as
			| ((error: Error | null, stdout: string, stderr: string) => void)
			| undefined;
		callback?.(null, '', '');
		return {} as never;
	}) as never);
}

function createDeferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}
