import fs from 'node:fs/promises';
import path from 'node:path';
import express, { type Router } from 'express';
import type { RuntimeConfig } from '@/types/index';
import {
  isAccessibleFilePath,
  isIncomingPath,
  isPrivatePath,
  resolveWithinDirectory
} from '@/services/files';
import {
  LARGE_TRANSFER_BYTES,
  PROXY_TRANSFER_BYTES_PER_SECOND,
  PublicTrafficLimits,
  sendTrafficLimitResponse
} from '@/services/publicTrafficLimits';
import { convertSrtToVtt, MAX_SUBTITLE_BYTES, type SubtitleEncoding } from '@/services/subtitles';

const subtitleEncodings = new Set<SubtitleEncoding>(['auto', 'utf-8', 'gb18030']);

export function createSubtitlesRouter(
  runtime: RuntimeConfig,
  trafficLimits: PublicTrafficLimits | null = null
): Router {
  const router = express.Router();

  router.get('/api/subtitle-vtt', async (request, response, next) => {
    try {
      const relativePath = request.query.path;
      const encodingValue = request.query.encoding ?? 'auto';
      if (
        typeof relativePath !== 'string' ||
        !relativePath.trim() ||
        typeof encodingValue !== 'string' ||
        !subtitleEncodings.has(encodingValue as SubtitleEncoding)
      ) {
        response.status(400).json({ error: 'Invalid subtitle request' });
        return;
      }

      const fullPath = resolveWithinDirectory(runtime.paths.filesDir, relativePath);
      if (!fullPath || path.extname(fullPath).toLowerCase() !== '.srt') {
        response.status(400).json({ error: 'Invalid subtitle path' });
        return;
      }
      if (
        isIncomingPath(runtime.paths, fullPath) ||
        (!runtime.features.privateFiles && isPrivatePath(runtime.paths, fullPath))
      ) {
        response.status(403).json({ error: 'Access denied' });
        return;
      }

      const blockedDirectories = runtime.features.privateFiles
        ? [runtime.paths.incomingDir]
        : [runtime.paths.incomingDir, runtime.paths.privateDir];
      if (!(await isAccessibleFilePath(runtime.paths.filesDir, fullPath, blockedDirectories))) {
        response.status(404).json({ error: 'Subtitle not found' });
        return;
      }

      const stats = await fs.stat(fullPath).catch(() => null);
      if (!stats) {
        response.status(404).json({ error: 'Subtitle not found' });
        return;
      }
      if (stats.size > MAX_SUBTITLE_BYTES) {
        response.status(413).json({ error: 'Subtitle file is too large' });
        return;
      }

      response.setHeader('Cache-Control', 'no-store');
      const release =
        trafficLimits && request.method !== 'HEAD' && stats.size > LARGE_TRANSFER_BYTES
          ? trafficLimits.acquireTransfer(request, response)
          : undefined;
      if (release === null) {
        sendTrafficLimitResponse(response);
        return;
      }

      try {
        const file = await fs.open(fullPath, 'r');
        let bytes: Uint8Array;
        try {
          let length = 0;
          const chunks: Buffer[] = [];
          while (length <= MAX_SUBTITLE_BYTES) {
            const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, MAX_SUBTITLE_BYTES + 1 - length));
            const read = await file.read(chunk, 0, chunk.length, length);
            if (read.bytesRead === 0) break;
            chunks.push(chunk.subarray(0, read.bytesRead));
            length += read.bytesRead;
          }
          if (length > MAX_SUBTITLE_BYTES) {
            release?.();
            response.status(413).json({ error: 'Subtitle file is too large' });
            return;
          }
          bytes = Buffer.concat(chunks, length);
        } finally {
          await file.close();
        }

        const vtt = convertSrtToVtt(bytes, encodingValue as SubtitleEncoding);
        if (vtt === null) {
          release?.();
          response.status(422).json({ error: 'Invalid subtitle file or encoding' });
          return;
        }
        response.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        if (request.method === 'HEAD') {
          response.status(200).end();
          return;
        }
        if (release) {
          response.setHeader('X-Accel-Limit-Rate', String(PROXY_TRANSFER_BYTES_PER_SECOND));
          response.setHeader('X-Accel-Buffering', 'yes');
        }
        response.send(vtt);
      } catch (error) {
        release?.();
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          response.status(404).json({ error: 'Subtitle not found' });
          return;
        }
        throw error;
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}
