// Pure helpers shared by the Figma-side variable creator and unit tests.
// Nothing in here may touch the figma global — keep it side-effect free so
// tests can run under Vitest in Node.

import type { TokenSet, TokenType, TokenVar } from '../ir/types';
import { hexToRGB } from '../style/color';

export type ParsedColor = { r: number; g: number; b: number; a: number };

export type ParsedValue =
  | { kind: 'color'; value: ParsedColor }
  | { kind: 'float'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'alias'; refName: string }
  | { kind: 'unknown' };

const VAR_REF_RE = /^var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,[^)]*)?\)\s*$/;

export function detectAlias(value: string): string | null {
  const m = value.trim().match(VAR_REF_RE);
  return m ? m[1] : null;
}

export function parseColor(raw: string): ParsedColor | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith('#')) {
    const s = v.length === 4 || v.length === 5
      ? '#' + v.slice(1).split('').map(c => c + c).join('')
      : v;
    if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(s)) return null;
    return hexToRGB(s);
  }
  const fnMatch = v.match(/^([a-z]+)\s*\(\s*([^)]+)\s*\)$/i);
  if (!fnMatch) return null;
  const fn = fnMatch[1].toLowerCase();
  // Accept comma- or whitespace-separated args (modern CSS Color 4 syntax both
  // are valid: rgb(0 0 0 / 0.5) and rgb(0, 0, 0, 0.5)).
  const argsRaw = fnMatch[2].replace('/', ' ').split(/[,\s]+/).filter(Boolean);
  if (fn === 'rgb' || fn === 'rgba') {
    if (argsRaw.length < 3) return null;
    const [r, g, b] = argsRaw.slice(0, 3).map(parsePctOrByte);
    const a = argsRaw[3] !== undefined ? parseAlpha(argsRaw[3]) : 1;
    if ([r, g, b].some(n => Number.isNaN(n))) return null;
    return { r, g, b, a };
  }
  if (fn === 'hsl' || fn === 'hsla') {
    if (argsRaw.length < 3) return null;
    const h = parseFloat(argsRaw[0]);
    const s = parsePercent(argsRaw[1]);
    const l = parsePercent(argsRaw[2]);
    const a = argsRaw[3] !== undefined ? parseAlpha(argsRaw[3]) : 1;
    if ([h, s, l].some(n => Number.isNaN(n))) return null;
    return { ...hslToRgb(h, s, l), a };
  }
  // oklch / oklab / hwb / lab / lch / color() — out of scope; caller falls
  // back to STRING if we return null here.
  return null;
}

function parsePctOrByte(s: string): number {
  if (s.endsWith('%')) return Math.max(0, Math.min(1, parseFloat(s) / 100));
  const n = parseFloat(s);
  if (Number.isNaN(n)) return NaN;
  return Math.max(0, Math.min(1, n / 255));
}

function parsePercent(s: string): number {
  if (s.endsWith('%')) return Math.max(0, Math.min(1, parseFloat(s) / 100));
  const n = parseFloat(s);
  return Number.isNaN(n) ? NaN : Math.max(0, Math.min(1, n));
}

function parseAlpha(s: string): number {
  if (s.endsWith('%')) return Math.max(0, Math.min(1, parseFloat(s) / 100));
  const n = parseFloat(s);
  return Number.isNaN(n) ? 1 : Math.max(0, Math.min(1, n));
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return { r: l, g: l, b: l };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: hue2rgb(hh + 1 / 3), g: hue2rgb(hh), b: hue2rgb(hh - 1 / 3) };
}

// "16px" / "1rem" / "0.5em" / "200%" / "16" → number
export function parseFloatValue(raw: string): number | null {
  const v = raw.trim();
  const m = v.match(/^(-?\d*\.?\d+)(px|rem|em|%)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] || 'px').toLowerCase();
  if (unit === 'rem' || unit === 'em') return n * 16;
  if (unit === '%') return n; // semantics depend on context; pass through
  return n;
}

export function parseValue(raw: string, type: TokenType): ParsedValue {
  if (raw == null) return { kind: 'unknown' };
  const aliasRef = detectAlias(raw);
  if (aliasRef) return { kind: 'alias', refName: aliasRef };
  if (type === 'COLOR') {
    const c = parseColor(raw);
    return c ? { kind: 'color', value: c } : { kind: 'unknown' };
  }
  if (type === 'FLOAT') {
    const n = parseFloatValue(raw);
    return n != null ? { kind: 'float', value: n } : { kind: 'unknown' };
  }
  return { kind: 'string', value: raw.trim() };
}

// Strip a leading "--" and an optional configurable prefix, then convert
// hyphen-separated segments into "/" so tokens nest in the Figma sidebar.
//   --token-color-primary-500  →  color/primary/500
//   --color-primary             →  color/primary
export function variableNameForFigma(rawName: string, stripPrefixes: string[] = ['token-']): string {
  let n = rawName.replace(/^--/, '');
  for (const p of stripPrefixes) {
    if (n.startsWith(p)) { n = n.slice(p.length); break; }
  }
  return n.replace(/-/g, '/');
}

// Stable string key for a parsed colour, used as the lookup map key for
// back-binding scraped raw hex/rgb values to their declaring token. Drops
// the alpha byte when fully opaque so `#3B82F6` (from a node fill) matches
// `--color-primary: #3B82F6` whether or not the var was authored with FF.
export function colorKey(c: { r: number; g: number; b: number; a: number }): string {
  const h = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0').toUpperCase();
  let s = '#' + h(c.r) + h(c.g) + h(c.b);
  if (c.a < 0.999) s += h(c.a);
  return s;
}

// Same key, but accepts a raw CSS string. Returns null when unparseable.
export function colorKeyFromCss(raw: string): string | null {
  const c = parseColor(raw);
  return c ? colorKey(c) : null;
}

export type IndexEntries = {
  color: Map<string, string>;   // colorKey → raw token name (--xxx)
  number: Map<number, string>;  // px → raw token name
  string: Map<string, string>;  // string value → raw token name
};

// Build a value→token-name lookup for back-binding. Only literal values in
// the default (first) mode contribute; alias-only vars skip so the leaf
// variable wins (designer can still edit through the alias). When two vars
// share the same value, the entry is dropped — binding ambiguously is worse
// than not binding at all (designer thinks they're editing X but it's Y).
export function buildIndexEntries(set: TokenSet): IndexEntries {
  const color = new Map<string, string>();
  const colorBlocked = new Set<string>();
  const number = new Map<number, string>();
  const numberBlocked = new Set<number>();
  const string = new Map<string, string>();
  const stringBlocked = new Set<string>();
  const defaultMode = set.modes[0] || 'Light';

  for (const v of set.vars) {
    const raw = v.values[defaultMode];
    if (!raw) continue;
    if (detectAlias(raw)) continue;

    if (v.type === 'COLOR') {
      const k = colorKeyFromCss(raw);
      if (!k) continue;
      if (colorBlocked.has(k)) continue;
      if (color.has(k)) { color.delete(k); colorBlocked.add(k); continue; }
      color.set(k, v.name);
    } else if (v.type === 'FLOAT') {
      const n = parseFloatValue(raw);
      if (n == null) continue;
      if (numberBlocked.has(n)) continue;
      if (number.has(n)) { number.delete(n); numberBlocked.add(n); continue; }
      number.set(n, v.name);
    } else {
      const s = raw.trim();
      if (!s) continue;
      if (stringBlocked.has(s)) continue;
      if (string.has(s)) { string.delete(s); stringBlocked.add(s); continue; }
      string.set(s, v.name);
    }
  }

  return { color, number, string };
}

// Walk a var's values; if every literal failed type detection at scrape time
// (resulting in 'STRING') but the value looks like an alias, follow the chain
// and inherit the target var's type. Pure — operates on a TokenSet copy.
//
// Example: --surface: var(--color-primary)  → was STRING, becomes COLOR once
// --color-primary is known to be COLOR.
export function resolveAliasTypes(set: TokenSet): TokenSet {
  const byName = new Map(set.vars.map(v => [v.name, v]));
  const cache = new Map<string, TokenType | null>();

  // True iff every defined value for this var is a var() alias (no literal).
  function isPureAlias(v: TokenVar): boolean {
    const vals = Object.values(v.values);
    if (!vals.length) return false;
    return vals.every(raw => detectAlias(raw) !== null);
  }

  function resolve(name: string, seen: Set<string>): TokenType | null {
    if (cache.has(name)) return cache.get(name)!;
    if (seen.has(name)) return null;
    const v = byName.get(name);
    if (!v) return null;
    seen.add(name);

    if (!isPureAlias(v)) {
      cache.set(name, v.type);
      return v.type;
    }
    for (const raw of Object.values(v.values)) {
      const ref = detectAlias(raw);
      if (!ref) continue;
      const t = resolve(ref, seen);
      if (t && t !== 'STRING') {
        cache.set(name, t);
        return t;
      }
    }
    cache.set(name, v.type);
    return v.type;
  }

  return {
    modes: set.modes,
    vars: set.vars.map(v => {
      if (!isPureAlias(v)) return v;
      const inferred = resolve(v.name, new Set());
      return inferred && inferred !== v.type ? { ...v, type: inferred } : v;
    }),
  };
}

// Topologically order vars so aliases are resolved after their targets.
// Returns vars in dependency order; cycles are broken by emitting the
// remaining nodes in input order (caller logs/skips cycles).
export function topoOrderVars(set: TokenSet): TokenVar[] {
  const byName = new Map(set.vars.map(v => [v.name, v]));
  const visited = new Set<string>();
  const stack = new Set<string>();
  const out: TokenVar[] = [];

  function visit(v: TokenVar) {
    if (visited.has(v.name)) return;
    if (stack.has(v.name)) return; // cycle — break here
    stack.add(v.name);
    for (const raw of Object.values(v.values)) {
      const ref = detectAlias(raw);
      if (ref) {
        const target = byName.get(ref);
        if (target) visit(target);
      }
    }
    stack.delete(v.name);
    visited.add(v.name);
    out.push(v);
  }

  for (const v of set.vars) visit(v);
  return out;
}
