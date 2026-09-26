import path from 'node:path';
import fs from 'node:fs/promises';
import express, { type Request } from 'express';
import multer from 'multer';
import type { RuntimeConfig } from '@/types/index';
import {
  isInvalidDestination,
  moveStagedFile,
  resolveUploadDestination,
  type ResolvedUploadDestination
} from '@/services/upload';
import { appendDebugLog } from '@/utils/logger';

function encodeFileUrl(relativePath: string): string {
  return `/files/${relativePath.split('/').filter(Boolean).map(encodeURIComponent).join('/')}`;
}

export function createUploadRouter(runtime: RuntimeConfig) {
  const router = express.Router();
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_request, _file, callback) => {
        callback(null, runtime.paths.incomingDir);
      },
      filename: (_request, file, callback) => {
        const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const safeName = path.basename(decodedName.replaceAll('\\', '/'));
        callback(null, safeName || `upload-${Date.now()}`);
      }
    })
  });

  router.post('/upload', (_request, response, next) => {
    if (!runtime.features.upload) {
      response.status(403).json({ error: 'Uploads are disabled' });
      return;
    }
    next();
  });

  router.post('/upload', upload.single('file'), async (request: Request, response) => {
    if (!request.file) {
      response.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const stagedPath = request.file.path;
    const stagedName = request.file.filename;

    const fail = (status: number, message: string) => {
      // Never leave a rejected upload behind in the staging directory.
      void fs.unlink(stagedPath).catch(() => undefined);
      void appendDebugLog(
        runtime.paths.dataRoot,
        `[upload] result=rejected status=${status} bytes=${request.file?.size ?? 0}`
      );
      response.status(status).json({ error: message });
    };

    let destination: ResolvedUploadDestination;
    try {
      destination = await resolveUploadDestination(runtime.paths, request.body?.destination);
    } catch {
      fail(500, 'Failed to resolve upload destination');
      return;
    }

    if (isInvalidDestination(destination)) {
      fail(400, 'Invalid upload destination');
      return;
    }

    if (destination.mode === 'incoming') {
      void appendDebugLog(
        runtime.paths.dataRoot,
        `[upload] result=ok target=incoming bytes=${request.file.size}`
      );
      response.send({
        message: 'File uploaded successfully!',
        file: request.file
      });
      return;
    }

    try {
      const finalName = await moveStagedFile(stagedPath, destination.absolutePath, stagedName);
      request.file.destination = destination.absolutePath;
      request.file.filename = finalName;
      request.file.path = path.join(destination.absolutePath, finalName);
      const relativePath = [destination.relativePath, finalName].filter(Boolean).join('/');
      void appendDebugLog(
        runtime.paths.dataRoot,
        `[upload] result=ok target=visible renamed=${
          finalName !== stagedName
        } bytes=${request.file.size}`
      );
      response.send({
        message: 'File uploaded successfully!',
        file: request.file,
        relativePath,
        url: encodeFileUrl(relativePath)
      });
    } catch {
      fail(500, 'Failed to store the uploaded file');
    }
  });

  return router;
}
