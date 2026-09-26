import type { Request, RequestHandler, Response } from 'express';

const MIB = 1024 * 1024;
export const LARGE_TRANSFER_BYTES = MIB;
export const PROXY_TRANSFER_BYTES_PER_SECOND = 512 * 1024;
const RETRY_AFTER_SECONDS = 60;
const CLIENT_IDLE_MS = 10 * 60 * 1000;
const MAX_CLIENTS = 10_000;
const MAX_CLIENT_TRANSFERS = 4;
const MAX_GLOBAL_TRANSFERS = 16;

interface Bucket {
  tokens: number;
  updatedAt: number;
  readonly capacity: number;
  readonly refillPerSecond: number;
}

interface ClientState {
  general: Bucket;
  content: Bucket;
  listing: Bucket;
  search: Bucket;
  activeTransfers: number;
  lastSeen: number;
}

function bucket(capacity: number, refillPerSecond: number, now: number): Bucket {
  return { tokens: capacity, updatedAt: now, capacity, refillPerSecond };
}

function hasToken(value: Bucket, now: number): boolean {
  value.tokens = Math.min(
    value.capacity,
    value.tokens + (Math.max(0, now - value.updatedAt) / 1000) * value.refillPerSecond
  );
  value.updatedAt = now;
  return value.tokens >= 1;
}

function clientAddress(request: Request): string {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

function isReadRequest(request: Request): boolean {
  return request.method === 'GET' || request.method === 'HEAD';
}

function isContentRequest(request: Request): boolean {
  return (
    isReadRequest(request) &&
    (request.path === '/files' ||
      request.path.startsWith('/files/') ||
      request.path === '/api/markdown-content')
  );
}

function isSearchRequest(request: Request): boolean {
  return (
    isReadRequest(request) &&
    (request.path === '/api/search' || request.path.startsWith('/api/search/'))
  );
}

export function sendTrafficLimitResponse(response: Response): void {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Retry-After', String(RETRY_AFTER_SECONDS));
  response.status(429).json({ error: 'Too many requests' });
}

export class PublicTrafficLimits {
  private readonly clients = new Map<string, ClientState>();
  private readonly globalGeneral: Bucket;
  private readonly globalContent: Bucket;
  private readonly globalSearch: Bucket;
  private activeTransfers = 0;
  private requestsSeen = 0;

  constructor() {
    const now = performance.now();
    this.globalGeneral = bucket(60, 30, now);
    this.globalContent = bucket(20, 10, now);
    this.globalSearch = bucket(10, 30 / 60, now);
  }

  readonly middleware: RequestHandler = (request, response, next) => {
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const now = performance.now();
    this.requestsSeen += 1;
    if (this.requestsSeen % 256 === 0) this.pruneClients(now);

    const client = this.getClient(clientAddress(request), now);
    if (!client) {
      sendTrafficLimitResponse(response);
      return;
    }

    const limits = [this.globalGeneral, client.general];
    if (isContentRequest(request)) {
      limits.push(this.globalContent, client.content);
    } else if (isSearchRequest(request)) {
      limits.push(this.globalSearch, client.search);
    } else if (isReadRequest(request) && request.path === '/api/list-files') {
      limits.push(client.listing);
    }

    if (!limits.every((limit) => hasToken(limit, now))) {
      sendTrafficLimitResponse(response);
      return;
    }
    for (const limit of limits) limit.tokens -= 1;
    next();
  };

  acquireTransfer(request: Request, response: Response): (() => void) | null {
    const client = this.getClient(clientAddress(request), performance.now());
    if (
      !client ||
      client.activeTransfers >= MAX_CLIENT_TRANSFERS ||
      this.activeTransfers >= MAX_GLOBAL_TRANSFERS
    ) {
      return null;
    }

    client.activeTransfers += 1;
    this.activeTransfers += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      response.off('close', release);
      response.off('finish', release);
      client.activeTransfers -= 1;
      this.activeTransfers -= 1;
    };
    response.once('close', release);
    response.once('finish', release);
    return release;
  }

  private getClient(address: string, now: number): ClientState | null {
    const existing = this.clients.get(address);
    if (existing) {
      existing.lastSeen = now;
      this.clients.delete(address);
      this.clients.set(address, existing);
      return existing;
    }

    if (this.clients.size >= MAX_CLIENTS) {
      this.pruneClients(now);
      if (this.clients.size >= MAX_CLIENTS) {
        const oldestInactive = [...this.clients].find(([, state]) => state.activeTransfers === 0);
        if (!oldestInactive) return null;
        this.clients.delete(oldestInactive[0]);
      }
    }

    const created: ClientState = {
      general: bucket(30, 10, now),
      content: bucket(20, 60 / 60, now),
      listing: bucket(10, 30 / 60, now),
      search: bucket(3, 6 / 60, now),
      activeTransfers: 0,
      lastSeen: now
    };
    this.clients.set(address, created);
    return created;
  }

  private pruneClients(now: number): void {
    for (const [address, client] of this.clients) {
      if (client.activeTransfers === 0 && now - client.lastSeen > CLIENT_IDLE_MS) {
        this.clients.delete(address);
      }
    }
  }
}
