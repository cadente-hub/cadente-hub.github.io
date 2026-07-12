import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        downloads: resolve(__dirname, 'downloads.html'),
        releaseNotes: resolve(__dirname, 'release-notes.html'),
        terms: resolve(__dirname, 'terms-and-conditions.html'),
      },
    },
    outDir: 'dist',
  },
});
