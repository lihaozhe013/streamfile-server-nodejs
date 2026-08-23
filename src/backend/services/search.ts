import path from 'node:path';
import fg from 'fast-glob';
import type { RuntimePaths, SearchResult } from '@/types/index';
import { isWithinDirectory } from '@/services/files';

function buildCandidates(fileName: string): string[] {
  const escaped = fileName.replace(/[\\{}[\]()?+^$.]/g, '\\$&');
  return [`**/*${escaped}*`];
}

export async function searchFilesInPath(
  fileName: string,
  searchPath: string,
  paths: RuntimePaths,
): Promise<SearchResult[]> {
  const entries = await fg(buildCandidates(fileName), {
    cwd: searchPath,
    absolute: true,
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: false,
    ignore: ['**/incoming/**', '**/private-files/**'],
    unique: true,
    suppressErrors: true,
  });

  const query = fileName.toLowerCase();
  return entries
    .filter((absolutePath) =>
      path.basename(absolutePath).toLowerCase().includes(query),
    )
    .filter((absolutePath) => {
      const relativePath = path.relative(paths.filesDir, absolutePath);
      return (
        isWithinDirectory(paths.filesDir, absolutePath) &&
        !isWithinDirectory(paths.privateDir, absolutePath) &&
        !isWithinDirectory(paths.incomingDir, absolutePath) &&
        !relativePath.split(path.sep).some((segment) => segment.startsWith('.'))
      );
    })
    .map((absolutePath) => ({
      file_name: path.basename(absolutePath),
      file_path: absolutePath,
      relative_path: path
        .relative(paths.filesDir, absolutePath)
        .split(path.sep)
        .join('/'),
    }));
}
