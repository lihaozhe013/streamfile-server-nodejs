import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { DEV_STUB_MARKER_FILENAME, ensureRuntimeDirectories, loadRuntimeConfig } from '@/config';

async function createTempHome(): Promise<string> {
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

test('generates a default config under the home directories when missing', async () => {
  const homeDir = await createTempHome();
  try {
    const runtime = await loadRuntimeConfig({ homeDir });
    const configPath = path.join(homeDir, '.config', 'stream-file-server', 'config.yaml');
    const dataRoot = path.join(homeDir, '.local', 'stream-file-server');

    assert.equal(runtime.configPath, configPath);
    assert.equal(runtime.server.port, 3000);
    assert.deepEqual(runtime.features, {
      upload: true,
      privateFiles: true,
      homePage: true,
      publicTrafficLimits: false
    });
    assert.equal(runtime.paths.dataRoot, dataRoot);
    assert.equal(runtime.paths.publicDir, path.join(dataRoot, 'public'));
    assert.equal(runtime.paths.publicEmbedded, false);
    assert.equal(runtime.paths.filesDir, path.join(dataRoot, 'files'));
    assert.match(
      await fs.readFile(configPath, 'utf8'),
      /directories:\n  public: "~\/\.local\/stream-file-server\/public"/
    );

    await ensureRuntimeDirectories(runtime);
    await Promise.all(
      [runtime.paths.filesDir, runtime.paths.incomingDir, runtime.paths.privateDir].map(
        async (directory) => {
          assert.equal(await pathExists(directory), true);
        }
      )
    );
    assert.match(
      await fs.readFile(path.join(dataRoot, 'debug.log'), 'utf8'),
      /\[backend_config\] Generated config\.yaml/
    );
  } finally {
    await fs.rm(homeDir, { recursive: true, force: true });
  }
});

test('honors an explicit config path', async () => {
  const homeDir = await createTempHome();
  const runtimeDir = path.join(homeDir, 'runtime');
  try {
    await fs.mkdir(runtimeDir, { recursive: true });
    const configPath = path.join(runtimeDir, 'custom-config.yaml');

    const runtime = await loadRuntimeConfig({ homeDir, configPath });
    assert.equal(runtime.configPath, configPath);
    assert.equal(await pathExists(configPath), true);
    assert.equal(
      await pathExists(path.join(homeDir, '.config', 'stream-file-server', 'config.yaml')),
      false
    );
  } finally {
    await fs.rm(homeDir, { recursive: true, force: true });
  }
});

test('expands home and resolves relative directories against the data root', async () => {
  const homeDir = await createTempHome();
  try {
    const configPath = path.join(homeDir, '.config', 'stream-file-server', 'config.yaml');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    const absolutePrivate = path.resolve(homeDir, 'absolute-private');
    await fs.writeFile(
      configPath,
      `server:
  host: "127.0.0.1"
  port: 4310

directories:
  public: "~/custom-public"
  upload: "files"
  incoming: "files/incoming"
  private: ${JSON.stringify(absolutePrivate)}
`
    );

    const runtime = await loadRuntimeConfig({ homeDir });
    const dataRoot = path.join(homeDir, '.local', 'stream-file-server');
    assert.equal(runtime.server.port, 4310);
    assert.deepEqual(runtime.features, {
      upload: true,
      privateFiles: true,
      homePage: true,
      publicTrafficLimits: false
    });
    assert.equal(runtime.paths.publicDir, path.join(homeDir, 'custom-public'));
    assert.equal(runtime.paths.filesDir, path.join(dataRoot, 'files'));
    assert.equal(runtime.paths.incomingDir, path.join(dataRoot, 'files', 'incoming'));
    assert.equal(runtime.paths.privateDir, absolutePrivate);
  } finally {
    await fs.rm(homeDir, { recursive: true, force: true });
  }
});

test('uses an existing public directory from disk when present', async () => {
  const homeDir = await createTempHome();
  try {
    const publicDir = path.join(homeDir, '.local', 'stream-file-server', 'public');
    await fs.mkdir(publicDir, { recursive: true });
    await fs.writeFile(path.join(publicDir, 'index.html'), '<!doctype html><title>SPA</title>');

    const runtime = await loadRuntimeConfig({ homeDir });
    assert.equal(runtime.paths.publicDir, publicDir);
    assert.equal(runtime.paths.publicEmbedded, false);
    assert.equal(runtime.paths.spaShellPath, path.join(publicDir, 'index.html'));
  } finally {
    await fs.rm(homeDir, { recursive: true, force: true });
  }
});

test('skips dev stub directories in favor of bundled assets', async () => {
  const homeDir = await createTempHome();
  try {
    const entryDir = path.join(homeDir, 'bundled');
    const bundledPublic = path.join(entryDir, 'public');
    await fs.mkdir(bundledPublic, { recursive: true });
    await fs.writeFile(
      path.join(bundledPublic, 'index.html'),
      '<!doctype html><title>Bundled</title>'
    );

    const stubDir = path.join(homeDir, '.local', 'stream-file-server', 'public');
    await fs.mkdir(stubDir, { recursive: true });
    await fs.writeFile(path.join(stubDir, 'index.html'), '<!doctype html><title>Stub</title>');
    await fs.writeFile(path.join(stubDir, DEV_STUB_MARKER_FILENAME), 'created by dev\n');

    const runtime = await loadRuntimeConfig({
      homeDir,
      publicSourceEnvironment: { entryDir, standalone: false }
    });
    assert.equal(runtime.paths.publicDir, bundledPublic);
    assert.equal(runtime.paths.publicEmbedded, false);
  } finally {
    await fs.rm(homeDir, { recursive: true, force: true });
  }
});

test('keeps dev stub directories for development when no bundled source exists', async () => {
  const homeDir = await createTempHome();
  try {
    const stubDir = path.join(homeDir, '.local', 'stream-file-server', 'public');
    await fs.mkdir(stubDir, { recursive: true });
    await fs.writeFile(path.join(stubDir, 'index.html'), '<!doctype html><title>Stub</title>');
    await fs.writeFile(path.join(stubDir, DEV_STUB_MARKER_FILENAME), 'created by dev\n');

    const runtime = await loadRuntimeConfig({
      homeDir,
      publicSourceEnvironment: { entryDir: path.join(homeDir, 'missing-entry'), standalone: false }
    });
    assert.equal(runtime.paths.publicDir, stubDir);
    assert.equal(runtime.paths.publicEmbedded, false);
  } finally {
    await fs.rm(homeDir, { recursive: true, force: true });
  }
});

test('prefers embedded assets over dev stub directories in standalone executables', async () => {
  const homeDir = await createTempHome();
  try {
    const stubDir = path.join(homeDir, '.local', 'stream-file-server', 'public');
    await fs.mkdir(stubDir, { recursive: true });
    await fs.writeFile(path.join(stubDir, 'index.html'), '<!doctype html><title>Stub</title>');
    await fs.writeFile(path.join(stubDir, DEV_STUB_MARKER_FILENAME), 'created by dev\n');

    const entryDir = path.join(homeDir, 'entry');
    const runtime = await loadRuntimeConfig({
      homeDir,
      publicSourceEnvironment: { entryDir, standalone: true }
    });
    assert.equal(runtime.paths.publicDir, path.join(entryDir, 'public'));
    assert.equal(runtime.paths.publicEmbedded, true);
  } finally {
    await fs.rm(homeDir, { recursive: true, force: true });
  }
});

test('skips override directories without an index.html', async () => {
  const homeDir = await createTempHome();
  try {
    const entryDir = path.join(homeDir, 'bundled');
    const bundledPublic = path.join(entryDir, 'public');
    await fs.mkdir(bundledPublic, { recursive: true });
    await fs.writeFile(
      path.join(bundledPublic, 'index.html'),
      '<!doctype html><title>Bundled</title>'
    );

    const partialDir = path.join(homeDir, '.local', 'stream-file-server', 'public');
    await fs.mkdir(partialDir, { recursive: true });
    await fs.writeFile(path.join(partialDir, 'style.css'), 'body {}');

    const runtime = await loadRuntimeConfig({
      homeDir,
      publicSourceEnvironment: { entryDir, standalone: false }
    });
    assert.equal(runtime.paths.publicDir, bundledPublic);
  } finally {
    await fs.rm(homeDir, { recursive: true, force: true });
  }
});

test('defaults a missing public directory instead of rejecting the config', async () => {
  const homeDir = await createTempHome();
  try {
    const configPath = path.join(homeDir, '.config', 'stream-file-server', 'config.yaml');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(
      configPath,
      `server:
  host: "0.0.0.0"
  port: 3000

directories:
  upload: "files"
  incoming: "files/incoming"
  private: "files/private-files"
`
    );

    const runtime = await loadRuntimeConfig({ homeDir });
    assert.equal(
      runtime.paths.publicDir,
      path.join(homeDir, '.local', 'stream-file-server', 'public')
    );
  } finally {
    await fs.rm(homeDir, { recursive: true, force: true });
  }
});

test('does not overwrite an existing config', async () => {
  const homeDir = await createTempHome();
  try {
    const configPath = path.join(homeDir, '.config', 'stream-file-server', 'config.yaml');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    const config = `server:
  host: "127.0.0.1"
  port: 4310

directories:
  public: "~/custom-public"
  upload: "shared-files"
  incoming: "shared-files/incoming"
  private: "shared-files/private-files"
`;
    await fs.writeFile(configPath, config);

    const runtime = await loadRuntimeConfig({ homeDir });
    assert.equal(runtime.server.host, '127.0.0.1');
    assert.equal(runtime.server.port, 4310);
    assert.equal(await fs.readFile(configPath, 'utf8'), config);
    assert.equal(await pathExists(path.join(runtime.paths.dataRoot, 'debug.log')), false);
  } finally {
    await fs.rm(homeDir, { recursive: true, force: true });
  }
});

test('loads independently configured feature flags without rewriting the file', async () => {
  const homeDir = await createTempHome();
  try {
    const configPath = path.join(homeDir, '.config', 'stream-file-server', 'config.yaml');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    const config = `server:
  host: "127.0.0.1"
  port: 3000
features:
  upload: false
  privateFiles: false
directories:
  upload: "files"
  incoming: "files/incoming"
  private: "files/private-files"
`;
    await fs.writeFile(configPath, config);

    const runtime = await loadRuntimeConfig({ homeDir });
    assert.deepEqual(runtime.features, {
      upload: false,
      privateFiles: false,
      homePage: true,
      publicTrafficLimits: false
    });
    assert.equal(await fs.readFile(configPath, 'utf8'), config);

    const homeDisabledConfig = config.replace(
      '  upload: false\n  privateFiles: false',
      '  homePage: false'
    );
    await fs.writeFile(configPath, homeDisabledConfig);
    const homeDisabledRuntime = await loadRuntimeConfig({ homeDir });
    assert.deepEqual(homeDisabledRuntime.features, {
      upload: true,
      privateFiles: true,
      homePage: false,
      publicTrafficLimits: false
    });
  } finally {
    await fs.rm(homeDir, { recursive: true, force: true });
  }
});

test('rejects non-boolean feature flags', async () => {
  const homeDir = await createTempHome();
  try {
    const configPath = path.join(homeDir, '.config', 'stream-file-server', 'config.yaml');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    const baseConfig = `server:
  host: "127.0.0.1"
  port: 3000
directories:
  upload: "files"
  incoming: "files/incoming"
  private: "files/private-files"
`;
    for (const field of ['upload', 'privateFiles', 'homePage', 'publicTrafficLimits']) {
      await fs.writeFile(configPath, `${baseConfig}features:\n  ${field}: "false"\n`);
      await assert.rejects(loadRuntimeConfig({ homeDir }), new RegExp(`features\\.${field}`));
    }
    await fs.writeFile(configPath, `${baseConfig}features: null\n`);
    await assert.rejects(loadRuntimeConfig({ homeDir }), /Invalid config field: features$/);
  } finally {
    await fs.rm(homeDir, { recursive: true, force: true });
  }
});

test('enables public traffic limits only when explicitly configured', async () => {
  const homeDir = await createTempHome();
  try {
    const configPath = path.join(homeDir, '.config', 'stream-file-server', 'config.yaml');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(
      configPath,
      `server:
  host: "127.0.0.1"
  port: 3000
features:
  publicTrafficLimits: true
directories:
  upload: "files"
  incoming: "files/incoming"
  private: "files/private-files"
`
    );
    const runtime = await loadRuntimeConfig({ homeDir });
    assert.equal(runtime.features.publicTrafficLimits, true);
    assert.equal(runtime.features.upload, true);
  } finally {
    await fs.rm(homeDir, { recursive: true, force: true });
  }
});

test('preserves an invalid existing config for correction', async () => {
  const homeDir = await createTempHome();
  try {
    const configPath = path.join(homeDir, '.config', 'stream-file-server', 'config.yaml');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    const invalidConfig = 'server: []\n';
    await fs.writeFile(configPath, invalidConfig);

    await assert.rejects(
      loadRuntimeConfig({ homeDir }),
      /Invalid config: server and directories are required/
    );
    assert.equal(await fs.readFile(configPath, 'utf8'), invalidConfig);
  } finally {
    await fs.rm(homeDir, { recursive: true, force: true });
  }
});

test('rejects a non-string public directory value', async () => {
  const homeDir = await createTempHome();
  try {
    const configPath = path.join(homeDir, '.config', 'stream-file-server', 'config.yaml');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(
      configPath,
      `server:
  host: "0.0.0.0"
  port: 3000

directories:
  public: 123
  upload: "files"
  incoming: "files/incoming"
  private: "files/private-files"
`
    );

    await assert.rejects(
      loadRuntimeConfig({ homeDir }),
      /Invalid config field: directories\.public/
    );
  } finally {
    await fs.rm(homeDir, { recursive: true, force: true });
  }
});

test('handles concurrent first-start config generation', async () => {
  const homeDir = await createTempHome();
  try {
    const runtimes = await Promise.all(
      Array.from({ length: 2 }, () => loadRuntimeConfig({ homeDir }))
    );
    const configPath = path.join(homeDir, '.config', 'stream-file-server', 'config.yaml');
    assert.equal(runtimes[0]?.configPath, configPath);
    assert.equal(runtimes[1]?.server.port, 3000);
    assert.equal((await fs.readFile(configPath, 'utf8')).length > 0, true);
  } finally {
    await fs.rm(homeDir, { recursive: true, force: true });
  }
});
