import { expect, test } from '@playwright/test';
import { mockFeatures } from './mockFeatures';

test('hides upload controls and blocks the upload page when uploads are disabled', async ({
  page
}) => {
  await mockFeatures(page, { upload: false });
  await page.route('**/api/list-files*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'A calm place for everything you share.' })
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Upload' })).toHaveCount(0);
  await expect(page.locator('.upload-panel')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Upload a file' })).toHaveCount(0);

  await page.goto('/files/');
  await expect(page.getByRole('heading', { name: 'All files' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload here' })).toHaveCount(0);
  await expect(page.getByText('No files here yet.')).toBeVisible();

  await page.goto('/upload');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('redirects the home route and keeps both upload targets available', async ({ page }) => {
  await mockFeatures(page, { homePage: false });
  await page.route('**/api/list-files*', async (route) => {
    const requestedPath = new URL(route.request().url()).searchParams.get('path') ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(requestedPath ? [] : [{ name: 'photos', isDirectory: true }])
    });
  });

  const uploadBodies: string[] = [];
  await page.route('**/upload', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const body = route.request().postDataBuffer()?.toString('latin1') ?? '';
    uploadBodies.push(body);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'File uploaded successfully!',
        relativePath: body.includes('photos') ? 'photos/folder.txt' : undefined
      })
    });
  });

  await page.goto('/');
  await expect(page).toHaveURL(/\/files\/$/);
  await expect(page.getByRole('link', { name: 'Home' })).toHaveCount(0);
  await expect(page.locator('.brand')).toHaveAttribute('href', '/files/');
  await page.getByRole('link', { name: 'Upload', exact: true }).click();
  await expect(page).toHaveURL(/\/upload$/);
  await expect(page.getByRole('radio', { name: /Inbox/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Files folder/ })).toBeVisible();

  await page.locator('.upload-panel input[type="file"]').setInputFiles({
    name: 'inbox.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('inbox')
  });
  await page.getByRole('button', { name: 'Upload file' }).click();
  await expect(page.getByRole('status')).toContainText('File uploaded successfully!');

  await page.getByRole('radio', { name: /Files folder/ }).check();
  const picker = page.getByRole('dialog', { name: 'Choose upload folder' });
  await picker.getByRole('button', { name: 'photos' }).click();
  await picker.getByRole('button', { name: /Upload to/ }).click();
  await page.locator('.upload-panel input[type="file"]').setInputFiles({
    name: 'folder.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('folder')
  });
  await page.getByRole('button', { name: 'Upload file' }).click();
  await expect(page.getByRole('status')).toContainText('Uploaded to photos/folder.txt.');
  expect(uploadBodies).toHaveLength(2);
  expect(uploadBodies[0]).toMatch(/name="destination"\r\n\r\n\r\n/);
  expect(uploadBodies[1]).toContain('photos');
});

test('shows only browsing when home and upload are disabled', async ({ page }) => {
  await mockFeatures(page, { homePage: false, upload: false, privateFiles: false });
  await page.route('**/api/list-files*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.goto('/');
  await expect(page).toHaveURL(/\/files\/$/);
  await expect(page.getByRole('link', { name: 'Home' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Upload' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Upload here' })).toHaveCount(0);
  await page.goto('/upload');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse files' }).last()).toHaveAttribute(
    'href',
    '/files/'
  );
});

test('shows a route error if feature discovery fails', async ({ page }) => {
  await page.route('**/api/features', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Feature discovery unavailable' })
    });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Unable to load this page' })).toBeVisible();
  await expect(page.getByText('Feature discovery unavailable')).toBeVisible();
});

test('shows a retry message when directory requests are rate limited', async ({ page }) => {
  await mockFeatures(page, { publicTrafficLimits: true });
  await page.route('**/api/list-files*', async (route) => {
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      headers: { 'Retry-After': '60' },
      body: JSON.stringify({ error: 'Too many requests' })
    });
  });

  await page.goto('/files/');
  await expect(page.getByRole('heading', { name: 'Please try again shortly' })).toBeVisible();
  await expect(page.getByText('Too many requests. Wait about a minute, then retry.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});
