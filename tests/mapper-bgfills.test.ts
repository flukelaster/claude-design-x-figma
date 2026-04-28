import { describe, it, expect } from 'vitest';
import { shouldSkipImageLayers } from '../src/main/mapper/index';
import type { ResolvedStyle } from '../src/main/ir/types';

// Helper: bg metadata is stashed as __bgImage / __bgSize / __bgRepeat by
// computedToResolved. Tests build a style by direct assignment.
function bg(over: Partial<{ bgImage: string; bgSize: string; bgRepeat: string; bg: string }>): ResolvedStyle {
  const s: ResolvedStyle = {};
  if (over.bg) s.bg = over.bg;
  const a = s as any;
  if (over.bgImage !== undefined) a.__bgImage = over.bgImage;
  if (over.bgSize !== undefined) a.__bgSize = over.bgSize;
  if (over.bgRepeat !== undefined) a.__bgRepeat = over.bgRepeat;
  return s;
}

describe('shouldSkipImageLayers', () => {
  it('returns false when no bg-image present', () => {
    expect(shouldSkipImageLayers(bg({}))).toBe(false);
    expect(shouldSkipImageLayers(bg({ bg: '#FFFFFF' }))).toBe(false);
  });

  it('returns false for already-rasterized data URLs', () => {
    expect(shouldSkipImageLayers(bg({
      bgImage: 'url("data:image/png;base64,iVBOR...")',
      bgSize: '64px 64px',
      bgRepeat: 'repeat',
    }))).toBe(false);
  });

  it('drops repeating-linear-gradient (no Figma tile equivalent)', () => {
    expect(shouldSkipImageLayers(bg({
      bgImage: 'repeating-linear-gradient(45deg, #141416 0px, #141416 8px, #1c1c1f 8px, #1c1c1f 16px)',
    }))).toBe(true);
  });

  it('drops repeating-radial-gradient', () => {
    expect(shouldSkipImageLayers(bg({
      bgImage: 'repeating-radial-gradient(circle, #fff 0px, #fff 4px, #000 4px, #000 8px)',
    }))).toBe(true);
  });

  it('drops plain gradient + pixel bg-size + bg-repeat (CSS grid pattern)', () => {
    expect(shouldSkipImageLayers(bg({
      bgImage: 'linear-gradient(to right, rgba(255,255,255,.05) 1px, transparent 1px)',
      bgSize: '40px 40px',
      bgRepeat: 'repeat',
    }))).toBe(true);
  });

  it('keeps plain gradient with fixed pixel bg-size and NO repeat (hero gradient)', () => {
    // Regression guard: hero linear-gradient sized 1440x600 should render via
    // Figma's gradient paint, not be silently dropped.
    expect(shouldSkipImageLayers(bg({
      bgImage: 'linear-gradient(to right, #333, #666)',
      bgSize: '1440px 600px',
      bgRepeat: 'no-repeat',
    }))).toBe(false);
  });

  it('keeps plain gradient when bg-size is auto / cover / contain', () => {
    expect(shouldSkipImageLayers(bg({
      bgImage: 'linear-gradient(180deg, #fff, #000)',
      bgSize: 'cover',
      bgRepeat: 'repeat',
    }))).toBe(false);
    expect(shouldSkipImageLayers(bg({
      bgImage: 'linear-gradient(180deg, #fff, #000)',
      bgSize: 'auto',
      bgRepeat: 'repeat',
    }))).toBe(false);
  });

  it('keeps plain gradient with pixel bg-size but missing bg-repeat', () => {
    expect(shouldSkipImageLayers(bg({
      bgImage: 'linear-gradient(to right, #333, #666)',
      bgSize: '40px 40px',
    }))).toBe(false);
  });
});
