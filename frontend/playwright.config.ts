import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const localNoProxy = ['127.0.0.1', 'localhost'];
process.env.NO_PROXY = [
  ...new Set([process.env.NO_PROXY || '', ...localNoProxy].join(',').split(',').filter(Boolean)),
].join(',');
process.env.no_proxy = process.env.NO_PROXY;

const projectPython =
  process.env.YUNGANG_PYTHON || (process.env.CONDA_PREFIX ? path.join(process.env.CONDA_PREFIX, 'python') : 'python');
const pythonCommand = process.platform === 'win32' ? `"${projectPython}"` : projectPython;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  // Stable cross-platform snapshots: omit the OS suffix from baseline names.
  // For a fully reproducible environment, run inside the Playwright Docker image:
  //   docker run --rm -it -v "$(pwd):/work" -w /work/frontend mcr.microsoft.com/playwright:v1.50.1-jammy npx playwright test e2e/visual.spec.ts
  snapshotPathTemplate: '{testDir}/{testFileName}-snapshots/{arg}-{projectName}{ext}',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `${pythonCommand} -m uvicorn backend.app:app --host 127.0.0.1 --port 8000`,
      cwd: '..',
      env: { YUNGANG_TEST_MODE: '1' },
      url: 'http://127.0.0.1:8000/api/meta',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3000',
      cwd: '.',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: 'desktop', testIgnore: /visual\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // PC is the supported product surface. Keep the mobile viewport available
    // only for explicit exploratory runs, not as a release gate.
    { name: 'visual-2048', testMatch: /visual\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 2048, height: 1053 } } },
    { name: 'visual-1920', testMatch: /visual\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } },
    { name: 'visual-1440', testMatch: /visual\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'visual-1280', testMatch: /visual\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } },
  ],
});
