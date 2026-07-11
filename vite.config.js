import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'demo',
  plugins: [react()],
  resolve: {
    alias: {
      reactimgeditor: resolve(import.meta.dirname, 'lib/index.js'),
    },
  },
});
