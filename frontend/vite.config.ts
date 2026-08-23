import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite emits hashed filenames under dist/assets/ by default, which is suitable
// for long-term caching. The deployment host should serve them with immutable
// Cache-Control headers (e.g. max-age=31536000, immutable).
export default defineConfig({
  plugins: [react()],
  publicDir: 'static',
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
});
