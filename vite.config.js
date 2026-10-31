import { defineConfig } from 'vite';
import { resolve } from 'path';
import cadenteBlogPlugin from './scripts/blog/vite-plugin.mjs';
import cadentePages, { pageInputs } from './scripts/i18n/vite-plugin.mjs';
import cadenteSitemap from './scripts/seo/vite-plugin.mjs';

const origin = 'https://cadente-hub.github.io';

export default defineConfig({
  base: '/',
  // Every page is its own entry; nothing falls back to the home page.
  appType: 'mpa',
  plugins: [
    // The home in each ready language, from pages/ and i18n/ (scripts/i18n).
    cadentePages({ root: __dirname, origin }),
    cadenteBlogPlugin({
      contentDir: resolve(__dirname, 'content/blog'),
      origin,
    }),
    // dist/sitemap.xml, from the canonical and hreflang links of every built page.
    cadenteSitemap(),
  ],
  build: {
    rollupOptions: {
      input: {
        ...pageInputs(__dirname),
      },
    },
    outDir: 'dist',
    // The home waits for its language's window catalog with a top-level await.
    target: 'es2022',
  },
});
