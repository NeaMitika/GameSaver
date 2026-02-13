import type { BackupScanResult } from '@shared/types';

export function formatDate(value: string, locale = 'en-US'): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function formatBytes(value: number): string {
  if (value === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(value) / Math.log(k));
  return `${(value / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatScanResultMessage(result: BackupScanResult): string {
  const parts = [`${result.addedSnapshots} imported`, `${result.removedSnapshots} removed`];
  if (result.skippedUnknownGames > 0) {
    parts.push(`${result.skippedUnknownGames} skipped (unknown game)`);
  }
  if (result.skippedInvalidSnapshots > 0) {
    parts.push(`${result.skippedInvalidSnapshots} skipped (invalid snapshot)`);
  }
  return `Scan complete: ${parts.join(', ')}.`;
}
