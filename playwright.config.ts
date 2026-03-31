import { defineConfig, devices } from '@playwright/test';

const playwrightScope = process.env.PLAYWRIGHT_SCOPE;
const shouldSkipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';
const browserChannel = process.env.CI ? 'chromium' : 'chrome';
const webBaseUrl = 'http://127.0.0.1:3100';
const adminBaseUrl = 'http://127.0.0.1:3101';
const webDistDir = `.next-playwright/web-${process.pid}`;
const adminDistDir = `.next-playwright/admin-${process.pid}`;
const webServerCommand = [
  'LLM_PROVIDER=mock',
  'MOCK_STREAM_CHAT_PREFIX=[web-e2e]',
  'MOCK_STREAM_ECHO_KNOWLEDGE=1',
  'MOCK_STREAM_DELTA_DELAY_MS=72',
  `NEXT_DIST_DIR=${webDistDir}`,
  'pnpm -C apps/web exec next dev -p 3100 -H 127.0.0.1',
].join(' ');
const adminWebServerCommand = [
  `NEXT_DIST_DIR=${adminDistDir}`,
  'pnpm -C apps/admin exec next dev -p 3101 -H 127.0.0.1',
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
          command: adminWebServerCommand,
          url: `${adminBaseUrl}/login`,
          timeout: 120 * 1000,
          reuseExistingServer: false,
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
        baseURL: adminBaseUrl,
      },
    },
  ],
  webServer: shouldSkipWebServer ? undefined : webServers,
});
