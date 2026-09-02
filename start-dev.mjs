import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'node:os';
import path from 'node:path';

const cacheDir = path.join(os.tmpdir(), 'vite-cache-work-timer-fix-bug');

const server = await createServer({
  configFile: false,
  root: '.',
  plugins: [react()],
  server: { port: 5176, host: true },
  cacheDir,
  build: { outDir: 'dist', sourcemap: true, target: 'es2022' },
});
await server.listen();
console.log(`Vite running at http://localhost:5176/`);
console.log(`Cache dir: ${cacheDir}`);
