import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: isCI ? [['github'], ['html']] : 'html',
  timeout: isCI ? 120_000 : 60_000,
  globalTimeout: isCI ? 45 * 60 * 1000 : 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: isCI ? 30_000 : 15_000,
    navigationTimeout: isCI ? 60_000 : 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !isCI,
    timeout: isCI ? 180_000 : 60_000,
    env: {
      ...process.env,
      VITE_TESTING_MODE: 'true',
    },
  },
});
