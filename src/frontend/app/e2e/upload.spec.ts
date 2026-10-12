import { expect, test } from '@playwright/test';
import { mockFeatures } from './mockFeatures';

test('home page uploads to a folder picked in the directory dialog', async ({ page }) => {
  await mockFeatures(page);
  await page.route('**/api/list-files*', async (route) => {
    const requestedPath = new URL(route.request().url()).searchParams.get('path') ?? '';
    const payload =
      requestedPath === ''
        ? [
            { name: 'photos', isDirectory: true },
            { name: 'notes.txt', isDirectory: false }
          ]
        : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload)
    });
  });

  let uploadBody = '';
  await page.route('**/upload', async (route) => {
    uploadBody = route.request().postDataBuffer()?.toString('latin1') ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'File uploaded successfully!',
        relativePath: 'photos/shot.png',
        url: '/files/photos/shot.png'
      })
    });
  });

  await page.goto('/');
  await page.getByRole('radio', { name: /Files folder/ }).check();

  const dialog = page.getByRole('dialog', { name: 'Choose upload folder' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'photos' }).click();
  await dialog.getByRole('button', { name: /Upload to/ }).click();

  await page.locator('.upload-panel .upload-files-input').setInputFiles({
    name: 'shot.png',
    mimeType: 'image/png',
    buffer: Buffer.from('png')
  });
  await page.getByRole('button', { name: 'Upload file' }).click();

  await expect(
    page.getByRole('status').filter({ hasText: 'Uploaded to photos/shot.png.' })
  ).toBeVisible();
  expect(uploadBody).toContain('name="destination"');
  expect(uploadBody).toContain('photos');
});

test('directory page uploads here with the current path as destination', async ({ page }) => {
  await mockFeatures(page);
  await page.route('**/api/list-files*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]'
    });
  });

  let uploadBody = '';
  await page.route('**/upload', async (route) => {
    uploadBody = route.request().postDataBuffer()?.toString('latin1') ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'File uploaded successfully!',
        relativePath: 'dropped.txt',
        url: '/files/dropped.txt'
      })
    });
  });

  await page.goto('/files/');
  const uploadButton = page.locator('.page-actions').getByRole('button', { name: 'Upload here' });
  await expect(uploadButton).toBeVisible();
  await uploadButton.click();

  const dialog = page.getByRole('dialog', { name: 'Upload a file here' });
  await expect(dialog).toContainText('Destination: /root');
  await dialog.locator('.upload-files-input').setInputFiles({
    name: 'dropped.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hi')
  });
  await dialog.getByRole('button', { name: 'Upload file' }).click();

  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({ hasText: 'Uploaded to dropped.txt.' })
  ).toBeVisible();
  expect(uploadBody).toMatch(/name="destination"\r\n\r\n\./);
});

test('home page uploads multiple selected files to the picked folder', async ({ page }) => {
  await mockFeatures(page);
  await page.route('**/api/list-files*', async (route) => {
    const requestedPath = new URL(route.request().url()).searchParams.get('path') ?? '';
    const payload = requestedPath === '' ? [{ name: 'photos', isDirectory: true }] : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload)
    });
  });

  const uploadBodies: string[] = [];
  await page.route('**/upload', async (route) => {
    uploadBodies.push(route.request().postDataBuffer()?.toString('latin1') ?? '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'File uploaded successfully!',
        relativePath: 'photos/batch.png',
        url: '/files/photos/batch.png'
      })
    });
  });

  await page.goto('/');
  await page.getByRole('radio', { name: /Files folder/ }).check();
  const dialog = page.getByRole('dialog', { name: 'Choose upload folder' });
  await dialog.getByRole('button', { name: 'photos' }).click();
  await dialog.getByRole('button', { name: /Upload to/ }).click();

  await page.locator('.upload-panel .upload-files-input').setInputFiles([
    { name: 'first.png', mimeType: 'image/png', buffer: Buffer.from('one') },
    { name: 'second.png', mimeType: 'image/png', buffer: Buffer.from('two') }
  ]);
  await expect(page.locator('.drop-zone')).toContainText('2 files selected');
  await page.getByRole('button', { name: 'Upload 2 files' }).click();

  await expect(
    page.getByRole('status').filter({ hasText: 'Uploaded 2 files to photos.' })
  ).toBeVisible();
  expect(uploadBodies).toHaveLength(2);
  expect(uploadBodies[0]).toMatch(/name="destination"\r\n\r\nphotos/);
  expect(uploadBodies[1]).toMatch(/name="destination"\r\n\r\nphotos/);
});
