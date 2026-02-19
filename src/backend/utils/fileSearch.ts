import path from 'path';
import fg from 'fast-glob';
import { Request, Response } from 'express';
import { UPLOAD_DIR } from './paths';

type RawSearchItem = {
  path: string;
  full_file_name: string;
};

export const handleSearchRequest = (req: Request, res: Response) => {
  const fileName = (req.params as any)[0];
  const currentDir = ((req.params as any)[1] || '').toString();

  if (!fileName) {
    return res.json({ error: 'file_name parameter is required' });
  }

  const safeCurrentDir = path.normalize(currentDir).replace(/^(\.\.(\/|\\|$))+/, '');
  const searchPath = path.join(UPLOAD_DIR, safeCurrentDir);

  if (!searchPath.startsWith(UPLOAD_DIR)) {
    return res.json({ error: 'Invalid search path' });
  }

  try {
    const jsonResult = searchFilesInPath(fileName, searchPath);
    const files = JSON.parse(jsonResult);

    const filteredFiles = files.filter((file: { path: string; full_file_name: string }) => {
      const relativePath = path.relative(UPLOAD_DIR, file.path);
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
        relative_path: path.relative(UPLOAD_DIR, file.path),
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

async function searchFilesStructured(
  fileName: string,
  searchPath: string,
): Promise<Array<{ file_name: string; file_path: string; relative_path: string }>> {
  const results = await searchFilesCore(fileName, searchPath);
  return results.map((r) => ({
    file_name: r.full_file_name,
    file_path: r.path,
    relative_path: path.relative(searchPath, r.path),
  }));
}

function searchFilesInPath(fileName: string, searchPath: string): string {
  // Provide a sync-like wrapper that returns JSON string to match previous native addon API
  // We'll block using deasync-like behavior by leveraging fast-glob's sync API for simplicity
  const results = searchFilesCoreSync(fileName, searchPath);
  return JSON.stringify(results);
}

function buildCandidates(fileName: string) {
  // Escape glob special chars lightly; fast-glob treats [] and {} specially
  const escaped = fileName.replace(/[\\{}\[\]\(\)\?\+\^\$\.]/g, '\\$&');
  return [
    `**/*${escaped}*`, // contains
  ];
}

async function searchFilesCore(fileName: string, searchPath: string): Promise<RawSearchItem[]> {
  const patterns = buildCandidates(fileName);
  const entries: string[] = await fg(patterns, {
    cwd: searchPath,
    absolute: true,
    onlyFiles: true,
    dot: false, // skip dotfiles
    followSymbolicLinks: true,
    ignore: ['**/incoming/**', '**/private-files/**'],
    unique: true,
    suppressErrors: true,
    // We handle case-insensitive match by filtering post-glob
  });

  const q = fileName.toLowerCase();
  return (entries as string[])
    .filter((abs: string) => path.basename(abs).toLowerCase().includes(q))
    .map((abs: string) => ({ path: abs, full_file_name: path.basename(abs) }));
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
