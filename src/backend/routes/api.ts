import fs from 'node:fs/promises';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import type { RuntimeConfig } from '@/types/index';
import {
  isAccessibleFilePath,
  isIncomingPath,
  isPrivatePath,
  isPrivateRealPath,
  isSafeExistingPath,
  listPublicDirectory,
  resolveWithinDirectory
} from '@/services/files';
import { searchFilesInPath } from '@/services/search';
import { createVisibleDirectory } from '@/services/upload';

export function createApiRouter(runtime: RuntimeConfig) {
  const router = express.Router();

  router.get('/api/features', (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.json(runtime.features);
  });

  router.get(
    '/api/markdown-content',
    asyncHandler(async (request, response) => {
      const filePath = getQueryString(request, 'path');
      if (!filePath) {
        response.status(400).json({ error: 'Path parameter is required' });
        return;
      }

      const fullPath = resolveWithinDirectory(runtime.paths.filesDir, filePath);
      if (!fullPath) {
        response.status(400).json({ error: 'Invalid path' });
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
      if (path.extname(fullPath).toLowerCase() !== '.md') {
        response.status(404).json({ error: 'File not found or not a markdown file' });
        return;
      }

      const blockedDirectories = runtime.features.privateFiles
        ? [runtime.paths.incomingDir]
        : [runtime.paths.incomingDir, runtime.paths.privateDir];
      if (!(await isAccessibleFilePath(runtime.paths.filesDir, fullPath, blockedDirectories))) {
        response.status(404).json({ error: 'File not found or not a markdown file' });
        return;
      }

      response.json({
        content: await fs.readFile(fullPath, 'utf8'),
        filename: path.basename(fullPath),
        path: path.relative(runtime.paths.filesDir, fullPath).split(path.sep).join('/')
      });
    })
  );

  router.get(
    '/api/list-files',
    asyncHandler(async (request, response) => {
      const relativePath = getQueryString(request, 'path') ?? '';
      const fullPath = resolveWithinDirectory(runtime.paths.filesDir, relativePath);
      if (!fullPath) {
        response.status(400).json({ error: 'Invalid path' });
        return;
      }
      if (
        isIncomingPath(runtime.paths, fullPath) ||
        isPrivatePath(runtime.paths, fullPath) ||
        (!runtime.features.privateFiles && (await isPrivateRealPath(runtime.paths, fullPath)))
      ) {
        response.status(403).json({ error: 'Access denied' });
        return;
      }
      if (!(await isSafeExistingPath(runtime.paths.filesDir, fullPath))) {
        response.status(500).json({ error: 'Failed to read directory' });
        return;
      }

      response.json(
        await listPublicDirectory(fullPath, runtime.paths, runtime.features.privateFiles)
      );
    })
  );

  const searchHandler = asyncHandler(async (request, response) => {
    const params = request.params as Record<string, string>;
    const fileName = getQueryString(request, 'q') ?? params[0] ?? undefined;
    const currentDir = getQueryString(request, 'dir') ?? params[1] ?? '';

    if (!fileName) {
      response.status(400).json({ error: 'file_name parameter is required' });
      return;
    }

    const searchPath = resolveWithinDirectory(runtime.paths.filesDir, currentDir);
    if (!searchPath) {
      response.json({ error: 'Invalid search path' });
      return;
    }
    if (
      isIncomingPath(runtime.paths, searchPath) ||
      isPrivatePath(runtime.paths, searchPath) ||
      (!runtime.features.privateFiles && (await isPrivateRealPath(runtime.paths, searchPath))) ||
      !(await isSafeExistingPath(runtime.paths.filesDir, searchPath))
    ) {
      response.json({ error: 'Invalid search path' });
      return;
    }

    const results = await searchFilesInPath(
      fileName,
      searchPath,
      runtime.paths,
      runtime.features.privateFiles
    );
    response.json({
      query: { file_name: fileName, current_dir: currentDir },
      results,
      count: results.length
    });
  });

  router.post(
    '/api/mkdir',
    (_request, response, next) => {
      if (!runtime.features.upload) {
        response.status(403).json({ error: 'Uploads are disabled' });
        return;
      }
      next();
    },
    express.json({ limit: '16kb' }),
    asyncHandler(async (request, response) => {
      const body = request.body;
      const relativePath =
        typeof body === 'object' && body !== null && 'path' in body
          ? (body as { path: unknown }).path
          : undefined;

      const created = await createVisibleDirectory(runtime.paths, relativePath);
      if (!created) {
        response.status(400).json({ error: 'Invalid directory path' });
        return;
      }

      response.json(created);
    })
  );

  router.get('/api/search', searchHandler);
  router.get(/^\/api\/search\/file_name=([^/]+)\/current_dir=(.*)$/, searchHandler);

  return router;
}

function getQueryString(request: Request, key: string): string | undefined {
  const value = request.query[key];
  return typeof value === 'string' ? value : undefined;
}

function asyncHandler(handler: (request: Request, response: Response) => Promise<void>) {
  return (request: Request, response: Response, next: (error?: unknown) => void) => {
    void handler(request, response).catch(next);
  };
}
