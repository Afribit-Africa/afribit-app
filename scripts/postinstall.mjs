#!/usr/bin/env node
/**
 * Root postinstall: apply patches/, then check the Matrix SDK's binaries (pin-matrix-binaries).
 *
 * `postinstall-postinstall` (a dependency of @unomed/react-native-matrix-sdk) re-runs this
 * hook through `yarn run postinstall` while npm is still running other packages' install
 * scripts, including the SDK's own binary download, so the two would race over the same
 * files. npm runs this hook itself once every package is installed; that is the run that
 * counts, so the yarn-invoked one does nothing.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (/^yarn\//.test(process.env.npm_config_user_agent ?? '')) {
  console.log('postinstall: skipped under yarn; npm runs it once all packages are installed');
  process.exit(0);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const require = createRequire(path.join(root, 'package.json'));
const run = (script, args = []) => execFileSync(process.execPath, [script, ...args], { cwd: root, stdio: 'inherit' });
try {
  run(require.resolve('patch-package/dist/index.js'), ['--error-on-fail']);
  run(path.join(here, 'pin-matrix-binaries.mjs'));
} catch {
  process.exit(1);
}
