import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const scannedRoots = ['server', 'src', 'shared'];
const disallowedPatterns = [
  { name: 'better-sqlite3', pattern: /from\s+['"]better-sqlite3['"]|require\(['"]better-sqlite3['"]\)/ },
  { name: 'SQLite getDatabase', pattern: /from\s+['"][^'"]*db\/database['"]|getDatabase\s*\(/ },
  { name: 'SQLite schema module', pattern: /from\s+['"][^'"]*db\/(?:schema|[^'"]+-schema)['"]/ },
];

function isAllowedLegacyPath(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  return normalized.includes('.test.')
    || normalized.startsWith('server/db/')
    || normalized === 'server/ownership.ts';
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(entryPath);
    return /\.(?:ts|tsx|js|mjs|cjs)$/.test(entry.name) ? [entryPath] : [];
  }));
  return nested.flat();
}

const files = (await Promise.all(scannedRoots.map((directory) => walk(path.join(root, directory))))).flat();
const violations = [];

for (const filePath of files) {
  const relativePath = path.relative(root, filePath);
  if (isAllowedLegacyPath(relativePath)) continue;
  const content = await readFile(filePath, 'utf8');
  for (const check of disallowedPatterns) {
    if (check.pattern.test(content)) {
      violations.push(`${relativePath}: imports or calls ${check.name}`);
    }
  }
}

if (violations.length) {
  console.error('SQLite persistence imports are not allowed in runtime feature modules:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log('Runtime feature modules do not import SQLite persistence APIs.');
}
