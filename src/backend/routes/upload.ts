import path from 'node:path';
import express, { type Request } from 'express';
import multer from 'multer';
import type { RuntimeConfig } from '@/types/index';

export function createUploadRouter(runtime: RuntimeConfig) {
  const router = express.Router();
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_request, _file, callback) => {
        callback(null, runtime.paths.incomingDir);
      },
      filename: (_request, file, callback) => {
        const decodedName = Buffer.from(file.originalname, 'latin1').toString(
          'utf8',
        );
        const safeName = path.basename(decodedName.replaceAll('\\', '/'));
        callback(null, safeName || `upload-${Date.now()}`);
      },
    }),
  });

  router.post(
    '/upload',
    upload.single('file'),
    (request: Request, response) => {
      if (!request.file) {
        response.status(400).json({ error: 'No file uploaded' });
        return;
      }
      response.send({
        message: 'File uploaded successfully!',
        file: request.file,
      });
    },
  );

  return router;
}
