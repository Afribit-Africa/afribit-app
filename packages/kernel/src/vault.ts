/**
 * Feature vault key naming (CR-6). A feature's secret is stored under
 * `vault.<featureId>.<name>`. The feature id is the namespace segment, so it must
 * not contain the `.` delimiter: otherwise `vault.a.b.c` would belong to both
 * feature `a.b` (name `c`) and feature `a` (name `b.c`). Names may contain `.`,
 * since the namespace is fixed by the (dot-free) feature id.
 */
const SEGMENT = /^[a-z0-9][a-z0-9._-]{0,63}$/;

function checkSegment(value: string, label: string): void {
  if (!SEGMENT.test(value)) throw new Error(`${label} must match ${SEGMENT.source}`);
  if (value.includes('..')) throw new Error(`${label} must not contain ".."`);
}

export function vaultKey(featureId: string, name: string): string {
  checkSegment(featureId, 'feature id');
  checkSegment(name, 'name');
  if (featureId.includes('.')) throw new Error('feature id must not contain ".": it would share another feature\'s namespace');
  return `vault.${featureId}.${name}`;
}
