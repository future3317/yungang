import { spawn } from 'node:child_process';
import process from 'node:process';

const python = process.env.YUNGANG_PYTHON || (process.env.CONDA_PREFIX ? `${process.env.CONDA_PREFIX}/python` : 'python');
const api = spawn(python, ['-m', 'uvicorn', 'backend.app:app', '--port', '8000'], { cwd: '..', stdio: 'inherit', shell: process.platform === 'win32' });
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '3000'], { cwd: '.', stdio: 'inherit' });

const stop = () => {
  api.kill('SIGTERM');
  vite.kill('SIGTERM');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('exit', stop);

async function waitFor(url) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The service is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`E2E service did not become ready: ${url}`);
}

await Promise.all([waitFor('http://127.0.0.1:8000/api/meta'), waitFor('http://127.0.0.1:3000')]);
await new Promise(() => {});
