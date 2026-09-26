import fsSync from 'node:fs';
import path from 'node:path';
import express, { type Response, type Router } from 'express';
import type { RuntimePaths } from '@/types/index';

const MIME_TYPES: Record<string, string> = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8'
};

function mimeTypeFor(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Files inside a standalone executable are reachable through node:fs metadata
 * APIs and Bun.file, but not through streaming APIs used by express.static and
 * res.sendFile, so embedded assets are read into memory and sent directly.
 */
export function sendPublicFile(
  response: Response,
  paths: RuntimePaths,
  filePath: string
): Promise<void> {
  if (!paths.publicEmbedded) {
    return new Promise((resolve, reject) => {
      // Home-based data paths contain dot directories (e.g. ~/.local), which
      // send would otherwise hide behind its dotfile protection.
      response.sendFile(filePath, { dotfiles: 'allow' }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  return sendEmbeddedFile(response, filePath);
}

async function sendEmbeddedFile(response: Response, filePath: string): Promise<void> {
  const contents = await Bun.file(filePath).arrayBuffer();
  if (response.headersSent) return;
  response.setHeader('Content-Type', mimeTypeFor(filePath));
  response.setHeader('Content-Length', String(contents.byteLength));
  response.send(Buffer.from(contents));
}

export function createPublicAssetRouter(paths: RuntimePaths): Router {
  const router = express.Router();
  if (!paths.publicEmbedded) {
    router.use(express.static(paths.publicDir));
    return router;
  }

  const manifest = collectEmbeddedFiles(paths.publicDir);

  router.get(/^\/.*$/, async (request, response, next) => {
    try {
      const relativePath = resolveRequestedAsset(request.path);
      if (relativePath === null) {
        response.status(400).json({ error: 'Invalid asset path' });
        return;
      }

      const candidate = manifest.has(relativePath)
        ? relativePath
        : manifest.has(`${relativePath}/index.html`)
          ? `${relativePath}/index.html`
          : null;

      if (candidate === null) {
        next();
        return;
      }

      await sendEmbeddedFile(response, path.join(paths.publicDir, candidate));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function resolveRequestedAsset(requestPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }

  if (!decoded.startsWith('/')) return null;
  const normalized = path.posix.normalize(decoded);
  if (normalized.includes('..')) return null;
  return normalized.replace(/^\/+/, '').split(path.sep).join('/');
}

function collectEmbeddedFiles(root: string): Set<string> {
  const files = new Set<string>();
  const visit = (directory: string): void => {
    for (const entry of fsSync.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile()) {
        files.add(path.relative(root, entryPath).split(path.sep).join('/'));
      }
    }
  };
  visit(root);
  return files;
}
