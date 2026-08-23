import { spawn } from 'node:child_process';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const packageManager = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const backendUrl = process.env.BACKEND_URL ?? 'http://127.0.0.1:3000';

const commands = [
  {
    label: 'backend',
    args: ['--dir', 'src/backend', 'dev'],
    env: { ...process.env, STREAMFILE_ROOT_DIR: projectDirectory },
  },
  {
    label: 'frontend',
    args: ['--dir', 'src/frontend/app', 'dev'],
    env: { ...process.env, BACKEND_URL: backendUrl },
  },
];

const children = [];
let shuttingDown = false;
let exitCode = 0;

function writePrefixed(label, chunk) {
  const lines = String(chunk).split(/(?<=\n)/);
  for (const line of lines) {
    if (line) process.stdout.write(`[${label}] ${line}`);
  }
}

function stopChildren(signal = 'SIGTERM') {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const command of commands) {
  const child = spawn(packageManager, command.args, {
    cwd: projectDirectory,
    env: command.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  children.push(child);

  child.stdout.on('data', (chunk) => writePrefixed(command.label, chunk));
  child.stderr.on('data', (chunk) => writePrefixed(command.label, chunk));
  child.on('error', (error) => {
    console.error(
      `[global_dev] ${command.label} failed to start: ${error.message}`,
    );
    exitCode = 1;
    stopChildren();
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    if (code !== 0) {
      exitCode = code ?? 1;
      console.error(
        `[global_dev] ${command.label} exited with ${signal ?? `code ${code}`}`,
      );
    }
    stopChildren();
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => stopChildren(signal));
}

await new Promise((resolve) => {
  let remaining = children.length;
  for (const child of children) {
    child.once('exit', () => {
      remaining -= 1;
      if (remaining === 0) resolve();
    });
  }
});

process.exitCode = exitCode;
