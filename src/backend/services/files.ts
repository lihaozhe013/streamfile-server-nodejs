import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry, RuntimePaths } from '@/types/index';

export function isWithinDirectory(
  baseDirectory: string,
  candidatePath: string,
): boolean {
  const base = path.resolve(baseDirectory);
  const candidate = path.resolve(candidatePath);
  const relativePath = path.relative(base, candidate);
  return (
    relativePath === '' ||
    (!relativePath.startsWith(`..${path.sep}`) &&
      relativePath !== '..' &&
      !path.isAbsolute(relativePath))
  );
}

export function normalizeRelativePath(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\/+/, '');
}

export function decodeRoutePath(value: string): string | null {
  try {
    return normalizeRelativePath(decodeURIComponent(value));
  } catch {
    return null;
  }
}

export function resolveWithinDirectory(
  baseDirectory: string,
  relativePath: string,
): string | null {
  const candidate = path.resolve(
    baseDirectory,
    normalizeRelativePath(relativePath),
  );
  return isWithinDirectory(baseDirectory, candidate) ? candidate : null;
}

export async function isSafeExistingPath(
  baseDirectory: string,
  candidatePath: string,
): Promise<boolean> {
  if (!isWithinDirectory(baseDirectory, candidatePath)) return false;

  try {
    const [realBase, realCandidate] = await Promise.all([
      fs.realpath(baseDirectory),
      fs.realpath(candidatePath),
    ]);
    return isWithinDirectory(realBase, realCandidate);
  } catch {
    return false;
  }
}

export async function isAccessibleFilePath(
  baseDirectory: string,
  candidatePath: string,
  blockedDirectories: string[] = [],
): Promise<boolean> {
  if (!isWithinDirectory(baseDirectory, candidatePath)) return false;

  const parentPath = path.dirname(candidatePath);
  if (!(await isSafeExistingPath(baseDirectory, parentPath))) return false;

  try {
    const stats = await fs.stat(candidatePath);
    if (!stats.isFile()) return false;

    const realCandidatePath = await fs.realpath(candidatePath);
    const realBlockedDirectories = await Promise.all(
      blockedDirectories.map((directory) => fs.realpath(directory)),
    );
    return realBlockedDirectories.every(
      (directory) => !isWithinDirectory(directory, realCandidatePath),
    );
  } catch {
    return false;
  }
}

export function isIncomingPath(
  paths: RuntimePaths,
  candidatePath: string,
): boolean {
  return isWithinDirectory(paths.incomingDir, candidatePath);
}

export function isPrivatePath(
  paths: RuntimePaths,
  candidatePath: string,
): boolean {
  return isWithinDirectory(paths.privateDir, candidatePath);
}

export async function listPublicDirectory(
  directoryPath: string,
  paths: RuntimePaths,
): Promise<FileEntry[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const visibleEntries = entries.filter(
    (entry) =>
      !entry.name.startsWith('.') &&
      entry.name !== 'incoming' &&
      entry.name !== 'private-files',
  );

  const files = await Promise.all(
    visibleEntries.map(async (entry) => {
      const entryPath = path.join(directoryPath, entry.name);

      try {
        const stats = await fs.stat(entryPath);
        if (stats.isDirectory()) {
          if (!(await isSafeExistingPath(paths.filesDir, entryPath))) {
            return null;
          }
          return { name: entry.name, isDirectory: true };
        }

        if (
          !(await isAccessibleFilePath(paths.filesDir, entryPath, [
            paths.incomingDir,
          ]))
        ) {
          return null;
        }
        return { name: entry.name, isDirectory: false };
      } catch {
        return null;
      }
    }),
  );

  return files.filter((entry): entry is FileEntry => entry !== null);
}
