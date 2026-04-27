import React, { useState } from 'react';
import type { UIMessage, PluginMessage } from '../shared/messages';
import type { IRNode, TokenSet } from '../main/ir/types';
import { normaliseServer } from './normalise-server';

const DEFAULT_SERVER = 'http://127.0.0.1:7777';
const SERVE_CMD = 'npm run serve';
const FETCH_TIMEOUT_MS = 30_000;
const PING_INTERVAL_MS = 4_000;
const PING_TIMEOUT_MS = 2_000;

type ScrapeState = 'idle' | 'scraping' | 'ready';
type ServerStatus = 'unknown' | 'online' | 'offline';
type Scraped = { screens: IRNode[]; tokens?: TokenSet | null };

const colors = {
  panel: '#2B2B2B',
  field: '#F7F8FA',
  fieldBorder: '#DADDE3',
  text: '#F4F4F5',
  muted: '#B3B8C2',
  line: '#3F3F46',
  primary: '#4F8CFF',
  success: '#2DD47B',
  danger: '#FF6B6B',
  warning: '#F7C948',
};

const appStyle: React.CSSProperties = {
  minHeight: '100vh',
  height: '100vh',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  padding: '18px 20px 16px',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: colors.text,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 38%), #1F1F1F',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 11,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: '20px',
  fontWeight: 760,
  letterSpacing: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const titleSeparatorStyle: React.CSSProperties = {
  color: colors.muted,
  fontWeight: 600,
  margin: '0 2px',
};

function ClaudeLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: '0 0 auto' }}>
      <path
        d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"
        fill="#D97757"
        fillRule="nonzero"
      />
    </svg>
  );
}

function FigmaLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: '0 0 auto' }}>
      <path d="M4 20a4 4 0 014-4h4v4a4 4 0 01-8 0z" fill="#24CB71" />
      <path d="M12 0v8h4a4 4 0 000-8h-4z" fill="#FF7237" />
      <path d="M15.967 16a4 4 0 100-8 4 4 0 000 8z" fill="#00B6FF" />
      <path d="M4 4a4 4 0 004 4h4V0H8a4 4 0 00-4 4z" fill="#FF3737" />
      <path d="M4 12a4 4 0 004 4h4V8H8a4 4 0 00-4 4z" fill="#874FFF" />
    </svg>
  );
}

const statusPillStyle: React.CSSProperties = {
  marginLeft: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  minHeight: 26,
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.08)',
  fontSize: 11,
  lineHeight: '14px',
  fontWeight: 700,
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  overflow: 'auto',
  paddingRight: 2,
};

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 12,
  borderRadius: 8,
  background: colors.panel,
  border: `1px solid ${colors.line}`,
  boxShadow: '0 14px 30px rgba(0, 0, 0, 0.18)',
};

const helpStyle: React.CSSProperties = {
  borderRadius: 8,
  background: 'rgba(79, 140, 255, 0.08)',
  border: '1px solid rgba(79, 140, 255, 0.22)',
  padding: '10px 12px',
};

const helpListStyle: React.CSSProperties = {
  margin: '9px 0 0',
  paddingLeft: 18,
  color: colors.muted,
  fontSize: 11,
  lineHeight: '17px',
};

const codeStyle: React.CSSProperties = {
  padding: '1px 5px',
  borderRadius: 5,
  background: 'rgba(255,255,255,0.08)',
  color: colors.text,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 10,
};

const fieldGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 36,
  padding: '8px 10px',
  border: `1px solid ${colors.fieldBorder}`,
  borderRadius: 6,
  outline: 'none',
  background: colors.field,
  color: '#171717',
  fontSize: 12,
  lineHeight: '18px',
  fontFamily: 'inherit',
  boxShadow: '0 1px 0 rgba(255,255,255,0.55) inset',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  lineHeight: '13px',
  color: colors.muted,
  fontWeight: 760,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};

const detailsStyle: React.CSSProperties = {
  borderTop: `1px solid ${colors.line}`,
  paddingTop: 10,
};

const summaryStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: colors.muted,
  cursor: 'pointer',
  fontSize: 11,
  lineHeight: '15px',
  fontWeight: 700,
  listStyle: 'none',
};

const advancedSummaryBaseStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  borderRadius: 6,
  border: `1px solid ${colors.line}`,
  background: 'rgba(255,255,255,0.04)',
  color: colors.text,
  cursor: 'pointer',
  fontSize: 11,
  lineHeight: '14px',
  fontWeight: 700,
  letterSpacing: 0.2,
  textTransform: 'uppercase',
  listStyle: 'none',
  userSelect: 'none',
  transition: 'background 120ms ease, border-color 120ms ease',
};

const chevronStyle: React.CSSProperties = {
  display: 'inline-block',
  marginLeft: 'auto',
  color: colors.muted,
  transition: 'transform 160ms ease',
};

const advancedGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 10,
};

const primaryButtonBase: React.CSSProperties = {
  width: '100%',
  minHeight: 38,
  padding: '9px 12px',
  border: '1px solid transparent',
  borderRadius: 7,
  color: '#FFFFFF',
  fontFamily: 'inherit',
  fontSize: 13,
  lineHeight: '18px',
  fontWeight: 780,
  letterSpacing: 0,
};

const stepButtonDisabledStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  borderColor: 'rgba(255,255,255,0.12)',
  color: 'rgba(244,244,245,0.62)',
  boxShadow: 'none',
  cursor: 'not-allowed',
  opacity: 1,
};

const stepButtonSecondaryStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.09)',
  borderColor: 'rgba(255,255,255,0.16)',
  color: colors.text,
  boxShadow: 'none',
};

const finalButtonDisabledStyle: React.CSSProperties = {
  background: 'rgba(79, 140, 255, 0.08)',
  borderColor: 'rgba(79, 140, 255, 0.14)',
  color: 'rgba(244,244,245,0.5)',
  boxShadow: 'none',
  cursor: 'not-allowed',
  opacity: 1,
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingTop: 2,
};

const messageStyle: React.CSSProperties = {
  borderRadius: 8,
  padding: '9px 10px',
  fontSize: 12,
  lineHeight: '16px',
  whiteSpace: 'pre-wrap',
};

const progressTrackStyle: React.CSSProperties = {
  position: 'relative',
  height: 6,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.06)',
  overflow: 'hidden',
};

const progressBarStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: '40%',
  borderRadius: 999,
  background: 'linear-gradient(90deg, rgba(79,140,255,0) 0%, #4F8CFF 50%, rgba(79,140,255,0) 100%)',
  animation: 'cdxf-progress 1.1s ease-in-out infinite',
};

const PROGRESS_KEYFRAMES = `@keyframes cdxf-progress {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}`;

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    // `credentials: 'omit'` is the default for every outbound call so cookies
    // scoped to the Figma iframe origin are never forwarded to a Server URL
    // that the user pointed at a same-origin endpoint. Callers can still
    // override via `init.credentials` if needed.
    return await fetch(url, { credentials: 'omit', ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

const STATUS_META = {
  online:  { dot: colors.success, text: colors.success, label: 'Online' },
  offline: { dot: colors.danger,  text: colors.danger,  label: 'Offline' },
  unknown: { dot: colors.warning, text: colors.warning, label: 'Checking…' },
} satisfies Record<ServerStatus, { dot: string; text: string; label: string }>;

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
  const [serverStatus, setServerStatus] = useState<ServerStatus>('unknown');
  const [helpOpen, setHelpOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedHover, setAdvancedHover] = useState(false);

  React.useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const msg = e.data?.pluginMessage as PluginMessage | undefined;
      if (!msg) return;
      if (msg.type === 'done') {
        const vars = msg.variableCount ?? 0;
        setStatus(
          vars > 0
            ? `Created ${msg.nodeCount} root frame(s) and ${vars} variable(s).`
            : `Created ${msg.nodeCount} root frame(s).`,
        );
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

  React.useEffect(() => {
    let cancelled = false;
    const base = normaliseServer(server);

    const check = async () => {
      if (!base || base === 'http://') {
        if (!cancelled) setServerStatus('offline');
        return;
      }
      try {
        const r = await fetchWithTimeout(`${base}/ping`, { method: 'GET' }, PING_TIMEOUT_MS);
        if (!cancelled) setServerStatus(r.ok ? 'online' : 'offline');
      } catch {
        if (!cancelled) setServerStatus('offline');
      }
    };

    setServerStatus('unknown');
    check();
    const id = setInterval(check, PING_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [server]);

  const post = (msg: UIMessage) => parent.postMessage({ pluginMessage: msg }, '*');

  const scrape = async () => {
    if (!url.trim()) { setError('Enter a URL first.'); return; }
    setScrapeState('scraping');
    setScraped(null);
    setScrapeInfo('');
    setStatus('');
    setError('');
    const base = normaliseServer(server);
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
      const tokens: TokenSet | null = body?.tokens && Array.isArray(body.tokens.vars) ? body.tokens : null;
      setScraped({ screens, tokens });
      const tokenCount = tokens?.vars.length ?? 0;
      setScrapeInfo(
        tokenCount > 0
          ? `${screens.length} screen(s), ${tokenCount} token(s) scraped`
          : `${screens.length} screen(s) scraped`,
      );
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

  const canConvert = scrapeState === 'ready' && !!scraped;
  const canScrape = scrapeState !== 'scraping' && url.trim().length > 0 && serverStatus !== 'offline';
  const sm = STATUS_META[serverStatus];

  return (
    <div style={appStyle}>
      <style>{PROGRESS_KEYFRAMES}</style>
      <header style={headerStyle}>
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <h1 style={titleStyle}>
            <ClaudeLogo size={16} />
            <span>Claude Design</span>
            <span style={titleSeparatorStyle}>×</span>
            <FigmaLogo size={16} />
            <span>Figma</span>
          </h1>
        </div>
        <div
          title={`Companion server: ${sm.label}`}
          style={{ ...statusPillStyle, color: sm.text }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: sm.dot, display: 'inline-block', boxShadow: `0 0 0 3px ${sm.dot}22` }} />
          {sm.label}
        </div>
      </header>

      <main style={contentStyle}>
        <details
          open={helpOpen}
          onToggle={e => setHelpOpen((e.currentTarget as HTMLDetailsElement).open)}
          style={helpStyle}
        >
          <summary style={{ ...summaryStyle, color: colors.text }}>How to use</summary>
          <ol style={helpListStyle}>
            <li>
              In your <strong>Terminal</strong>, run <code style={codeStyle}>npm run serve</code> from the project folder and wait until the status pill above shows Online.
            </li>
            <li>
              In Claude Design, click <strong>Present</strong> (top-right) → <strong>New tab</strong>, then copy the URL from the new tab and paste it below.
            </li>
            <li>Adjust Advanced only when you need a different viewport or wait time.</li>
            <li>Click Scrape, then Convert to Figma when the scrape is ready.</li>
          </ol>
        </details>

        <section style={panelStyle}>
          <div style={fieldGroupStyle}>
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
          </div>

          <details
            open={advancedOpen}
            onToggle={e => setAdvancedOpen((e.currentTarget as HTMLDetailsElement).open)}
            style={detailsStyle}
          >
            <summary
              style={{
                ...advancedSummaryBaseStyle,
                background: advancedHover || advancedOpen ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)',
                borderColor: advancedHover || advancedOpen ? 'rgba(255,255,255,0.16)' : colors.line,
              }}
              onMouseEnter={() => setAdvancedHover(true)}
              onMouseLeave={() => setAdvancedHover(false)}
            >
              <span>Advanced</span>
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                aria-hidden="true"
                style={{ ...chevronStyle, transform: advancedOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
              >
                <path d="M3 1.5 L6.5 5 L3 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </summary>
            <div style={advancedGridStyle}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Width</label>
                <input title="Viewport width in pixels" type="text" inputMode="numeric" pattern="[0-9]*" value={width} onChange={e => setWidth(parseInt(e.target.value.replace(/\D/g, '')) || 0)} style={inputStyle} />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Height</label>
                <input title="Viewport height in pixels" type="text" inputMode="numeric" pattern="[0-9]*" value={height} onChange={e => setHeight(parseInt(e.target.value.replace(/\D/g, '')) || 0)} style={inputStyle} />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Wait (ms)</label>
                <input title="Settle delay after page load, in milliseconds" type="text" inputMode="numeric" pattern="[0-9]*" value={waitMs} onChange={e => setWaitMs(parseInt(e.target.value.replace(/\D/g, '')) || 0)} style={inputStyle} />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Server</label>
                <input title="Companion server base URL" type="text" value={server} onChange={e => setServer(e.target.value)} style={inputStyle} />
              </div>
            </div>
          </details>

          <button
            onClick={scrape}
            disabled={!canScrape}
            style={{
              ...primaryButtonBase,
              background: 'linear-gradient(135deg, #4F8CFF, #68D391)',
              cursor: 'pointer',
              boxShadow: '0 12px 24px rgba(79, 140, 255, 0.24)',
              ...(scrapeState === 'ready' ? stepButtonSecondaryStyle : {}),
              ...(!canScrape ? stepButtonDisabledStyle : {}),
            }}
          >
            {scrapeState === 'scraping' ? 'Scraping…' : scrapeState === 'ready' ? 'Re-scrape' : 'Scrape'}
          </button>
        </section>

        {scrapeInfo && (
          <div style={{ ...messageStyle, color: colors.success, background: 'rgba(45, 212, 123, 0.12)', border: '1px solid rgba(45, 212, 123, 0.24)' }}>
            {scrapeInfo}
          </div>
        )}
      </main>

      <footer style={footerStyle}>
        <button
          onClick={convert}
          disabled={!canConvert || converting}
          style={{
            ...primaryButtonBase,
            minHeight: 40,
            background: colors.primary,
            cursor: 'pointer',
            boxShadow: '0 14px 28px rgba(79, 140, 255, 0.32)',
            ...(!canConvert || converting ? finalButtonDisabledStyle : {}),
          }}
        >
          {converting ? 'Converting…' : 'Convert to Figma'}
        </button>
        {converting && (
          <div style={progressTrackStyle} role="progressbar" aria-label="Converting to Figma">
            <span style={progressBarStyle} />
          </div>
        )}
        {status && <div style={{ ...messageStyle, color: colors.success, background: 'rgba(45, 212, 123, 0.12)', border: '1px solid rgba(45, 212, 123, 0.24)' }}>{status}</div>}
        {error && <div style={{ ...messageStyle, color: colors.danger, background: 'rgba(255, 107, 107, 0.12)', border: '1px solid rgba(255, 107, 107, 0.25)' }}>{error}</div>}
      </footer>
    </div>
  );
}
