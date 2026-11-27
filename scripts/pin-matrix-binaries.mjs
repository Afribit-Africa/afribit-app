#!/usr/bin/env node
/**
 * Pins the native binaries of @unomed/react-native-matrix-sdk (Chat's Matrix engine).
 *
 * The package's own postinstall downloads `binaries.tar.gz` from its GitHub release with
 * no checksum, and extracts it over its Android libraries and the iPhone xcframework.
 * npm's lockfile integrity covers the Android libraries but not that download. So after
 * install this checks every file against `matrix-binaries.json`. If any is missing or
 * different, it downloads the archive itself, checks the archive's SHA-256, extracts it
 * and checks every file again. Anything that still doesn't match fails the install, and
 * with it the build.
 */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pin = JSON.parse(readFileSync(path.join(here, 'matrix-binaries.json'), 'utf8'));
const pkgDir = process.env.PIN_MATRIX_PKG_DIR ?? path.join(here, '..', 'node_modules', ...pin.package.split('/'));
const ALLOWED = ['build/RnMatrixRustSdk.xcframework/', 'android/src/main/jniLibs/'];

function fail(message) {
  console.error(`pin-matrix-binaries: ${message}`);
  process.exit(1);
}

async function sha256File(file) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(file), hash);
  return hash.digest('hex');
}

async function mismatches() {
  const bad = [];
  for (const [rel, want] of Object.entries(pin.files)) {
    const file = path.join(pkgDir, ...rel.split('/'));
    if (!existsSync(file) || (await sha256File(file)) !== want.sha256) bad.push(rel);
  }
  return bad;
}

async function download(dest) {
  const res = await fetch(pin.archive.url, { redirect: 'follow' });
  if (!res.ok || !res.body) fail(`download failed: HTTP ${res.status}`);
  const hash = createHash('sha256');
  let bytes = 0;
  const body = Readable.fromWeb(res.body).on('data', (chunk) => {
    hash.update(chunk);
    bytes += chunk.length;
  });
  await pipeline(body, createWriteStream(dest));
  const got = hash.digest('hex');
  if (bytes !== pin.archive.bytes || got !== pin.archive.sha256) fail(`archive does not match the pin (sha256 ${got}, ${bytes} bytes)`);
}

/** Only paths under the two expected roots (or their parent folders), never absolute or climbing out. */
function checkEntries(archive) {
  const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8', maxBuffer: 1 << 20 }).split('\n').filter(Boolean);
  for (const entry of entries) {
    const name = entry.replace(/^\.\//, '');
    const dir = name.endsWith('/') ? name : name + '/';
    const inside = ALLOWED.some((root) => name.startsWith(root) || root.startsWith(dir));
    if (!inside || name.startsWith('/') || name.includes(String.fromCharCode(92)) || name.split('/').includes('..')) fail(`unexpected archive entry: ${entry}`);
  }
}

if (!existsSync(pkgDir)) process.exit(0); // not installed in this workspace
const installed = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version;
if (installed !== pin.version) fail(`${pin.package} is ${installed} but the pin is ${pin.version}: update scripts/matrix-binaries.json`);

const bad = await mismatches();
if (bad.length === 0) {
  console.log(`pin-matrix-binaries: ${Object.keys(pin.files).length} files match ${pin.version}`);
  process.exit(0);
}
console.log(`pin-matrix-binaries: ${bad.length} file(s) missing or different, fetching the pinned archive`);
const archive = path.join(tmpdir(), `matrix-binaries-${pin.version}-${process.pid}.tar.gz`);
try {
  await download(archive);
  checkEntries(archive);
  rmSync(path.join(pkgDir, 'build', 'RnMatrixRustSdk.xcframework'), { recursive: true, force: true });
  execFileSync('tar', ['-xzf', archive, '-C', pkgDir], { stdio: 'inherit' });
} finally {
  rmSync(archive, { force: true });
}
const still = await mismatches();
if (still.length) fail(`still different after extracting the pinned archive: ${still.join(', ')}`);
console.log(`pin-matrix-binaries: restored ${pin.version} from the pinned archive`);
