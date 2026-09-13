import { defineConfig } from 'vite';
import { resolve } from 'path';
import cadenteBlogPlugin from './scripts/blog/vite-plugin.mjs';

export default defineConfig({
  base: '/',
  plugins: [
    cadenteBlogPlugin({
      contentDir: resolve(__dirname, 'content/blog'),
      origin: 'https://cadente-hub.github.io',
    }),
  ],
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
