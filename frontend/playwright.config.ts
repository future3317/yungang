import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'python -m uvicorn backend.app:app --port 8000', cwd: '..', url: 'http://127.0.0.1:8000/api/meta', reuseExistingServer: true, timeout: 120_000 },
    { command: 'npm run dev -- --host 127.0.0.1', cwd: '.', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 120_000 }
  ],
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true } }
  ]
});
