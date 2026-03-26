import { defineConfig, devices } from '@playwright/test';

const playwrightScope = process.env.PLAYWRIGHT_SCOPE;
const shouldSkipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';
const browserChannel = process.env.CI ? 'chromium' : 'chrome';
const webBaseUrl = 'http://127.0.0.1:3100';
const webDistDir = `.next-playwright/web-${process.pid}`;
const webServerCommand = [
  'LLM_PROVIDER=mock',
  'MOCK_STREAM_CHAT_PREFIX=[web-e2e]',
  `NEXT_DIST_DIR=${webDistDir}`,
  'pnpm -C apps/web exec next dev -p 3100 -H 127.0.0.1',
].join(' ');
const webServers = [
  ...(playwrightScope === 'admin'
    ? []
    : [
        {
          command: webServerCommand,
          url: `${webBaseUrl}/chat`,
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
        baseURL: webBaseUrl,
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
