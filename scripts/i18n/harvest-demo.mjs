// Collects every text the Cadente window shows on the site into i18n/demo-strings.json: the source that each
// language's i18n/<code>/demo.json translates. Needs the dev server (npm run dev).
// Usage: node scripts/i18n/harvest-demo.mjs [base URL] [--fresh]   (default http://localhost:5199)
import fs from 'node:fs';
import path from 'node:path';
import { withBrowser, openPage } from '../browser.mjs';
import { ROOT } from './catalog.mjs';

const base = (process.argv.slice(2).find(a => !a.startsWith('--')) ?? 'http://localhost:5199').replace(/\/$/, '');
const out = path.join(ROOT, 'i18n/demo-strings.json');
await withBrowser(async browser => {
  const { page, errors } = await openPage(browser, `${base}/scripts/i18n/harvest.html`, { viewport: { width: 1440, height: 900 } });
  await page.waitForFunction(() => window.__harvest, null, { timeout: 240000, polling: 500 });
  const result = await page.evaluate(() => window.__harvest);
  if (result.error) throw new Error(`a colheita parou depois de ${result.log.at(-1)}:\n${result.error}`);
  if (errors.length) throw new Error(`erros na página:\n${errors.join('\n')}`);
  // Clock-dependent texts ("{0} s" or "{0} min {1} s") vary between runs, so the harvest adds to what was there;
  // --fresh starts over (after a text was removed from the window).
  const before = !process.argv.includes('--fresh') && fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : [];
  const keys = [...new Set([...before, ...result.keys])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  fs.writeFileSync(out, `${JSON.stringify(keys, null, 1)}\n`);
  console.log(`${keys.length} textos da janela em ${path.relative(ROOT, out)} (${result.keys.length} nesta rodada, ${result.log.length} etapas)`);
});
