import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Static admission scan for one feature package. It cannot prove a feature is
 * safe; it enforces the structural rules that make isolation possible:
 * a feature talks only to React, React Native UI, the design system and the
 * feature SDK, and never reaches into another feature, the shell, storage or
 * raw native modules.
 */

export const ALLOWED_IMPORTS = new Set(['react', 'react/jsx-runtime', 'react-native', '@afribit/feature-sdk', '@afribit/design']);
export const ALLOWED_DEPENDENCIES = new Set(['@afribit/feature-sdk', '@afribit/design']);
export const ALLOWED_PEER_DEPENDENCIES = new Set(['react', 'react-native']);

const FORBIDDEN_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\bNativeModules\b/, 'raw NativeModules access'],
  [/\bTurboModuleRegistry\b/, 'raw TurboModuleRegistry access'],
  [/\b__fbBatchedBridge\b/, 'bridge internals'],
  [/(^|[^.\w])eval\s*\(/, 'eval'],
  [/\bnew\s+Function\s*\(/, 'new Function'],
  [/\brequire\s*\(\s*[^'"\s)]/, 'non-literal require'],
  [/\bimport\s*\(\s*[^'"\s)]/, 'non-literal dynamic import'],
];

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;

export interface Finding {
  readonly file: string;
  readonly rule: string;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) out.push(p);
  }
  return out;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

export function scanFeature(featureDir: string): Finding[] {
  const findings: Finding[] = [];
  const rel = (p: string) => path.relative(featureDir, p).split(path.sep).join('/');

  const pkgPath = path.join(featureDir, 'package.json');
  if (!existsSync(pkgPath)) return [{ file: 'package.json', rule: 'missing package.json' }];
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, Record<string, string> | undefined>;
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    if (!ALLOWED_DEPENDENCIES.has(dep)) findings.push({ file: 'package.json', rule: `dependency "${dep}" is not allowed for feature apps` });
  }
  for (const dep of Object.keys(pkg.peerDependencies ?? {})) {
    if (!ALLOWED_PEER_DEPENDENCIES.has(dep)) findings.push({ file: 'package.json', rule: `peer dependency "${dep}" is not allowed` });
  }
  if (pkg.scripts && Object.keys(pkg.scripts).some((s) => /^(pre|post)?install$|^prepare$/.test(s))) {
    findings.push({ file: 'package.json', rule: 'install lifecycle scripts are not allowed' });
  }

  const srcDir = path.join(featureDir, 'src');
  if (!existsSync(srcDir)) return [...findings, { file: 'src', rule: 'missing src directory' }];
  for (const file of walk(srcDir)) {
    const code = stripComments(readFileSync(file, 'utf8'));
    for (const [re, rule] of FORBIDDEN_PATTERNS) if (re.test(code)) findings.push({ file: rel(file), rule });
    for (const m of code.matchAll(SPECIFIER)) {
      const spec = m[1]!;
      if (spec.startsWith('.')) {
        const target = path.resolve(path.dirname(file), spec);
        if (!target.startsWith(featureDir + path.sep)) findings.push({ file: rel(file), rule: `relative import "${spec}" leaves the feature package` });
      } else if (!ALLOWED_IMPORTS.has(spec)) {
        findings.push({ file: rel(file), rule: `import "${spec}" is not allowed for feature apps` });
      }
    }
  }
  return findings;
}
