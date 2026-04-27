import { describe, it, expect } from 'vitest';
import { resolveStyle } from '../src/main/style/resolve';

describe('resolveStyle', () => {
  it('flex col with gap and padding', () => {
    const s = resolveStyle('flex flex-col gap-4 p-6'.split(' '), {}, 'div');
    expect(s.layout).toBe('flex');
    expect(s.direction).toBe('column');
    expect(s.gap).toBe(16);
    expect(s.padding).toEqual({ t: 24, r: 24, b: 24, l: 24 });
  });

  it('bg color from palette', () => {
    const s = resolveStyle(['bg-blue-500'], {}, 'div');
    expect(s.bg).toBe('#3B82F6');
  });

  it('arbitrary color', () => {
    const s = resolveStyle(['bg-[#abcdef]'], {}, 'div');
    expect(s.bg).toBe('#ABCDEF');
  });

  it('text size + color', () => {
    const s = resolveStyle('text-2xl text-slate-900 font-bold'.split(' '), {}, 'h1');
    expect(s.fontSize).toBe(24);
    expect(s.lineHeight).toBe(32);
    expect(s.color).toBe('#0F172A');
    expect(s.fontWeight).toBe(700);
  });

  it('rounded radius', () => {
    expect(resolveStyle(['rounded'], {}, 'div').radius).toBe(4);
    expect(resolveStyle(['rounded-lg'], {}, 'div').radius).toBe(8);
    expect(resolveStyle(['rounded-full'], {}, 'div').radius).toBe(9999);
  });

  it('directional padding', () => {
    const s = resolveStyle('px-4 py-2'.split(' '), {}, 'div');
    expect(s.padding).toEqual({ t: 8, r: 16, b: 8, l: 16 });
  });

  it('inline style overrides', () => {
    const s = resolveStyle(['p-4'], { padding: '20px' }, 'div');
    expect(s.padding).toEqual({ t: 20, r: 20, b: 20, l: 20 });
  });

  it('width fill / hug', () => {
    expect(resolveStyle(['w-full'], {}, 'div').width).toBe('fill');
    expect(resolveStyle(['w-fit'], {}, 'div').width).toBe('hug');
    expect(resolveStyle(['w-32'], {}, 'div').width).toBe(128);
  });

  it('heading defaults', () => {
    const s = resolveStyle([], {}, 'h2');
    expect(s.fontSize).toBe(28);
    expect(s.fontWeight).toBe(700);
  });

  it('skips responsive modifier', () => {
    const s = resolveStyle(['md:p-8', 'p-2'], {}, 'div');
    expect(s.padding).toEqual({ t: 8, r: 8, b: 8, l: 8 });
  });
});
