import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const tanstackVersionPattern = /^\d+\.\d+\.\d+-tanstack\.\d+$/;
const isDryRun = process.argv.includes('--dry-run');
const npmCache = mkdtempSync(join(tmpdir(), 'super-sitemap-npm-cache-'));
const npmEnv = {
  ...process.env,
  npm_config_cache: npmCache,
};

/**
 * Removes the per-run npm scratch cache.
 */
function cleanupNpmCache() {
  rmSync(npmCache, { force: true, recursive: true });
}

/**
 * Runs a command with inherited stdio and a release-local npm cache.
 */
function run(command, args) {
  execFileSync(command, withNpmCache(command, args), { env: npmEnv, stdio: 'inherit' });
}

/**
 * Runs a command and returns trimmed stdout.
 */
function output(command, args) {
  return execFileSync(command, withNpmCache(command, args), {
    encoding: 'utf8',
    env: npmEnv,
  }).trim();
}

/**
 * Appends the temp cache argument to npm commands.
 */
function withNpmCache(command, args) {
  if (command !== 'npm') {
    return args;
  }

  return [...args, '--cache', npmCache];
}

process.on('exit', cleanupNpmCache);

const branch = output('git', ['branch', '--show-current']);

if (branch !== 'tanstack') {
  console.error(`Refusing to publish from branch "${branch}". Switch to "tanstack" first.`);
  process.exit(1);
}

if (!tanstackVersionPattern.test(packageJson.version)) {
  console.error(
    `Refusing to publish ${packageJson.name}@${packageJson.version}. Expected a version like 1.0.13-tanstack.0.`
  );
  console.error('Run: npm version prerelease --preid tanstack --no-git-tag-version');
  process.exit(1);
}

if (!isDryRun) {
  run('npm', ['dist-tag', 'ls', packageJson.name]);
}

run('npm', ['pack', '--dry-run']);

if (isDryRun) {
  process.exit(0);
}

run('npm', ['publish', '--tag', 'tanstack']);

if (!isDryRun) {
  run('npm', ['dist-tag', 'ls', packageJson.name]);
}
