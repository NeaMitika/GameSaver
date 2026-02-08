import { useCallback } from 'react';
import { toast } from '@renderer/components/ui/sonner';
import { getErrorMessage } from '@renderer/lib/error';
import type { NoticeTone } from '@renderer/types/app';

export type UseToastNotificationsResult = {
  showNotice: (tone: NoticeTone, message: string, durationMs?: number) => void;
  showError: (error: unknown, fallback: string) => void;
};

export function useToastNotifications(): UseToastNotificationsResult {
  const showNotice = useCallback((tone: NoticeTone, message: string, durationMs = 3000) => {
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
  }, []);

  const showError = useCallback(
    (error: unknown, fallback: string) => {
      showNotice('error', getErrorMessage(error, fallback), 5000);
    },
    [showNotice]
  );

  return {
    showNotice,
    showError
  };
}
