import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` -> normal multi-file dist/
// `npm run build:single` -> one self-contained dist-single/index.html (easy to host anywhere)
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist', chunkSizeWarningLimit: 1200 },
  test: { environment: 'node', globals: true, include: ['src/tests/**/*.test.ts'] },
}));
