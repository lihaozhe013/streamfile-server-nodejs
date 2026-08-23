import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const backendDirectory = path.resolve(path.dirname(__filename), '..');
const projectDirectory = path.resolve(backendDirectory, '..', '..');
const isWatch = process.argv.includes('--watch');
const defaultConfigPath = path.join(backendDirectory, 'config', 'default.yaml');
const packagedConfigPath = path.join(projectDirectory, 'dist', 'default.yaml');

const buildOptions = {
  absWorkingDir: projectDirectory,
  entryPoints: ['src/backend/server.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2024',
  outfile: path.join(projectDirectory, 'dist', 'server.js'),
  sourcemap: false,
  minify: true,
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
};

async function packageDefaultConfig() {
  await fsPromises.mkdir(path.dirname(packagedConfigPath), { recursive: true });
  await fsPromises.copyFile(defaultConfigPath, packagedConfigPath);
}

if (isWatch) {
  const context = await esbuild.context(buildOptions);
  await packageDefaultConfig();
  await context.watch();
  console.log('[backend_build] Watching for changes...');
} else {
  await esbuild.build(buildOptions);
  await packageDefaultConfig();
}
