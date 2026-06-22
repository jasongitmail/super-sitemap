import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const publishTag = process.env.npm_config_tag ?? 'latest';
const isPrerelease = packageJson.version.includes('-');

if (publishTag === 'tanstack') {
  console.error(
    `Refusing to publish ${packageJson.name}@${packageJson.version} with retired npm tag "tanstack".`
  );
  console.error('TanStack Start support ships in the main package as of v2.0.');
  process.exit(1);
}

if (isPrerelease && publishTag === 'latest') {
  console.error(
    `Refusing to publish prerelease ${packageJson.name}@${packageJson.version} with npm tag "latest".`
  );
  console.error('Use an explicit prerelease tag, e.g. npm publish --tag next.');
  process.exit(1);
}
