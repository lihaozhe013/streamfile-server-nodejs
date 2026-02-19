import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import type { Config } from '@/backend/types/index';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve project root robustly for both built and tsx-dev runs
const ROOT_DIR = path.resolve(process.cwd());
const CONFIG_PATH = path.join(ROOT_DIR, 'config.yaml');

let config: Config;

if (!fs.existsSync(CONFIG_PATH)) {
  console.error(`Config file not found at ${CONFIG_PATH}`);
  process.exit(1);
}

const fileContents = fs.readFileSync(CONFIG_PATH, 'utf8');
config = yaml.load(fileContents) as Config;


const HOST = config.server.host;
const PORT = config.server.port;
const FILES_DIR = path.join(ROOT_DIR, config.directories.upload);
const INCOMING_DIR = path.join(ROOT_DIR, config.directories.incoming);
const PRIVATE_DIR = path.join(ROOT_DIR, config.directories.private);
const PUBLIC_DIR = path.join(ROOT_DIR, config.directories.public);

// Resolve public dir with build-first base './public' (dist/public), and fallbacks for dev
function resolvePublicDir(): string {
  const candidates = [
    path.join(ROOT_DIR, 'dist/public'), // build artifact base
    path.join(ROOT_DIR, 'public'), // project/public
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  // default to project/public
  return path.join(ROOT_DIR, 'public');
}

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    const interface_ = interfaces[interfaceName];
    if (interface_) {
      for (const iface of interface_) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  }
  return '0.0.0.0';
}

const LOCAL_IP = getLocalIP();

// create folders if dne
if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

if (!fs.existsSync(INCOMING_DIR)) {
  fs.mkdirSync(INCOMING_DIR, { recursive: true });
}

if (!fs.existsSync(PRIVATE_DIR)) {
  fs.mkdirSync(PRIVATE_DIR, { recursive: true });
}

// Add 404 index.html to INCOMING_DIR and PRIVATE_DIR if they don't have one
const incomingIndexPath = path.join(INCOMING_DIR, 'index.html');
const privateIndexPath = path.join(PRIVATE_DIR, 'index.html');
const source404Path = path.join(PUBLIC_DIR, '404-index.html');

if (!fs.existsSync(incomingIndexPath)) {
  fs.copyFileSync(source404Path, incomingIndexPath);
}

if (!fs.existsSync(privateIndexPath)) {
  fs.copyFileSync(source404Path, privateIndexPath);
}

export { PRIVATE_DIR, FILES_DIR, INCOMING_DIR, PUBLIC_DIR, HOST, PORT, LOCAL_IP, __dirname }