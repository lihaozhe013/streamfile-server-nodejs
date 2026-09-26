import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import { PublicTrafficLimits } from '@/services/publicTrafficLimits';

function requestFor(address: string): Request {
  return { ip: address } as Request;
}

function responseEvents(): Response & EventEmitter {
  return new EventEmitter() as Response & EventEmitter;
}

test('limits concurrent transfers and releases slots after disconnects', () => {
  const limits = new PublicTrafficLimits();
  const requests = Array.from({ length: 4 }, () => responseEvents());
  const releases = requests.map((response) =>
    limits.acquireTransfer(requestFor('client-a'), response)
  );
  assert.equal(
    releases.every((release) => typeof release === 'function'),
    true
  );
  assert.equal(limits.acquireTransfer(requestFor('client-a'), responseEvents()), null);

  requests[0]?.emit('close');
  const next = limits.acquireTransfer(requestFor('client-a'), responseEvents());
  assert.equal(typeof next, 'function');
  releases[0]?.();
  next?.();
  for (const release of releases.slice(1)) release?.();

  const globalReleases = Array.from({ length: 16 }, (_, index) =>
    limits.acquireTransfer(requestFor(`client-${index}`), responseEvents())
  );
  assert.equal(
    globalReleases.every((release) => typeof release === 'function'),
    true
  );
  assert.equal(limits.acquireTransfer(requestFor('another-client'), responseEvents()), null);
  globalReleases[0]?.();
  const finalRelease = limits.acquireTransfer(requestFor('another-client'), responseEvents());
  assert.equal(typeof finalRelease, 'function');
  finalRelease?.();
  for (const release of globalReleases.slice(1)) release?.();
});
