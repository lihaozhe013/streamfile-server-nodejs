import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const packageManager = 'pnpm';

await ensureDevSpaShell(projectDirectory);

const child = spawn(packageManager, ['--dir', 'src/backend', 'dev'], {
  cwd: projectDirectory,
  env: { ...process.env, STREAMFILE_ROOT_DIR: projectDirectory },
  stdio: 'inherit',
  shell: true,
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

async function ensureDevSpaShell(rootDir) {
  const publicDir = path.join(rootDir, 'public');
  const stubs = ['index.html', '404-index.html'];
  for (const name of stubs) {
    const filePath = path.join(publicDir, name);
    try {
      await fs.access(filePath);
    } catch {
      await fs.mkdir(publicDir, { recursive: true });
      await fs.writeFile(
        filePath,
        '<!-- Development SPA shell stub -->\n',
        'utf-8',
      );
      console.log(`[backend_dev] Created stub public/${name} for development`);
    }
  }
}
