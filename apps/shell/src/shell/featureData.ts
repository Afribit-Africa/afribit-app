import { featureDataDir } from '@afribit/kernel';
import { deleteAsync, documentDirectory, makeDirectoryAsync } from 'expo-file-system/legacy';

/**
 * On-device data directories for feature apps (CR-2b). The kernel decides the path
 * (`<documents>/features/<id>/`); this module creates it and wipes the whole
 * `features` tree when the identity ends.
 */

function documentsRoot(): string {
  if (documentDirectory === null) throw new Error('expo-file-system: document directory is unavailable');
  return documentDirectory;
}

/** Creates this feature's data directory (intermediates included) and returns its URI. */
export async function ensureFeatureDataDir(featureId: string): Promise<string> {
  const uri = featureDataDir(documentsRoot(), featureId);
  await makeDirectoryAsync(uri, { intermediates: true });
  return uri;
}

/** Deletes every feature's data directory. Succeeds when it is already gone. */
export async function wipeAllFeatureData(): Promise<void> {
  const root = documentsRoot().replace(/\/+$/, '');
  await deleteAsync(`${root}/features/`, { idempotent: true });
}
