import { describe, it, expect } from 'vitest';
import { computedToResolved } from '../src/main/mapper/computed';
import { ComputedStyle } from '../src/main/ir/types';

function resolve(c: ComputedStyle) {
  return computedToResolved(c, {});
}

describe('computedToResolved layout', () => {
  it('flex row → layout flex direction row', () => {
    const r = resolve({ display: 'flex', flexDirection: 'row' });
    expect(r.layout).toBe('flex');
    expect(r.direction).toBe('row');
  });
  it('flex column', () => {
    const r = resolve({ display: 'flex', flexDirection: 'column' });
    expect(r.direction).toBe('column');
  });
  it('display none → layout none', () => {
    expect(resolve({ display: 'none' }).layout).toBe('none');
  });
});

describe('computedToResolved padding', () => {
  it('captures padding from per-side props', () => {
    const r = resolve({ paddingTop: 4, paddingRight: 8, paddingBottom: 4, paddingLeft: 8 });
    expect(r.padding).toEqual({ t: 4, r: 8, b: 4, l: 8 });
  });
  it('omits padding when all zero', () => {
    expect(resolve({}).padding).toBeUndefined();
  });
});

describe('computedToResolved corners', () => {
  it('uniform corners → scalar radius', () => {
    const r = resolve({
      borderTopLeftRadius: 8, borderTopRightRadius: 8,
      borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
    });
    expect(r.radius).toBe(8);
    expect(r.corners).toBeUndefined();
  });
  it('non-uniform corners → corners object', () => {
    const r = resolve({
      borderTopLeftRadius: 8, borderTopRightRadius: 8,
      borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
    });
    expect(r.radius).toBeUndefined();
    expect(r.corners).toEqual({ tl: 8, tr: 8, bl: 0, br: 0 });
  });
});

describe('computedToResolved borders', () => {
  it('uniform border', () => {
    const r = resolve({
      borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
      borderColor: 'rgb(0, 0, 0)',
    });
    expect(r.borderWidth).toBe(1);
    expect(r.borderSides).toBeUndefined();
    expect(r.borderColor).toBe('#000000');
  });
  it('per-side border (e.g. underline link via border-bottom)', () => {
    const r = resolve({
      borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 2, borderLeftWidth: 0,
      borderColor: 'rgb(0, 0, 255)',
    });
    expect(r.borderWidth).toBeUndefined();
    expect(r.borderSides).toEqual({ t: 0, r: 0, b: 2, l: 0 });
    expect(r.borderColor).toBe('#0000FF');
  });
  it('dashed style', () => {
    const r = resolve({
      borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1,
      borderTopStyle: 'dashed',
    });
    expect(r.borderStyle).toBe('dashed');
  });
});

describe('computedToResolved shadows', () => {
  it('captures multiple shadows', () => {
    const r = resolve({
      boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1), 0px 4px 8px rgba(0, 0, 0, 0.2)',
    });
    expect(r.shadows).toHaveLength(2);
    expect(r.shadow?.blur).toBe(2);
  });
  it('captures inset', () => {
    const r = resolve({ boxShadow: 'inset 0px 0px 4px #000' });
    expect(r.shadows).toHaveLength(1);
    expect(r.shadows![0].inset).toBe(true);
  });
  it('combines filter drop-shadow with box-shadow', () => {
    const r = resolve({
      boxShadow: '0px 1px 2px #000',
      filter: 'drop-shadow(2px 2px 4px #f00)',
    });
    expect(r.shadows).toHaveLength(2);
  });
});

describe('computedToResolved blur effects', () => {
  it('captures filter blur', () => {
    expect(resolve({ filter: 'blur(8px)' }).layerBlur).toBe(8);
  });
  it('captures backdrop-filter blur', () => {
    expect(resolve({ backdropFilter: 'blur(12px)' }).backgroundBlur).toBe(12);
  });
});

describe('computedToResolved blend mode', () => {
  it('passes through known modes', () => {
    expect(resolve({ mixBlendMode: 'multiply' }).blendMode).toBe('multiply');
  });
  it('skips unknown', () => {
    expect(resolve({ mixBlendMode: 'plus-lighter' as any }).blendMode).toBeUndefined();
  });
});

describe('computedToResolved object-fit', () => {
  it('passes known fit', () => {
    expect(resolve({ objectFit: 'cover' }).objectFit).toBe('cover');
    expect(resolve({ objectFit: 'contain' }).objectFit).toBe('contain');
  });
});

describe('computedToResolved text-decoration', () => {
  it('underline', () => {
    expect(resolve({ textDecorationLine: 'underline' }).textDecoration).toBe('underline');
  });
  it('line-through', () => {
    expect(resolve({ textDecorationLine: 'line-through' }).textDecoration).toBe('line-through');
  });
  it('skips none', () => {
    expect(resolve({ textDecorationLine: 'none' }).textDecoration).toBeUndefined();
  });
});

describe('computedToResolved clip-path', () => {
  it('inset round → radius', () => {
    const r = resolve({ clipPath: 'inset(0px round 12px)' });
    expect(r.radius).toBe(12);
  });
  it('circle → full radius', () => {
    const r = resolve({ clipPath: 'circle(50%)' });
    expect(r.radius).toBe(9999);
  });
  it('polygon → captures points', () => {
    const r = resolve({ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' });
    expect(r.radius).toBeUndefined();
    expect(r.clipPathPolygon).toHaveLength(3);
    expect(r.clipPathPolygon![0]).toEqual({ x: 0.5, y: 0 });
  });
});

describe('computedToResolved text-overflow + white-space', () => {
  it('ellipsis → textTruncation ending', () => {
    expect(resolve({ textOverflow: 'ellipsis' }).textTruncation).toBe('ending');
  });
  it('white-space pre → preserve', () => {
    expect(resolve({ whiteSpace: 'pre' }).whiteSpace).toBe('preserve');
  });
  it('white-space pre-line → preserve-line', () => {
    expect(resolve({ whiteSpace: 'pre-line' }).whiteSpace).toBe('preserve-line');
  });
  it('white-space normal → undefined', () => {
    expect(resolve({ whiteSpace: 'normal' }).whiteSpace).toBeUndefined();
  });
});
