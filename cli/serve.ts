#!/usr/bin/env node
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { renderAndScrape } from './render';

const PORT = parseInt(process.env.PORT ?? '7777', 10);
const HOST = process.env.HOST ?? '127.0.0.1';

function arg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0) return fallback;
  return process.argv[i + 1];
}

function setCORS(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function readBody(req: IncomingMessage, limit = 1_000_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) { reject(new Error('Body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function unwrapUrl(raw: string): string {
  const md = raw.match(/^\[[^\]]*\]\((.+)\)$/);
  if (md) return md[1].trim();
  return raw.replace(/^<|>$/g, '').trim();
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

  const url = req.url ?? '/';

  if (req.method === 'GET' && (url === '/ping' || url === '/')) {
    return json(res, 200, { ok: true, service: 'claude-figma', version: '0.1.0' });
  }

  if (req.method === 'POST' && url === '/scrape') {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      if (!body.url || typeof body.url !== 'string') {
        return json(res, 400, { error: 'Missing "url" string in body' });
      }
      const targetUrl = unwrapUrl(body.url);
      const viewport = body.viewport && typeof body.viewport === 'object'
        ? { width: Number(body.viewport.width) || 1440, height: Number(body.viewport.height) || 900 }
        : { width: 1440, height: 900 };
      const waitMs = Number(body.waitMs) || 500;
      const clickText = typeof body.clickText === 'string' && body.clickText.trim() ? body.clickText.trim() : undefined;

      const t0 = Date.now();
      console.log(`→ scrape ${targetUrl} (${viewport.width}x${viewport.height}, wait=${waitMs}ms${clickText ? `, click="${clickText}"` : ''})`);
      const result = await renderAndScrape({ url: targetUrl, viewport, waitMs, clickText });
      const ms = Date.now() - t0;
      console.log(`✓ ${result.screens.length} screen(s) in ${ms}ms`);
      return json(res, 200, result);
    } catch (e: any) {
      console.error('✗ scrape error:', e?.message ?? e);
      return json(res, 500, { error: e?.message ?? String(e) });
    }
  }

  return json(res, 404, { error: 'Not found' });
});

const portArg = arg('--port');
const hostArg = arg('--host');
const port = portArg ? parseInt(portArg, 10) : PORT;
const host = hostArg ?? HOST;

server.listen(port, host, () => {
  console.log(`claude-figma serve → http://${host}:${port}`);
  console.log(`  GET  /ping     health check`);
  console.log(`  POST /scrape   { url, viewport?, waitMs? } → IR JSON`);
});

process.on('SIGINT', () => { server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
