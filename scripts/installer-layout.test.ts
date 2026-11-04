import { ok, strictEqual } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { extractPowerShellFunctions } from './installer-fixture-functions';

// Real archive extraction and isolated install roots, with no network or user PATH writes.
// These fixtures do not qualify real release binaries or deployed endpoint bytes.
const windows = process.platform === 'win32';
// Validate the main boundary before spawning any fixture process, on every host.
const functions = extractPowerShellFunctions(readFileSync(resolve('public/install.ps1'), 'utf8'));
// Every case exercises paths with shell metacharacters as data, never command text.
const root = mkdtempSync(join(tmpdir(), "hosted-installer-'$() & "));
const installer = resolve(`public/install.${windows ? 'ps1' : 'sh'}`);
const source = join(root, 'source');
const binary = windows ? 'mangostudio.exe' : 'mangostudio';
mkdirSync(source);

function run(command: string, args: string[], fixtureEnv: Record<string, string> = {}) {
  const env = { ...process.env, ...fixtureEnv };
  if (windows && command === 'powershell.exe') {
    // Actions launches Bun from PowerShell 7. Let Windows PowerShell 5.1 build
    // its own module path instead of inheriting PS7's incompatible module set.
    for (const key of Object.keys(env)) {
      if (key.toLowerCase() === 'psmodulepath') delete env[key];
    }
  }
  const result = spawnSync(command, args, { encoding: 'utf8', env });
  if (result.error) throw result.error;
  return result;
}

function install(archive: string, target: string) {
  if (!windows) {
    return run('bash', [
      '-c',
      'source "$1"; install_archive "$2" fixture "$3"',
      'layout-test',
      installer,
      archive,
      target,
    ]);
  }
  // Load the actual production functions without main, which persists the user PATH.
  return run(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `${functions}\nInstall-Archive $env:MANGO_FIXTURE_ARCHIVE fixture $env:MANGO_FIXTURE_TARGET`,
    ],
    { MANGO_FIXTURE_ARCHIVE: archive, MANGO_FIXTURE_TARGET: target }
  );
}

function archive(name: string): string {
  const path = join(root, `${name}.${windows ? 'zip' : 'tar.gz'}`);
  const result = windows
    ? run(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          "Compress-Archive -Path (Join-Path $env:MANGO_FIXTURE_SOURCE '*') -DestinationPath $env:MANGO_FIXTURE_ARCHIVE",
        ],
        { MANGO_FIXTURE_SOURCE: source, MANGO_FIXTURE_ARCHIVE: path }
      )
    : run('tar', ['-czf', path, '-C', source, '.']);
  strictEqual(result.status, 0, result.stderr);
  return path;
}

try {
  writeFileSync(join(source, binary), 'fixture binary payload');
  const valid = archive('valid');
  const target = join(root, 'installed');
  const accepted = install(valid, target);
  strictEqual(accepted.status, 0, accepted.stderr);
  strictEqual(readFileSync(join(target, 'fixture', binary), 'utf8'), 'fixture binary payload');
  ok(!existsSync(join(target, 'fixture', 'public', 'index.html')));

  rmSync(join(source, binary));
  writeFileSync(join(source, 'unrelated.txt'), 'not the binary');
  const missing = archive('missing');
  const refused = install(missing, target);
  ok(refused.status !== 0, 'missing binary must fail');
  ok(refused.stderr.includes(`archive is missing ${binary}`), refused.stderr);
  strictEqual(readFileSync(join(target, 'fixture', binary), 'utf8'), 'fixture binary payload');

  mkdirSync(join(source, binary));
  writeFileSync(join(source, binary, 'placeholder'), 'a directory is not a binary');
  const directory = archive('directory');
  const directoryRefused = install(directory, join(root, 'directory-install'));
  ok(directoryRefused.status !== 0, 'directory in place of the binary must fail');
  ok(directoryRefused.stderr.includes(`archive is missing ${binary}`), directoryRefused.stderr);

  const corrupt = join(root, `corrupt.${windows ? 'zip' : 'tar.gz'}`);
  writeFileSync(corrupt, 'not an archive');
  const rejected = install(corrupt, join(root, 'corrupt-install'));
  ok(rejected.status !== 0, 'corrupt archive must fail');
  ok(!existsSync(join(root, 'corrupt-install', 'fixture')));

  // Preserve download integrity independently of the local extraction fixtures.
  const manifest = join(root, 'SHA256SUMS');
  const hash = createHash('sha256').update(readFileSync(valid)).digest('hex');
  writeFileSync(manifest, `${hash}  fixture\n`);
  function checksum() {
    if (!windows) {
      return run('bash', [
        '-c',
        'source "$1"; verify_checksum "$2" "$3" fixture',
        'checksum-test',
        installer,
        manifest,
        valid,
      ]);
    }
    return run(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `${functions}\nTest-Checksum $env:MANGO_FIXTURE_MANIFEST $env:MANGO_FIXTURE_ARCHIVE fixture`,
      ],
      { MANGO_FIXTURE_MANIFEST: manifest, MANGO_FIXTURE_ARCHIVE: valid }
    );
  }
  const verified = checksum();
  strictEqual(verified.status, 0, verified.stderr);
  writeFileSync(valid, 'corrupted downloaded binary archive');
  const mismatch = checksum();
  ok(mismatch.status !== 0);
  ok(mismatch.stderr.includes('checksum mismatch for fixture'), mismatch.stderr);
  writeFileSync(manifest, `${hash}  another-asset\n`);
  const absent = checksum();
  ok(absent.status !== 0);
  ok(absent.stderr.includes('SHA256SUMS does not contain fixture'), absent.stderr);
  console.warn(`[ok] hosted installer layout and integrity fixtures on ${process.platform}`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
