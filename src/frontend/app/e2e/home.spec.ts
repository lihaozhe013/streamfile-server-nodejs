import { expect, test } from '@playwright/test';

test('renders the SPA home page and navigates without a document reload', async ({
  page,
}) => {
  await page.route('**/api/list-files*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    });
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      name: 'A calm place for everything you share.',
    }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Browse files' }).first().click();
  await expect(page).toHaveURL(/\/files\/$/);
  await expect(page.getByRole('heading', { name: 'All files' })).toBeVisible();
});
