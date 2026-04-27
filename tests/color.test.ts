import { describe, it, expect } from 'vitest';
import { resolveColor, hexToRGB } from '../src/main/style/color';

describe('resolveColor', () => {
  it('resolves palette token', () => {
    expect(resolveColor('red-500')).toBe('#EF4444');
  });
  it('resolves white/black', () => {
    expect(resolveColor('white')).toBe('#FFFFFF');
    expect(resolveColor('black')).toBe('#000000');
  });
  it('arbitrary hex', () => {
    expect(resolveColor('[#abc]')).toBe('#ABC');
  });
  it('unknown returns null', () => {
    expect(resolveColor('not-a-color')).toBeNull();
  });
  it('alpha modifier', () => {
    expect(resolveColor('red-500/50')).toBe('#EF444480');
  });
});

describe('hexToRGB', () => {
  it('converts 6-digit hex', () => {
    const c = hexToRGB('#FF0000');
    expect(c.r).toBeCloseTo(1);
    expect(c.g).toBeCloseTo(0);
    expect(c.b).toBeCloseTo(0);
    expect(c.a).toBe(1);
  });
  it('handles alpha', () => {
    const c = hexToRGB('#FF000080');
    expect(c.a).toBeCloseTo(0.502, 2);
  });
});
