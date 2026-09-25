import fsPromises from 'node:fs/promises';
import path from 'node:path';

const backendDirectory = path.resolve(import.meta.dir, '..');
const projectDirectory = path.resolve(backendDirectory, '..', '..');
const distDirectory = path.join(projectDirectory, 'dist');
const serverOutfile = path.join(distDirectory, 'server.js');
const defaultConfigPath = path.join(backendDirectory, 'config', 'default.yaml');
const packagedConfigPath = path.join(distDirectory, 'default.yaml');

async function packageDefaultConfig(): Promise<void> {
  await fsPromises.mkdir(distDirectory, { recursive: true });
  await fsPromises.copyFile(defaultConfigPath, packagedConfigPath);
}

const result = await Bun.build({
  entrypoints: [path.join(backendDirectory, 'server.ts')],
  target: 'bun',
  format: 'esm',
  minify: true,
  sourcemap: 'none',
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  throw new Error('[backend_build] Bun bundling failed');
}

const [artifact] = result.outputs;
if (!artifact) throw new Error('[backend_build] Bun produced no output');

await fsPromises.mkdir(distDirectory, { recursive: true });
await Bun.write(serverOutfile, artifact);
await packageDefaultConfig();

console.log(`[backend_build] Bundled server.ts to ${serverOutfile}`);