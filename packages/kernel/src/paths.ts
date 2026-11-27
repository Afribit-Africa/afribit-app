/**
 * Per-feature data directory (CR-2a). The native Matrix engine keeps an
 * encrypted SQLite store on disk, so each feature is handed a directory no
 * other feature can name. Pure path arithmetic: the shell owns the root, and
 * the feature id is the same dot-free namespace segment as a vault key.
 */
const FEATURE_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

export function featureDataDir(root: string, featureId: string): string {
  const normalisedRoot = root.replace(/\/+$/, '');
  if (normalisedRoot === '') throw new Error('root must not be empty');
  if (!normalisedRoot.startsWith('/') && !normalisedRoot.startsWith('file:///')) {
    throw new Error('root must be an absolute path or a file:/// URI');
  }
  if (normalisedRoot.split('/').includes('..')) throw new Error('root must not contain ".." as a path segment');
  if (normalisedRoot.includes('\\')) throw new Error('root must not contain a backslash');
  if (CONTROL.test(normalisedRoot)) throw new Error('root must not contain a control character');

  if (!FEATURE_ID.test(featureId)) throw new Error(`feature id must match ${FEATURE_ID.source}`);
  if (featureId.includes('..')) throw new Error('feature id must not contain ".."');
  if (featureId.includes('.')) throw new Error('feature id must not contain ".": it would share another feature\'s directory');

  const result = `${normalisedRoot}/features/${featureId}/`;
  // Final guard: the feature id can never escape the root's features directory.
  if (!result.startsWith(`${normalisedRoot}/features/`)) throw new Error('data directory escaped its root');
  return result;
}
