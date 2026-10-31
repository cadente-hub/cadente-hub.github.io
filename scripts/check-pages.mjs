// Opens each page of each ready language in Chromium and fails if the page logs an error or still shows a
// catalog key. Usage: node scripts/check-pages.mjs [base URL]   (default http://localhost:5199, the dev server)
import { withBrowser, openPage } from './browser.mjs';
import { readyLocales } from './i18n/catalog.mjs';
import { PAGES } from './i18n/pages.mjs';

const base = (process.argv[2] ?? 'http://localhost:5199').replace(/\/$/, '');
const only = process.env.CHECK_LOCALES?.split(',');
const problems = [];
await withBrowser(async browser => {
  for (const locale of readyLocales().filter(l => !only || only.includes(l.code))) {
    for (const p of PAGES) {
      const url = `${base}${locale.path}${p.url}`;
      const { page, context, errors } = await openPage(browser, url);
      // Let the scripted window play a little: most text is drawn by scripts.
      await page.waitForTimeout(Number(process.env.CHECK_WAIT ?? 2500));
      const text = await page.evaluate(() => document.body.innerText);
      const keys = [...new Set(text.match(/\b(?:js|meta|nav|hero)\.[a-z][\w.]+/g) ?? [])];
      for (const e of errors) problems.push(`${url}: ${e}`);
      for (const k of keys) problems.push(`${url}: chave visível ${k}`);
      console.log(`${errors.length || keys.length ? '✗' : '✓'} ${url}`);
      await context.close();
    }
  }
});
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
