import path from 'path';
import { execFile } from 'child_process';
import { Settings } from '../../shared/types';
import { backupGame } from './backupService';
import { AppDb } from './db';
import { updateGameLastSeen } from './gameService';

const listeners = new Set<(payload: { gameId: string; isRunning: boolean }) => void>();
const runningMap = new Map<string, boolean>();
const launchedPidMap = new Map<string, number>();
const lastInstallCheckAt = new Map<string, number>();
const lastSeenRunningAt = new Map<string, number>();
let pollingTimer: NodeJS.Timeout | null = null;
let psListModule: ((options?: { all?: boolean }) => Promise<Array<{ name?: string; cmd?: string }>>) | null = null;
let pollInFlight = false;
let monitorRunId = 0;

const POLL_INTERVAL_MS = 5000;
const INSTALL_CHECK_COOLDOWN_MS = 10000;
const RUNNING_GRACE_MS = 5000;

export function startSessionMonitor(db: AppDb, settings: Settings): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
  }
  monitorRunId += 1;
  const runId = monitorRunId;

  pollingTimer = setInterval(() => {
    void runPollCycle(db, settings, runId);
  }, POLL_INTERVAL_MS);

  void runPollCycle(db, settings, runId);
}

export function getRunningMap(): Map<string, boolean> {
  return runningMap;
}

export function onSessionStatus(listener: (payload: { gameId: string; isRunning: boolean }) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function registerLaunchedProcess(gameId: string, pid: number): void {
  if (!pid || Number.isNaN(pid)) return;
  launchedPidMap.set(gameId, pid);
  lastSeenRunningAt.set(gameId, Date.now());
  setRunningState(gameId, true);
}

async function loadPsList() {
  if (!psListModule) {
    const mod = await import('ps-list');
    psListModule = mod.default;
  }
  return psListModule;
}

async function listProcesses(): Promise<Array<{ name?: string; cmd?: string }>> {
  try {
    const psList = await loadPsList();
    return await psList();
  } catch {
    return await listProcessesFromTasklist();
  }
}

function listProcessesFromTasklist(): Promise<Array<{ name?: string; cmd?: string }>> {
  return new Promise((resolve) => {
    execFile('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true }, (error, stdout) => {
      if (error || !stdout) {
        resolve([]);
        return;
      }

      const rows = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const processes = rows.map((line) => {
        const match = line.match(/^"([^"]+)"/);
        return {
          name: match ? match[1] : undefined,
          cmd: undefined
        };
      });
      resolve(processes);
    });
  });
}

async function runPollCycle(db: AppDb, settings: Settings, runId: number): Promise<void> {
  if (pollInFlight) {
    return;
  }
  pollInFlight = true;
  try {
    await pollSessions(db, settings, runId);
  } catch {
    // Ignore monitor errors and continue next cycle.
  } finally {
    pollInFlight = false;
  }
}

async function pollSessions(db: AppDb, settings: Settings, runId: number): Promise<void> {
  if (runId !== monitorRunId) return;

  const games = db.state.games.map((game) => ({
    id: game.id,
    exe_path: game.exe_path,
    install_path: game.install_path
  }));
  const activeGameIds = new Set(games.map((game) => game.id));
  pruneSessionCaches(activeGameIds);
  if (games.length === 0) return;

  const processes = await listProcesses();
  if (runId !== monitorRunId) return;
  const processNames = processes.map((proc) => ({
    name: proc.name?.toLowerCase() ?? '',
    cmd: proc.cmd?.toLowerCase() ?? ''
  }));

  for (const game of games) {
    const stableRunning = await detectStableRunning(game.id, game.exe_path, game.install_path, processNames);
    if (runId !== monitorRunId) return;
    applyTransitionEffects(db, settings, game.id, stableRunning);
  }
}

async function detectStableRunning(
  gameId: string,
  exePathValue: string,
  installPathValue: string,
  processes: Array<{ name: string; cmd: string }>
): Promise<boolean> {
  const now = Date.now();
  const exePath = path.normalize(exePathValue).toLowerCase();
  const exeName = path.basename(exePath);
  const exeStem = path.parse(exeName).name;
  const installPath = path.normalize(installPathValue);

  let isRunning = false;
  const trackedPid = launchedPidMap.get(gameId);
  if (trackedPid) {
    const pidRunning = await isPidRunning(trackedPid);
    if (pidRunning) {
      isRunning = true;
    } else {
      launchedPidMap.delete(gameId);
    }
  }

  if (!isRunning) {
    isRunning = processes.some(
      (proc) => proc.name === exeName || proc.name === exeStem || proc.cmd.includes(exePath)
    );
  }

  if (!isRunning && process.platform === 'win32') {
    isRunning = await isProcessRunningByPath(exeName, exePath);
  }

  if (!isRunning && process.platform === 'win32' && installPath) {
    const lastCheck = lastInstallCheckAt.get(gameId) ?? 0;
    if (now - lastCheck >= INSTALL_CHECK_COOLDOWN_MS) {
      lastInstallCheckAt.set(gameId, now);
      isRunning = await isProcessRunningByInstallPath(installPath);
    }
  }

  if (isRunning) {
    lastSeenRunningAt.set(gameId, now);
  }

  const lastSeen = lastSeenRunningAt.get(gameId);
  return isRunning || (lastSeen ? now - lastSeen < RUNNING_GRACE_MS : false);
}

function applyTransitionEffects(db: AppDb, settings: Settings, gameId: string, nextRunning: boolean): void {
  const prevRunning = runningMap.get(gameId) ?? false;
  if (prevRunning === nextRunning) {
    return;
  }

  setRunningState(gameId, nextRunning);

  if (nextRunning) {
    updateGameLastSeen(db, gameId, new Date().toISOString());
    return;
  }

  backupGame(db, settings, gameId, 'auto').catch(() => undefined);
}

function setRunningState(gameId: string, isRunning: boolean): void {
  const prevRunning = runningMap.get(gameId) ?? false;
  if (prevRunning === isRunning) {
    return;
  }

  runningMap.set(gameId, isRunning);
  notify({ gameId, isRunning });
}

function pruneSessionCaches(activeGameIds: Set<string>): void {
  pruneMapKeys(runningMap, activeGameIds);
  pruneMapKeys(launchedPidMap, activeGameIds);
  pruneMapKeys(lastInstallCheckAt, activeGameIds);
  pruneMapKeys(lastSeenRunningAt, activeGameIds);
}

function pruneMapKeys<T>(target: Map<string, T>, activeGameIds: Set<string>): void {
  for (const gameId of target.keys()) {
    if (!activeGameIds.has(gameId)) {
      target.delete(gameId);
    }
  }
}

function notify(payload: { gameId: string; isRunning: boolean }): void {
  for (const listener of listeners) {
    listener(payload);
  }
}

function isProcessRunningByPath(exeName: string, exePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const safeName = exeName.replace(/'/g, "''");
    const command =
      `Get-CimInstance Win32_Process -Filter "Name='${safeName}'" | ` + 'Select-Object -ExpandProperty ExecutablePath';

    execFile('powershell', ['-NoProfile', '-Command', command], { windowsHide: true }, (error, stdout) => {
      if (error || !stdout) {
        resolve(false);
        return;
      }
      const matches = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => path.normalize(line).toLowerCase());
      resolve(matches.includes(exePath));
    });
  });
}

function isProcessRunningByInstallPath(installPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const normalized = path.normalize(installPath);
    const wildcardPath = normalized.endsWith(path.sep) ? `${normalized}*` : `${normalized}${path.sep}*`;
    const safePath = wildcardPath.replace(/'/g, "''");
    const command =
      `Get-CimInstance Win32_Process | ` +
      `Where-Object { $_.ExecutablePath -like '${safePath}' } | ` +
      'Select-Object -First 1 -ExpandProperty ExecutablePath';

    execFile('powershell', ['-NoProfile', '-Command', command], { windowsHide: true }, (error, stdout) => {
      if (error || !stdout) {
        resolve(false);
        return;
      }
      resolve(stdout.trim().length > 0);
    });
  });
}

function isPidRunning(pid: number): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { windowsHide: true }, (error, stdout) => {
      if (error || !stdout) {
        resolve(false);
        return;
      }
      const rows = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const hasPid = rows.some((line) => {
        const parts = line.split('","').map((part) => part.replace(/^"|"$/g, ''));
        const rowPid = parts[1];
        return rowPid === String(pid);
      });
      resolve(hasPid);
    });
  });
}

export function resetSessionServiceForTests(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  listeners.clear();
  runningMap.clear();
  launchedPidMap.clear();
  lastInstallCheckAt.clear();
  lastSeenRunningAt.clear();
  psListModule = null;
  pollInFlight = false;
  monitorRunId = 0;
}

