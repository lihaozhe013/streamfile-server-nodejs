import path from 'path';
import fg from 'fast-glob';
import { Request, Response } from 'express';
import { FILES_DIR } from './paths';

type RawSearchItem = {
  path: string;
  full_file_name: string;
};

export const handleSearchRequest = (req: Request, res: Response) => {
  // Support both query params (standard) and regex capturing groups (legacy)
  const fileName = (req.query.q as string) || (req.params as Record<string, string>)[0];
  const currentDir = (req.query.dir as string) || ((req.params as Record<string, string>)[1] || '').toString();

  if (!fileName) {
    return res.status(400).json({ error: 'file_name parameter is required' });
  }

  const safeCurrentDir = path.normalize(currentDir).replace(/^(\.\.(\/|\\|$))+/, '');
  const searchPath = path.join(FILES_DIR, safeCurrentDir);

  if (!searchPath.startsWith(FILES_DIR)) {
    return res.json({ error: 'Invalid search path' });
  }

  try {
    const jsonResult = searchFilesInPath(fileName, searchPath);
    const files = JSON.parse(jsonResult);

    const filteredFiles = files.filter((file: { path: string; full_file_name: string }) => {
      const relativePath = path.relative(FILES_DIR, file.path);
      return (
        !relativePath.startsWith('private-files') &&
        !relativePath.startsWith('incoming') &&
        !file.full_file_name.startsWith('.')
      );
    });

    const resultFiles = filteredFiles.map((file: { full_file_name: string; path: string }) => {
      return {
        file_name: file.full_file_name,
        file_path: file.path,
        relative_path: path.relative(FILES_DIR, file.path),
      };
    });

    return res.json({
      query: {
        file_name: fileName,
        current_dir: safeCurrentDir,
      },
      results: resultFiles,
      count: resultFiles.length,
    });
  } catch (error) {
    return res.json({
      error: 'Search failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

function searchFilesInPath(fileName: string, searchPath: string): string {
  // Provide a sync-like wrapper that returns JSON string to match previous native addon API
  // We'll block using deasync-like behavior by leveraging fast-glob's sync API for simplicity
  const results = searchFilesCoreSync(fileName, searchPath);
  return JSON.stringify(results);
}

function buildCandidates(fileName: string) {
  // Escape glob special chars lightly; fast-glob treats [] and {} specially
  const escaped = fileName.replace(/[\\{}[\]()?+^$.]/g, '\\$&');
  return [
    `**/*${escaped}*`, // contains
  ];
}

function searchFilesCoreSync(fileName: string, searchPath: string): RawSearchItem[] {
  const patterns = buildCandidates(fileName);
  const entries: string[] = fg.sync(patterns, {
    cwd: searchPath,
    absolute: true,
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: true,
    ignore: ['**/incoming/**', '**/private-files/**'],
    unique: true,
    suppressErrors: true,
  });

  const q = fileName.toLowerCase();
  return (entries as string[])
    .filter((abs: string) => path.basename(abs).toLowerCase().includes(q))
    .map((abs: string) => ({ path: abs, full_file_name: path.basename(abs) }));
}
