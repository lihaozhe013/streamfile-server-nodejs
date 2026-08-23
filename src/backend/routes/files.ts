import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import type { Request, Response, Router } from 'express';
import type { RuntimeConfig } from '@/types/index';
import {
  decodeRoutePath,
  isAccessibleFilePath,
  isIncomingPath,
  isSafeExistingPath,
  resolveWithinDirectory,
} from '@/services/files';
import { isMediaExtension } from '@/utils/isMediaExtension';

export function createFilesRouter(runtime: RuntimeConfig): Router {
  const router = express.Router();

  router.get(/^\/files(?:\/.*)?$/, async (request, response, next) => {
    try {
      await handleFileRequest(request, response, runtime);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

async function handleFileRequest(
  request: Request,
  response: Response,
  runtime: RuntimeConfig,
): Promise<void> {
  const rawRelativePath = request.path.slice('/files'.length);
  const relativePath = decodeRoutePath(rawRelativePath);
  if (relativePath === null) {
    response.status(400).json({ error: 'Invalid file path' });
    return;
  }

  const fullPath = resolveWithinDirectory(runtime.paths.filesDir, relativePath);
  if (!fullPath) {
    response.status(403).json({ error: 'Access denied' });
    return;
  }

  if (isIncomingPath(runtime.paths, fullPath)) {
    response.status(403).json({ error: 'Access denied' });
    return;
  }

  const stats = await fs.stat(fullPath).catch(() => null);
  if (!stats) {
    response.status(404).sendFile(runtime.paths.notFoundPath);
    return;
  }

  if (stats.isDirectory()) {
    if (!(await isSafeExistingPath(runtime.paths.filesDir, fullPath))) {
      response.status(404).sendFile(runtime.paths.notFoundPath);
      return;
    }

    const customIndexPath = path.join(fullPath, 'index.html');
    if (await isSafeExistingPath(runtime.paths.filesDir, customIndexPath)) {
      await sendFile(response, customIndexPath);
      return;
    }

    await sendSpaShell(response, runtime);
    return;
  }

  if (
    !(await isAccessibleFilePath(runtime.paths.filesDir, fullPath, [
      runtime.paths.incomingDir,
    ]))
  ) {
    response.status(404).sendFile(runtime.paths.notFoundPath);
    return;
  }

  if (request.query.raw === '1') {
    await sendFile(response, fullPath);
    return;
  }

  const extension = path.extname(fullPath).toLowerCase();
  if (extension === '.md' || isMediaExtension(extension)) {
    await sendSpaShell(response, runtime);
    return;
  }

  await sendFile(response, fullPath);
}

export function sendFile(response: Response, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    response.sendFile(filePath, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function sendSpaShell(
  response: Response,
  runtime: RuntimeConfig,
): Promise<void> {
  try {
    await fs.access(runtime.paths.spaShellPath);
  } catch {
    throw new Error(
      `SPA shell is missing at ${runtime.paths.spaShellPath}. Run pnpm build before starting the production server.`,
    );
  }
  await sendFile(response, runtime.paths.spaShellPath);
}
