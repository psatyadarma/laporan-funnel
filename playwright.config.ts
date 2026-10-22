import { defineConfig, devices } from '@playwright/test';

// End-to-end QA: runs the real app locally with mock payments and a fake AI server.
// `npm run test:e2e` (first run builds the client and creates a fresh local database).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1, // tests share the fake AI server's mode
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:8788',
    ...devices['Pixel 7'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  webServer: [
    { command: 'node tests/e2e/fake-ai.mjs', url: 'http://localhost:8790/__calls', reuseExistingServer: !process.env.CI, timeout: 20_000 },
    { command: 'node tests/e2e/start-app.mjs', url: 'http://localhost:8788/api/health', reuseExistingServer: !process.env.CI, timeout: 180_000 },
  ],
});
