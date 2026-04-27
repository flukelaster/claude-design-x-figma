#!/usr/bin/env node
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { renderAndScrape } from './render';

function arg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0) return fallback;
  return process.argv[i + 1];
}

function unwrapUrl(raw: string): string {
  // Accept markdown-style "[text](url)" copy-pastes by extracting the URL.
  const md = raw.match(/^\[[^\]]*\]\((.+)\)$/);
  if (md) return md[1].trim();
  // Strip surrounding angle brackets ("<https://…>") and whitespace.
  return raw.replace(/^<|>$/g, '').trim();
}

async function main() {
  const rawUrl = process.argv[2];
  if (!rawUrl || rawUrl.startsWith('-')) {
    console.error('Usage: claude-figma <url> [-o screens.json] [--width N] [--height N] [--wait MS]');
    process.exit(1);
  }
  const url = unwrapUrl(rawUrl);
  const out = arg('-o', 'screens.json')!;
  const width = parseInt(arg('--width', '1440')!, 10);
  const height = parseInt(arg('--height', '900')!, 10);
  const waitMs = parseInt(arg('--wait', '500')!, 10);

  console.log(`→ rendering ${url}`);
  const result = await renderAndScrape({
    url,
    viewport: { width, height },
    waitMs,
  });

  const outPath = resolve(process.cwd(), out);
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  const size = (JSON.stringify(result).length / 1024).toFixed(1);
  console.log(`✓ wrote ${result.screens.length} screen(s) → ${outPath} (${size} KB)`);
}

main().catch(e => {
  console.error('✗', e);
  process.exit(1);
});
