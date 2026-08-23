import path from 'node:path';
import fg from 'fast-glob';
import type { RuntimePaths, SearchResult } from '@/types/index';
import {
  isAccessibleFilePath,
  isIncomingPath,
  isPrivatePath,
  isWithinDirectory,
} from '@/services/files';

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
    onlyFiles: false,
    dot: false,
    followSymbolicLinks: false,
    ignore: ['**/incoming/**', '**/private-files/**'],
    unique: true,
    suppressErrors: true,
  });

  const query = fileName.toLowerCase();
  const candidates = entries
    .filter((absolutePath) =>
      path.basename(absolutePath).toLowerCase().includes(query),
    )
    .filter((absolutePath) => {
      const relativePath = path.relative(paths.filesDir, absolutePath);
      return (
        isWithinDirectory(paths.filesDir, absolutePath) &&
        !isPrivatePath(paths, absolutePath) &&
        !isIncomingPath(paths, absolutePath) &&
        !relativePath.split(path.sep).some((segment) => segment.startsWith('.'))
      );
    });

  const results = await Promise.all(
    candidates.map(async (absolutePath) => {
      if (
        !(await isAccessibleFilePath(paths.filesDir, absolutePath, [
          paths.incomingDir,
        ]))
      ) {
        return null;
      }

      return {
        file_name: path.basename(absolutePath),
        file_path: absolutePath,
        relative_path: path
          .relative(paths.filesDir, absolutePath)
          .split(path.sep)
          .join('/'),
      };
    }),
  );

  return results.filter((result): result is SearchResult => result !== null);
}
