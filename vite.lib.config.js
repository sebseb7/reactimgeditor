import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: resolve(import.meta.dirname, 'lib/index.js'),
      formats: ['es'],
      fileName: 'reactimgeditor',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        '@atlaskit/pragmatic-drag-and-drop',
        /^@atlaskit\/pragmatic-drag-and-drop\/.*/,
      ],
    },
  },
});
