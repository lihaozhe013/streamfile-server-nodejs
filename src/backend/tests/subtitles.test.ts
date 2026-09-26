import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createApp } from '@/app';
import { MAX_SUBTITLE_BYTES } from '@/services/subtitles';
import type { RuntimeConfig, RuntimeFeatures, RuntimePaths } from '@/types/index';

async function withServer(
  callback: (baseUrl: string, paths: RuntimePaths) => Promise<void>,
  features: Partial<RuntimeFeatures> = {}
): Promise<void> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'streamfile-subtitles-'));
  const filesDir = path.join(rootDir, 'files');
  const publicDir = path.join(rootDir, 'public');
  const paths: RuntimePaths = {
    dataRoot: rootDir,
    publicDir,
    publicEmbedded: false,
    filesDir,
    incomingDir: path.join(filesDir, 'incoming'),
    privateDir: path.join(filesDir, 'private-files'),
    spaShellPath: path.join(publicDir, 'index.html'),
    notFoundPath: path.join(publicDir, '404-index.html')
  };
  await fs.mkdir(paths.incomingDir, { recursive: true });
  await fs.mkdir(paths.privateDir, { recursive: true });
  await fs.mkdir(path.join(filesDir, 'folder'), { recursive: true });
  await fs.mkdir(publicDir, { recursive: true });
  await fs.writeFile(paths.spaShellPath, '<!doctype html>');
  await fs.writeFile(paths.notFoundPath, '<!doctype html>');

  const runtime: RuntimeConfig = {
    server: { host: '127.0.0.1', port: 0 },
    features: {
      upload: true,
      privateFiles: true,
      homePage: true,
      publicTrafficLimits: false,
      ...features
    },
    paths,
    configPath: path.join(rootDir, 'config.yaml')
  };
  const server = createApp(runtime).listen(0, '127.0.0.1');

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No server address');
    await callback(`http://127.0.0.1:${address.port}`, paths);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(rootDir, { recursive: true, force: true });
  }
}

function subtitleUrl(baseUrl: string, relativePath: string, encoding = 'auto'): string {
  return `${baseUrl}/api/subtitle-vtt?${new URLSearchParams({ path: relativePath, encoding })}`;
}

test('converts UTF-8 SRT cues to safe WebVTT and validates HEAD requests', async () => {
  await withServer(async (baseUrl, paths) => {
    const filePath = path.join(paths.filesDir, 'folder', 'movie.srt');
    await fs.writeFile(
      filePath,
      '\uFEFF1\r\n00:00:01,000 --> 00:00:02,500\r\n<i>Hello</i> & bye\r\nSecond line\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\n<script>alert(1)</script>\r\n'
    );
    const url = subtitleUrl(baseUrl, 'folder/movie.srt');
    const head = await fetch(url, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.match(head.headers.get('content-type') ?? '', /^text\/vtt/);
    assert.equal(await head.text(), '');

    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(
      await response.text(),
      'WEBVTT\n\n00:00:01.000 --> 00:00:02.500\n<i>Hello</i> &amp; bye\nSecond line\n\n00:00:03.000 --> 00:00:04.000\n&lt;script&gt;alert(1)&lt;/script&gt;\n'
    );
  });
});

test('falls back to GB18030 and allows an explicit encoding override', async () => {
  await withServer(async (baseUrl, paths) => {
    const filePath = path.join(paths.filesDir, 'folder', '中文.srt');
    await fs.writeFile(
      filePath,
      Buffer.concat([
        Buffer.from('1\r\n00:00:01,000 --> 00:00:02,000\r\n'),
        Buffer.from([0xc4, 0xe3, 0xba, 0xc3]),
        Buffer.from('\r\n')
      ])
    );
    const relativePath = 'folder/中文.srt';
    assert.match(await (await fetch(subtitleUrl(baseUrl, relativePath))).text(), /你好/);
    assert.match(await (await fetch(subtitleUrl(baseUrl, relativePath, 'gb18030'))).text(), /你好/);
    const wrongEncoding = await fetch(subtitleUrl(baseUrl, relativePath, 'utf-8'));
    assert.equal(wrongEncoding.status, 422);
    assert.deepEqual(await wrongEncoding.json(), { error: 'Invalid subtitle file or encoding' });
  });
});

test('rejects invalid requests, malformed cues, and oversized files', async () => {
  await withServer(async (baseUrl, paths) => {
    await fs.writeFile(path.join(paths.filesDir, 'folder', 'bad.srt'), 'not an SRT file');
    await fs.writeFile(
      path.join(paths.filesDir, 'folder', 'large.srt'),
      Buffer.alloc(MAX_SUBTITLE_BYTES + 1, 0x41)
    );
    assert.equal((await fetch(`${baseUrl}/api/subtitle-vtt`)).status, 400);
    assert.equal((await fetch(subtitleUrl(baseUrl, '../escape.srt'))).status, 400);
    assert.equal((await fetch(subtitleUrl(baseUrl, 'folder/movie.txt'))).status, 400);
    assert.equal((await fetch(subtitleUrl(baseUrl, 'folder/bad.srt', 'latin1'))).status, 400);
    assert.equal((await fetch(subtitleUrl(baseUrl, 'folder/missing.srt'))).status, 404);
    const invalid = await fetch(subtitleUrl(baseUrl, 'folder/bad.srt'));
    assert.equal(invalid.status, 422);
    assert.match(invalid.headers.get('content-type') ?? '', /^application\/json/);
    assert.equal(
      (await fetch(subtitleUrl(baseUrl, 'folder/bad.srt'), { method: 'HEAD' })).status,
      422
    );
    assert.equal((await fetch(subtitleUrl(baseUrl, 'folder/large.srt'))).status, 413);
  });
});

test('preserves incoming and private access rules', async () => {
  await withServer(async (baseUrl, paths) => {
    const content = '1\n00:00:01,000 --> 00:00:02,000\nHello\n';
    await fs.writeFile(path.join(paths.incomingDir, 'hidden.srt'), content);
    await fs.writeFile(path.join(paths.privateDir, 'secret.srt'), content);
    assert.equal((await fetch(subtitleUrl(baseUrl, 'incoming/hidden.srt'))).status, 403);
    assert.equal((await fetch(subtitleUrl(baseUrl, 'private-files/secret.srt'))).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/list-files?path=private-files`)).status, 403);
  });

  await withServer(
    async (baseUrl, paths) => {
      await fs.writeFile(
        path.join(paths.privateDir, 'secret.srt'),
        '1\n00:00:01,000 --> 00:00:02,000\nHello\n'
      );
      assert.equal((await fetch(subtitleUrl(baseUrl, 'private-files/secret.srt'))).status, 403);
    },
    { privateFiles: false }
  );
});

test('allows regular-file symlinks but blocks directory symlinks and protected targets', async (t) => {
  await withServer(async (baseUrl, paths) => {
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'streamfile-subtitles-outside-'));
    try {
      const outsideFile = path.join(outsideDir, 'external.srt');
      await fs.writeFile(outsideFile, '1\n00:00:01,000 --> 00:00:02,000\nExternal\n');
      await fs.writeFile(
        path.join(paths.incomingDir, 'hidden.srt'),
        '1\n00:00:01,000 --> 00:00:02,000\nHidden\n'
      );
      try {
        await fs.symlink(outsideFile, path.join(paths.filesDir, 'folder', 'linked.srt'));
        await fs.symlink(outsideDir, path.join(paths.filesDir, 'folder', 'linked-dir'), 'dir');
        await fs.symlink(
          path.join(paths.incomingDir, 'hidden.srt'),
          path.join(paths.filesDir, 'folder', 'blocked.srt')
        );
      } catch (error) {
        t.skip(`Symlinks unavailable: ${String(error)}`);
        return;
      }
      assert.equal((await fetch(subtitleUrl(baseUrl, 'folder/linked.srt'))).status, 200);
      assert.equal(
        (await fetch(subtitleUrl(baseUrl, 'folder/linked-dir/external.srt'))).status,
        404
      );
      assert.equal((await fetch(subtitleUrl(baseUrl, 'folder/blocked.srt'))).status, 404);
    } finally {
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });
});

test('counts subtitle requests against public content limits', async () => {
  await withServer(
    async (baseUrl, paths) => {
      await fs.writeFile(
        path.join(paths.filesDir, 'folder', 'movie.srt'),
        '1\n00:00:01,000 --> 00:00:02,000\nHello\n'
      );
      const url = subtitleUrl(baseUrl, 'folder/movie.srt');
      for (let index = 0; index < 20; index += 1) {
        assert.equal((await fetch(url, { method: 'HEAD' })).status, 200);
      }
      assert.equal((await fetch(url, { method: 'HEAD' })).status, 429);
    },
    { publicTrafficLimits: true }
  );
});
