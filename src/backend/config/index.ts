import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as yaml from 'js-yaml';
import type { Config, RuntimeConfig, RuntimePaths } from '@/types/index';
import { appendDebugLog } from '@/utils/logger';

const DEFAULT_CONFIG_URL = new URL('./default.yaml', import.meta.url);

interface LoadConfigOptions {
  configPath?: string;
  rootDir?: string;
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
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 65535
  ) {
    throw new Error('Invalid config field: server.port');
  }
  return value;
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
      port: readPort(server.port),
    },
    directories: {
      public: readString(directories.public, 'directories.public'),
      upload: readString(directories.upload, 'directories.upload'),
      incoming: readString(directories.incoming, 'directories.incoming'),
      private: readString(directories.private, 'directories.private'),
    },
  };
}

export async function findConfigPath(
  startDir = process.cwd(),
): Promise<string | undefined> {
  const candidates = [
    path.resolve(startDir, 'config.yaml'),
    path.resolve(startDir, '..', 'config.yaml'),
    path.resolve(startDir, '..', '..', 'config.yaml'),
  ];
  for (const candidate of candidates) {
    try {
      await fsPromises.access(candidate);
      return candidate;
    } catch {
      // Continue searching parent directories.
    }
  }
  return undefined;
}

function resolveDirectory(rootDir: string, directory: string): string {
  return path.resolve(rootDir, directory);
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await fsPromises.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

async function resolvePublicDirectory(
  rootDir: string,
  configuredDirectory: string,
): Promise<string> {
  const configuredPublicDir = resolveDirectory(rootDir, configuredDirectory);
  if (configuredDirectory !== 'public') return configuredPublicDir;
  if (await pathExists(path.join(configuredPublicDir, 'index.html'))) {
    return configuredPublicDir;
  }

  const sourcePublicDir = resolveDirectory(rootDir, 'src/frontend/public');
  return (await pathExists(path.join(sourcePublicDir, 'index.html')))
    ? sourcePublicDir
    : configuredPublicDir;
}

async function toRuntimePaths(
  rootDir: string,
  config: Config,
): Promise<RuntimePaths> {
  const publicDir = await resolvePublicDirectory(
    rootDir,
    config.directories.public,
  );
  const filesDir = resolveDirectory(rootDir, config.directories.upload);
  const incomingDir = resolveDirectory(rootDir, config.directories.incoming);
  const privateDir = resolveDirectory(rootDir, config.directories.private);

  return {
    rootDir,
    publicDir,
    filesDir,
    incomingDir,
    privateDir,
    spaShellPath: path.join(publicDir, 'index.html'),
    notFoundPath: path.join(publicDir, '404-index.html'),
  };
}

async function ensureConfigFile(
  rootDir: string,
  requestedPath?: string,
): Promise<string> {
  const configPath = path.resolve(
    requestedPath ?? path.join(rootDir, 'config.yaml'),
  );
  if (await pathExists(configPath)) return configPath;

  try {
    const defaultConfig = await fsPromises.readFile(DEFAULT_CONFIG_URL, 'utf8');
    await fsPromises.writeFile(configPath, defaultConfig, {
      encoding: 'utf8',
      flag: 'wx',
    });
    await appendDebugLog(rootDir, '[backend_config] Generated config.yaml');
    return configPath;
  } catch (error) {
    if (isFileExistsError(error) && (await pathExists(configPath))) {
      return configPath;
    }
    throw new Error(
      `Unable to create config.yaml in ${rootDir}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    );
  }
}

function isFileExistsError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'EEXIST'
  );
}

export async function loadRuntimeConfig(
  options: LoadConfigOptions = {},
): Promise<RuntimeConfig> {
  const searchDir = path.resolve(
    options.rootDir ?? process.env.STREAMFILE_ROOT_DIR ?? process.cwd(),
  );
  const configPath = await ensureConfigFile(
    searchDir,
    options.configPath ?? (await findConfigPath(searchDir)),
  );
  const rootDir = searchDir;
  const fileContents = await fsPromises.readFile(configPath, 'utf8');
  const config = parseConfig(yaml.load(fileContents));

  return {
    server: config.server,
    paths: await toRuntimePaths(rootDir, config),
    configPath,
  };
}

export async function ensureRuntimeDirectories(
  runtime: RuntimeConfig,
): Promise<void> {
  const { paths } = runtime;
  await Promise.all([
    fsPromises.mkdir(paths.publicDir, { recursive: true }),
    fsPromises.mkdir(paths.filesDir, { recursive: true }),
    fsPromises.mkdir(paths.incomingDir, { recursive: true }),
    fsPromises.mkdir(paths.privateDir, { recursive: true }),
  ]);

  try {
    await fsPromises.access(paths.notFoundPath);
  } catch {
    return;
  }

  await Promise.all([
    ensurePrivateNotFoundPage(paths.incomingDir, paths.notFoundPath),
    ensurePrivateNotFoundPage(paths.privateDir, paths.notFoundPath),
  ]);
}

async function ensurePrivateNotFoundPage(
  directory: string,
  source404Path: string,
): Promise<void> {
  const destination = path.join(directory, 'index.html');
  try {
    await fsPromises.access(destination);
  } catch {
    await fsPromises.copyFile(source404Path, destination);
  }
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
