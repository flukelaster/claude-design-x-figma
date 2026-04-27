import { PALETTE, SINGLE_COLORS } from './palette';

// Returns hex like "#RRGGBB" or "#RRGGBBAA", or null if unknown.
export function resolveColor(token: string): string | null {
  if (!token) return null;

  // Arbitrary value: bg-[#abc] / bg-[rgb(0,0,0)]
  if (token.startsWith('[') && token.endsWith(']')) {
    return parseRawColor(token.slice(1, -1));
  }

  // Single color
  if (SINGLE_COLORS[token]) {
    const c = SINGLE_COLORS[token];
    return c === 'transparent' ? '#00000000' : (c === 'currentColor' ? null : c);
  }

  // Family-shade like red-500 or red-500/50 (alpha)
  const [base, alphaStr] = token.split('/');
  const m = base.match(/^([a-z]+)-(\d{2,3})$/);
  if (!m) return null;
  const [, family, shade] = m;
  const hex = PALETTE[family]?.[shade];
  if (!hex) return null;
  if (alphaStr) {
    const a = Math.round((parseInt(alphaStr, 10) / 100) * 255);
    return hex + a.toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}

function parseRawColor(raw: string): string | null {
  if (raw.startsWith('#')) return raw.toUpperCase();
  const rgb = raw.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(',').map(s => s.trim());
    const [r, g, b, a] = parts.map(Number);
    if ([r, g, b].some(n => Number.isNaN(n))) return null;
    let hex = '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();
    if (a !== undefined && !Number.isNaN(a)) {
      hex += Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();
    }
    return hex;
  }
  return null;
}

// hex "#RRGGBB" or "#RRGGBBAA" -> Figma RGB { r, g, b } in 0..1, plus opacity
export function hexToRGB(hex: string): { r: number; g: number; b: number; a: number } {
  let s = hex.replace('#', '');
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  const r = parseInt(s.slice(0, 2), 16) / 255;
  const g = parseInt(s.slice(2, 4), 16) / 255;
  const b = parseInt(s.slice(4, 6), 16) / 255;
  const a = s.length >= 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}
