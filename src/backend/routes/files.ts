import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import type { Request, Response, Router } from 'express';
import type { RuntimeConfig } from '@/types/index';
import {
  decodeRoutePath,
  isAccessibleFilePath,
  isIncomingPath,
  isPrivatePath,
  isPrivateRealPath,
  isSafeExistingPath,
  resolveWithinDirectory
} from '@/services/files';
import { isMediaExtension } from '@/utils/isMediaExtension';
import { sendPublicFile } from '@/services/publicAssets';
import {
  LARGE_TRANSFER_BYTES,
  PROXY_TRANSFER_BYTES_PER_SECOND,
  PublicTrafficLimits,
  sendTrafficLimitResponse
} from '@/services/publicTrafficLimits';

export function createFilesRouter(
  runtime: RuntimeConfig,
  trafficLimits: PublicTrafficLimits | null = null
): Router {
  const router = express.Router();

  router.get(/^\/files(?:\/.*)?$/, async (request, response, next) => {
    try {
      await handleFileRequest(request, response, runtime, trafficLimits);
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
  trafficLimits: PublicTrafficLimits | null
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
  if (!runtime.features.privateFiles && isPrivatePath(runtime.paths, fullPath)) {
    response.status(403).json({ error: 'Access denied' });
    return;
  }

  const stats = await fs.stat(fullPath).catch(() => null);
  if (!stats) {
    await sendNotFoundPage(response, runtime);
    return;
  }

  if (stats.isDirectory()) {
    if (
      !(await isSafeExistingPath(runtime.paths.filesDir, fullPath)) ||
      (!runtime.features.privateFiles && (await isPrivateRealPath(runtime.paths, fullPath)))
    ) {
      await sendNotFoundPage(response, runtime);
      return;
    }

    const customIndexPath = path.join(fullPath, 'index.html');
    if (await isSafeExistingPath(runtime.paths.filesDir, customIndexPath)) {
      const customIndexStats = await fs.stat(customIndexPath);
      await sendDataFile(request, response, customIndexPath, customIndexStats.size, trafficLimits);
      return;
    }

    await sendSpaShell(response, runtime);
    return;
  }

  const blockedDirectories = runtime.features.privateFiles
    ? [runtime.paths.incomingDir]
    : [runtime.paths.incomingDir, runtime.paths.privateDir];
  if (!(await isAccessibleFilePath(runtime.paths.filesDir, fullPath, blockedDirectories))) {
    await sendNotFoundPage(response, runtime);
    return;
  }

  if (request.query.raw === '1') {
    await sendDataFile(request, response, fullPath, stats.size, trafficLimits);
    return;
  }

  const extension = path.extname(fullPath).toLowerCase();
  if (extension === '.md' || isMediaExtension(extension)) {
    await sendSpaShell(response, runtime);
    return;
  }

  await sendDataFile(request, response, fullPath, stats.size, trafficLimits);
}

async function sendDataFile(
  request: Request,
  response: Response,
  filePath: string,
  fileSize: number,
  trafficLimits: PublicTrafficLimits | null
): Promise<void> {
  if (!trafficLimits || request.method === 'HEAD' || fileSize <= LARGE_TRANSFER_BYTES) {
    await sendFile(response, filePath);
    return;
  }

  const release = trafficLimits.acquireTransfer(request, response);
  if (!release) {
    sendTrafficLimitResponse(response);
    return;
  }
  response.setHeader('X-Accel-Limit-Rate', String(PROXY_TRANSFER_BYTES_PER_SECOND));
  response.setHeader('X-Accel-Buffering', 'yes');
  try {
    await sendFile(response, filePath);
  } finally {
    release();
  }
}

export function sendFile(response: Response, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Home-based data paths contain dot directories (e.g. ~/.local), which
    // send would otherwise hide behind its dotfile protection.
    response.sendFile(filePath, { dotfiles: 'allow' }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function sendNotFoundPage(response: Response, runtime: RuntimeConfig): Promise<void> {
  response.status(404);
  await sendPublicFile(response, runtime.paths, runtime.paths.notFoundPath);
}

export async function sendSpaShell(response: Response, runtime: RuntimeConfig): Promise<void> {
  if (!runtime.paths.publicEmbedded) {
    try {
      await fs.access(runtime.paths.spaShellPath);
    } catch {
      throw new Error(
        `SPA shell is missing at ${runtime.paths.spaShellPath}. Run bun run build before starting the production server.`
      );
    }
  }
  await sendPublicFile(response, runtime.paths, runtime.paths.spaShellPath);
}
