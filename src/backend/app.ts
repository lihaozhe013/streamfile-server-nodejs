import express, { type Express } from 'express';
import type { RuntimeConfig } from '@/types/index';
import { errorHandler } from '@/middleware/errors';
import { createApiRouter } from '@/routes/api';
import { createFilesRouter, sendSpaShell } from '@/routes/files';
import { createUploadRouter } from '@/routes/upload';

export function createApp(runtime: RuntimeConfig): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(createFilesRouter(runtime));
  app.use(createApiRouter(runtime));
  app.use(createUploadRouter(runtime));
  app.use(express.static(runtime.paths.publicDir));
  app.use('/public', express.static(runtime.paths.publicDir));

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
