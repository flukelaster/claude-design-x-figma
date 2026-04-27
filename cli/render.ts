import { chromium, Browser, Page } from 'playwright';
import { SCRAPE_FN } from './scrape-injected';
import type { TokenSet } from '../src/main/ir/types';

export type ScrapeResult = {
  screens: any[];
  viewport: { w: number; h: number };
  tokens?: TokenSet | null;
};

export type RenderOptions = {
  url: string;
  viewport?: { width: number; height: number };
  waitMs?: number;          // extra settle time after load
  selector?: string;        // wait until this selector is present
};

export async function renderAndScrape(opts: RenderOptions): Promise<ScrapeResult> {
  const browser: Browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: opts.viewport ?? { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page: Page = await context.newPage();

    page.on('pageerror', e => console.warn('[page error]', e.message));
    page.on('console', m => {
      if (m.type() === 'error') console.warn('[console]', m.text());
    });

    await page.goto(opts.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Babel transform + React mount happens after DOMContentLoaded.
    // Wait for #root to actually have content.
    await page.waitForFunction(
      () => {
        const r = document.getElementById('root');
        return !!(r && r.children.length > 0);
      },
      { timeout: 60_000 },
    );

    if (opts.selector) {
      await page.waitForSelector(opts.selector, { timeout: 15_000 });
    }
    if (opts.waitMs) await page.waitForTimeout(opts.waitMs);

    // Inline external <img> via toDataURL so plugin can render without re-fetching
    await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll('img'));
      await Promise.all(imgs.map(async (img) => {
        try {
          if (img.src.startsWith('data:')) return;
          const res = await fetch(img.src, { mode: 'cors' });
          const blob = await res.blob();
          const reader = new FileReader();
          const data: string = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          img.setAttribute('src', data);
        } catch {
          // leave as-is; plugin will try its own fetch
        }
      }));
    }).catch(() => {/* non-fatal */});

    const result = await page.evaluate(SCRAPE_FN) as ScrapeResult;

    // Take per-screen screenshots clipped to each screen's bounding box.
    const root = await page.$('#root');
    const screenHandles = root
      ? await root.$$(':scope > *')
      : await page.$$('body > *');

    for (let i = 0; i < result.screens.length && i < screenHandles.length; i++) {
      try {
        const buf = await screenHandles[i].screenshot({ type: 'png', omitBackground: false });
        const b64 = `data:image/png;base64,${buf.toString('base64')}`;
        // Stash on the root IR node via a synthetic attr the mapper recognises.
        result.screens[i].attrs = result.screens[i].attrs ?? {};
        result.screens[i].attrs.__screenshot = b64;
      } catch (e) {
        console.warn(`screenshot ${i} failed:`, (e as Error).message);
      }
    }

    return result;
  } finally {
    await browser.close();
  }
}
