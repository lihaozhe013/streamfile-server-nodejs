import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { $ } from 'bun';

const projectDirectory = path.resolve(import.meta.dir, '..', '..');
const distDirectory = path.join(projectDirectory, 'dist');

const requiredArtifacts = [
  path.join(distDirectory, 'server.js'),
  path.join(distDirectory, 'default.yaml'),
  path.join(distDirectory, 'public', 'index.html'),
  path.join(distDirectory, 'public', '404-index.html'),
];

async function cleanBuildOwnedArtifacts(): Promise<void> {
  await fsPromises.rm(path.join(distDirectory, 'public'), {
    recursive: true,
    force: true,
  });
  await fsPromises.rm(path.join(distDirectory, 'server.js'), { force: true });
  await fsPromises.rm(path.join(distDirectory, 'default.yaml'), { force: true });
}

async function verifyArtifacts(): Promise<void> {
  for (const artifact of requiredArtifacts) {
    try {
      await fsPromises.access(artifact);
    } catch {
      throw new Error(`[build] Required artifact is missing: ${artifact}`);
    }
  }
}

await cleanBuildOwnedArtifacts();

console.log('[build] Typechecking backend');
await $`bun run --cwd src/backend typecheck`.cwd(projectDirectory);

console.log('[build] Bundling backend');
await $`bun run --cwd src/backend build`.cwd(projectDirectory);

console.log('[build] Typechecking frontend');
await $`bun run --cwd src/frontend/app typecheck`.cwd(projectDirectory);

console.log('[build] Building frontend');
await $`bun run --cwd src/frontend/app build`.cwd(projectDirectory);

await verifyArtifacts();
console.log('[build] Verified production artifacts');