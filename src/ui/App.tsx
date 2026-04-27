import React, { useState } from 'react';
import type { UIMessage, PluginMessage } from '../shared/messages';

const SAMPLE = `<div class="flex flex-col gap-4 p-6 bg-white rounded-lg shadow-md">
  <h1 class="text-2xl font-bold text-slate-900">Hello Figma</h1>
  <p class="text-base text-slate-600">Paste Claude Design output here.</p>
  <button class="bg-blue-500 text-white px-4 py-2 rounded">Click me</button>
</div>`;

const DEFAULT_SERVER = 'http://127.0.0.1:7777';
const SERVE_CMD = 'npm run serve';

type Mode = 'url' | 'html' | 'json';
type ScrapeState = 'idle' | 'scraping' | 'ready';

export function App() {
  const [mode, setMode] = useState<Mode>('url');

  // URL mode state
  const [url, setUrl] = useState('');
  const [server, setServer] = useState(DEFAULT_SERVER);
  const [width, setWidth] = useState(1440);
  const [height, setHeight] = useState(900);
  const [waitMs, setWaitMs] = useState(500);
  const [scrapeState, setScrapeState] = useState<ScrapeState>('idle');
  const [scraped, setScraped] = useState<any>(null);
  const [scrapeInfo, setScrapeInfo] = useState('');

  // HTML mode state
  const [src, setSrc] = useState(SAMPLE);

  // JSON mode state
  const [jsonName, setJsonName] = useState('');
  const [jsonPayload, setJsonPayload] = useState<any>(null);

  // Shared
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
    try {
      // Health check first so we can show actionable error.
      try {
        const ping = await fetch(`${server}/ping`, { method: 'GET' });
        if (!ping.ok) throw new Error(`Server responded ${ping.status}`);
      } catch (e: any) {
        throw new Error(
          `Cannot reach scrape server at ${server}.\n` +
          `Start it in another terminal: ${SERVE_CMD}`,
        );
      }

      const res = await fetch(`${server}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), viewport: { width, height }, waitMs }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      const screens = Array.isArray(body?.screens) ? body.screens : null;
      if (!screens || !screens.length) throw new Error('Server returned no screens.');
      setScraped({ screens });
      setScrapeInfo(`${screens.length} screen(s) scraped`);
      setScrapeState('ready');
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setScrapeState('idle');
    }
  };

  const convert = () => {
    setStatus('Converting…');
    setError('');
    setConverting(true);
    if (mode === 'url') {
      if (!scraped) { setError('Scrape first.'); setConverting(false); return; }
      post({ type: 'convert-json', payload: scraped });
    } else if (mode === 'html') {
      post({ type: 'convert', source: src, format: 'html' });
    } else {
      if (!jsonPayload) { setError('Pick a JSON file first.'); setConverting(false); return; }
      post({ type: 'convert-json', payload: jsonPayload });
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const text = await f.text();
      const json = JSON.parse(text);
      const screens = Array.isArray(json?.screens) ? json.screens : (Array.isArray(json) ? json : null);
      if (!screens) throw new Error('Expected { screens: [...] } or top-level array.');
      setJsonPayload({ screens });
      setJsonName(`${f.name} — ${screens.length} screen(s)`);
      setError('');
    } catch (e: any) {
      setError(e.message);
      setJsonPayload(null);
      setJsonName('');
    }
  };

  const tabBtn = (m: Mode, label: string) => (
    <button
      onClick={() => { setMode(m); setError(''); setStatus(''); }}
      style={{
        padding: '6px 10px',
        background: mode === m ? '#0F172A' : '#F1F5F9',
        color: mode === m ? '#fff' : '#0F172A',
        border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600,
      }}
    >{label}</button>
  );

  const canConvert =
    (mode === 'url' && scrapeState === 'ready' && !!scraped) ||
    (mode === 'html' && src.trim().length > 0) ||
    (mode === 'json' && !!jsonPayload);

  const inputStyle: React.CSSProperties = {
    padding: '6px 8px', border: '1px solid #d4d4d8', borderRadius: 4, fontSize: 12, fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: '#475569', fontWeight: 500 };

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, height: '100vh', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>Claude Design → Figma</strong>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {tabBtn('url', 'URL')}
          {tabBtn('html', 'HTML')}
          {tabBtn('json', 'JSON')}
        </div>
      </div>

      {mode === 'url' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
          <label style={labelStyle}>URL</label>
          <input
            type="text"
            value={url}
            onChange={e => { setUrl(e.target.value); if (scrapeState === 'ready') { setScrapeState('idle'); setScraped(null); setScrapeInfo(''); } }}
            placeholder="https://your-claude-design.example.com"
            style={inputStyle}
          />

          <details>
            <summary style={{ fontSize: 11, color: '#475569', cursor: 'pointer' }}>Advanced</summary>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <div>
                <label style={labelStyle}>Width</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={width} onChange={e => setWidth(parseInt(e.target.value.replace(/\D/g, '')) || 0)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={labelStyle}>Height</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={height} onChange={e => setHeight(parseInt(e.target.value.replace(/\D/g, '')) || 0)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={labelStyle}>Wait (ms)</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={waitMs} onChange={e => setWaitMs(parseInt(e.target.value.replace(/\D/g, '')) || 0)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={labelStyle}>Server</label>
                <input type="text" value={server} onChange={e => setServer(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
              </div>
            </div>
          </details>

          <button
            onClick={scrape}
            disabled={scrapeState === 'scraping' || !url.trim()}
            style={{
              padding: '8px 12px',
              background: scrapeState === 'scraping' ? '#94A3B8' : '#0F172A',
              color: '#fff', border: 'none', borderRadius: 4,
              cursor: scrapeState === 'scraping' || !url.trim() ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {scrapeState === 'scraping' ? 'Scraping…' : scrapeState === 'ready' ? 'Re-scrape' : 'Scrape'}
          </button>

          {scrapeInfo && <div style={{ fontSize: 12, color: '#16A34A' }}>✓ {scrapeInfo}</div>}
        </div>
      )}

      {mode === 'html' && (
        <textarea
          value={src}
          onChange={e => setSrc(e.target.value)}
          spellCheck={false}
          title="HTML source"
          placeholder="Paste HTML here"
          style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, padding: 8, border: '1px solid #d4d4d8', borderRadius: 4, resize: 'none' }}
        />
      )}

      {mode === 'json' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: '1px dashed #d4d4d8', borderRadius: 4 }}>
          <div style={{ fontSize: 12, color: '#475569' }}>
            1. Run <code style={{ background: '#F1F5F9', padding: '1px 4px', borderRadius: 2 }}>npx claude-figma &lt;url&gt; -o screens.json</code><br/>
            2. Pick the resulting JSON file:
          </div>
          <input
            type="file"
            accept="application/json,.json"
            title="Pick screens.json"
            onChange={e => onFile(e.target.files?.[0])}
          />
          {jsonName && <div style={{ fontSize: 12, color: '#16A34A' }}>✓ {jsonName}</div>}
        </div>
      )}

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
