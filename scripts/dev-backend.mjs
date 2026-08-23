import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const packageManager = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const child = spawn(packageManager, ['--dir', 'src/backend', 'dev'], {
  cwd: projectDirectory,
  env: { ...process.env, STREAMFILE_ROOT_DIR: projectDirectory },
  stdio: 'inherit',
});

let shuttingDown = false;

function stopChild(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!child.killed) child.kill(signal);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => stopChild(signal));
}

child.on('error', (error) => {
  console.error(`[backend_dev] Failed to start: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (shuttingDown) return;
  process.exitCode = code ?? (signal ? 1 : 0);
});
