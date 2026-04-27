import { describe, it, expect } from 'vitest';
import {
  splitTopLevelComma,
  cssColorToHex,
  cssColorToRgba,
  parseLinearGradient,
  parseRadialGradient,
  parseConicGradient,
  parseGradient,
  parseShadowItem,
  parseBoxShadows,
  parseBlurPx,
  parseFilterDropShadows,
  parsePolygonPoints,
} from '../src/main/mapper/parsers';

describe('splitTopLevelComma', () => {
  it('splits flat list', () => {
    expect(splitTopLevelComma('a, b, c')).toEqual(['a', 'b', 'c']);
  });
  it('keeps rgba parens together', () => {
    expect(splitTopLevelComma('rgba(0, 0, 0, 0.5), #fff'))
      .toEqual(['rgba(0, 0, 0, 0.5)', '#fff']);
  });
  it('handles nested url()', () => {
    expect(splitTopLevelComma('url(a.png), linear-gradient(red, blue)'))
      .toEqual(['url(a.png)', 'linear-gradient(red, blue)']);
  });
});

describe('cssColorToHex', () => {
  it('passes hex through uppercased', () => {
    expect(cssColorToHex('#abc123')).toBe('#ABC123');
  });
  it('parses rgb', () => {
    expect(cssColorToHex('rgb(255, 0, 0)')).toBe('#FF0000');
  });
  it('parses rgba alpha', () => {
    expect(cssColorToHex('rgba(0, 0, 0, 0.5)')).toBe('#00000080');
  });
  it('parses space-separated rgb', () => {
    expect(cssColorToHex('rgb(255 0 128)')).toBe('#FF0080');
  });
  it('parses rgb with slash alpha', () => {
    expect(cssColorToHex('rgb(255 0 0 / 0.5)')).toBe('#FF000080');
  });
  it('parses hsl', () => {
    // hsl(0, 100%, 50%) → red
    expect(cssColorToHex('hsl(0, 100%, 50%)')).toBe('#FF0000');
    expect(cssColorToHex('hsl(120 100% 50%)')).toBe('#00FF00');
  });
  it('parses oklch (red-ish)', () => {
    // oklch(0.628 0.258 29.23) ≈ pure red sRGB
    const hex = cssColorToHex('oklch(0.628 0.258 29.23)');
    expect(hex).toMatch(/^#[A-F0-9]{6}$/);
    // R channel should dominate
    const r = parseInt(hex!.slice(1, 3), 16);
    const g = parseInt(hex!.slice(3, 5), 16);
    const b = parseInt(hex!.slice(5, 7), 16);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });
  it('parses display-p3', () => {
    // color(display-p3 1 0 0) ≈ super-red, clamped to sRGB ~#FF something
    const hex = cssColorToHex('color(display-p3 1 0 0)');
    expect(hex).toMatch(/^#[A-F0-9]{6}$/);
    const r = parseInt(hex!.slice(1, 3), 16);
    expect(r).toBeGreaterThan(200);
  });
  it('parses color(srgb)', () => {
    expect(cssColorToHex('color(srgb 1 0 0)')).toBe('#FF0000');
  });
  it('returns null for transparent', () => {
    expect(cssColorToHex('transparent')).toBeNull();
    expect(cssColorToHex('rgba(0, 0, 0, 0)')).toBeNull();
  });
});

describe('cssColorToRgba', () => {
  it('parses 3-digit hex', () => {
    const c = cssColorToRgba('#f00')!;
    expect(c.r).toBeCloseTo(1);
    expect(c.g).toBeCloseTo(0);
    expect(c.b).toBeCloseTo(0);
    expect(c.a).toBe(1);
  });
  it('parses rgba', () => {
    const c = cssColorToRgba('rgba(255, 128, 0, 0.5)')!;
    expect(c.r).toBeCloseTo(1);
    expect(c.g).toBeCloseTo(128 / 255);
    expect(c.a).toBe(0.5);
  });
});

describe('parseLinearGradient', () => {
  it('parses 2-stop horizontal gradient', () => {
    const g = parseLinearGradient('linear-gradient(90deg, #ff0000 0%, #0000ff 100%)')!;
    expect(g.type).toBe('GRADIENT_LINEAR');
    expect(g.gradientStops).toHaveLength(2);
    expect(g.gradientStops[0].position).toBe(0);
    expect(g.gradientStops[1].position).toBe(1);
  });
  it('parses to-bottom keyword', () => {
    const g = parseLinearGradient('linear-gradient(to bottom, #ffffff, #000000)')!;
    expect(g).toBeTruthy();
    expect(g.gradientStops).toHaveLength(2);
  });
  it('handles rgba stops', () => {
    const g = parseLinearGradient('linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)')!;
    expect(g.gradientStops[0].color.a).toBe(0.5);
    expect(g.gradientStops[1].color.a).toBe(0);
  });
  it('returns null on invalid', () => {
    expect(parseLinearGradient('not-a-gradient')).toBeNull();
  });
});

describe('parseRadialGradient', () => {
  it('parses simple radial', () => {
    const g = parseRadialGradient('radial-gradient(circle, #ffffff 0%, #000000 100%)')!;
    expect(g.type).toBe('GRADIENT_RADIAL');
    expect(g.gradientStops).toHaveLength(2);
  });
  it('parses center position', () => {
    const g = parseRadialGradient('radial-gradient(at 25% 75%, #ffffff, #000000)')!;
    expect(g.gradientTransform[0][2]).toBeCloseTo(0.25);
    expect(g.gradientTransform[1][2]).toBeCloseTo(0.75);
  });
});

describe('parseConicGradient', () => {
  it('parses conic with from angle', () => {
    const g = parseConicGradient('conic-gradient(from 90deg, #ff0000, #0000ff)')!;
    expect(g.type).toBe('GRADIENT_ANGULAR');
    expect(g.gradientStops).toHaveLength(2);
  });
  it('parses conic with deg stops', () => {
    const g = parseConicGradient('conic-gradient(#ff0000 0deg, #0000ff 180deg)')!;
    expect(g.gradientStops[0].position).toBe(0);
    expect(g.gradientStops[1].position).toBe(0.5);
  });
});

describe('parseGradient dispatch', () => {
  it('routes by prefix', () => {
    expect(parseGradient('linear-gradient(#ff0000, #0000ff)')?.type).toBe('GRADIENT_LINEAR');
    expect(parseGradient('radial-gradient(#ff0000, #0000ff)')?.type).toBe('GRADIENT_RADIAL');
    expect(parseGradient('conic-gradient(#ff0000, #0000ff)')?.type).toBe('GRADIENT_ANGULAR');
    expect(parseGradient('url(foo.png)')).toBeNull();
  });
});

describe('parseShadowItem', () => {
  it('parses x y blur color', () => {
    const eff = parseShadowItem('2px 4px 8px rgba(0, 0, 0, 0.25)')!;
    expect(eff.x).toBe(2);
    expect(eff.y).toBe(4);
    expect(eff.blur).toBe(8);
    expect(eff.spread).toBe(0);
    expect(eff.inset).toBe(false);
    expect(eff.color).toBe('#00000040');
  });
  it('parses inset shadow', () => {
    const eff = parseShadowItem('inset 0 1px 2px #000')!;
    expect(eff.inset).toBe(true);
    expect(eff.x).toBe(0);
    expect(eff.y).toBe(1);
    expect(eff.blur).toBe(2);
  });
  it('parses spread', () => {
    const eff = parseShadowItem('1px 2px 3px 4px #abc')!;
    expect(eff.spread).toBe(4);
  });
});

describe('parseBoxShadows', () => {
  it('handles multiple shadows', () => {
    const shadows = parseBoxShadows('0 1px 2px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.2)')!;
    expect(shadows).toHaveLength(2);
    expect(shadows[0].blur).toBe(2);
    expect(shadows[1].blur).toBe(8);
  });
  it('returns undefined for none', () => {
    expect(parseBoxShadows('none')).toBeUndefined();
    expect(parseBoxShadows(undefined)).toBeUndefined();
  });
});

describe('parseBlurPx', () => {
  it('extracts blur radius', () => {
    expect(parseBlurPx('blur(8px)')).toBe(8);
    expect(parseBlurPx('blur(12.5px) brightness(0.9)')).toBe(12.5);
  });
  it('returns undefined when missing', () => {
    expect(parseBlurPx('brightness(0.9)')).toBeUndefined();
    expect(parseBlurPx(undefined)).toBeUndefined();
  });
});

describe('parseFilterDropShadows', () => {
  it('extracts drop-shadow entries', () => {
    const shadows = parseFilterDropShadows('drop-shadow(2px 2px 4px #000) blur(8px) drop-shadow(0 0 1px red)');
    expect(shadows).toHaveLength(2);
    expect(shadows[0].x).toBe(2);
    expect(shadows[1].blur).toBe(1);
    expect(shadows.every(s => !s.inset)).toBe(true);
  });
});

describe('parsePolygonPoints', () => {
  it('parses triangle %', () => {
    const pts = parsePolygonPoints('polygon(50% 0%, 100% 100%, 0% 100%)')!;
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ x: 0.5, y: 0 });
    expect(pts[1]).toEqual({ x: 1, y: 1 });
  });
  it('parses 6-point hexagon', () => {
    const pts = parsePolygonPoints('polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)')!;
    expect(pts).toHaveLength(6);
  });
  it('rejects 2-point or fewer', () => {
    expect(parsePolygonPoints('polygon(0% 0%, 100% 100%)')).toBeNull();
  });
  it('returns null for non-polygon', () => {
    expect(parsePolygonPoints('circle(50%)')).toBeNull();
    expect(parsePolygonPoints(undefined)).toBeNull();
  });
});
