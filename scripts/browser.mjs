// Opens a headless Chromium for the site's browser scripts (harvest, checks, screenshots). Uses the Chromium that
// Playwright installed; CADENTE_CHROMIUM points to another binary, such as an older cached headless shell.
// Whoever opens the browser closes it: every caller wraps its work in withBrowser.
import { chromium } from 'playwright';

export async function withBrowser(fn) {
  const browser = await chromium.launch({ executablePath: process.env.CADENTE_CHROMIUM || undefined });
  try { return await fn(browser); } finally { await browser.close(); }
}

// Opens `url` and collects console errors and failed requests of the page.
export async function openPage(browser, url, { viewport = { width: 1440, height: 900 }, reducedMotion = 'no-preference', locale } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion, locale });
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) errors.push(`falhou: ${r.url()}`); });
  await page.goto(url, { waitUntil: 'load' });
  return { page, context, errors };
}
