import type { Page } from '@playwright/test';
import type { RuntimeFeatures } from '../src/types';

export async function mockFeatures(page: Page, features: Partial<RuntimeFeatures> = {}) {
  await page.route('**/api/features', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ upload: true, privateFiles: true, homePage: true, ...features })
    });
  });
}
