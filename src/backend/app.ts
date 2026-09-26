import express, { type Express } from 'express';
import type { RuntimeConfig } from '@/types/index';
import { errorHandler } from '@/middleware/errors';
import { createApiRouter } from '@/routes/api';
import { createFilesRouter, sendSpaShell } from '@/routes/files';
import { createSubtitlesRouter } from '@/routes/subtitles';
import { createPublicAssetRouter } from '@/services/publicAssets';
import { createUploadRouter } from '@/routes/upload';
import { PublicTrafficLimits } from '@/services/publicTrafficLimits';

export function createApp(runtime: RuntimeConfig): Express {
  const app = express();
  app.disable('x-powered-by');
  const trafficLimits = runtime.features.publicTrafficLimits ? new PublicTrafficLimits() : null;
  if (trafficLimits) {
    app.set('trust proxy', 1);
    app.use(trafficLimits.middleware);
  }

  app.use(createFilesRouter(runtime, trafficLimits));
  app.use(createApiRouter(runtime, trafficLimits));
  app.use(createSubtitlesRouter(runtime, trafficLimits));
  app.use(createUploadRouter(runtime));
  if (!runtime.features.homePage) {
    app.get('/', (_request, response) => response.redirect(302, '/files/'));
  }
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
