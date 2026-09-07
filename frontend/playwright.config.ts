import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.ts/,
  timeout: 30000,
  workers: 1,
  use: {
    viewport: { width: 1366, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'NG_BUILD_MAX_WORKERS=2 NX_DAEMON=false pnpm dev:admin',
      url: 'http://127.0.0.1:4200',
      reuseExistingServer: !process.env['CI'],
      timeout: 120000,
    },
    {
      command: 'node tests/mock-api.mjs',
      url: 'http://127.0.0.1:4302/healthz',
      reuseExistingServer: false,
    },
    {
      command:
        'PORT=4301 HOST=127.0.0.1 API_INTERNAL_URL=http://127.0.0.1:4302 node dist/apps/smart-customer/server/server.mjs',
      url: 'http://127.0.0.1:4301/healthz',
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
