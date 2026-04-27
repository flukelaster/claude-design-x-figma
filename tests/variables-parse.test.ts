import { describe, it, expect } from 'vitest';
import {
  buildIndexEntries,
  colorKey,
  colorKeyFromCss,
  detectAlias,
  parseColor,
  parseFloatValue,
  parseValue,
  resolveAliasTypes,
  variableNameForFigma,
  topoOrderVars,
} from '../src/main/variables/parse';
import type { TokenSet } from '../src/main/ir/types';

describe('detectAlias', () => {
  it('detects a plain var() ref', () => {
    expect(detectAlias('var(--color-primary)')).toBe('--color-primary');
  });
  it('detects a var() with fallback', () => {
    expect(detectAlias('var(--gap, 8px)')).toBe('--gap');
  });
  it('returns null for literal', () => {
    expect(detectAlias('#fff')).toBeNull();
    expect(detectAlias('16px')).toBeNull();
  });
});

describe('parseColor', () => {
  it('parses 6-digit hex', () => {
    expect(parseColor('#3b82f6')).toEqual({
      r: 59 / 255, g: 130 / 255, b: 246 / 255, a: 1,
    });
  });
  it('parses 8-digit hex with alpha', () => {
    const c = parseColor('#00000080')!;
    expect(c.r).toBe(0);
    expect(c.a).toBeCloseTo(128 / 255, 5);
  });
  it('parses 3-digit shorthand', () => {
    const c = parseColor('#fff')!;
    expect(c.r).toBe(1);
    expect(c.g).toBe(1);
    expect(c.b).toBe(1);
  });
  it('parses rgb()', () => {
    expect(parseColor('rgb(255, 0, 0)')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });
  it('parses rgba() with alpha', () => {
    const c = parseColor('rgba(0, 0, 0, 0.5)')!;
    expect(c.a).toBeCloseTo(0.5, 5);
  });
  it('parses modern rgb(r g b / a) syntax', () => {
    const c = parseColor('rgb(255 255 255 / 0.25)')!;
    expect(c.r).toBe(1);
    expect(c.a).toBeCloseTo(0.25, 5);
  });
  it('parses hsl()', () => {
    const c = parseColor('hsl(0, 100%, 50%)')!;
    expect(c.r).toBeCloseTo(1, 5);
    expect(c.g).toBeCloseTo(0, 5);
    expect(c.b).toBeCloseTo(0, 5);
  });
  it('returns null for unknown function', () => {
    expect(parseColor('oklch(70% 0.1 200)')).toBeNull();
  });
});

describe('parseFloatValue', () => {
  it('parses px', () => { expect(parseFloatValue('16px')).toBe(16); });
  it('parses rem as ×16', () => { expect(parseFloatValue('1.5rem')).toBe(24); });
  it('parses bare number as px', () => { expect(parseFloatValue('12')).toBe(12); });
  it('returns null for keywords', () => { expect(parseFloatValue('auto')).toBeNull(); });
});

describe('parseValue', () => {
  it('routes alias regardless of declared type', () => {
    expect(parseValue('var(--x)', 'COLOR')).toEqual({ kind: 'alias', refName: '--x' });
    expect(parseValue('var(--x)', 'FLOAT')).toEqual({ kind: 'alias', refName: '--x' });
  });
  it('returns unknown when COLOR cannot be parsed', () => {
    expect(parseValue('not-a-color', 'COLOR')).toEqual({ kind: 'unknown' });
  });
  it('parses STRING by passthrough', () => {
    expect(parseValue(' Inter ', 'STRING')).toEqual({ kind: 'string', value: 'Inter' });
  });
});

describe('variableNameForFigma', () => {
  it('strips --token- prefix and nests with slashes', () => {
    expect(variableNameForFigma('--token-color-primary-500')).toBe('color/primary/500');
  });
  it('falls back to slashing when no known prefix', () => {
    expect(variableNameForFigma('--space-md')).toBe('space/md');
  });
  it('honours custom prefix list', () => {
    expect(variableNameForFigma('--ds-color-bg', ['ds-'])).toBe('color/bg');
  });
});

describe('topoOrderVars', () => {
  it('orders aliases after targets', () => {
    const set: TokenSet = {
      modes: ['Light'],
      vars: [
        { name: '--surface', type: 'COLOR', values: { Light: 'var(--blue-500)' } },
        { name: '--blue-500', type: 'COLOR', values: { Light: '#3B82F6' } },
      ],
    };
    const ordered = topoOrderVars(set).map(v => v.name);
    expect(ordered).toEqual(['--blue-500', '--surface']);
  });

  it('resolveAliasTypes infers COLOR from alias chain', () => {
    const set: TokenSet = {
      modes: ['Light'],
      vars: [
        { name: '--surface', type: 'STRING', values: { Light: 'var(--brand)' } },
        { name: '--brand', type: 'STRING', values: { Light: 'var(--blue-500)' } },
        { name: '--blue-500', type: 'COLOR', values: { Light: '#3B82F6' } },
      ],
    };
    const out = resolveAliasTypes(set);
    expect(out.vars.find(v => v.name === '--surface')!.type).toBe('COLOR');
    expect(out.vars.find(v => v.name === '--brand')!.type).toBe('COLOR');
    expect(out.vars.find(v => v.name === '--blue-500')!.type).toBe('COLOR');
  });

  it('resolveAliasTypes leaves type alone when var has a literal value', () => {
    const set: TokenSet = {
      modes: ['Light'],
      vars: [
        { name: '--space-md', type: 'FLOAT', values: { Light: '16px' } },
      ],
    };
    expect(resolveAliasTypes(set).vars[0].type).toBe('FLOAT');
  });

  it('resolveAliasTypes survives alias cycle without throwing', () => {
    const set: TokenSet = {
      modes: ['Light'],
      vars: [
        { name: '--a', type: 'STRING', values: { Light: 'var(--b)' } },
        { name: '--b', type: 'STRING', values: { Light: 'var(--a)' } },
      ],
    };
    expect(() => resolveAliasTypes(set)).not.toThrow();
  });

  it('breaks cycles without throwing', () => {
    const set: TokenSet = {
      modes: ['Light'],
      vars: [
        { name: '--a', type: 'COLOR', values: { Light: 'var(--b)' } },
        { name: '--b', type: 'COLOR', values: { Light: 'var(--a)' } },
      ],
    };
    expect(() => topoOrderVars(set)).not.toThrow();
    expect(topoOrderVars(set)).toHaveLength(2);
  });
});

describe('colorKey', () => {
  it('drops alpha when fully opaque', () => {
    expect(colorKey({ r: 1, g: 0, b: 0, a: 1 })).toBe('#FF0000');
  });
  it('keeps alpha when not opaque', () => {
    expect(colorKey({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('#00000080');
  });
  it('matches via colorKeyFromCss across hex / rgb forms', () => {
    expect(colorKeyFromCss('#3B82F6')).toBe(colorKeyFromCss('rgb(59, 130, 246)'));
  });
});

describe('buildIndexEntries', () => {
  const sample: TokenSet = {
    modes: ['Light', 'Dark'],
    vars: [
      { name: '--color-primary', type: 'COLOR', values: { Light: '#3B82F6', Dark: '#60A5FA' } },
      { name: '--space-md', type: 'FLOAT', values: { Light: '16px' } },
      { name: '--space-lg', type: 'FLOAT', values: { Light: '24px' } },
      { name: '--surface', type: 'COLOR', values: { Light: 'var(--color-primary)' } },
      { name: '--font-sans', type: 'STRING', values: { Light: 'Inter' } },
    ],
  };

  it('indexes literal colours from default mode only', () => {
    const e = buildIndexEntries(sample);
    expect(e.color.get('#3B82F6')).toBe('--color-primary');
    expect(e.color.has('#60A5FA')).toBe(false); // dark-mode literal not indexed
  });

  it('skips alias-only vars (leaf wins)', () => {
    const e = buildIndexEntries(sample);
    expect([...e.color.values()]).not.toContain('--surface');
  });

  it('indexes FLOAT and STRING tokens', () => {
    const e = buildIndexEntries(sample);
    expect(e.number.get(16)).toBe('--space-md');
    expect(e.number.get(24)).toBe('--space-lg');
    expect(e.string.get('Inter')).toBe('--font-sans');
  });

  it('drops ambiguous values rather than guessing', () => {
    const set: TokenSet = {
      modes: ['Light'],
      vars: [
        { name: '--a', type: 'FLOAT', values: { Light: '16px' } },
        { name: '--b', type: 'FLOAT', values: { Light: '16px' } },
        { name: '--c', type: 'FLOAT', values: { Light: '16px' } },
      ],
    };
    const e = buildIndexEntries(set);
    expect(e.number.has(16)).toBe(false); // dropped: three vars compete
  });

  it('drops ambiguous colours too', () => {
    const set: TokenSet = {
      modes: ['Light'],
      vars: [
        { name: '--brand', type: 'COLOR', values: { Light: '#FF0000' } },
        { name: '--danger', type: 'COLOR', values: { Light: '#FF0000' } },
      ],
    };
    const e = buildIndexEntries(set);
    expect(e.color.has('#FF0000')).toBe(false);
  });
});
