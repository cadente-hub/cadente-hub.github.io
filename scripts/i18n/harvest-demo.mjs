// Collects every text the Cadente window shows on the site into i18n/demo-strings.json: the source that each
// language's i18n/<code>/demo.json translates. Needs the dev server (npm run dev).
// Usage: node scripts/i18n/harvest-demo.mjs [base URL]   (default http://localhost:5199)
import fs from 'node:fs';
import path from 'node:path';
import { withBrowser, openPage } from '../browser.mjs';
import { ROOT } from './catalog.mjs';

const base = (process.argv[2] ?? 'http://localhost:5199').replace(/\/$/, '');
const out = path.join(ROOT, 'i18n/demo-strings.json');
await withBrowser(async browser => {
  const { page, errors } = await openPage(browser, `${base}/scripts/i18n/harvest.html`, { viewport: { width: 1440, height: 900 } });
  await page.waitForFunction(() => window.__harvest, null, { timeout: 240000, polling: 500 });
  const result = await page.evaluate(() => window.__harvest);
  if (result.error) throw new Error(`a colheita parou depois de ${result.log.at(-1)}:\n${result.error}`);
  if (errors.length) throw new Error(`erros na página:\n${errors.join('\n')}`);
  fs.writeFileSync(out, `${JSON.stringify(result.keys, null, 1)}\n`);
  console.log(`${result.keys.length} textos da janela em ${path.relative(ROOT, out)} (${result.log.length} etapas)`);
});
