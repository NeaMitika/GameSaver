import { cn } from '@renderer/lib/utils';

type ProgressBarProps = {
  value: number;
  className?: string;
  trackClassName?: string;
  indicatorClassName?: string;
};

function normalizeProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(Math.round(value), 100));
}

export function ProgressBar({ value, className, trackClassName, indicatorClassName }: ProgressBarProps) {
  const normalized = normalizeProgress(value);

  return (
    <div className={cn('h-2 w-full overflow-hidden rounded bg-muted', trackClassName, className)}>
      <div
        className={cn('h-full bg-primary transition-all duration-200', indicatorClassName)}
        style={{ width: `${normalized}%` }}
      />
    </div>
  );
}
