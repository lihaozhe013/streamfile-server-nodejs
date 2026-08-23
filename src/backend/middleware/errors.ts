import multer from 'multer';
import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  next,
) => {
  if (response.headersSent) return next(error);

  if (error instanceof multer.MulterError) {
    return response.status(400).json({ error: error.message });
  }

  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : 500;
  const message =
    error instanceof Error ? error.message : 'Internal server error';

  if (status >= 500) console.error(`[backend_error] ${message}`);
  return response.status(status >= 400 && status < 600 ? status : 500).json({
    error: message,
  });
};
