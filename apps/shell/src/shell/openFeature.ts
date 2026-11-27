import { router } from 'expo-router';
import type { useShell } from './ShellProvider';

/** Opens an app if it can run now; otherwise shows its details (never a fake screen). */
export function openFeature(shell: ReturnType<typeof useShell>, id: string): void {
  const a = shell.availabilityOf(id);
  if (a.status === 'unavailable') {
    router.push({ pathname: '/service/[id]', params: { id } });
    return;
  }
  shell.setLastApp(id);
  router.push({ pathname: '/app/[id]', params: { id } });
}
