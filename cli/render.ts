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
  clickText?: string;       // SPA navigation: click a link/button matching this label before scrape
  bypassCSP?: boolean;      // disable target-site CSP enforcement; needed for previews that inline Babel
};

export async function renderAndScrape(opts: RenderOptions): Promise<ScrapeResult> {
  const browser: Browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: opts.viewport ?? { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      // OPT-IN. Some previews (Claude Design) set strict CSP (require-trusted-
      // types-for 'script', script-src nonce) that blocks React's inline Babel.
      // Enable per request so we don't relax CSP for unrelated scrape targets.
      bypassCSP: opts.bypassCSP === true,
    });
    const page: Page = await context.newPage();

    page.on('pageerror', e => console.warn('[page error]', e.message));
    page.on('console', m => {
      if (m.type() === 'error') console.warn('[console]', m.text());
    });

    await page.goto(opts.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Babel transform + React mount happens after DOMContentLoaded.
    // Wait for #root to actually have content. If mount never happens (CSP,
    // missing assets, expired token), fall back to whatever the body has —
    // a partial scrape beats a hard timeout.
    try {
      await page.waitForFunction(
        () => {
          const r = document.getElementById('root');
          return !!(r && r.children.length > 0);
        },
        { timeout: 30_000 },
      );
    } catch {
      console.warn('[scrape] #root never populated within 30s — falling back to body scrape');
    }

    if (opts.selector) {
      await page.waitForSelector(opts.selector, { timeout: 15_000 });
    }
    if (opts.waitMs) await page.waitForTimeout(opts.waitMs);

    // SPA nav step: click a menu link/button matching `clickText` before scraping.
    // Many Claude Design previews are React Router SPAs whose URL doesn't update
    // when the user navigates in the preview tab — passing the same URL re-renders
    // the home page. Clicking the menu item triggers in-app routing.
    if (opts.clickText) {
      try {
        const targetText = opts.clickText;
        const handle = await page.evaluateHandle((text: string) => {
          const lc = text.toLowerCase();
          const candidates = Array.from(document.querySelectorAll('a, button, [role="link"], [role="button"], [role="tab"], [role="menuitem"]')) as HTMLElement[];
          // Exact match wins; substring match is fallback.
          let exact: HTMLElement | null = null;
          let partial: HTMLElement | null = null;
          for (const el of candidates) {
            const t = (el.innerText || el.textContent || '').trim().toLowerCase();
            if (!t) continue;
            if (t === lc) { exact = el; break; }
            if (!partial && t.includes(lc)) partial = el;
          }
          return exact || partial;
        }, targetText);
        const el = handle.asElement();
        if (el) {
          await el.scrollIntoViewIfNeeded().catch(() => {});
          await el.click({ timeout: 5_000 });
          // Allow SPA router + render to settle. Re-wait for #root content too —
          // some routers unmount + remount during navigation.
          await page.waitForTimeout(800);
          await page.waitForFunction(
            () => {
              const r = document.getElementById('root');
              return !!(r && r.children.length > 0);
            },
            { timeout: 10_000 },
          ).catch(() => {/* best effort */});
          if (opts.waitMs) await page.waitForTimeout(opts.waitMs);
          console.log(`[scrape] clicked "${targetText}" — proceeding to capture`);
        } else {
          console.warn(`[scrape] clickText="${targetText}" matched no link/button on page`);
        }
        await handle.dispose();
      } catch (e) {
        console.warn(`[scrape] click failed:`, (e as Error).message);
      }
    }

    // Rasterize tiled gradient backgrounds (grid patterns built from
    // linear-gradient + small background-size). Figma gradient paints can't
    // tile, so render one tile via Playwright screenshot (canvas+foreignObject
    // taints in Chromium), then swap background-image to a data: URL that the
    // existing image-fill TILE path handles.
    // tsx/esbuild wraps named function declarations with a __name() helper that
    // doesn't exist in the browser scope after serialization. Pass raw JS string
    // to page.evaluate to bypass the TS loader entirely.
    const probeResult: { targets: Array<{ id: string; w: number; h: number; tag: string; selector: string }>; debug: Array<{ tag: string; bgImg: string; bgSize: string }> } = await page.evaluate(`(() => {
      // Tile from explicit bg-size: '40px 40px'
      const tileFromBgSize = (bgSize) => {
        const m = bgSize.match(/^(\\d+(?:\\.\\d+)?)px(?:\\s+(\\d+(?:\\.\\d+)?)px)?$/);
        if (!m) return null;
        const w = parseFloat(m[1]);
        const h = parseFloat(m[2] || m[1]);
        if (!w || !h || w > 512 || h > 512) return null;
        return { w, h };
      };
      // Tile from repeating-* gradient stops: largest 'Npx' value = period.
      // Multiply by 4 (capped 64-256) so the rendered tile contains several
      // full periods on both axes — handles any gradient angle.
      const tileFromRepeatingGradient = (bgImg) => {
        if (!/repeating-(linear|radial)-gradient/.test(bgImg)) return null;
        const matches = bgImg.match(/(\\d+(?:\\.\\d+)?)px/g);
        if (!matches) return null;
        let maxPx = 0;
        for (const p of matches) maxPx = Math.max(maxPx, parseFloat(p));
        if (!maxPx) return null;
        const dim = Math.max(64, Math.min(256, Math.ceil(maxPx * 4)));
        return { w: dim, h: dim };
      };
      const found = [];
      const debug = [];
      const els = [document.documentElement, document.body, ...Array.from(document.querySelectorAll('*'))];
      let counter = 0;
      for (const el of els) {
        const cs = getComputedStyle(el);
        const bgImg = cs.backgroundImage;
        if (!bgImg || bgImg === 'none') continue;
        if (!/gradient\\(/.test(bgImg)) continue;
        if (debug.length < 10) debug.push({ tag: el.tagName, bgImg: bgImg.slice(0, 200), bgSize: cs.backgroundSize });
        // Prefer explicit bg-size; otherwise compute tile from repeating gradient.
        const t = tileFromBgSize(cs.backgroundSize) || tileFromRepeatingGradient(bgImg);
        if (!t) continue;
        const id = '__tile_' + counter++;
        el.setAttribute('data-tile-id', id);
        const tmp = document.createElement('div');
        tmp.setAttribute('data-tile-renderer', id);
        tmp.style.cssText = 'position:fixed;top:0;left:-99999px;width:' + t.w + 'px;height:' + t.h + 'px;background-image:' + bgImg + ';background-size:' + t.w + 'px ' + t.h + 'px;background-repeat:no-repeat;background-color:transparent';
        document.body.appendChild(tmp);
        found.push({ id, w: t.w, h: t.h, tag: el.tagName, selector: el.tagName });
      }
      return { targets: found, debug };
    })()`);
    const tileTargets = probeResult.targets;
    console.log('[scrape] tile rasterize candidates:', tileTargets.length);
    if (probeResult.debug.length > 0) {
      console.log('[scrape] gradient-bearing elements found:');
      for (const d of probeResult.debug) console.log(`  <${d.tag}> bg-size=${d.bgSize}  bg-image=${d.bgImg}`);
    }
    for (const f of tileTargets) {
      try {
        const tile = await page.$(`[data-tile-renderer="${f.id}"]`);
        if (!tile) continue;
        const buf = await tile.screenshot({ type: 'png', omitBackground: true });
        const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
        await page.evaluate(
          ({ id, dataUrl, w, h }: { id: string; dataUrl: string; w: number; h: number }) => {
            const target = document.querySelector('[data-tile-id="' + id + '"]') as HTMLElement | null;
            if (target) {
              target.style.backgroundImage = 'url("' + dataUrl + '")';
              target.style.backgroundSize = w + 'px ' + h + 'px';
              target.style.backgroundRepeat = 'repeat';
            }
            const tmp = document.querySelector('[data-tile-renderer="' + id + '"]');
            if (tmp) tmp.remove();
          },
          { id: f.id, dataUrl, w: f.w, h: f.h },
        );
      } catch (e) {
        console.warn(`tile rasterize ${f.id} failed:`, (e as Error).message);
      }
    }

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
    // When the scraper collapsed root into a single screen (single-page layout),
    // shoot the root element itself instead of its first child.
    const root = await page.$('#root');
    const childHandles = root
      ? await root.$$(':scope > *')
      : await page.$$('body > *');
    const screenHandles = (result.screens.length === 1 && childHandles.length > 1 && root)
      ? [root]
      : childHandles;

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
