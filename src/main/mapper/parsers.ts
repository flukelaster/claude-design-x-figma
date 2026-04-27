// Pure CSS value parsers used by both the runtime mapper and unit tests.
// No Figma plugin globals here.

import { ShadowEffect } from '../ir/types';

export type RGBA01 = { r: number; g: number; b: number; a: number };
export type GradientStop = { position: number; color: RGBA01 };
export type GradientLinear = {
  type: 'GRADIENT_LINEAR';
  gradientStops: GradientStop[];
  gradientTransform: [[number, number, number], [number, number, number]];
};
export type GradientRadial = {
  type: 'GRADIENT_RADIAL';
  gradientStops: GradientStop[];
  gradientTransform: [[number, number, number], [number, number, number]];
};
export type GradientAngular = {
  type: 'GRADIENT_ANGULAR';
  gradientStops: GradientStop[];
  gradientTransform: [[number, number, number], [number, number, number]];
};
export type AnyGradient = GradientLinear | GradientRadial | GradientAngular;

export function splitTopLevelComma(v: string): string[] {
  const out: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < v.length; i++) {
    const ch = v[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) { out.push(v.slice(start, i).trim()); start = i + 1; }
  }
  const tail = v.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

function rgbToHex(r: number, g: number, b: number, a: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  let hex = '#' + [clamp(r), clamp(g), clamp(b)].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();
  if (a < 1) hex += Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0').toUpperCase();
  return hex;
}

// HSL → RGB. h in degrees, s/l in 0..1.
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

// Linear sRGB ↔ sRGB gamma
function srgbToLinear(c: number): number {
  c = c / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, v * 255));
}

// CIE D65 reference white (Lab/LCH).
const D65 = { X: 0.95047, Y: 1.0, Z: 1.08883 };

// Lab → linear sRGB (D65). Reference: CSS Color 4.
function labToLinearRgb(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const eps = 0.008856;
  const k = 903.3;
  const fxC = (fx ** 3 > eps) ? fx ** 3 : ((116 * fx - 16) / k);
  const fyC = (L > k * eps) ? fy ** 3 : (L / k);
  const fzC = (fz ** 3 > eps) ? fz ** 3 : ((116 * fz - 16) / k);
  const X = fxC * D65.X;
  const Y = fyC * D65.Y;
  const Z = fzC * D65.Z;
  const r =  3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  const g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  const bl =  0.0557 * X - 0.2040 * Y + 1.0570 * Z;
  return [r, g, bl];
}

function lchToLab(L: number, C: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  return [L, C * Math.cos(h), C * Math.sin(h)];
}

// OKLab → linear sRGB. Reference: https://bottosson.github.io/posts/oklab/
function oklabToLinearRgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

// Display P3 → linear sRGB (P3 RGB → P3 linear → XYZ → sRGB linear).
function p3ToLinearRgb(r: number, g: number, b: number): [number, number, number] {
  const lin = [r, g, b].map(c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const [pr, pg, pb] = lin;
  const X =  0.4865709 * pr + 0.2656677 * pg + 0.1982173 * pb;
  const Y =  0.2289746 * pr + 0.6917385 * pg + 0.0792869 * pb;
  const Z =  0.0000000 * pr + 0.0451134 * pg + 1.0439443 * pb;
  return [
     3.2406 * X - 1.5372 * Y - 0.4986 * Z,
    -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
     0.0557 * X - 0.2040 * Y + 1.0570 * Z,
  ];
}

function linearRgbToHex(r: number, g: number, b: number, a: number): string {
  return rgbToHex(linearToSrgb(r), linearToSrgb(g), linearToSrgb(b), a);
}

function parseAlpha(token: string | undefined): number {
  if (!token) return 1;
  const t = token.trim();
  if (t.endsWith('%')) return parseFloat(t) / 100;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 1;
}

// Parse one of: number ("128"), percentage ("50%"), or "none" (→0).
function parseChannel(token: string, scale: number): number {
  const t = token.trim();
  if (t === 'none') return 0;
  if (t.endsWith('%')) return (parseFloat(t) / 100) * scale;
  return parseFloat(t);
}

// Strip leading slash-alpha syntax: "color(srgb 1 0 0 / 0.5)" → main + alpha.
function splitAlpha(inner: string): { body: string; alpha?: string } {
  const i = inner.lastIndexOf('/');
  if (i < 0) return { body: inner };
  return { body: inner.slice(0, i).trim(), alpha: inner.slice(i + 1).trim() };
}

export function cssColorToHex(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (s === 'transparent' || s === 'rgba(0, 0, 0, 0)') return null;
  if (s.startsWith('#')) return s.toUpperCase();

  // rgb() / rgba(): comma OR space separated; "rgb(255 0 0 / .5)" valid.
  const rgbM = s.match(/^rgba?\(([^)]+)\)$/);
  if (rgbM) {
    const inner = rgbM[1].replace(',', ' ').replace(/,/g, ' ');
    const { body, alpha } = splitAlpha(inner);
    const parts = body.trim().split(/\s+/);
    if (parts.length < 3) return null;
    const r = parseChannel(parts[0], 255);
    const g = parseChannel(parts[1], 255);
    const b = parseChannel(parts[2], 255);
    const aRaw = alpha ?? parts[3];
    const a = parseAlpha(aRaw);
    if ([r, g, b].some(n => Number.isNaN(n))) return null;
    return rgbToHex(r, g, b, a);
  }

  const hslM = s.match(/^hsla?\(([^)]+)\)$/);
  if (hslM) {
    const inner = hslM[1].replace(/,/g, ' ');
    const { body, alpha } = splitAlpha(inner);
    const parts = body.trim().split(/\s+/);
    if (parts.length < 3) return null;
    const h = parseFloat(parts[0]);
    const sat = parseFloat(parts[1]) / 100;
    const lt = parseFloat(parts[2]) / 100;
    const a = parseAlpha(alpha ?? parts[3]);
    if ([h, sat, lt].some(n => Number.isNaN(n))) return null;
    const [r, g, b] = hslToRgb(h, sat, lt);
    return rgbToHex(r, g, b, a);
  }

  const labM = s.match(/^lab\(([^)]+)\)$/);
  if (labM) {
    const { body, alpha } = splitAlpha(labM[1]);
    const parts = body.trim().split(/\s+/);
    const L = parseChannel(parts[0], 100);
    const a = parseFloat(parts[1]);
    const b = parseFloat(parts[2]);
    const [lr, lg, lb] = labToLinearRgb(L, a, b);
    return linearRgbToHex(lr, lg, lb, parseAlpha(alpha));
  }

  const lchM = s.match(/^lch\(([^)]+)\)$/);
  if (lchM) {
    const { body, alpha } = splitAlpha(lchM[1]);
    const parts = body.trim().split(/\s+/);
    const L = parseChannel(parts[0], 100);
    const C = parseFloat(parts[1]);
    const h = parseFloat(parts[2]);
    const [labL, labA, labB] = lchToLab(L, C, h);
    const [lr, lg, lb] = labToLinearRgb(labL, labA, labB);
    return linearRgbToHex(lr, lg, lb, parseAlpha(alpha));
  }

  const oklabM = s.match(/^oklab\(([^)]+)\)$/);
  if (oklabM) {
    const { body, alpha } = splitAlpha(oklabM[1]);
    const parts = body.trim().split(/\s+/);
    const L = parseChannel(parts[0], 1);
    const a = parseFloat(parts[1]);
    const b = parseFloat(parts[2]);
    const [lr, lg, lb] = oklabToLinearRgb(L, a, b);
    return linearRgbToHex(lr, lg, lb, parseAlpha(alpha));
  }

  const oklchM = s.match(/^oklch\(([^)]+)\)$/);
  if (oklchM) {
    const { body, alpha } = splitAlpha(oklchM[1]);
    const parts = body.trim().split(/\s+/);
    const L = parseChannel(parts[0], 1);
    const C = parseFloat(parts[1]);
    const h = parseFloat(parts[2]);
    const [labL, labA, labB] = lchToLab(L, C, h);
    const [lr, lg, lb] = oklabToLinearRgb(labL, labA, labB);
    return linearRgbToHex(lr, lg, lb, parseAlpha(alpha));
  }

  // color(<space> r g b [/ a]) — supports srgb, srgb-linear, display-p3.
  const colorM = s.match(/^color\(\s*(\S+)\s+([^)]+)\)$/);
  if (colorM) {
    const space = colorM[1].toLowerCase();
    const { body, alpha } = splitAlpha(colorM[2]);
    const parts = body.trim().split(/\s+/);
    const r0 = parseFloat(parts[0]);
    const g0 = parseFloat(parts[1]);
    const b0 = parseFloat(parts[2]);
    const a = parseAlpha(alpha);
    if ([r0, g0, b0].some(n => Number.isNaN(n))) return null;
    if (space === 'srgb') return rgbToHex(r0 * 255, g0 * 255, b0 * 255, a);
    if (space === 'srgb-linear') return linearRgbToHex(r0, g0, b0, a);
    if (space === 'display-p3') {
      const [lr, lg, lb] = p3ToLinearRgb(r0, g0, b0);
      return linearRgbToHex(lr, lg, lb, a);
    }
    return null;
  }

  return null;
}

export function cssColorToRgba(v: string): RGBA01 | null {
  const s = v.trim();
  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return {
      r: parseInt(h.slice(0, 2), 16) / 255,
      g: parseInt(h.slice(2, 4), 16) / 255,
      b: parseInt(h.slice(4, 6), 16) / 255,
      a: h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/);
  if (!m) return null;
  const parts = m[1].split(',').map(p => parseFloat(p.trim()));
  if (parts.slice(0, 3).some(n => Number.isNaN(n))) return null;
  return {
    r: parts[0] / 255,
    g: parts[1] / 255,
    b: parts[2] / 255,
    a: parts[3] !== undefined ? parts[3] : 1,
  };
}

function parseGradientStops(stopParts: string[], unit: 'percent' | 'deg'): GradientStop[] {
  const stops: GradientStop[] = [];
  for (let i = 0; i < stopParts.length; i++) {
    const s = stopParts[i];
    const colorMatch = s.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]+)/);
    if (!colorMatch) continue;
    const col = colorMatch[1];
    const rest = s.replace(col, '').trim();
    let pos = i / Math.max(1, stopParts.length - 1);
    if (unit === 'deg') {
      const degMatch = rest.match(/([-\d.]+)deg/);
      const pctMatch = rest.match(/([\d.]+)%/);
      if (degMatch) pos = parseFloat(degMatch[1]) / 360;
      else if (pctMatch) pos = parseFloat(pctMatch[1]) / 100;
    } else {
      const pctMatch = rest.match(/([-\d.]+)%/);
      if (pctMatch) pos = parseFloat(pctMatch[1]) / 100;
    }
    const rgb = cssColorToRgba(col);
    if (!rgb) continue;
    stops.push({ position: Math.max(0, Math.min(1, pos)), color: rgb });
  }
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].position < stops[i - 1].position) {
      stops[i] = { ...stops[i], position: stops[i - 1].position };
    }
  }
  return stops;
}

export function parseLinearGradient(value: string): GradientLinear | null {
  const m = value.match(/^linear-gradient\((.+)\)$/s);
  if (!m) return null;
  const parts = splitTopLevelComma(m[1]);

  let angleDeg = 180;
  let stopParts = parts;
  const first = parts[0];
  const angleMatch = first.match(/^(-?\d+(?:\.\d+)?)deg$/);
  if (angleMatch) { angleDeg = parseFloat(angleMatch[1]); stopParts = parts.slice(1); }
  else if (first.startsWith('to ')) {
    const dir = first.slice(3).trim();
    const DIR: Record<string, number> = {
      'top': 0, 'right': 90, 'bottom': 180, 'left': 270,
      'top right': 45, 'right top': 45,
      'bottom right': 135, 'right bottom': 135,
      'bottom left': 225, 'left bottom': 225,
      'top left': 315, 'left top': 315,
    };
    if (DIR[dir] !== undefined) angleDeg = DIR[dir];
    stopParts = parts.slice(1);
  }

  const stops = parseGradientStops(stopParts, 'percent');
  if (stops.length < 2) return null;

  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return {
    type: 'GRADIENT_LINEAR',
    gradientStops: stops,
    gradientTransform: [
      [cos, sin, 0.5 - 0.5 * cos - 0.5 * sin],
      [-sin, cos, 0.5 + 0.5 * sin - 0.5 * cos],
    ],
  };
}

export function parseRadialGradient(value: string): GradientRadial | null {
  const m = value.match(/^radial-gradient\((.+)\)$/s);
  if (!m) return null;
  const parts = splitTopLevelComma(m[1]);

  let stopParts = parts;
  let cx = 0.5, cy = 0.5;
  const first = parts[0];
  const looksLikeStop = /^(rgba?\(|#)/i.test(first);
  if (!looksLikeStop) {
    stopParts = parts.slice(1);
    const atMatch = first.match(/at\s+([\d.]+)%\s+([\d.]+)%/);
    if (atMatch) { cx = parseFloat(atMatch[1]) / 100; cy = parseFloat(atMatch[2]) / 100; }
  }

  const stops = parseGradientStops(stopParts, 'percent');
  if (stops.length < 2) return null;

  const rx = Math.max(cx, 1 - cx);
  const ry = Math.max(cy, 1 - cy);
  return {
    type: 'GRADIENT_RADIAL',
    gradientStops: stops,
    gradientTransform: [
      [rx, 0, cx],
      [0, ry, cy],
    ],
  };
}

export function parseConicGradient(value: string): GradientAngular | null {
  const m = value.match(/^conic-gradient\((.+)\)$/s);
  if (!m) return null;
  const parts = splitTopLevelComma(m[1]);

  let stopParts = parts;
  let fromDeg = 0;
  let cx = 0.5, cy = 0.5;
  const first = parts[0];
  const fromMatch = first.match(/from\s+(-?[\d.]+)deg/);
  const atMatch = first.match(/at\s+([\d.]+)%\s+([\d.]+)%/);
  const looksLikeStop = /^(rgba?\(|#)/i.test(first);
  if (fromMatch) fromDeg = parseFloat(fromMatch[1]);
  if (atMatch) { cx = parseFloat(atMatch[1]) / 100; cy = parseFloat(atMatch[2]) / 100; }
  if (!looksLikeStop) stopParts = parts.slice(1);

  const stops = parseGradientStops(stopParts, 'deg');
  if (stops.length < 2) return null;

  const rad = (fromDeg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return {
    type: 'GRADIENT_ANGULAR',
    gradientStops: stops,
    gradientTransform: [
      [cos * 0.5, -sin * 0.5, cx],
      [sin * 0.5, cos * 0.5, cy],
    ],
  };
}

export function parseGradient(value: string): AnyGradient | null {
  if (value.startsWith('linear-gradient')) return parseLinearGradient(value);
  if (value.startsWith('radial-gradient')) return parseRadialGradient(value);
  if (value.startsWith('conic-gradient')) return parseConicGradient(value);
  return null;
}

export function parseShadowItem(item: string): ShadowEffect | null {
  const inset = /\binset\b/.test(item);
  const cleaned = item.replace(/\binset\b/, '').trim();
  const colorMatch = cleaned.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]+)/);
  const color = colorMatch ? (cssColorToHex(colorMatch[1]) ?? '#00000040') : '#00000040';
  const numSrc = colorMatch ? cleaned.replace(colorMatch[0], '') : cleaned;
  const nums = numSrc.match(/-?\d*\.?\d+/g);
  if (!nums || nums.length < 2) return null;
  const [x = 0, y = 0, blur = 0, spread = 0] = nums.map(Number);
  return { x, y, blur, spread, color, inset };
}

export function parseBoxShadows(v: string | undefined): ShadowEffect[] | undefined {
  if (!v || v === 'none') return undefined;
  const items = splitTopLevelComma(v);
  const effects: ShadowEffect[] = [];
  for (const item of items) {
    const eff = parseShadowItem(item);
    if (eff) effects.push(eff);
  }
  return effects.length ? effects : undefined;
}

export function parseBlurPx(filter: string | undefined): number | undefined {
  if (!filter) return undefined;
  const m = filter.match(/blur\(([\d.]+)px\)/);
  return m ? parseFloat(m[1]) : undefined;
}

// Parse "polygon(0% 0%, 100% 0%, 50% 100%)" → array of normalized points (0..1).
// Pixel values are NOT normalized here; caller must scale by element dims.
export function parsePolygonPoints(cp: string | undefined): Array<{ x: number; y: number }> | null {
  if (!cp) return null;
  const m = cp.match(/^polygon\((.+)\)$/);
  if (!m) return null;
  const inner = m[1];
  const items = splitTopLevelComma(inner);
  const points: Array<{ x: number; y: number }> = [];
  for (const item of items) {
    const parts = item.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const x = parseDimOrPercent(parts[0]);
    const y = parseDimOrPercent(parts[1]);
    if (x === null || y === null) return null;
    points.push({ x, y });
  }
  return points.length >= 3 ? points : null;
}

function parseDimOrPercent(v: string): number | null {
  if (v.endsWith('%')) {
    const n = parseFloat(v.slice(0, -1));
    return Number.isFinite(n) ? n / 100 : null;
  }
  // Treat raw pixel values as already-normalized (caller can post-process if needed).
  // Most clip-path declarations use percent so this branch is rare in scraped data.
  if (v.endsWith('px')) {
    const n = parseFloat(v.slice(0, -2));
    return Number.isFinite(n) ? n : null;
  }
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function parseFilterDropShadows(filter: string | undefined): ShadowEffect[] {
  if (!filter) return [];
  const out: ShadowEffect[] = [];
  const re = /drop-shadow\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(filter)) !== null) {
    const eff = parseShadowItem(m[1]);
    if (eff) out.push({ ...eff, inset: false });
  }
  return out;
}
