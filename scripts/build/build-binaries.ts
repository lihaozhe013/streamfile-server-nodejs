import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { $ } from 'bun';

const projectDirectory = path.resolve(import.meta.dir, '..', '..');
const distDirectory = path.join(projectDirectory, 'dist');
const binDirectory = path.join(distDirectory, 'bin');

const targets = [
  { target: 'bun-windows-x64', suffix: 'windows-x64', extension: '.exe' },
  { target: 'bun-linux-x64', suffix: 'linux-x64', extension: '' },
  { target: 'bun-linux-arm64', suffix: 'linux-arm64', extension: '' },
  { target: 'bun-darwin-arm64', suffix: 'darwin-arm64', extension: '' }
] as const;

async function main(): Promise<void> {
  console.log('[binaries] Building dist/server.js and dist/public first');
  await $`bun run build`.cwd(projectDirectory);

  const version = (await Bun.file(path.join(projectDirectory, 'VERSION')).text()).trim();
  await fsPromises.rm(binDirectory, { recursive: true, force: true });
  await fsPromises.mkdir(binDirectory, { recursive: true });

  const previousCwd = process.cwd();
  process.chdir(distDirectory);
  try {
    for (const { target, suffix, extension } of targets) {
      const outfile = path.join(
        binDirectory,
        `streamfile-server-${version}-${suffix}${extension}`
      );
      const result = await Bun.build({
        entrypoints: ['./server.js'],
        compile: { target, outfile, assets: ['public'] },
        minify: true,
        sourcemap: 'none'
      });

      if (!result.success) {
        for (const log of result.logs) console.error(log);
        throw new Error(`[binaries] Compilation failed for ${target}`);
      }

      const size = (await fsPromises.stat(outfile)).size;
      console.log(`[binaries] Built ${path.basename(outfile)} (${Math.round(size / 1024 / 1024)} MB)`);
    }
  } finally {
    process.chdir(previousCwd);
  }

  console.log('[binaries] Verified standalone binaries');
}

await main();
