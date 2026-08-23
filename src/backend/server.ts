import { createApp } from '@/app';
import {
  ensureRuntimeDirectories,
  getLocalIp,
  loadRuntimeConfig,
} from '@/config';
import { appendDebugLog } from '@/utils/logger';

const runtime = await loadRuntimeConfig();
await ensureRuntimeDirectories(runtime);

const app = createApp(runtime);
const server = app.listen(runtime.server.port, runtime.server.host, () => {
  const host =
    runtime.server.host === '0.0.0.0' ? getLocalIp() : runtime.server.host;
  void appendDebugLog(
    runtime.paths.rootDir,
    `[backend_server] Server started: http://${host}:${runtime.server.port}`,
  );
});

let shuttingDown = false;
const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  void appendDebugLog(
    runtime.paths.rootDir,
    `[backend_server] Received ${signal}, shutting down`,
  );
  server.close((error) => {
    if (error) {
      void appendDebugLog(
        runtime.paths.rootDir,
        `[backend_server] Shutdown failed: ${error.message}`,
      );
      process.exitCode = 1;
    }
  });
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
