import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Library consumers install this package in both DEV and production apps.
// npm's prepare hook inherits the consumer's NODE_ENV; if that is
// "development", Vite sets isProduction=false and emits jsxDEV /
// jsx-dev-runtime, which production React does not expose.
// Force production JSX regardless of the ambient NODE_ENV.
export default defineConfig({
  mode: 'production',
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  oxc: {
    jsx: {
      runtime: 'automatic',
      development: false,
    },
  },
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
        '@atlaskit/pragmatic-drag-and-drop',
        /^@atlaskit\/pragmatic-drag-and-drop\/.*/,
      ],
    },
  },
});
