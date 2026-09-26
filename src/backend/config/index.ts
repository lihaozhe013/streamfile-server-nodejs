import fsSync from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Config, RuntimeConfig, RuntimePaths } from '@/types/index';
import { appendDebugLog } from '@/utils/logger';
import defaultConfigTemplate from './default.yaml' with { type: 'text' };

const APP_DIRECTORY_NAME = 'stream-file-server';

interface LoadConfigOptions {
  configPath?: string;
  homeDir?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid config field: ${field}`);
  }
  return value;
}

function readPort(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error('Invalid config field: server.port');
  }
  return value;
}

function readOptionalDirectory(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error('Invalid config field: directories.public');
  }
  return value.trim() ? value : null;
}

function parseConfig(value: unknown): Config {
  if (!isRecord(value)) throw new Error('Invalid config: expected an object');

  const server = value.server;
  const directories = value.directories;
  if (!isRecord(server) || !isRecord(directories)) {
    throw new Error('Invalid config: server and directories are required');
  }

  return {
    server: {
      host: readString(server.host, 'server.host'),
      port: readPort(server.port)
    },
    directories: {
      public: readOptionalDirectory(directories.public),
      upload: readString(directories.upload, 'directories.upload'),
      incoming: readString(directories.incoming, 'directories.incoming'),
      private: readString(directories.private, 'directories.private')
    }
  };
}

function expandHomePath(value: string, home: string): string {
  if (value === '~') return home;
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(home, value.slice(2));
  }
  return value;
}

function resolveConfiguredDirectory(value: string, home: string, dataRoot: string): string {
  const expanded = expandHomePath(value, home);
  return path.isAbsolute(expanded) ? path.normalize(expanded) : path.resolve(dataRoot, expanded);
}

function resolveHomeDirectory(explicitHomeDir?: string): string {
  const home = explicitHomeDir?.trim() || os.homedir();
  if (!home) {
    throw new Error('Unable to determine the home directory for config resolution');
  }
  return path.resolve(home);
}

/**
 * Public assets prefer a directory that exists on disk so operators can
 * override the packaged SPA; otherwise they fall back to the directory that
 * ships next to the entry point, which is the executable's embedded asset tree
 * in standalone builds.
 */
function resolvePublicSource(
  configuredValue: string | null,
  home: string,
  dataRoot: string
): { publicDir: string; publicEmbedded: boolean } {
  const configuredDir = configuredValue
    ? resolveConfiguredDirectory(configuredValue, home, dataRoot)
    : path.join(dataRoot, 'public');

  if (fsSync.existsSync(configuredDir)) {
    return { publicDir: configuredDir, publicEmbedded: false };
  }

  const bundledDir = path.join(path.dirname(Bun.main), 'public');
  if (Bun.isStandaloneExecutable || fsSync.existsSync(bundledDir)) {
    return { publicDir: bundledDir, publicEmbedded: Bun.isStandaloneExecutable };
  }

  return { publicDir: configuredDir, publicEmbedded: false };
}

function toRuntimePaths(config: Config, home: string, dataRoot: string): RuntimePaths {
  const publicSource = resolvePublicSource(config.directories.public, home, dataRoot);
  const filesDir = resolveConfiguredDirectory(config.directories.upload, home, dataRoot);
  const incomingDir = resolveConfiguredDirectory(config.directories.incoming, home, dataRoot);
  const privateDir = resolveConfiguredDirectory(config.directories.private, home, dataRoot);

  return {
    dataRoot,
    publicDir: publicSource.publicDir,
    publicEmbedded: publicSource.publicEmbedded,
    filesDir,
    incomingDir,
    privateDir,
    spaShellPath: path.join(publicSource.publicDir, 'index.html'),
    notFoundPath: path.join(publicSource.publicDir, '404-index.html')
  };
}

async function fileExists(candidatePath: string): Promise<boolean> {
  try {
    await fsPromises.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

function isFileExistsError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';
}

async function ensureConfigFile(configPath: string, dataRoot: string): Promise<string> {
  if (await fileExists(configPath)) return configPath;

  try {
    await fsPromises.mkdir(path.dirname(configPath), { recursive: true });
    await fsPromises.writeFile(configPath, defaultConfigTemplate, {
      encoding: 'utf8',
      flag: 'wx'
    });
    await fsPromises.mkdir(dataRoot, { recursive: true });
    await appendDebugLog(dataRoot, `[backend_config] Generated config.yaml at ${configPath}`);
    return configPath;
  } catch (error) {
    if (isFileExistsError(error) && (await fileExists(configPath))) {
      return configPath;
    }
    throw new Error(
      `Unable to create config.yaml at ${configPath}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

export async function loadRuntimeConfig(options: LoadConfigOptions = {}): Promise<RuntimeConfig> {
  const home = resolveHomeDirectory(options.homeDir);
  const configPath = path.resolve(
    options.configPath ?? path.join(home, '.config', APP_DIRECTORY_NAME, 'config.yaml')
  );
  const dataRoot = path.join(home, '.local', APP_DIRECTORY_NAME);

  await ensureConfigFile(configPath, dataRoot);
  const fileContents = await fsPromises.readFile(configPath, 'utf8');
  const config = parseConfig(Bun.YAML.parse(fileContents));

  return {
    server: config.server,
    paths: toRuntimePaths(config, home, dataRoot),
    configPath
  };
}

export async function ensureRuntimeDirectories(runtime: RuntimeConfig): Promise<void> {
  const { paths } = runtime;
  await Promise.all([
    fsPromises.mkdir(paths.filesDir, { recursive: true }),
    fsPromises.mkdir(paths.incomingDir, { recursive: true }),
    fsPromises.mkdir(paths.privateDir, { recursive: true })
  ]);

  try {
    await fsPromises.access(paths.notFoundPath);
  } catch {
    return;
  }

  await Promise.all([
    ensurePrivateNotFoundPage(paths.incomingDir, paths.notFoundPath),
    ensurePrivateNotFoundPage(paths.privateDir, paths.notFoundPath)
  ]);
}

async function ensurePrivateNotFoundPage(directory: string, source404Path: string): Promise<void> {
  const destination = path.join(directory, 'index.html');
  try {
    await fsPromises.access(destination);
    return;
  } catch {
    // Fall through and create the page from the source template.
  }

  // The source may live inside a standalone executable's embedded assets, so
  // read/write is used instead of copyFile.
  const contents = await fsPromises.readFile(source404Path);
  await fsPromises.writeFile(destination, contents);
}

export function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return '0.0.0.0';
}
