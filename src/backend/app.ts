import express, { type Express } from 'express';
import type { RuntimeConfig } from '@/types/index';
import { errorHandler } from '@/middleware/errors';
import { createApiRouter } from '@/routes/api';
import { createFilesRouter, sendSpaShell } from '@/routes/files';
import { createPublicAssetRouter } from '@/services/publicAssets';
import { createUploadRouter } from '@/routes/upload';

export function createApp(runtime: RuntimeConfig): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(createFilesRouter(runtime));
  app.use(createApiRouter(runtime));
  app.use(createUploadRouter(runtime));
  app.use(createPublicAssetRouter(runtime.paths));
  app.use('/public', createPublicAssetRouter(runtime.paths));

  app.get('/{*splat}', async (request, response, next) => {
    if (request.path === '/api' || request.path.startsWith('/api/')) {
      response.status(404).json({ error: 'API endpoint not found' });
      return;
    }

    try {
      await sendSpaShell(response, runtime);
    } catch (error) {
      next(error);
    }
  });

  app.use(errorHandler);
  return app;
}
