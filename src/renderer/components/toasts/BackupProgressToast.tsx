import type { BackupProgressPayload } from '@shared/types';
import { formatBytes } from '@renderer/lib/format';
import { ProgressBar } from '@renderer/components/ui/progress-bar';

export function BackupProgressToast({ payload }: { payload: BackupProgressPayload }) {
	const progressBits = [`${payload.completedFiles}/${payload.totalFiles} files`, `${payload.percent}%`];
	if (payload.totalBytes > 0) {
		progressBits.splice(1, 0, `${formatBytes(payload.copiedBytes)} / ${formatBytes(payload.totalBytes)}`);
	}

	return (
		<div className='w-65 space-y-2'>
			<p className='text-xs text-muted-foreground'>{progressBits.join(' · ')}</p>
			<ProgressBar value={payload.percent} />
		</div>
	);
}
