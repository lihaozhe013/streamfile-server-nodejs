import fs from 'node:fs/promises';
import path from 'node:path';

export async function appendDebugLog(
  rootDir: string,
  message: string,
): Promise<void> {
  const line = `${new Date().toISOString()} ${message}\n`;
  try {
    await fs.appendFile(path.join(rootDir, 'debug.log'), line, 'utf8');
  } catch {
    // Logging must not prevent the application from starting.
  }
}
