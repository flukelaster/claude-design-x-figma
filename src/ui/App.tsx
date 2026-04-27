import React, { useState } from 'react';
import type { UIMessage, PluginMessage } from '../shared/messages';

const SAMPLE = `<div class="flex flex-col gap-4 p-6 bg-white rounded-lg shadow-md">
  <h1 class="text-2xl font-bold text-slate-900">Hello Figma</h1>
  <p class="text-base text-slate-600">Paste Claude Design output here.</p>
  <button class="bg-blue-500 text-white px-4 py-2 rounded">Click me</button>
</div>`;

type Mode = 'html' | 'json';

export function App() {
  const [mode, setMode] = useState<Mode>('html');
  const [src, setSrc] = useState(SAMPLE);
  const [jsonName, setJsonName] = useState('');
  const [jsonPayload, setJsonPayload] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  React.useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const msg = e.data?.pluginMessage as PluginMessage | undefined;
      if (!msg) return;
      if (msg.type === 'done') { setStatus(`Created ${msg.nodeCount} root frame(s).`); setError(''); }
      else if (msg.type === 'error') { setError(msg.message); setStatus(''); }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const post = (msg: UIMessage) => parent.postMessage({ pluginMessage: msg }, '*');

  const convert = () => {
    setStatus('Converting…'); setError('');
    if (mode === 'html') {
      post({ type: 'convert', source: src, format: 'html' });
    } else {
      if (!jsonPayload) { setError('Pick a JSON file first.'); setStatus(''); return; }
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
      onClick={() => setMode(m)}
      style={{
        padding: '6px 10px',
        background: mode === m ? '#0F172A' : '#F1F5F9',
        color: mode === m ? '#fff' : '#0F172A',
        border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600,
      }}
    >{label}</button>
  );

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, height: '100vh', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>Claude Design → Figma</strong>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {tabBtn('html', 'HTML')}
          {tabBtn('json', 'JSON (CLI)')}
        </div>
      </div>

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
        style={{ padding: '8px 12px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
      >
        Convert to Figma
      </button>
      {status && <div style={{ color: '#16A34A', fontSize: 12 }}>{status}</div>}
      {error && <div style={{ color: '#DC2626', fontSize: 12, whiteSpace: 'pre-wrap' }}>{error}</div>}
    </div>
  );
}
