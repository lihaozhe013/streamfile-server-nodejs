import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createApp } from '@/app';
import { ensureRuntimeDirectories } from '@/config';
import type { RuntimeConfig, RuntimePaths } from '@/types/index';

interface Fixture {
  rootDir: string;
  paths: RuntimePaths;
  runtime: RuntimeConfig;
}

async function createFixture(): Promise<Fixture> {
  const rootDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'streamfile-backend-'),
  );
  const publicDir = path.join(rootDir, 'public');
  const filesDir = path.join(rootDir, 'files');
  const incomingDir = path.join(filesDir, 'incoming');
  const privateDir = path.join(filesDir, 'private-files');
  const paths: RuntimePaths = {
    rootDir,
    publicDir,
    filesDir,
    incomingDir,
    privateDir,
    spaShellPath: path.join(publicDir, 'index.html'),
    notFoundPath: path.join(publicDir, '404-index.html'),
  };

  await fs.mkdir(publicDir, { recursive: true });
  await fs.mkdir(path.join(filesDir, 'folder', 'custom'), { recursive: true });
  await fs.mkdir(path.join(filesDir, 'incoming-evil'), { recursive: true });
  await fs.mkdir(path.join(filesDir, 'private-files'), { recursive: true });
  await fs.writeFile(paths.spaShellPath, '<!doctype html><title>SPA</title>');
  await fs.writeFile(paths.notFoundPath, '<!doctype html><title>404</title>');
  await fs.writeFile(
    path.join(filesDir, 'folder', 'hello world.md'),
    '# Hello world\n',
  );
  await fs.writeFile(path.join(filesDir, 'folder', 'clip.mp4'), 'media');
  await fs.writeFile(path.join(filesDir, 'folder', 'note.txt'), 'plain text');
  await fs.writeFile(
    path.join(filesDir, 'folder', 'custom', 'index.html'),
    '<!doctype html><title>Custom</title>',
  );
  await fs.writeFile(
    path.join(filesDir, 'private-files', 'secret.txt'),
    'secret',
  );
  await fs.writeFile(
    path.join(filesDir, 'incoming-evil', 'visible.txt'),
    'visible',
  );
  await fs.writeFile(path.join(filesDir, '.hidden'), 'hidden');

  const runtime: RuntimeConfig = {
    server: { host: '127.0.0.1', port: 0 },
    paths,
    configPath: path.join(rootDir, 'config.yaml'),
  };
  await ensureRuntimeDirectories(runtime);
  return { rootDir, paths, runtime };
}

async function withServer(
  callback: (baseUrl: string, fixture: Fixture) => Promise<void>,
): Promise<void> {
  const fixture = await createFixture();
  const server = createApp(fixture.runtime).listen(0, '127.0.0.1');

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', () => resolve());
      server.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Test server did not expose an address');
    }
    await callback(`http://127.0.0.1:${address.port}`, fixture);
  } finally {
    await closeServer(server);
    await fs.rm(fixture.rootDir, { recursive: true, force: true });
  }
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

test('lists public files and serves SPA, raw, custom, and private URLs', async () => {
  await withServer(async (baseUrl) => {
    const listResponse = await fetch(`${baseUrl}/api/list-files`);
    assert.equal(listResponse.status, 200);
    const entries = (await listResponse.json()) as Array<{
      name: string;
      isDirectory: boolean;
    }>;
    const names = entries.map((entry) => entry.name);
    assert.deepEqual(names.sort(), ['folder', 'incoming-evil']);

    const markdownResponse = await fetch(
      `${baseUrl}/files/folder/hello%20world.md`,
    );
    assert.equal(markdownResponse.status, 200);
    assert.match(await markdownResponse.text(), /<title>SPA<\/title>/);

    const rawResponse = await fetch(
      `${baseUrl}/files/folder/hello%20world.md?raw=1`,
    );
    assert.equal(rawResponse.status, 200);
    assert.equal(await rawResponse.text(), '# Hello world\n');

    const mediaResponse = await fetch(`${baseUrl}/files/folder/clip.mp4`);
    assert.equal(mediaResponse.status, 200);
    assert.match(await mediaResponse.text(), /<title>SPA<\/title>/);

    const customResponse = await fetch(`${baseUrl}/files/folder/custom/`);
    assert.equal(customResponse.status, 200);
    assert.match(await customResponse.text(), /<title>Custom<\/title>/);

    const privateResponse = await fetch(
      `${baseUrl}/files/private-files/secret.txt?raw=1`,
    );
    assert.equal(privateResponse.status, 200);
    assert.equal(await privateResponse.text(), 'secret');

    const incomingResponse = await fetch(
      `${baseUrl}/files/incoming/index.html?raw=1`,
    );
    assert.equal(incomingResponse.status, 403);

    const missingResponse = await fetch(`${baseUrl}/files/missing.txt`);
    assert.equal(missingResponse.status, 404);
    assert.match(await missingResponse.text(), /<title>404<\/title>/);
  });
});

test('supports nested paths, markdown API, and legacy search URLs', async () => {
  await withServer(async (baseUrl) => {
    const directoryResponse = await fetch(
      `${baseUrl}/api/list-files?path=folder`,
    );
    assert.equal(directoryResponse.status, 200);
    const directoryEntries = (await directoryResponse.json()) as Array<{
      name: string;
      isDirectory: boolean;
    }>;
    assert.equal(
      directoryEntries.some((entry) => entry.name === 'hello world.md'),
      true,
    );

    const markdownResponse = await fetch(
      `${baseUrl}/api/markdown-content?path=${encodeURIComponent('folder/hello world.md')}`,
    );
    assert.equal(markdownResponse.status, 200);
    assert.deepEqual(await markdownResponse.json(), {
      content: '# Hello world\n',
      filename: 'hello world.md',
      path: 'folder/hello world.md',
    });

    const searchResponse = await fetch(
      `${baseUrl}/api/search?q=hello&dir=folder`,
    );
    assert.equal(searchResponse.status, 200);
    const searchPayload = (await searchResponse.json()) as {
      count: number;
      results: Array<{ file_name: string }>;
    };
    assert.equal(searchPayload.count, 1);
    assert.equal(searchPayload.results[0]?.file_name, 'hello world.md');

    const legacyResponse = await fetch(
      `${baseUrl}/api/search/file_name=hello/current_dir=folder`,
    );
    assert.equal(legacyResponse.status, 200);
    assert.equal((await legacyResponse.json()).count, 1);
  });
});

test('supports file symlinks without following directory symlinks', async (t) => {
  await withServer(async (baseUrl, fixture) => {
    const traversalResponse = await fetch(
      `${baseUrl}/api/list-files?path=${encodeURIComponent('../outside')}`,
    );
    assert.equal(traversalResponse.status, 400);

    const privateListResponse = await fetch(
      `${baseUrl}/api/list-files?path=private-files`,
    );
    assert.equal(privateListResponse.status, 403);

    const incomingListResponse = await fetch(
      `${baseUrl}/api/list-files?path=incoming`,
    );
    assert.equal(incomingListResponse.status, 403);

    const outsideMedia = path.join(fixture.rootDir, 'outside-clip.mp4');
    const outsideMarkdown = path.join(fixture.rootDir, 'outside-note.md');
    const outsideDirectory = path.join(fixture.rootDir, 'outside-directory');
    const mediaLink = path.join(fixture.paths.filesDir, 'linked-clip.mp4');
    const markdownLink = path.join(fixture.paths.filesDir, 'linked-note.md');
    const directoryLink = path.join(fixture.paths.filesDir, 'linked-directory');
    const brokenLink = path.join(fixture.paths.filesDir, 'broken.mp4');

    await fs.writeFile(outsideMedia, 'external media');
    await fs.writeFile(outsideMarkdown, '# External note\n');
    await fs.mkdir(outsideDirectory);
    await fs.writeFile(path.join(outsideDirectory, 'hidden.txt'), 'hidden');
    try {
      await fs.symlink(outsideMedia, mediaLink);
      await fs.symlink(outsideMarkdown, markdownLink);
      await fs.symlink(outsideDirectory, directoryLink);
      await fs.symlink(path.join(fixture.rootDir, 'missing.mp4'), brokenLink);
    } catch (error) {
      t.skip(`symlinks unavailable: ${String(error)}`);
      return;
    }

    const listResponse = await fetch(`${baseUrl}/api/list-files`);
    assert.equal(listResponse.status, 200);
    const entries = (await listResponse.json()) as Array<{
      name: string;
      isDirectory: boolean;
    }>;
    assert.deepEqual(
      entries.find((entry) => entry.name === 'linked-clip.mp4'),
      { name: 'linked-clip.mp4', isDirectory: false },
    );
    assert.equal(
      entries.some((entry) => entry.name === 'linked-directory'),
      false,
    );
    assert.equal(
      entries.some((entry) => entry.name === 'broken.mp4'),
      false,
    );

    const mediaPageResponse = await fetch(`${baseUrl}/files/linked-clip.mp4`);
    assert.equal(mediaPageResponse.status, 200);
    assert.match(await mediaPageResponse.text(), /<title>SPA<\/title>/);

    const mediaResponse = await fetch(`${baseUrl}/files/linked-clip.mp4?raw=1`);
    assert.equal(mediaResponse.status, 200);
    assert.match(
      mediaResponse.headers.get('content-type') ?? '',
      /^video\/mp4/,
    );
    assert.equal(await mediaResponse.text(), 'external media');

    const markdownResponse = await fetch(
      `${baseUrl}/api/markdown-content?path=linked-note.md`,
    );
    assert.equal(markdownResponse.status, 200);
    assert.deepEqual(await markdownResponse.json(), {
      content: '# External note\n',
      filename: 'linked-note.md',
      path: 'linked-note.md',
    });

    const searchResponse = await fetch(
      `${baseUrl}/api/search?q=linked-clip&dir=`,
    );
    assert.equal(searchResponse.status, 200);
    assert.equal((await searchResponse.json()).count, 1);

    const directoryResponse = await fetch(`${baseUrl}/files/linked-directory/`);
    assert.equal(directoryResponse.status, 404);
  });
});

test('uploads Unicode filenames and reports malformed uploads', async () => {
  await withServer(async (baseUrl, fixture) => {
    const form = new FormData();
    form.append('file', new Blob(['upload content']), '中文 文件.txt');
    const uploadResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: form,
    });
    assert.equal(uploadResponse.status, 200);
    assert.equal(
      (await uploadResponse.json()).message,
      'File uploaded successfully!',
    );

    const uploadedNames = await fs.readdir(fixture.paths.incomingDir);
    const uploadedName = uploadedNames.find((name) => name !== 'index.html');
    assert.equal(uploadedName, '中文 文件.txt');
    assert.equal(
      await fs.readFile(
        path.join(fixture.paths.incomingDir, uploadedName),
        'utf8',
      ),
      'upload content',
    );

    const malformedResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: new FormData(),
    });
    assert.equal(malformedResponse.status, 400);
  });
});

test('keeps API 404s separate from the SPA fallback', async () => {
  await withServer(async (baseUrl) => {
    const apiResponse = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(apiResponse.status, 404);
    assert.deepEqual(await apiResponse.json(), {
      error: 'API endpoint not found',
    });

    const spaResponse = await fetch(`${baseUrl}/client/deep/link`);
    assert.equal(spaResponse.status, 200);
    assert.match(await spaResponse.text(), /<title>SPA<\/title>/);
  });
});
