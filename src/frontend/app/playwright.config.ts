import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    // Headed for local debugging; CI stays headless because CI is set there.
    headless: !process.env.CI
  },
  webServer: {
    command: 'vite --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
