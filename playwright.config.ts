import { defineConfig, devices } from '@playwright/test';

const playwrightScope = process.env.PLAYWRIGHT_SCOPE;
const shouldSkipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';
const browserChannel = process.env.CI ? 'chromium' : 'chrome';
const webServers = [
  ...(playwrightScope === 'admin'
    ? []
    : [
        {
          command: 'pnpm dev:web',
          url: 'http://127.0.0.1:3000/chat',
          timeout: 120 * 1000,
          reuseExistingServer: !process.env.CI,
        },
      ]),
  ...(playwrightScope === 'web'
    ? []
    : [
        {
          command: 'pnpm dev:admin',
          url: 'http://127.0.0.1:3001/login',
          timeout: 120 * 1000,
          reuseExistingServer: !process.env.CI,
        },
      ]),
];

export default defineConfig({
  testDir: './apps',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    serviceWorkers: 'block',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'web-chrome',
      testMatch: 'web/e2e/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        channel: browserChannel,
        baseURL: 'http://127.0.0.1:3000',
      },
    },
    {
      name: 'admin-chrome',
      testMatch: 'admin/e2e/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        channel: browserChannel,
        baseURL: 'http://127.0.0.1:3001',
      },
    },
  ],
  webServer: shouldSkipWebServer ? undefined : webServers,
});
