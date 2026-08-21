import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const localNoProxy = ['127.0.0.1', 'localhost'];
process.env.NO_PROXY = [...new Set([process.env.NO_PROXY || '', ...localNoProxy].join(',').split(',').filter(Boolean))].join(',');
process.env.no_proxy = process.env.NO_PROXY;

const projectPython = process.env.YUNGANG_PYTHON || (process.env.CONDA_PREFIX ? path.join(process.env.CONDA_PREFIX, 'python') : 'python');
const pythonCommand = process.platform === 'win32' ? `"${projectPython}"` : projectPython;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: `${pythonCommand} -m uvicorn backend.app:app --host 127.0.0.1 --port 8000`, cwd: '..', url: 'http://127.0.0.1:8000/api/meta', reuseExistingServer: false, timeout: 120_000 },
    { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3000', cwd: '.', url: 'http://127.0.0.1:3000', reuseExistingServer: false, timeout: 120_000 },
  ],
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true } }
  ]
});
