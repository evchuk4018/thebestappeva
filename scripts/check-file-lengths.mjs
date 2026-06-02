import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const MAX_LINES = 300;
const ROOT_FILES = [
  '.env.example',
  'README.md',
  'agent.md',
  'index.html',
  'metadata.json',
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  path.join('public', 'manifest.json'),
];
const SOURCE_DIRS = ['src'];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedPaths = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return walk(entryPath);
      }

      return [entryPath];
    }),
  );

  return nestedPaths.flat();
}

async function collectIncludedFiles() {
  const sourceFiles = (
    await Promise.all(
      SOURCE_DIRS.map(async (directory) => {
        const absoluteDirectory = path.join(ROOT, directory);
        const directoryStats = await stat(absoluteDirectory);
        return directoryStats.isDirectory() ? walk(absoluteDirectory) : [];
      }),
    )
  ).flat();

  const rootFiles = await Promise.all(
    ROOT_FILES.map(async (relativePath) => {
      const absolutePath = path.join(ROOT, relativePath);
      try {
        const fileStats = await stat(absolutePath);
        return fileStats.isFile() ? absolutePath : null;
      } catch {
        return null;
      }
    }),
  );

  return [...sourceFiles, ...rootFiles.filter(Boolean)].sort();
}

function countLines(content) {
  return content === '' ? 0 : content.split(/\r?\n/).length;
}

async function main() {
  const includedFiles = await collectIncludedFiles();
  const violations = [];

  for (const filePath of includedFiles) {
    const content = await readFile(filePath, 'utf8');
    const lineCount = countLines(content);

    if (lineCount > MAX_LINES) {
      violations.push({
        path: path.relative(ROOT, filePath),
        lineCount,
      });
    }
  }

  if (violations.length === 0) {
    console.log(`All authored files are within ${MAX_LINES} lines.`);
    return;
  }

  console.error(`Found ${violations.length} file(s) above ${MAX_LINES} lines:`);
  for (const violation of violations) {
    console.error(`- ${violation.path}: ${violation.lineCount} lines`);
  }

  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
