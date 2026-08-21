import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const projectPython = process.env.YUNGANG_PYTHON || (process.env.CONDA_PREFIX ? path.join(process.env.CONDA_PREFIX, 'python') : 'python');

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: `node e2e-server.mjs`, cwd: '.', url: 'http://127.0.0.1:3000', reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true } }
  ]
});
