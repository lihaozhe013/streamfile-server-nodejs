import path from 'node:path';
import type { RuntimePaths, SearchResult } from '@/types/index';
import {
  isAccessibleFilePath,
  isIncomingPath,
  isPrivatePath,
  isWithinDirectory,
} from '@/services/files';

function escapeGlobLiteral(value: string): string {
  return value.replace(/[\\*?[\]{}!]/g, '\\$&');
}

function buildCandidatePattern(fileName: string): string {
  return `**/*${escapeGlobLiteral(fileName)}*`;
}

async function scanCandidates(
  fileName: string,
  searchPath: string,
): Promise<string[]> {
  const glob = new Bun.Glob(buildCandidatePattern(fileName));
  const matches = new Set<string>();
  try {
    for await (const entry of glob.scan({
      cwd: searchPath,
      absolute: true,
      onlyFiles: false,
      dot: false,
      followSymlinks: false,
    })) {
      matches.add(entry);
    }
  } catch {
    // Mirror the previous suppressErrors behavior: unreadable or non-directory
    // search roots yield no matches instead of failing the request.
    return [];
  }
  return [...matches];
}

export async function searchFilesInPath(
  fileName: string,
  searchPath: string,
  paths: RuntimePaths,
): Promise<SearchResult[]> {
  const entries = await scanCandidates(fileName, searchPath);

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
