import React, { useState } from 'react';
import type { UIMessage, PluginMessage } from '../shared/messages';
import type { IRNode } from '../main/ir/types';

const DEFAULT_SERVER = 'http://127.0.0.1:7777';
const SERVE_CMD = 'npm run serve';
const FETCH_TIMEOUT_MS = 30_000;

type ScrapeState = 'idle' | 'scraping' | 'ready';
type Scraped = { screens: IRNode[] };

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function App() {
  const [url, setUrl] = useState('');
  const [server, setServer] = useState(DEFAULT_SERVER);
  const [width, setWidth] = useState(1440);
  const [height, setHeight] = useState(900);
  const [waitMs, setWaitMs] = useState(500);
  const [scrapeState, setScrapeState] = useState<ScrapeState>('idle');
  const [scraped, setScraped] = useState<Scraped | null>(null);
  const [scrapeInfo, setScrapeInfo] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [converting, setConverting] = useState(false);

  React.useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const msg = e.data?.pluginMessage as PluginMessage | undefined;
      if (!msg) return;
      if (msg.type === 'done') {
        setStatus(`Created ${msg.nodeCount} root frame(s).`);
        setError('');
        setConverting(false);
      } else if (msg.type === 'error') {
        setError(msg.message);
        setStatus('');
        setConverting(false);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const post = (msg: UIMessage) => parent.postMessage({ pluginMessage: msg }, '*');

  const scrape = async () => {
    if (!url.trim()) { setError('Enter a URL first.'); return; }
    setScrapeState('scraping');
    setScraped(null);
    setScrapeInfo('');
    setStatus('');
    setError('');
    const base = server.trim().replace(/\/+$/, '').replace(/^(?!https?:\/\/)/i, 'http://');
    if (!base || base === 'http://') {
      setError('Server URL is empty.');
      setScrapeState('idle');
      return;
    }
    try {
      try {
        const ping = await fetchWithTimeout(`${base}/ping`, { method: 'GET' }, 5_000);
        if (!ping.ok) throw new Error(`Server responded ${ping.status}`);
      } catch {
        throw new Error(
          `Cannot reach scrape server at ${base}.\n` +
          `Start it in another terminal: ${SERVE_CMD}`,
        );
      }

      const res = await fetchWithTimeout(`${base}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), viewport: { width, height }, waitMs }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      const screens: IRNode[] | null = Array.isArray(body?.screens) ? body.screens : null;
      if (!screens || !screens.length) throw new Error('Server returned no screens.');
      setScraped({ screens });
      setScrapeInfo(`${screens.length} screen(s) scraped`);
      setScrapeState('ready');
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string } | undefined;
      const message = err?.name === 'AbortError'
        ? `Scrape timed out after ${FETCH_TIMEOUT_MS / 1000}s.`
        : (err?.message ?? String(e));
      setError(message);
      setScrapeState('idle');
    }
  };

  const convert = () => {
    if (!scraped) { setError('Scrape first.'); return; }
    setStatus('Converting…');
    setError('');
    setConverting(true);
    post({ type: 'convert-json', payload: scraped });
  };

  const inputStyle: React.CSSProperties = {
    padding: '6px 8px', border: '1px solid #d4d4d8', borderRadius: 4, fontSize: 12, fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: '#475569', fontWeight: 500 };
  const numericInput: React.CSSProperties = { ...inputStyle, width: '100%', boxSizing: 'border-box' };

  const canConvert = scrapeState === 'ready' && !!scraped;
  const canScrape = scrapeState !== 'scraping' && url.trim().length > 0;

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, height: '100vh', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>Claude Design → Figma</strong>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
        <label style={labelStyle}>URL</label>
        <input
          type="text"
          value={url}
          onChange={e => {
            setUrl(e.target.value);
            if (scrapeState === 'ready') {
              setScrapeState('idle');
              setScraped(null);
              setScrapeInfo('');
            }
          }}
          placeholder="https://your-claude-design.example.com"
          style={inputStyle}
        />

        <details>
          <summary style={{ fontSize: 11, color: '#475569', cursor: 'pointer' }}>Advanced</summary>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <div>
              <label style={labelStyle}>Width</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={width} onChange={e => setWidth(parseInt(e.target.value.replace(/\D/g, '')) || 0)} style={numericInput} />
            </div>
            <div>
              <label style={labelStyle}>Height</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={height} onChange={e => setHeight(parseInt(e.target.value.replace(/\D/g, '')) || 0)} style={numericInput} />
            </div>
            <div>
              <label style={labelStyle}>Wait (ms)</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={waitMs} onChange={e => setWaitMs(parseInt(e.target.value.replace(/\D/g, '')) || 0)} style={numericInput} />
            </div>
            <div>
              <label style={labelStyle}>Server</label>
              <input type="text" value={server} onChange={e => setServer(e.target.value)} style={numericInput} />
            </div>
          </div>
        </details>

        <button
          onClick={scrape}
          disabled={!canScrape}
          style={{
            padding: '8px 12px',
            background: !canScrape ? '#94A3B8' : '#0F172A',
            color: '#fff', border: 'none', borderRadius: 4,
            cursor: !canScrape ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          {scrapeState === 'scraping' ? 'Scraping…' : scrapeState === 'ready' ? 'Re-scrape' : 'Scrape'}
        </button>

        {scrapeInfo && <div style={{ fontSize: 12, color: '#16A34A' }}>✓ {scrapeInfo}</div>}
      </div>

      <button
        onClick={convert}
        disabled={!canConvert || converting}
        style={{
          padding: '8px 12px',
          background: !canConvert || converting ? '#94A3B8' : '#3B82F6',
          color: '#fff', border: 'none', borderRadius: 4,
          cursor: !canConvert || converting ? 'not-allowed' : 'pointer',
          fontWeight: 600,
        }}
      >
        {converting ? 'Converting…' : 'Convert to Figma'}
      </button>
      {status && <div style={{ color: '#16A34A', fontSize: 12 }}>{status}</div>}
      {error && <div style={{ color: '#DC2626', fontSize: 12, whiteSpace: 'pre-wrap' }}>{error}</div>}
    </div>
  );
}
