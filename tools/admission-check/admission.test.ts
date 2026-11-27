import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRegistry, validateManifest } from '../../packages/kernel/src';
import { FEATURE_MANIFESTS, RELEASE_POLICY } from '../../apps/shell/src/release-policy';
import { scanFeature } from './scan';

const root = path.resolve(__dirname, '../..');
const featuresDir = path.join(root, 'features');
const featureDirs = readdirSync(featuresDir).filter((d) => existsSync(path.join(featuresDir, d, 'manifest.json')));

describe('admission: every shipped feature', () => {
  it('there is at least one feature', () => {
    expect(featureDirs.length).toBeGreaterThan(0);
  });

  it.each(featureDirs)('%s has a valid manifest whose id matches its folder', (dir) => {
    const raw = JSON.parse(readFileSync(path.join(featuresDir, dir, 'manifest.json'), 'utf8')) as unknown;
    const r = validateManifest(raw);
    expect(r.ok ? [] : r.errors).toEqual([]);
    if (r.ok) expect(r.manifest.id).toBe(dir);
  });

  it.each(featureDirs)('%s passes the import and dependency boundary scan', (dir) => {
    expect(scanFeature(path.join(featuresDir, dir))).toEqual([]);
  });

  it('every feature folder is in the release policy and the shell registry, and nothing else is', () => {
    expect(Object.keys(RELEASE_POLICY).sort()).toEqual([...featureDirs].sort());
    expect(FEATURE_MANIFESTS.map((m) => (m as { id: string }).id).sort()).toEqual([...featureDirs].sort());
  });

  it('the registry admits every shipped feature with no rejections', () => {
    const reg = createRegistry(FEATURE_MANIFESTS, RELEASE_POLICY);
    expect(reg.rejected).toEqual([]);
    expect(reg.features).toHaveLength(featureDirs.length);
  });
});

describe('admission: seeded violations are caught', () => {
  const findings = scanFeature(path.join(__dirname, 'fixtures', 'bad-feature'));
  const rules = findings.map((f) => f.rule).join('\n');

  it.each([
    'import "@react-native-async-storage/async-storage" is not allowed',
    'relative import "../../../../features/wallet/src" leaves the feature package',
    'import "@afribit/kernel" is not allowed',
    'raw NativeModules access',
    'eval',
    'non-literal require',
    'dependency "expo-secure-store" is not allowed',
    'install lifecycle scripts are not allowed',
  ])('detects: %s', (rule) => {
    expect(rules).toContain(rule);
  });

  it('ignores forbidden words inside comments', () => {
    expect(findings.filter((f) => f.file.endsWith('clean.ts'))).toEqual([]);
  });
});
