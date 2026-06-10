import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const publishTag = process.env.npm_config_tag ?? 'latest';
const isTanstackPrerelease = /-tanstack\.\d+$/.test(packageJson.version);

/**
 * Returns the current Git branch name.
 */
function getCurrentBranch() {
  return execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
}

if (isTanstackPrerelease && publishTag !== 'tanstack') {
  console.error(
    `Refusing to publish ${packageJson.name}@${packageJson.version} with npm tag "${publishTag}".`
  );
  console.error('TanStack prereleases must be published with: npm publish --tag tanstack');
  process.exit(1);
}

if (isTanstackPrerelease && getCurrentBranch() !== 'tanstack') {
  console.error(
    `Refusing to publish ${packageJson.name}@${packageJson.version} from a non-tanstack branch.`
  );
  process.exit(1);
}

if (!isTanstackPrerelease && publishTag === 'tanstack') {
  console.error(
    `Refusing to publish non-TanStack version ${packageJson.name}@${packageJson.version} with npm tag "tanstack".`
  );
  process.exit(1);
}
