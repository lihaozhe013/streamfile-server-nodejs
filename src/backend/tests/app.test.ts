import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createApp } from '@/app';
import { ensureRuntimeDirectories } from '@/config';
import type { RuntimeConfig, RuntimeFeatures, RuntimePaths } from '@/types/index';

interface Fixture {
  rootDir: string;
  paths: RuntimePaths;
  runtime: RuntimeConfig;
}

async function createFixture(features: Partial<RuntimeFeatures> = {}): Promise<Fixture> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'streamfile-backend-'));
  const publicDir = path.join(rootDir, 'public');
  const filesDir = path.join(rootDir, 'files');
  const incomingDir = path.join(filesDir, 'incoming');
  const privateDir = path.join(filesDir, 'private-files');
  const paths: RuntimePaths = {
    dataRoot: rootDir,
    publicDir,
    publicEmbedded: false,
    filesDir,
    incomingDir,
    privateDir,
    spaShellPath: path.join(publicDir, 'index.html'),
    notFoundPath: path.join(publicDir, '404-index.html')
  };

  await fs.mkdir(publicDir, { recursive: true });
  await fs.mkdir(path.join(publicDir, 'icons'), { recursive: true });
  await fs.mkdir(path.join(filesDir, 'folder', 'custom'), { recursive: true });
  await fs.mkdir(path.join(filesDir, 'incoming-evil'), { recursive: true });
  await fs.mkdir(path.join(filesDir, 'private-files'), { recursive: true });
  await fs.writeFile(paths.spaShellPath, '<!doctype html><title>SPA</title>');
  await fs.writeFile(paths.notFoundPath, '<!doctype html><title>404</title>');
  await fs.writeFile(path.join(publicDir, 'icons', 'server.svg'), '<svg />');
  await fs.writeFile(path.join(filesDir, 'folder', 'hello world.md'), '# Hello world\n');
  await fs.writeFile(path.join(filesDir, 'folder', 'clip.mp4'), 'media');
  await fs.writeFile(path.join(filesDir, 'folder', 'note.txt'), 'plain text');
  await fs.writeFile(
    path.join(filesDir, 'folder', 'custom', 'index.html'),
    '<!doctype html><title>Custom</title>'
  );
  await fs.writeFile(path.join(filesDir, 'private-files', 'secret.txt'), 'secret');
  await fs.writeFile(path.join(filesDir, 'incoming-evil', 'visible.txt'), 'visible');
  await fs.writeFile(path.join(filesDir, '.hidden'), 'hidden');

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
  await ensureRuntimeDirectories(runtime);
  return { rootDir, paths, runtime };
}

async function withServer(
  callback: (baseUrl: string, fixture: Fixture) => Promise<void>,
  features: Partial<RuntimeFeatures> = {}
): Promise<void> {
  const fixture = await createFixture(features);
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

    const rootIconResponse = await fetch(`${baseUrl}/icons/server.svg`);
    assert.equal(rootIconResponse.status, 200);
    assert.equal(await rootIconResponse.text(), '<svg />');

    const publicIconResponse = await fetch(`${baseUrl}/public/icons/server.svg`);
    assert.equal(publicIconResponse.status, 200);
    assert.equal(await publicIconResponse.text(), '<svg />');

    const markdownResponse = await fetch(`${baseUrl}/files/folder/hello%20world.md`);
    assert.equal(markdownResponse.status, 200);
    assert.match(await markdownResponse.text(), /<title>SPA<\/title>/);

    const rawResponse = await fetch(`${baseUrl}/files/folder/hello%20world.md?raw=1`);
    assert.equal(rawResponse.status, 200);
    assert.equal(await rawResponse.text(), '# Hello world\n');

    const mediaResponse = await fetch(`${baseUrl}/files/folder/clip.mp4`);
    assert.equal(mediaResponse.status, 200);
    assert.match(await mediaResponse.text(), /<title>SPA<\/title>/);

    const customResponse = await fetch(`${baseUrl}/files/folder/custom/`);
    assert.equal(customResponse.status, 200);
    assert.match(await customResponse.text(), /<title>Custom<\/title>/);

    const privateResponse = await fetch(`${baseUrl}/files/private-files/secret.txt?raw=1`);
    assert.equal(privateResponse.status, 200);
    assert.equal(await privateResponse.text(), 'secret');

    const incomingResponse = await fetch(`${baseUrl}/files/incoming/index.html?raw=1`);
    assert.equal(incomingResponse.status, 403);

    const missingResponse = await fetch(`${baseUrl}/files/missing.txt`);
    assert.equal(missingResponse.status, 404);
    assert.match(await missingResponse.text(), /<title>404<\/title>/);
  });
});

test('reports a clear error when the SPA shell is missing', async () => {
  await withServer(async (baseUrl, fixture) => {
    await fs.unlink(fixture.paths.spaShellPath);

    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 500);
    assert.match((await response.json()).error, /SPA shell is missing.*Run bun run build/);
  });
});

test('supports nested paths, markdown API, and legacy search URLs', async () => {
  await withServer(async (baseUrl) => {
    const directoryResponse = await fetch(`${baseUrl}/api/list-files?path=folder`);
    assert.equal(directoryResponse.status, 200);
    const directoryEntries = (await directoryResponse.json()) as Array<{
      name: string;
      isDirectory: boolean;
    }>;
    assert.equal(
      directoryEntries.some((entry) => entry.name === 'hello world.md'),
      true
    );

    const markdownResponse = await fetch(
      `${baseUrl}/api/markdown-content?path=${encodeURIComponent('folder/hello world.md')}`
    );
    assert.equal(markdownResponse.status, 200);
    assert.deepEqual(await markdownResponse.json(), {
      content: '# Hello world\n',
      filename: 'hello world.md',
      path: 'folder/hello world.md'
    });

    const searchResponse = await fetch(`${baseUrl}/api/search?q=hello&dir=folder`);
    assert.equal(searchResponse.status, 200);
    const searchPayload = (await searchResponse.json()) as {
      count: number;
      results: Array<{ file_name: string }>;
    };
    assert.equal(searchPayload.count, 1);
    assert.equal(searchPayload.results[0]?.file_name, 'hello world.md');

    const legacyResponse = await fetch(`${baseUrl}/api/search/file_name=hello/current_dir=folder`);
    assert.equal(legacyResponse.status, 200);
    assert.equal((await legacyResponse.json()).count, 1);
  });
});

test('supports file symlinks without following directory symlinks', async (t) => {
  await withServer(async (baseUrl, fixture) => {
    const traversalResponse = await fetch(
      `${baseUrl}/api/list-files?path=${encodeURIComponent('../outside')}`
    );
    assert.equal(traversalResponse.status, 400);

    const privateListResponse = await fetch(`${baseUrl}/api/list-files?path=private-files`);
    assert.equal(privateListResponse.status, 403);

    const incomingListResponse = await fetch(`${baseUrl}/api/list-files?path=incoming`);
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
      { name: 'linked-clip.mp4', isDirectory: false }
    );
    assert.equal(
      entries.some((entry) => entry.name === 'linked-directory'),
      false
    );
    assert.equal(
      entries.some((entry) => entry.name === 'broken.mp4'),
      false
    );

    const mediaPageResponse = await fetch(`${baseUrl}/files/linked-clip.mp4`);
    assert.equal(mediaPageResponse.status, 200);
    assert.match(await mediaPageResponse.text(), /<title>SPA<\/title>/);

    const mediaResponse = await fetch(`${baseUrl}/files/linked-clip.mp4?raw=1`);
    assert.equal(mediaResponse.status, 200);
    assert.match(mediaResponse.headers.get('content-type') ?? '', /^video\/mp4/);
    assert.equal(await mediaResponse.text(), 'external media');

    const markdownResponse = await fetch(`${baseUrl}/api/markdown-content?path=linked-note.md`);
    assert.equal(markdownResponse.status, 200);
    assert.deepEqual(await markdownResponse.json(), {
      content: '# External note\n',
      filename: 'linked-note.md',
      path: 'linked-note.md'
    });

    const searchResponse = await fetch(`${baseUrl}/api/search?q=linked-clip&dir=`);
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
      body: form
    });
    assert.equal(uploadResponse.status, 200);
    assert.equal((await uploadResponse.json()).message, 'File uploaded successfully!');

    const uploadedNames = await fs.readdir(fixture.paths.incomingDir);
    const uploadedName = uploadedNames.find((name) => name !== 'index.html');
    assert.equal(uploadedName, '中文 文件.txt');
    assert.equal(
      await fs.readFile(path.join(fixture.paths.incomingDir, uploadedName), 'utf8'),
      'upload content'
    );

    const malformedResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: new FormData()
    });
    assert.equal(malformedResponse.status, 400);
  });
});

async function uploadTo(
  baseUrl: string,
  fileName: string,
  content: string,
  destination?: string
): Promise<Response> {
  const form = new FormData();
  if (destination !== undefined) form.append('destination', destination);
  form.append('file', new Blob([content]), fileName);
  return fetch(`${baseUrl}/upload`, { method: 'POST', body: form });
}

test('uploads to visible directories and auto-renames collisions', async () => {
  await withServer(async (baseUrl, fixture) => {
    const first = await uploadTo(baseUrl, 'greeting.txt', 'hello', 'folder');
    assert.equal(first.status, 200);
    const firstBody = (await first.json()) as {
      message: string;
      relativePath: string;
      url: string;
    };
    assert.equal(firstBody.message, 'File uploaded successfully!');
    assert.equal(firstBody.relativePath, 'folder/greeting.txt');
    assert.equal(firstBody.url, '/files/folder/greeting.txt');
    assert.equal(
      await fs.readFile(path.join(fixture.paths.filesDir, 'folder', 'greeting.txt'), 'utf8'),
      'hello'
    );

    const second = await uploadTo(baseUrl, 'greeting.txt', 'again', 'folder');
    assert.equal(second.status, 200);
    const secondBody = (await second.json()) as { relativePath: string };
    assert.equal(secondBody.relativePath, 'folder/greeting (1).txt');
    assert.equal(
      await fs.readFile(path.join(fixture.paths.filesDir, 'folder', 'greeting.txt'), 'utf8'),
      'hello'
    );

    const nested = await uploadTo(baseUrl, '中文 文件.bin', 'bytes', 'sub dir/中文');
    assert.equal(nested.status, 200);
    const nestedBody = (await nested.json()) as {
      relativePath: string;
      url: string;
    };
    assert.equal(nestedBody.relativePath, 'sub dir/中文/中文 文件.bin');
    assert.equal(
      nestedBody.url,
      '/files/sub%20dir/%E4%B8%AD%E6%96%87/%E4%B8%AD%E6%96%87%20%E6%96%87%E4%BB%B6.bin'
    );
    assert.equal(
      await fs.readFile(
        path.join(fixture.paths.filesDir, 'sub dir', '中文', '中文 文件.bin'),
        'utf8'
      ),
      'bytes'
    );

    const root = await uploadTo(baseUrl, 'root-file.txt', 'top', '.');
    assert.equal(root.status, 200);
    const rootBody = (await root.json()) as { relativePath: string };
    assert.equal(rootBody.relativePath, 'root-file.txt');
    assert.equal(
      await fs.readFile(path.join(fixture.paths.filesDir, 'root-file.txt'), 'utf8'),
      'top'
    );

    const inbox = await uploadTo(baseUrl, 'inbox-only.txt', 'hidden', '');
    assert.equal(inbox.status, 200);
    const inboxBody = (await inbox.json()) as Record<string, unknown>;
    assert.equal('relativePath' in inboxBody, false);

    const listResponse = await fetch(`${baseUrl}/api/list-files?path=folder`);
    const listNames = ((await listResponse.json()) as Array<{ name: string }>)
      .map((entry) => entry.name)
      .sort();
    assert.deepEqual(listNames, [
      'clip.mp4',
      'custom',
      'greeting (1).txt',
      'greeting.txt',
      'hello world.md',
      'note.txt'
    ]);
  });
});

test('rejects traversal, protected, and hidden upload destinations', async () => {
  await withServer(async (baseUrl, fixture) => {
    await fs.symlink(fixture.rootDir, path.join(fixture.paths.filesDir, 'link-out'), 'dir');

    const invalidDestinations = [
      '../escape',
      'a/../../escape',
      'incoming',
      'incoming/sub',
      'private-files',
      'private-files/sub',
      '.hidden/sub',
      'sub/.hidden',
      'link-out/outside'
    ];
    for (const destination of invalidDestinations) {
      const response = await uploadTo(baseUrl, 'rejected.txt', 'nope', destination);
      assert.equal(response.status, 400, `destination "${destination}" should be rejected`);
      assert.equal((await response.json()).error, 'Invalid upload destination');
    }

    const stagedNames = await fs.readdir(fixture.paths.incomingDir);
    assert.deepEqual(
      stagedNames.filter((name) => name !== 'index.html'),
      [],
      'rejected uploads must not linger in staging'
    );
    await assert.rejects(fs.stat(path.join(fixture.paths.filesDir, 'escape')));
  });
});

test('creates visible directories through the mkdir API', async () => {
  await withServer(async (baseUrl, fixture) => {
    const mkdir = async (body: unknown): Promise<Response> =>
      fetch(`${baseUrl}/api/mkdir`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });

    const created = await mkdir({ path: 'a/b c' });
    assert.equal(created.status, 200);
    assert.deepEqual(await created.json(), {
      created: true,
      relativePath: 'a/b c'
    });
    const stats = await fs.stat(path.join(fixture.paths.filesDir, 'a', 'b c'));
    assert.equal(stats.isDirectory(), true);

    const again = await mkdir({ path: 'a/b c' });
    assert.equal(again.status, 200);
    assert.equal((await again.json()).created, false);

    const existing = await mkdir({ path: 'folder/custom' });
    assert.equal(existing.status, 200);
    assert.equal((await existing.json()).created, false);

    for (const rejectedPath of [
      'incoming',
      'incoming/sub',
      'private-files',
      '.cache',
      'a/.hidden',
      '../escape',
      '',
      '.'
    ]) {
      const response = await mkdir({ path: rejectedPath });
      assert.equal(response.status, 400, `path "${rejectedPath}" should be rejected`);
    }

    assert.equal((await mkdir({})).status, 400);
    assert.equal((await mkdir({ path: 42 })).status, 400);

    const listResponse = await fetch(`${baseUrl}/api/list-files`);
    const names = ((await listResponse.json()) as Array<{ name: string }>).map(
      (entry) => entry.name
    );
    assert.ok(names.includes('a'));
  });
});

test('keeps API 404s separate from the SPA fallback', async () => {
  await withServer(async (baseUrl) => {
    const apiResponse = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(apiResponse.status, 404);
    assert.deepEqual(await apiResponse.json(), {
      error: 'API endpoint not found'
    });

    const spaResponse = await fetch(`${baseUrl}/client/deep/link`);
    assert.equal(spaResponse.status, 200);
    assert.match(await spaResponse.text(), /<title>SPA<\/title>/);
  });
});

test('reports effective feature flags without caching', async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/features`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), {
        upload: false,
        privateFiles: false,
        homePage: false,
        publicTrafficLimits: false
      });
    },
    { upload: false, privateFiles: false, homePage: false }
  );
});

test('leaves public traffic unrestricted when its feature flag is disabled', async () => {
  await withServer(async (baseUrl) => {
    const responses = await Promise.all(
      Array.from({ length: 25 }, () => fetch(`${baseUrl}/files/folder/note.txt?raw=1`))
    );
    assert.equal(
      responses.every((response) => response.status === 200),
      true
    );
    assert.equal(responses[0]?.headers.get('x-robots-tag'), null);
    await Promise.all(responses.map((response) => response.arrayBuffer()));
  });
});

test('limits repeated content and search requests in public traffic mode', async () => {
  await withServer(
    async (baseUrl) => {
      const responses = await Promise.all(
        Array.from({ length: 25 }, () => fetch(`${baseUrl}/files/folder/note.txt?raw=1`))
      );
      assert.equal(responses.filter((response) => response.status === 429).length > 0, true);
      const limited = responses.find((response) => response.status === 429);
      assert.equal(limited?.headers.get('retry-after'), '60');
      assert.equal(limited?.headers.get('x-robots-tag'), 'noindex, nofollow');
      assert.deepEqual(await limited?.json(), { error: 'Too many requests' });
      await Promise.all(
        responses
          .filter((response) => response !== limited)
          .map((response) => response.arrayBuffer())
      );
    },
    { publicTrafficLimits: true }
  );

  await withServer(
    async (baseUrl) => {
      const urls = [
        '/api/search?q=hello',
        '/api/search/file_name=hello/current_dir=folder',
        '/api/search?q=hello',
        '/api/search/file_name=hello/current_dir=folder'
      ];
      const responses = await Promise.all(urls.map((url) => fetch(`${baseUrl}${url}`)));
      assert.equal(responses.filter((response) => response.status === 429).length, 1);
      await Promise.all(responses.map((response) => response.arrayBuffer()));
    },
    { publicTrafficLimits: true }
  );
});

test('marks large file and markdown responses for proxy speed limiting', async () => {
  await withServer(
    async (baseUrl, fixture) => {
      await fs.writeFile(
        path.join(fixture.paths.filesDir, 'folder', 'large.bin'),
        Buffer.alloc(2 * 1024 * 1024)
      );
      await fs.writeFile(
        path.join(fixture.paths.filesDir, 'folder', 'large.md'),
        'x'.repeat(2 * 1024 * 1024)
      );

      const rangeResponse = await fetch(`${baseUrl}/files/folder/large.bin?raw=1`, {
        headers: { Range: 'bytes=0-15' }
      });
      assert.equal(rangeResponse.status, 206);
      assert.equal(rangeResponse.headers.get('content-range'), 'bytes 0-15/2097152');
      assert.equal(rangeResponse.headers.get('x-accel-limit-rate'), '524288');
      assert.equal(rangeResponse.headers.get('x-accel-buffering'), 'yes');
      assert.equal((await rangeResponse.arrayBuffer()).byteLength, 16);

      const markdownResponse = await fetch(`${baseUrl}/api/markdown-content?path=folder/large.md`);
      assert.equal(markdownResponse.status, 200);
      assert.equal(markdownResponse.headers.get('x-accel-limit-rate'), '524288');
      assert.equal(markdownResponse.headers.get('x-accel-buffering'), 'yes');
      await markdownResponse.arrayBuffer();

      const pageResponse = await fetch(`${baseUrl}/files/folder/large.md`);
      assert.equal(pageResponse.headers.get('x-accel-limit-rate'), null);
      assert.equal(pageResponse.headers.get('x-accel-buffering'), null);
      await pageResponse.arrayBuffer();
    },
    { publicTrafficLimits: true }
  );

  await withServer(async (baseUrl, fixture) => {
    await fs.writeFile(
      path.join(fixture.paths.filesDir, 'folder', 'large.bin'),
      Buffer.alloc(2 * 1024 * 1024)
    );
    const response = await fetch(`${baseUrl}/files/folder/large.bin?raw=1`, {
      headers: { Range: 'bytes=0-15' }
    });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('x-accel-limit-rate'), null);
    assert.equal(response.headers.get('x-robots-tag'), null);
    await response.arrayBuffer();
  });
});

test('rejects uploads and directory creation before writing when uploads are disabled', async () => {
  await withServer(
    async (baseUrl, fixture) => {
      const stagedBefore = await fs.readdir(fixture.paths.incomingDir);
      const uploaded = await uploadTo(baseUrl, 'blocked.txt', 'content', '.');
      assert.equal(uploaded.status, 403);
      assert.deepEqual(await uploaded.json(), { error: 'Uploads are disabled' });
      assert.deepEqual(await fs.readdir(fixture.paths.incomingDir), stagedBefore);
      await assert.rejects(fs.access(path.join(fixture.paths.filesDir, 'blocked.txt')));

      const mkdir = await fetch(`${baseUrl}/api/mkdir`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: 'blocked-folder' })
      });
      assert.equal(mkdir.status, 403);
      assert.deepEqual(await mkdir.json(), { error: 'Uploads are disabled' });
      await assert.rejects(fs.access(path.join(fixture.paths.filesDir, 'blocked-folder')));
    },
    { upload: false }
  );
});

test('blocks direct private files while keeping them on disk and hidden', async () => {
  await withServer(
    async (baseUrl, fixture) => {
      await fs.writeFile(path.join(fixture.paths.privateDir, 'note.md'), '# Secret');
      await fs.writeFile(path.join(fixture.paths.privateDir, 'clip.mp4'), 'video');
      const blockedUrls = [
        '/files/private-files/secret.txt',
        '/files/private-files/secret.txt?raw=1',
        '/files/private-files/note.md',
        '/files/private-files/note.md?raw=1',
        '/files/private-files/clip.mp4',
        '/files/private-files/clip.mp4?raw=1',
        '/files/private-files/'
      ];
      for (const url of blockedUrls) {
        const response = await fetch(`${baseUrl}${url}`);
        assert.equal(response.status, 403, url);
        assert.deepEqual(await response.json(), { error: 'Access denied' });
      }
      const markdown = await fetch(`${baseUrl}/api/markdown-content?path=private-files/note.md`);
      assert.equal(markdown.status, 403);
      assert.deepEqual(await markdown.json(), { error: 'Access denied' });
      assert.equal((await fetch(`${baseUrl}/api/list-files?path=private-files`)).status, 403);
      const search = await fetch(`${baseUrl}/api/search?q=secret&dir=private-files`);
      assert.equal(search.status, 200);
      assert.deepEqual(await search.json(), { error: 'Invalid search path' });
      assert.equal(
        await fs.readFile(path.join(fixture.paths.privateDir, 'secret.txt'), 'utf8'),
        'secret'
      );
      assert.equal((await fetch(`${baseUrl}/files/folder/note.txt`)).status, 200);
    },
    { privateFiles: false }
  );
});

test('blocks symlink aliases into disabled private files', async (t) => {
  await withServer(
    async (baseUrl, fixture) => {
      const fileAlias = path.join(fixture.paths.filesDir, 'secret-alias.txt');
      const markdownAlias = path.join(fixture.paths.filesDir, 'secret-alias.md');
      const directoryAlias = path.join(fixture.paths.filesDir, 'private-alias');
      await fs.writeFile(path.join(fixture.paths.privateDir, 'secret.md'), '# Secret');
      try {
        await fs.symlink(path.join(fixture.paths.privateDir, 'secret.txt'), fileAlias);
        await fs.symlink(path.join(fixture.paths.privateDir, 'secret.md'), markdownAlias);
        await fs.symlink(fixture.paths.privateDir, directoryAlias, 'dir');
      } catch (error) {
        t.skip(`symlinks unavailable: ${String(error)}`);
        return;
      }

      assert.equal((await fetch(`${baseUrl}/files/secret-alias.txt?raw=1`)).status, 404);
      assert.equal(
        (await fetch(`${baseUrl}/api/markdown-content?path=secret-alias.md`)).status,
        404
      );
      assert.equal((await fetch(`${baseUrl}/files/private-alias/`)).status, 404);
      assert.equal((await fetch(`${baseUrl}/files/private-alias/secret.txt?raw=1`)).status, 404);
      assert.equal((await fetch(`${baseUrl}/api/list-files?path=private-alias`)).status, 403);
      const listing = await fetch(`${baseUrl}/api/list-files`);
      const entries = (await listing.json()) as Array<{ name: string }>;
      assert.equal(
        entries.some((entry) => entry.name.includes('alias')),
        false
      );
      const search = await fetch(`${baseUrl}/api/search?q=secret-alias&dir=`);
      assert.equal((await search.json()).count, 0);
    },
    { privateFiles: false }
  );
});

test('redirects the root to files when the home page is disabled', async () => {
  await withServer(
    async (baseUrl, fixture) => {
      await fs.writeFile(
        path.join(fixture.paths.filesDir, 'index.html'),
        '<title>Custom root</title>'
      );
      const root = await fetch(`${baseUrl}/`, { redirect: 'manual' });
      assert.equal(root.status, 302);
      assert.equal(root.headers.get('location'), '/files/');
      const filesRoot = await fetch(`${baseUrl}/files/`);
      assert.equal(filesRoot.status, 200);
      assert.match(await filesRoot.text(), /Custom root/);
      const missingApi = await fetch(`${baseUrl}/api/missing`);
      assert.equal(missingApi.status, 404);
      assert.deepEqual(await missingApi.json(), { error: 'API endpoint not found' });
    },
    { homePage: false }
  );
});

test('serves paths through dot directories and direct dot files', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'streamfile-dothome-'));
  try {
    // Simulate home-based layout: every sendFile target sits under a dot
    // directory, which the send library would otherwise answer with 404.
    const homeDir = path.join(rootDir, '.home');
    const publicDir = path.join(homeDir, '.local', 'stream-file-server', 'public');
    const filesDir = path.join(homeDir, '.local', 'stream-file-server', 'files');
    await fs.mkdir(path.join(publicDir, 'assets'), { recursive: true });
    await fs.mkdir(filesDir, { recursive: true });
    await fs.writeFile(path.join(publicDir, 'index.html'), '<!doctype html><title>SPA</title>');
    await fs.writeFile(path.join(publicDir, '404-index.html'), '<!doctype html><title>404</title>');
    await fs.writeFile(path.join(publicDir, 'assets', 'app.js'), 'console.log("app");\n');
    await fs.writeFile(path.join(filesDir, '.hidden'), 'hidden');
    await fs.writeFile(path.join(filesDir, 'note.txt'), 'plain text');

    const runtime: RuntimeConfig = {
      server: { host: '127.0.0.1', port: 0 },
      features: {
        upload: true,
        privateFiles: true,
        homePage: true,
        publicTrafficLimits: false
      },
      paths: {
        dataRoot: homeDir,
        publicDir,
        publicEmbedded: false,
        filesDir,
        incomingDir: path.join(filesDir, 'incoming'),
        privateDir: path.join(filesDir, 'private-files'),
        spaShellPath: path.join(publicDir, 'index.html'),
        notFoundPath: path.join(publicDir, '404-index.html')
      },
      configPath: path.join(homeDir, '.config', 'stream-file-server', 'config.yaml')
    };
    await ensureRuntimeDirectories(runtime);
    const server = createApp(runtime).listen(0, '127.0.0.1');

    try {
      await new Promise<void>((resolve, reject) => {
        server.once('listening', () => resolve());
        server.once('error', reject);
      });
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Test server did not expose an address');
      }
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const spaResponse = await fetch(`${baseUrl}/client/deep/link`);
      assert.equal(spaResponse.status, 200);
      assert.match(await spaResponse.text(), /<title>SPA<\/title>/);

      const notFoundResponse = await fetch(`${baseUrl}/files/missing.txt`);
      assert.equal(notFoundResponse.status, 404);
      assert.match(await notFoundResponse.text(), /<title>404<\/title>/);

      const rawResponse = await fetch(`${baseUrl}/files/note.txt?raw=1`);
      assert.equal(rawResponse.status, 200);
      assert.equal(await rawResponse.text(), 'plain text');

      const dotFileResponse = await fetch(`${baseUrl}/files/.hidden`);
      assert.equal(dotFileResponse.status, 200);
      assert.equal(await dotFileResponse.text(), 'hidden');

      const assetResponse = await fetch(`${baseUrl}/assets/app.js`);
      assert.equal(assetResponse.status, 200);
      assert.equal(await assetResponse.text(), 'console.log("app");\n');
    } finally {
      await closeServer(server);
    }
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});
