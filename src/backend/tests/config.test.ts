import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { ensureRuntimeDirectories, loadRuntimeConfig } from '@/config';

async function createTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'streamfile-config-'));
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

test('generates a default config and runtime directories when missing', async () => {
  const rootDir = await createTempRoot();
  try {
    const sourcePublicDir = path.join(rootDir, 'src/frontend/public');
    await fs.mkdir(sourcePublicDir, { recursive: true });
    await fs.writeFile(
      path.join(sourcePublicDir, 'index.html'),
      '<!doctype html><title>SPA</title>',
    );
    await fs.writeFile(
      path.join(sourcePublicDir, '404-index.html'),
      '<!doctype html><title>404</title>',
    );

    const runtime = await loadRuntimeConfig({ rootDir });
    assert.equal(runtime.configPath, path.join(rootDir, 'config.yaml'));
    assert.equal(runtime.server.port, 3000);
    assert.equal(runtime.paths.publicDir, sourcePublicDir);
    assert.match(
      await fs.readFile(runtime.configPath, 'utf8'),
      /directories:\n  public: "public"/,
    );

    await ensureRuntimeDirectories(runtime);
    await Promise.all(
      [
        runtime.paths.filesDir,
        runtime.paths.incomingDir,
        runtime.paths.privateDir,
      ].map(async (directory) => {
        assert.equal(await pathExists(directory), true);
      }),
    );
    assert.match(
      await fs.readFile(path.join(rootDir, 'debug.log'), 'utf8'),
      /\[backend_config\] Generated config\.yaml/,
    );
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

test('does not overwrite an existing config', async () => {
  const rootDir = await createTempRoot();
  try {
    const configPath = path.join(rootDir, 'config.yaml');
    const config = `server:
  host: "127.0.0.1"
  port: 4310

directories:
  public: "custom-public"
  upload: "shared-files"
  incoming: "shared-files/incoming"
  private: "shared-files/private-files"
`;
    await fs.writeFile(configPath, config);

    const runtime = await loadRuntimeConfig({ rootDir });
    assert.equal(runtime.server.host, '127.0.0.1');
    assert.equal(runtime.server.port, 4310);
    assert.equal(await fs.readFile(configPath, 'utf8'), config);
    assert.equal(await pathExists(path.join(rootDir, 'debug.log')), false);
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

test('preserves an invalid existing config for correction', async () => {
  const rootDir = await createTempRoot();
  try {
    const configPath = path.join(rootDir, 'config.yaml');
    const invalidConfig = 'server: []\n';
    await fs.writeFile(configPath, invalidConfig);

    await assert.rejects(
      loadRuntimeConfig({ rootDir }),
      /Invalid config: server and directories are required/,
    );
    assert.equal(await fs.readFile(configPath, 'utf8'), invalidConfig);
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

test('handles concurrent first-start config generation', async () => {
  const rootDir = await createTempRoot();
  try {
    const runtimes = await Promise.all(
      Array.from({ length: 2 }, () => loadRuntimeConfig({ rootDir })),
    );
    assert.equal(runtimes[0]?.configPath, path.join(rootDir, 'config.yaml'));
    assert.equal(runtimes[1]?.server.port, 3000);
    assert.equal(
      (await fs.readFile(path.join(rootDir, 'config.yaml'), 'utf8')).length > 0,
      true,
    );
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});
