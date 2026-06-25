import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import readline from 'node:readline';

const releaseTypes = ['patch', 'minor', 'major'];
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const dryRun = process.argv.includes('--dry-run');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelp();
  process.exit(0);
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

/**
 * Runs the interactive release workflow.
 */
async function main() {
  if (dryRun) {
    console.log(formatCommand('git', ['status', '--porcelain']));
  } else {
    await ensureCleanWorktree();
  }

  const releaseType = await promptReleaseType();

  await run('npm', ['whoami']);
  await run('bun', ['run', 'ready']);
  await run('npm', ['version', releaseType, '-m', 'chore(release): v%s']);
  await run('npm', ['publish']);
  await run('npm', ['view', packageJson.name, 'version', 'time.modified', 'dist-tags']);

  console.log(
    dryRun
      ? '\nDry run complete. After a real publish, push with:'
      : '\nRelease published. Push the release commit and tag when ready:'
  );
  console.log('git push origin main --follow-tags');
}

/**
 * Confirms no local changes are present before npm creates the release commit.
 */
async function ensureCleanWorktree() {
  const result = await collect('git', ['status', '--porcelain']);
  if (result.trim() === '') return;

  console.error('Refusing to release with a dirty git worktree:');
  console.error(result.trim());
  process.exit(1);
}

/**
 * Prompts for the semver release type with arrow-key navigation.
 *
 * @returns The selected npm version release type.
 */
async function promptReleaseType() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('Release type selection requires an interactive terminal.');
    process.exit(1);
  }

  let selectedIndex = 0;
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

  return await new Promise((resolve) => {
    let rendered = false;

    const render = () => {
      if (rendered) process.stdout.write(`\x1b[${releaseTypes.length + 1}A`);
      process.stdout.write('\x1b[?25l');
      readline.cursorTo(process.stdout, 0);
      readline.clearScreenDown(process.stdout);
      process.stdout.write('Release type? Use arrow keys, press Enter.\n');

      for (let index = 0; index < releaseTypes.length; index += 1) {
        const selected = index === selectedIndex;
        const prefix = selected ? '>' : ' ';
        const suffix = index === 0 ? ' (default)' : '';
        process.stdout.write(`${prefix} ${releaseTypes[index]}${suffix}\n`);
      }

      rendered = true;
    };

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.off('keypress', onKeypress);
      process.stdin.pause();
      process.stdout.write('\x1b[?25h');
    };

    const onKeypress = (_input, key) => {
      if (key.name === 'up' || key.name === 'k') {
        selectedIndex = (selectedIndex + releaseTypes.length - 1) % releaseTypes.length;
        render();
        return;
      }

      if (key.name === 'down' || key.name === 'j') {
        selectedIndex = (selectedIndex + 1) % releaseTypes.length;
        render();
        return;
      }

      if (key.name === 'return') {
        const releaseType = releaseTypes[selectedIndex];
        cleanup();
        process.stdout.write(`Selected release type: ${releaseType}\n`);
        resolve(releaseType);
        return;
      }

      if (key.name === 'c' && key.ctrl) {
        cleanup();
        process.stdout.write('Release cancelled.\n');
        process.exit(130);
      }
    };

    process.stdin.on('keypress', onKeypress);
    render();
  });
}

/**
 * Runs a command and inherits stdio so release output stays visible.
 *
 * @param command - Command executable.
 * @param args - Command arguments.
 */
async function run(command, args) {
  if (dryRun) {
    console.log(formatCommand(command, args));
    return;
  }

  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${formatCommand(command, args)} failed with ${signal ?? `exit ${code}`}`));
    });
  });
}

/**
 * Runs a command and returns stdout.
 *
 * @param command - Command executable.
 * @param args - Command arguments.
 * @returns Captured stdout.
 */
async function collect(command, args) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'inherit'] });
    let stdout = '';

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(`${formatCommand(command, args)} failed with ${signal ?? `exit ${code}`}`));
    });
  });
}

/**
 * Formats a command for readable dry-run output and error messages.
 *
 * @param command - Command executable.
 * @param args - Command arguments.
 * @returns Shell-like command string.
 */
function formatCommand(command, args) {
  return [command, ...args].map(quoteShellArg).join(' ');
}

/**
 * Quotes a shell argument when needed for display.
 *
 * @param value - Shell argument.
 * @returns Display-safe shell argument.
 */
function quoteShellArg(value) {
  if (/^[a-zA-Z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

/**
 * Prints command usage.
 */
function printHelp() {
  console.log(`Usage: bun run release [--dry-run]

Publishes a new ${packageJson.name} release.

The command prompts for patch, minor, or major with patch selected by default.`);
}
