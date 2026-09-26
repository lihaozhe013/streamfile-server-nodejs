import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import { mockFeatures } from './mockFeatures';

const vtt = 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nHello\n';

async function mockVideo(page: Page): Promise<void> {
  await mockFeatures(page);
  const video = await fs.readFile(new URL('./fixtures/black-2s.mp4', import.meta.url));
  await page.route('**/files/**?raw=1', async (route) => {
    await route.fulfill({ status: 200, contentType: 'video/mp4', body: video });
  });
}

async function mockVtt(page: Page, check?: (url: URL, method: string) => number): Promise<void> {
  await page.route('**/api/subtitle-vtt?*', async (route) => {
    const request = route.request();
    const status = check?.(new URL(request.url()), request.method()) ?? 200;
    await route.fulfill({
      status,
      contentType: status === 200 ? 'text/vtt' : 'application/json',
      body: request.method() === 'HEAD' ? '' : status === 200 ? vtt : '{}'
    });
  });
}

test('auto-enables same-name SRT and switches different names in the fullscreen menu', async ({
  page
}) => {
  await mockVideo(page);
  await page.route('**/api/list-files?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { name: 'movie.mp4', isDirectory: false },
        { name: 'movie.srt', isDirectory: false },
        { name: 'other-language.srt', isDirectory: false }
      ])
    });
  });
  const subtitleRequests: string[] = [];
  await mockVtt(page, (url, method) => {
    subtitleRequests.push(
      `${method} ${url.searchParams.get('path')} ${url.searchParams.get('encoding')}`
    );
    return 200;
  });

  await page.goto('/files/movies/movie.mp4');
  await expect(page.locator('.subtitle-encoding')).toContainText('movie.srt');
  await page.locator('.vjs-big-play-button').click();
  const menu = page.locator('button.vjs-subs-caps-button');
  await expect(menu).toBeVisible();
  await menu.click();
  const selected = page.locator('.vjs-subs-caps-button .vjs-subtitles-menu-item.vjs-selected');
  await expect(selected).toHaveCount(1);
  await expect(selected).toContainText('movie.srt');
  expect(subtitleRequests.some((request) => request.includes('other-language.srt'))).toBe(false);
  await page
    .locator('.vjs-subs-caps-button .vjs-menu-item')
    .filter({ hasText: 'other-language.srt' })
    .click();
  await expect(page.locator('.subtitle-encoding')).toContainText('other-language.srt');

  await page.locator('.subtitle-encoding select').selectOption('gb18030');
  await expect
    .poll(() => subtitleRequests.some((request) => request.includes('other-language.srt gb18030')))
    .toBe(true);

  await page.locator('.vjs-fullscreen-control').click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
  await menu.click();
  await page.locator('.vjs-subs-caps-button .vjs-menu-item').filter({ hasText: /off/i }).click();
  await expect(page.locator('.subtitle-encoding')).toHaveCount(0);
});

test('uses a known subtitle filename when directory listing is forbidden', async ({ page }) => {
  await mockVideo(page);
  await page.route('**/api/list-files?*', async (route) => {
    await route.fulfill({ status: 403, contentType: 'application/json', body: '{}' });
  });
  await mockVtt(page, (url) =>
    url.searchParams.get('path') === 'private-files/movie.srt' ? 404 : 200
  );

  await page.goto('/files/private-files/movie.mp4');
  await expect(page.getByLabel('Subtitle filename')).toBeVisible();
  await page.getByLabel('Subtitle filename').fill('known-subtitle.srt');
  await page.getByRole('button', { name: 'Add subtitle' }).click();
  await expect(page.locator('.subtitle-encoding')).toContainText('known-subtitle.srt');
  await page.locator('.vjs-big-play-button').click();
  await page.locator('button.vjs-subs-caps-button').click();
  await expect(
    page.locator('.vjs-subs-caps-button .vjs-menu-item').filter({ hasText: 'known-subtitle.srt' })
  ).toBeVisible();
});

test('shows a retry action when a subtitle fails without interrupting the player', async ({
  page
}) => {
  await mockVideo(page);
  await page.route('**/api/list-files?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ name: 'movie.srt', isDirectory: false }])
    });
  });
  let failed = true;
  await mockVtt(page, (url) =>
    (failed && url.searchParams.get('encoding') === 'auto') ||
    url.searchParams.get('encoding') === 'utf-8'
      ? 422
      : 200
  );

  await page.goto('/files/movie.mp4');
  await expect(page.getByRole('alert')).toContainText('invalid');
  await expect(page.locator('.video-js')).toBeVisible();
  failed = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.subtitle-encoding')).toContainText('movie.srt');
  await page.locator('.subtitle-encoding select').selectOption('utf-8');
  await expect(page.getByRole('alert')).toContainText('invalid');
  await expect(page.locator('.subtitle-encoding select')).toHaveValue('utf-8');
  await page.locator('.subtitle-encoding select').selectOption('gb18030');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('retries a limited directory listing and resets tracks after navigation', async ({ page }) => {
  await mockVideo(page);
  let limited = true;
  await page.route('**/api/list-files?*', async (route) => {
    const directory = new URL(route.request().url()).searchParams.get('path');
    if (limited && directory === 'a') {
      await route.fulfill({ status: 429, contentType: 'application/json', body: '{}' });
      return;
    }
    const entries =
      directory === 'a'
        ? [{ name: 'movie.srt', isDirectory: false }]
        : directory === 'b'
          ? [
              { name: 'clip.mp4', isDirectory: false },
              { name: 'clip.srt', isDirectory: false }
            ]
          : [{ name: 'b', isDirectory: true }];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(entries)
    });
  });
  await mockVtt(page);

  await page.goto('/files/a/movie.mp4');
  await expect(page.getByRole('alert')).toContainText('limited');
  limited = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('.subtitle-encoding')).toContainText('movie.srt');

  await page.getByRole('link', { name: 'Back' }).click();
  await page.getByRole('listitem').filter({ hasText: 'Parent directory' }).click();
  await page.getByRole('listitem').filter({ hasText: 'b' }).click();
  await page.getByRole('listitem').filter({ hasText: 'clip.mp4' }).click();
  await expect(page.locator('.subtitle-encoding')).toContainText('clip.srt');
  await expect(page.locator('.video-js')).toHaveCount(1);
  await expect(page.locator('.vjs-subtitles-menu-item')).toHaveCount(1);
  await expect(page.locator('.vjs-subtitles-menu-item')).toContainText('clip.srt');
});
