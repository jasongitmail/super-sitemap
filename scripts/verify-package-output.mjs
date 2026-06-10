// Verifies the packaged output is safe to publish:
// 1. No Node built-in imports in shipped code, so the package stays safe for
//    edge runtimes such as Cloudflare Workers.
// 2. Every package.json `exports` subpath resolves to real `types` and
//    `default` files.
//
// Runs after `tsc` in the `package` npm script.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const packagedDirs = ['dist/core', 'dist/adapters'];
const nodeImportRegex = /\b(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]node:/;

const failures = [];

for (const dir of packagedDirs) {
  const dirPath = path.join(root, dir);

  if (!fs.existsSync(dirPath)) {
    failures.push(`Missing packaged directory: ${dir}/ (run \`npm run package\` first)`);
    continue;
  }

  for (const filePath of listFilesRecursively(dirPath)) {
    if (!/\.(js|d\.ts)$/.test(filePath)) continue;
    if (/\.test\./.test(filePath)) continue; // excluded from the tarball by `files`

    const contents = fs.readFileSync(filePath, 'utf8');
    if (nodeImportRegex.test(contents)) {
      failures.push(`Node built-in import in shipped file: ${path.relative(root, filePath)}`);
    }
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

for (const [subpath, target] of Object.entries(packageJson.exports ?? {})) {
  for (const condition of ['types', 'default']) {
    const targetPath = target?.[condition];

    if (!targetPath) {
      failures.push(`Export '${subpath}' is missing the '${condition}' condition`);
      continue;
    }

    if (!fs.existsSync(path.join(root, targetPath))) {
      failures.push(`Export '${subpath}' ${condition} does not resolve: ${targetPath}`);
    }
  }
}

if (failures.length) {
  console.error('Package output verification failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('Package output verified: no Node built-ins, all exports resolve.');

function listFilesRecursively(dirPath) {
  const filePaths = [];

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      filePaths.push(...listFilesRecursively(entryPath));
    } else if (entry.isFile()) {
      filePaths.push(entryPath);
    }
  }

  return filePaths;
}
