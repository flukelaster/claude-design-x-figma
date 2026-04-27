import { ResolvedStyle, AxisAlign, FlexDir, SizingMode, TEXT_TAGS, Padding } from '../ir/types';
import { resolveColor } from './color';
import { FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOW } from './palette';

const SPACING_UNIT = 4; // Tailwind base unit (px)

function spacingValue(v: string): number | null {
  if (v === 'px') return 1;
  if (v.startsWith('[') && v.endsWith(']')) {
    const raw = v.slice(1, -1);
    return parseLength(raw);
  }
  const n = Number(v);
  if (Number.isFinite(n)) return n * SPACING_UNIT;
  return null;
}

function parseLength(raw: string): number | null {
  const m = raw.match(/^(-?\d*\.?\d+)(px|rem|em)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2] ?? 'px';
  if (unit === 'rem' || unit === 'em') return n * 16;
  return n;
}

function setPadding(style: ResolvedStyle, sides: ('t'|'r'|'b'|'l')[], value: number) {
  if (!style.padding) style.padding = { t: 0, r: 0, b: 0, l: 0 };
  for (const s of sides) style.padding[s] = value;
}

function applyClass(cls: string, style: ResolvedStyle) {
  // Strip responsive/state modifier prefixes — MVP: ignore non-base
  const segs = cls.split(':');
  if (segs.length > 1) {
    const last = segs[segs.length - 1];
    const modifiers = segs.slice(0, -1);
    // Only apply unmodified base; skip hover/md/etc.
    if (modifiers.some(m => m !== '')) return;
    cls = last;
  }

  // Layout
  if (cls === 'flex') { style.layout = 'flex'; if (!style.direction) style.direction = 'row'; return; }
  if (cls === 'inline-flex') { style.layout = 'flex'; if (!style.direction) style.direction = 'row'; return; }
  if (cls === 'block') { style.layout = 'block'; return; }
  if (cls === 'inline-block' || cls === 'inline') { style.layout = 'inline'; return; }
  if (cls === 'grid') { style.layout = 'grid'; return; }
  if (cls === 'hidden') { style.layout = 'none'; return; }

  // Direction
  if (cls === 'flex-row') { style.direction = 'row'; return; }
  if (cls === 'flex-col') { style.direction = 'column'; return; }

  // Align/justify
  const ALIGN: Record<string, AxisAlign> = {
    start: 'start', center: 'center', end: 'end', between: 'space-between',
    baseline: 'baseline', stretch: 'stretch',
  };
  if (cls.startsWith('items-')) {
    const k = cls.slice(6);
    if (ALIGN[k]) { style.align = ALIGN[k]; return; }
  }
  if (cls.startsWith('justify-')) {
    const k = cls.slice(8);
    if (ALIGN[k]) { style.justify = ALIGN[k]; return; }
  }
  if (cls.startsWith('self-')) return; // unsupported

  // Gap
  if (cls.startsWith('gap-')) {
    const v = spacingValue(cls.slice(4));
    if (v !== null) style.gap = v;
    return;
  }

  // Padding
  const padMatch = cls.match(/^p([trblxy])?-(.+)$/);
  if (padMatch) {
    const dir = padMatch[1];
    const v = spacingValue(padMatch[2]);
    if (v === null) return;
    const sides: Record<string, ('t'|'r'|'b'|'l')[]> = {
      undefined: ['t','r','b','l'], '': ['t','r','b','l'],
      x: ['l','r'], y: ['t','b'],
      t: ['t'], r: ['r'], b: ['b'], l: ['l'],
    };
    setPadding(style, sides[dir ?? ''], v);
    return;
  }

  // Width / Height
  if (cls.startsWith('w-')) { applySize(style, 'width', cls.slice(2)); return; }
  if (cls.startsWith('h-')) { applySize(style, 'height', cls.slice(2)); return; }

  // Background color
  if (cls.startsWith('bg-')) {
    const color = resolveColor(cls.slice(3));
    if (color) style.bg = color;
    return;
  }

  // Text color (text-{color}) or font-size (text-{size}) or align
  if (cls.startsWith('text-')) {
    const k = cls.slice(5);
    if (k === 'left' || k === 'center' || k === 'right' || k === 'justify') {
      style.textAlign = k as any; return;
    }
    if (FONT_SIZE[k]) {
      const [fs, lh] = FONT_SIZE[k];
      style.fontSize = fs; style.lineHeight = lh; return;
    }
    const c = resolveColor(k);
    if (c) { style.color = c; return; }
    return;
  }

  // Font weight / family
  if (cls.startsWith('font-')) {
    const k = cls.slice(5);
    if (FONT_WEIGHT[k]) { style.fontWeight = FONT_WEIGHT[k]; return; }
    if (k === 'sans') { style.fontFamily = 'Inter'; return; }
    if (k === 'serif') { style.fontFamily = 'Georgia'; return; }
    if (k === 'mono') { style.fontFamily = 'JetBrains Mono'; return; }
    return;
  }

  // Radius
  if (cls === 'rounded') { style.radius = RADIUS['']; return; }
  if (cls.startsWith('rounded-')) {
    const k = cls.slice(8);
    if (RADIUS[k] !== undefined) { style.radius = RADIUS[k]; return; }
    const v = parseLength(k.startsWith('[') ? k.slice(1, -1) : k);
    if (v !== null) style.radius = v;
    return;
  }

  // Border
  if (cls === 'border') { style.borderWidth = 1; return; }
  if (cls.startsWith('border-')) {
    const rest = cls.slice(7);
    const n = Number(rest);
    if (Number.isFinite(n)) { style.borderWidth = n; return; }
    const c = resolveColor(rest);
    if (c) { style.borderColor = c; if (style.borderWidth === undefined) style.borderWidth = 1; return; }
    return;
  }

  // Shadow
  if (cls === 'shadow') { style.shadow = SHADOW['']; return; }
  if (cls.startsWith('shadow-')) {
    const k = cls.slice(7);
    if (SHADOW[k]) { style.shadow = SHADOW[k]; return; }
    return;
  }

  // Position
  if (cls === 'relative') { style.position = 'relative'; return; }
  if (cls === 'absolute') { style.position = 'absolute'; return; }
  if (cls === 'fixed') { style.position = 'fixed'; return; }

  // Inset / top/right/bottom/left
  for (const side of ['top','right','bottom','left'] as const) {
    if (cls.startsWith(side + '-')) {
      const v = spacingValue(cls.slice(side.length + 1));
      if (v !== null) style[side] = v;
      return;
    }
  }

  // Opacity
  if (cls.startsWith('opacity-')) {
    const n = Number(cls.slice(8));
    if (Number.isFinite(n)) style.opacity = n / 100;
    return;
  }

  // Leading (line-height)
  if (cls.startsWith('leading-')) {
    const k = cls.slice(8);
    const map: Record<string, number> = { none: 1, tight: 1.25, snug: 1.375, normal: 1.5, relaxed: 1.625, loose: 2 };
    if (map[k] !== undefined) { style.lineHeight = (style.fontSize ?? 16) * map[k]; return; }
    const n = Number(k);
    if (Number.isFinite(n)) { style.lineHeight = n * SPACING_UNIT; return; }
    return;
  }

  // Tracking (letter-spacing)
  if (cls.startsWith('tracking-')) {
    const k = cls.slice(9);
    const map: Record<string, number> = { tighter: -0.8, tight: -0.4, normal: 0, wide: 0.4, wider: 0.8, widest: 1.6 };
    if (map[k] !== undefined) { style.letterSpacing = map[k]; return; }
    return;
  }
}

function applySize(style: ResolvedStyle, key: 'width'|'height', v: string) {
  if (v === 'full') { style[key] = 'fill'; return; }
  if (v === 'auto' || v === 'fit') { style[key] = 'hug'; return; }
  if (v === 'screen') { style[key] = key === 'width' ? 1440 : 900; return; }
  const n = spacingValue(v);
  if (n !== null) style[key] = n;
}

const CSS_TO_STYLE: Array<[string, (v: string, s: ResolvedStyle) => void]> = [
  ['display', (v, s) => {
    if (v === 'flex') { s.layout = 'flex'; if (!s.direction) s.direction = 'row'; }
    else if (v === 'block') s.layout = 'block';
    else if (v === 'grid') s.layout = 'grid';
    else if (v === 'none') s.layout = 'none';
  }],
  ['flex-direction', (v, s) => { s.direction = (v === 'column' || v === 'column-reverse') ? 'column' : 'row'; }],
  ['gap', (v, s) => { const n = parseLength(v); if (n !== null) s.gap = n; }],
  ['padding', (v, s) => applyShorthand(v, s, 'padding')],
  ['padding-top', (v, s) => setPadFromCss(s, 't', v)],
  ['padding-right', (v, s) => setPadFromCss(s, 'r', v)],
  ['padding-bottom', (v, s) => setPadFromCss(s, 'b', v)],
  ['padding-left', (v, s) => setPadFromCss(s, 'l', v)],
  ['width', (v, s) => { const n = parseLength(v); if (n !== null) s.width = n; else if (v === '100%') s.width = 'fill'; else if (v === 'auto') s.width = 'hug'; }],
  ['height', (v, s) => { const n = parseLength(v); if (n !== null) s.height = n; else if (v === '100%') s.height = 'fill'; else if (v === 'auto') s.height = 'hug'; }],
  ['background', (v, s) => { const c = parseColorCss(v); if (c) s.bg = c; }],
  ['background-color', (v, s) => { const c = parseColorCss(v); if (c) s.bg = c; }],
  ['color', (v, s) => { const c = parseColorCss(v); if (c) s.color = c; }],
  ['font-size', (v, s) => { const n = parseLength(v); if (n !== null) s.fontSize = n; }],
  ['font-weight', (v, s) => { const n = Number(v); if (Number.isFinite(n)) s.fontWeight = n; }],
  ['line-height', (v, s) => { const n = parseLength(v); if (n !== null) s.lineHeight = n; }],
  ['border-radius', (v, s) => { const n = parseLength(v); if (n !== null) s.radius = n; }],
  ['opacity', (v, s) => { const n = Number(v); if (Number.isFinite(n)) s.opacity = n; }],
  ['text-align', (v, s) => { if (['left','center','right','justify'].includes(v)) s.textAlign = v as any; }],
];

function setPadFromCss(s: ResolvedStyle, side: 't'|'r'|'b'|'l', v: string) {
  const n = parseLength(v);
  if (n === null) return;
  if (!s.padding) s.padding = { t: 0, r: 0, b: 0, l: 0 };
  s.padding[side] = n;
}

function applyShorthand(v: string, s: ResolvedStyle, kind: 'padding') {
  const parts = v.trim().split(/\s+/).map(parseLength).filter((n): n is number => n !== null);
  let t=0, r=0, b=0, l=0;
  if (parts.length === 1) [t, r, b, l] = [parts[0], parts[0], parts[0], parts[0]];
  else if (parts.length === 2) [t, r, b, l] = [parts[0], parts[1], parts[0], parts[1]];
  else if (parts.length === 3) [t, r, b, l] = [parts[0], parts[1], parts[2], parts[1]];
  else if (parts.length === 4) [t, r, b, l] = parts as any;
  else return;
  if (kind === 'padding') s.padding = { t, r, b, l };
}

function parseColorCss(v: string): string | null {
  if (v.startsWith('#')) return v.toUpperCase();
  const m = v.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(',').map(s => s.trim());
    const [r, g, b, a] = parts.map(Number);
    if ([r, g, b].some(n => Number.isNaN(n))) return null;
    let hex = '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();
    if (a !== undefined && !Number.isNaN(a)) hex += Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();
    return hex;
  }
  return null;
}

export function resolveStyle(
  classNames: string[],
  inline: Record<string, string>,
  tag: string,
): ResolvedStyle {
  const style: ResolvedStyle = {};

  // Default text size for headings
  const HEADING_SIZE: Record<string, [number, number, number]> = {
    h1: [32, 40, 700], h2: [28, 36, 700], h3: [24, 32, 700],
    h4: [20, 28, 700], h5: [18, 26, 600], h6: [16, 24, 600],
  };
  if (HEADING_SIZE[tag]) {
    const [fs, lh, fw] = HEADING_SIZE[tag];
    style.fontSize = fs; style.lineHeight = lh; style.fontWeight = fw;
  }
  if (TEXT_TAGS.has(tag) && style.fontSize === undefined) {
    style.fontSize = 16; style.lineHeight = 24;
  }

  for (const cls of classNames) applyClass(cls, style);

  for (const [prop, fn] of CSS_TO_STYLE) {
    if (inline[prop] !== undefined) fn(inline[prop], style);
  }

  return style;
}
