import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as yaml from 'js-yaml';
import type { Config, RuntimeConfig, RuntimePaths } from '@/types/index';

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

function toRuntimePaths(rootDir: string, config: Config): RuntimePaths {
  const publicDir = resolveDirectory(rootDir, config.directories.public);
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

export async function loadRuntimeConfig(
  options: LoadConfigOptions = {},
): Promise<RuntimeConfig> {
  const searchDir = path.resolve(
    options.rootDir ?? process.env.STREAMFILE_ROOT_DIR ?? process.cwd(),
  );
  const discoveredPath =
    options.configPath ?? (await findConfigPath(searchDir));
  if (!discoveredPath) {
    throw new Error(`Config file not found from ${searchDir}`);
  }

  const configPath = path.resolve(discoveredPath);
  const rootDir = searchDir;
  const fileContents = await fsPromises.readFile(configPath, 'utf8');
  const config = parseConfig(yaml.load(fileContents));

  return {
    server: config.server,
    paths: toRuntimePaths(rootDir, config),
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
