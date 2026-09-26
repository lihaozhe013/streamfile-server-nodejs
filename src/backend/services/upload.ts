import fs from 'node:fs/promises';
import path from 'node:path';
import { constants as fsConstants } from 'node:fs';
import type { RuntimePaths } from '@/types/index';
import { isWithinDirectory, normalizeRelativePath, resolveWithinDirectory } from '@/services/files';

const INCOMING_DESTINATION: ResolvedUploadDestination = {
  mode: 'incoming'
};

export type ResolvedUploadDestination =
  { mode: 'incoming' } | { mode: 'directory'; absolutePath: string; relativePath: string } | null;

export function isInvalidDestination(destination: ResolvedUploadDestination): destination is null {
  return destination === null;
}

function hasVisibleSegment(normalizedPath: string): boolean {
  return normalizedPath
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.')
    .every((segment) => !segment.startsWith('.'));
}

function errorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

async function isRealPathInsideBlockedDirectories(
  paths: RuntimePaths,
  realCandidate: string
): Promise<boolean> {
  const [realIncoming, realPrivate] = await Promise.all([
    fs.realpath(paths.incomingDir),
    fs.realpath(paths.privateDir)
  ]);
  return (
    isWithinDirectory(realIncoming, realCandidate) || isWithinDirectory(realPrivate, realCandidate)
  );
}

/**
 * Maps a user-supplied upload destination to a directory inside the visible
 * files area. An omitted or empty destination keeps the legacy inbox
 * behavior; '.' selects the visible root. Returns null when the destination
 * would escape the files root, land in a protected (incoming/private-files)
 * or hidden (dot-prefixed) location.
 */
export async function resolveUploadDestination(
  paths: RuntimePaths,
  destination: unknown
): Promise<ResolvedUploadDestination> {
  if (destination === undefined || destination === null) {
    return INCOMING_DESTINATION;
  }
  if (typeof destination !== 'string') return null;

  const normalized = normalizeRelativePath(destination);
  if (!normalized) return INCOMING_DESTINATION;
  if (!hasVisibleSegment(normalized)) return null;

  const resolved = resolveWithinDirectory(paths.filesDir, normalized);
  if (!resolved) return null;

  let realFilesDir: string;
  try {
    realFilesDir = await fs.realpath(paths.filesDir);
    // Validate the nearest existing ancestor before creating anything so a
    // symlinked directory cannot make mkdir write outside the files root.
    let ancestor = resolved;
    while (!(await pathExists(ancestor))) {
      const parent = path.dirname(ancestor);
      if (parent === ancestor) return null;
      ancestor = parent;
    }
    const realAncestor = await fs.realpath(ancestor);
    if (!isWithinDirectory(realFilesDir, realAncestor)) return null;
    if (await isRealPathInsideBlockedDirectories(paths, realAncestor)) {
      return null;
    }

    await fs.mkdir(resolved, { recursive: true });

    const realResolved = await fs.realpath(resolved);
    if (!isWithinDirectory(realFilesDir, realResolved)) return null;
    if (await isRealPathInsideBlockedDirectories(paths, realResolved)) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    mode: 'directory',
    absolutePath: resolved,
    relativePath: path.relative(paths.filesDir, resolved).split(path.sep).join('/')
  };
}

function buildCandidateName(name: string, attempt: number): string {
  if (attempt === 0) return name;
  const extension = path.extname(name);
  const stem = name.slice(0, name.length - extension.length);
  const suffix = ` (${attempt})`;
  const maxStemLength = Math.max(1, 200 - extension.length - suffix.length);
  return `${stem.slice(0, maxStemLength)}${suffix}${extension}`;
}

/**
 * Moves the staged file into the visible directory without ever clobbering an
 * existing entry: hard links fail with EEXIST on collisions, so the loop
 * retries with `name (1).ext` style candidates. Falls back to an exclusive
 * copy across filesystems.
 */
export async function moveStagedFile(
  stagedPath: string,
  targetDirectory: string,
  desiredName: string
): Promise<string> {
  const maxAttempts = 1000;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = buildCandidateName(desiredName, attempt);
    const target = path.join(targetDirectory, candidate);
    try {
      await fs.link(stagedPath, target);
      await fs.unlink(stagedPath);
      return candidate;
    } catch (error) {
      if (errorWithCode(error, 'EEXIST')) continue;
      if (!errorWithCode(error, 'EXDEV')) throw error;
    }

    try {
      await fs.copyFile(stagedPath, target, fsConstants.COPYFILE_EXCL);
      await fs.unlink(stagedPath);
      return candidate;
    } catch (error) {
      if (errorWithCode(error, 'EEXIST')) continue;
      throw error;
    }
  }

  const fallback = `${Date.now()}-${desiredName}`;
  const fallbackPath = path.join(targetDirectory, fallback);
  if (await pathExists(fallbackPath)) {
    throw new Error('Too many files with the same name in the destination');
  }
  await fs.rename(stagedPath, fallbackPath);
  return fallback;
}

/**
 * Creates a directory inside the visible files area for the upload folder
 * picker. Rejects protected and hidden locations with the same rules as
 * uploads; an existing directory counts as success.
 */
export async function createVisibleDirectory(
  paths: RuntimePaths,
  relativePath: unknown
): Promise<{ created: boolean; relativePath: string } | null> {
  if (typeof relativePath !== 'string') return null;

  const normalized = normalizeRelativePath(relativePath);
  if (!normalized || !hasVisibleSegment(normalized)) return null;

  const resolved = resolveWithinDirectory(paths.filesDir, normalized);
  if (!resolved || resolved === path.resolve(paths.filesDir)) return null;

  // Check existence before resolveUploadDestination creates the chain.
  const preexistingStats = await fs.stat(resolved).catch(() => null);
  const alreadyExists = Boolean(preexistingStats && preexistingStats.isDirectory());

  const destination = await resolveUploadDestination(paths, normalized);
  if (!destination || destination.mode !== 'directory') return null;
  return { created: !alreadyExists, relativePath: destination.relativePath };
}
