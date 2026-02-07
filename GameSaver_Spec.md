# GameSaver App Specification (AI Build Spec)

Version: 1.0  
Date: 2026-02-05  
Status: Draft for implementation

---

## 1. Summary

GameSaver is a desktop app that backs up, versions, and restores save game files for games installed outside of platforms like Steam, Origin, Epic, etc. It supports CD installs, standalone downloads, and portable games. It detects save locations, monitors changes, and creates snapshots automatically. Users can restore progress, compare versions.

Primary goals:

- Prevent lost game progress for non-platform games.
- Provide automatic, versioned backups with minimal user effort.
- Offer reliable restore and rollback features.

Non-goals:

- Game mod management.
- Cheating or save file editing.
- DRM bypass or executable patching.

---

## 2. Target Users

- PC gamers who install games from CDs, DRM-free sites, or legacy installers.
- Users who want reliable save backups without platform support.

---

## 3. Platforms

- Windows 10/11 primary.

Assumption: Many save files live in `%USERPROFILE%\Documents`, `%APPDATA%`, `%LOCALAPPDATA%`, `%PROGRAMDATA%`, or the game install directory.

---

## 4. Core Features

Feature: Game Discovery  
Description: Detect installed games and/or allow manual addition.  
Behavior: Scan common install locations and let users add custom folders.

Feature: Save Location Detection  
Description: Identify save folders via known rules and user-defined paths.  
Behavior: Use heuristics, templates, and manual overrides.

Feature: Auto Backup  
Description: Watch save file changes and create snapshots.  
Behavior: File watcher plus periodic scan for reliability.

Feature: Versioned Snapshots  
Description: Store timestamped copies with optional compression and dedup.  
Behavior: Keep configurable history and allow cleanup rules.

Feature: Restore and Rollback  
Description: Restore any previous snapshot.  
Behavior: One-click restore, with safety backup before overwrite.

Feature: Game Session Awareness  
Description: Detect when a game starts/stops to trigger backups.  
Behavior: Process detection by executable path or window title.

Feature: Health and Integrity  
Description: Verify backup integrity with checksums.  
Behavior: Auto-verify after backup and before restore.

---

## 5. User Experience

### 5.1 Main Screens

Screen: Dashboard  
Contents:

- List of games with status: protected, last backup, issues.
- Quick actions: backup now, restore, open folder.

Screen: Game Detail  
Contents:

- Save locations list with status.
- Snapshot history timeline.
- Restore button for each snapshot.
- Settings per game.

Screen: Add Game  
Contents:

- Search detected executables.
- Manual add path for game folder.
- Define save locations with templates or pickers.

Screen: Settings  
Contents:

- Global backup frequency.
- Retention policy.
- Storage location.

### 5.2 User Flows

Flow: Add a game

1. User clicks Add Game.
2. App proposes game executable or folder.
3. App suggests save locations using heuristics.
4. User confirms or edits locations.
5. App starts protection and initial backup.

Flow: Auto backup on game close

1. Game process stops.
2. App scans save locations.
3. App creates snapshot if changes detected.
4. App updates dashboard status.

Flow: Restore progress

1. User selects snapshot.
2. App warns about overwrite.
3. App creates safety backup of current files.
4. App restores snapshot and verifies integrity.

---

## 6. Functional Requirements

FR-1: The app must allow adding games by selecting a game executable or folder.  
FR-2: The app must support multiple save locations per game.  
FR-3: The app must detect changes via file watchers and scheduled scans.  
FR-4: The app must create timestamped snapshots of save files.  
FR-5: The app must allow restore of any snapshot.  
FR-6: The app must verify snapshot integrity using checksums.  
FR-7: The app must allow configurable retention policies.  
FR-8: The app must support a local storage root and per-game subfolders.  
FR-9: The app must keep logs of backup and restore operations.  
FR-10: The app must continue working if a game is running, but avoid partial backups by retrying locked files.

---

## 7. Non-Functional Requirements

NFR-1: Must run on Windows 10/11.  
NFR-2: Must use minimal CPU and disk I/O when idle.  
NFR-3: Must handle large save files up to 1 GB.  
NFR-4: Must be robust against abrupt shutdowns.  
NFR-5: Must store backups in a deterministic folder structure.  
NFR-6: Must not require admin privileges for normal operation.

---

## 8. Game Save Detection

### 8.1 Heuristic Paths

Templates to suggest save locations:

- `%USERPROFILE%\Documents\My Games\{GameName}`
- `%APPDATA%\{GameName}`
- `%LOCALAPPDATA%\{GameName}`
- `%PROGRAMDATA%\{GameName}`
- `{GameInstallDir}\Save`
- `{GameInstallDir}\Saves`
- `{GameInstallDir}\Profiles`

### 8.2 Rule Engine

Rules can include:

- Environment variables.
- Globs like `**\Save*` and `**\Profile*`.
- Registry hints if known.
- Executable-name matching.

---

## 9. Data Model

Entity: Game  
Fields:

- `id` (uuid)
- `name` (string)
- `install_path` (string)
- `exe_path` (string)
- `created_at` (datetime)
- `last_seen_at` (datetime)
- `status` (enum: protected, warning, error)

Entity: SaveLocation  
Fields:

- `id` (uuid)
- `game_id` (uuid)
- `path` (string)
- `type` (enum: folder, file)
- `auto_detected` (bool)
- `enabled` (bool)

Entity: Snapshot  
Fields:

- `id` (uuid)
- `game_id` (uuid)
- `created_at` (datetime)
- `size_bytes` (int)
- `checksum` (string)
- `storage_path` (string)
- `reason` (enum: auto, manual, pre-restore)

Entity: SnapshotFile  
Fields:

- `id` (uuid)
- `snapshot_id` (uuid)
- `relative_path` (string)
- `size_bytes` (int)
- `checksum` (string)

Entity: EventLog  
Fields:

- `id` (uuid)
- `game_id` (uuid)
- `type` (enum: backup, restore, error)
- `message` (string)
- `created_at` (datetime)

---

## 10. Storage Layout

Storage root: `%LOCALAPPDATA%\GameSaver\Backups`

Folder structure:

- `Backups\{GameId}\Snapshots\{SnapshotId}\...files`
- `Backups\{GameId}\metadata.json`
- `Backups\index.db`

---

## 11. Snapshot Strategy

- Default: full copy of save locations.
- Optional future: delta-based snapshots.
- Compression: ZIP by default, optional off.
- Checksum: SHA-256 per file and per snapshot.

---

## 12. Retention Policy

- Default keep: last 10 snapshots per game.
- Optional: keep last N days.
- Always keep the newest snapshot.

---

## 13. Process Detection

Game running detection methods:

- Match process executable path to `exe_path`.
- Window title match to `name` as fallback.
- Optional manual “Start game” button to mark session.

---

## 14. Security and Privacy

- Save files stay local.
- No telemetry.

---

## 15. Error Handling

- If files are locked, retry up to N times with backoff.
- If backup fails, log event and show warning.
- If restore fails, revert to safety backup.

---

## 16. API and Internal Interfaces

Module: BackupService  
Methods:

- `backupGame(gameId, reason)`
- `restoreSnapshot(snapshotId)`
- `verifySnapshot(snapshotId)`

Module: SaveLocationService  
Methods:

- `detectLocations(gameId)`
- `addLocation(gameId, path)`

Module: GameService  
Methods:

- `addGame(name, exePath, installPath)`
- `removeGame(gameId)`
- `listGames()`

Module: SettingsService  
Methods:

- `getSettings()`
- `updateSettings(payload)`

---

## 17. UI Requirements

- Must show backup status and last backup time.
- Must support manual backup and restore.
- Must show warning when save location is invalid.

---

## 18. Recommended Implementation

Recommended stack for Windows MVP:

- UI: React (TypeScript) running in the Electron renderer.
- Backend: Node.js in the Electron main process.
- Storage: SQLite for metadata.
- File ops: Node.js `fs` + `chokidar` for file watching.
- Packaging: `electron-builder` with NSIS installer.

---

## 19. Testing Plan

Test type: Unit  
Coverage:

- Path resolution and templating.
- Snapshot creation and restore.
- Retention policy logic.

Test type: Integration  
Coverage:

- File watcher events.
- Locked file retries.
- SQLite persistence.

Test type: End-to-end  
Coverage:

- Add game -> auto backup -> restore flow.

---

## 20. Acceptance Criteria

AC-1: A user can add a game and see it listed with “protected” status.  
AC-2: When a save file changes, a new snapshot is created within 5 minutes.  
AC-3: A user can restore a snapshot and game files reflect the restored state.  
AC-4: Retention policy deletes older snapshots correctly.  
AC-5: A restore creates a safety backup of current files.

---

## 21. Implementation Milestones

Milestone 1: Core models and storage  
Milestone 2: Game add + save detection  
Milestone 3: Backup and restore engine  
Milestone 4: UI dashboard and game detail  
Milestone 5: Retention and verification
