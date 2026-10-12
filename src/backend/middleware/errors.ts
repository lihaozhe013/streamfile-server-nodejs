import multer from 'multer';
import type { ErrorRequestHandler } from 'express';
import { ReportableError } from '@/utils/reportableError';

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) return next(error);

  if (error instanceof multer.MulterError) {
    // Client mistakes (unexpected field, part limits); messages carry no
    // server-side details.
    return response.status(400).json({ error: error.message });
  }

  if (error instanceof ReportableError) {
    return response.status(error.status).json({ error: error.message });
  }

  // Unexpected internal failures may contain filesystem details; summarize
  // them for the client and keep the real error on the server-side log.
  const detail = error instanceof Error ? error.message : 'Internal server error';
  console.error(`[backend_error] ${detail}`);
  return response.status(500).json({ error: 'Internal server error' });
};
