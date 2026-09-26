import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SPA_SHELL_STUB_CONTENT = '<!-- Development SPA shell stub -->\n';
// Must match DEV_STUB_MARKER_FILENAME in src/backend/config/index.ts.
const DEV_STUB_MARKER_FILENAME = '.streamfile-dev-stub';

async function isDevelopmentStubContent(filePath) {
  try {
    return (await fs.readFile(filePath, 'utf-8')) === SPA_SHELL_STUB_CONTENT;
  } catch {
    return false;
  }
}

await ensureDevSpaShell();

const child = spawn('bun', ['run', 'dev'], {
  cwd: path.join(projectDirectory, 'src', 'backend'),
  env: process.env,
  stdio: 'inherit',
  shell: true
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

async function ensureDevSpaShell() {
  const publicDir = path.join(os.homedir(), '.local', 'stream-file-server', 'public');
  const stubs = ['index.html', '404-index.html'];

  for (const name of stubs) {
    if (await isDevelopmentStubContent(path.join(publicDir, name))) continue;
    try {
      await fs.access(path.join(publicDir, name));
      // The directory holds a real public override; leave it untouched.
      return;
    } catch {
      // Missing file: it will be created below.
    }
  }

  for (const name of stubs) {
    const filePath = path.join(publicDir, name);
    if (await isDevelopmentStubContent(filePath)) continue;
    await fs.mkdir(publicDir, { recursive: true });
    await fs.writeFile(filePath, SPA_SHELL_STUB_CONTENT, 'utf-8');
    console.log(`[backend_dev] Created stub public/${name} in ${publicDir} for development`);
  }

  const markerPath = path.join(publicDir, DEV_STUB_MARKER_FILENAME);
  try {
    await fs.access(markerPath);
  } catch {
    await fs.writeFile(
      markerPath,
      'Created by the StreamFile dev launchers so packaged servers ignore this stub directory.\nDelete this file to keep this directory as a real public override.\n',
      'utf-8'
    );
    console.log(`[backend_dev] Marked ${publicDir} as a development stub directory`);
  }
  console.log('[backend_dev] Note: packaged servers automatically ignore this stub directory');
}
