import { ComputedStyle, ResolvedStyle, BlendModeName, ObjectFit, BorderStyle } from '../ir/types';
import {
  cssColorToHex,
  parseBoxShadows,
  parseBlurPx,
  parseFilterDropShadows,
  parsePolygonPoints,
} from './parsers';

export { cssColorToHex };

const BLEND_MODES: ReadonlySet<BlendModeName> = new Set([
  'normal', 'multiply', 'screen', 'overlay',
  'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion',
  'hue', 'saturation', 'color', 'luminosity',
]);

const OBJECT_FITS: ReadonlySet<ObjectFit> = new Set(['fill', 'contain', 'cover', 'none', 'scale-down']);

// Promote ComputedStyle into ResolvedStyle so the mapper can consume it
// without caring whether the IR came from class-resolution or browser scrape.
export function computedToResolved(c: ComputedStyle, existing: ResolvedStyle): ResolvedStyle {
  const s: ResolvedStyle = { ...existing };

  // Layout
  if (c.display === 'flex' || c.display === 'inline-flex') {
    s.layout = 'flex';
    s.direction = (c.flexDirection === 'column' || c.flexDirection === 'column-reverse') ? 'column' : 'row';
  } else if (c.display === 'none') {
    s.layout = 'none';
  } else if (c.display === 'block' && !s.layout) {
    s.layout = 'block';
  }

  if (c.gap !== undefined) s.gap = c.gap;

  const pT = c.paddingTop ?? 0;
  const pR = c.paddingRight ?? 0;
  const pB = c.paddingBottom ?? 0;
  const pL = c.paddingLeft ?? 0;
  if (pT || pR || pB || pL) s.padding = { t: pT, r: pR, b: pB, l: pL };

  // Sizing — prefer layout rect when available, else width/height
  const w = c.rectW ?? c.width;
  const h = c.rectH ?? c.height;
  if (typeof w === 'number' && w > 0) s.width = w;
  if (typeof h === 'number' && h > 0) s.height = h;

  // Justify / align (flex)
  const JUSTIFY: Record<string, ResolvedStyle['justify']> = {
    'flex-start': 'start', 'start': 'start',
    'center': 'center',
    'flex-end': 'end', 'end': 'end',
    'space-between': 'space-between',
  };
  if (c.justifyContent && JUSTIFY[c.justifyContent]) s.justify = JUSTIFY[c.justifyContent];

  const ALIGN: Record<string, ResolvedStyle['align']> = {
    'flex-start': 'start', 'start': 'start',
    'center': 'center',
    'flex-end': 'end', 'end': 'end',
    'baseline': 'baseline',
    'stretch': 'stretch',
  };
  if (c.alignItems && ALIGN[c.alignItems]) s.align = ALIGN[c.alignItems];

  // Colors. CSS backdrop-filter (e.g. blur) makes a translucent panel look
  // opaque over busy content. Figma has no equivalent for translucent bg, but
  // we DO get a real BACKGROUND_BLUR effect now — only strip alpha when the
  // bg is already mostly opaque so the blur effect adds the rest.
  let bg = cssColorToHex(c.backgroundColor);
  if (bg && c.backdropFilter && bg.length === 9) {
    const alpha = parseInt(bg.slice(7, 9), 16) / 255;
    if (alpha >= 0.7) bg = bg.slice(0, 7);
  }
  if (bg) s.bg = bg;
  const color = cssColorToHex(c.color);
  if (color) s.color = color;

  // Typography
  if (c.fontSize) s.fontSize = c.fontSize;
  if (c.fontWeight) s.fontWeight = c.fontWeight;
  if (c.fontFamily) s.fontFamily = c.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
  if (c.fontStyle && c.fontStyle !== 'normal') s.fontStyle = c.fontStyle;
  if (c.lineHeight && c.lineHeight > 0) s.lineHeight = c.lineHeight;
  if (c.letterSpacing && Math.abs(c.letterSpacing) > 0.01) s.letterSpacing = c.letterSpacing;
  if (c.textAlign && ['left','center','right','justify'].includes(c.textAlign)) s.textAlign = c.textAlign as any;
  if (c.textDecorationLine === 'underline') s.textDecoration = 'underline';
  else if (c.textDecorationLine === 'line-through') s.textDecoration = 'line-through';

  // Radius — keep uniform shortcut + per-corner when corners differ
  const tl = c.borderTopLeftRadius ?? 0;
  const tr = c.borderTopRightRadius ?? 0;
  const bl = c.borderBottomLeftRadius ?? 0;
  const br = c.borderBottomRightRadius ?? 0;
  if (tl || tr || bl || br) {
    if (tl === tr && tr === bl && bl === br) s.radius = tl;
    else s.corners = { tl, tr, bl, br };
  }

  // clip-path: inset(... round Rpx) / circle(...) → simple radius approximation.
  // Polygon and other shapes need a real vector mask; skipped here.
  const cp = c.clipPath;
  if (cp) {
    if (/^circle\(/.test(cp)) {
      s.radius = 9999;
      s.corners = undefined;
    } else if (/^polygon\(/.test(cp)) {
      const pts = parsePolygonPoints(cp);
      if (pts) s.clipPathPolygon = pts;
    } else {
      const insetRound = cp.match(/^inset\([^)]*round\s+([\d.]+)px\)/);
      if (insetRound) {
        const r = parseFloat(insetRound[1]);
        if (Number.isFinite(r) && r > 0) {
          s.radius = r;
          s.corners = undefined;
        }
      }
    }
  }

  // Border — capture per-side widths, plus a representative width/color so
  // existing single-stroke fallback still works for uniform borders.
  const bt = c.borderTopWidth ?? 0;
  const brw = c.borderRightWidth ?? 0;
  const bb = c.borderBottomWidth ?? 0;
  const blw = c.borderLeftWidth ?? 0;
  if (bt || brw || bb || blw) {
    const uniform = bt === brw && brw === bb && bb === blw;
    const bcHex = cssColorToHex(c.borderColor);
    if (uniform) {
      s.borderWidth = bt;
      if (bcHex) s.borderColor = bcHex;
    } else {
      s.borderSides = { t: bt, r: brw, b: bb, l: blw };
      if (bcHex) s.borderColor = bcHex;
    }
    // Map border-style → strokeDashes. Take the first non-none style.
    const styles = [c.borderTopStyle, c.borderRightStyle, c.borderBottomStyle, c.borderLeftStyle];
    const firstStyle = styles.find(x => x && x !== 'none');
    if (firstStyle === 'dashed' || firstStyle === 'dotted' || firstStyle === 'solid') {
      s.borderStyle = firstStyle as BorderStyle;
    }
  }

  // Shadows — collect both box-shadow and filter: drop-shadow(...) into one
  // effects list. Inset shadows become INNER_SHADOW in the mapper.
  const boxShadows = parseBoxShadows(c.boxShadow) ?? [];
  const filterShadows = parseFilterDropShadows(c.filter);
  const allShadows = [...boxShadows, ...filterShadows];
  if (allShadows.length) {
    s.shadows = allShadows;
    // back-compat: keep first non-inset as scalar shadow
    const firstDrop = allShadows.find(e => !e.inset);
    if (firstDrop) s.shadow = { x: firstDrop.x, y: firstDrop.y, blur: firstDrop.blur, spread: firstDrop.spread, color: firstDrop.color };
  }

  // Blur effects
  const layerBlur = parseBlurPx(c.filter);
  if (layerBlur) s.layerBlur = layerBlur;
  const bgBlur = parseBlurPx(c.backdropFilter);
  if (bgBlur) s.backgroundBlur = bgBlur;

  // Blend mode (skip 'normal')
  if (c.mixBlendMode && BLEND_MODES.has(c.mixBlendMode as BlendModeName)) {
    s.blendMode = c.mixBlendMode as BlendModeName;
  }

  // object-fit on <img>
  if (c.objectFit && OBJECT_FITS.has(c.objectFit as ObjectFit)) {
    s.objectFit = c.objectFit as ObjectFit;
  }

  // text-overflow ellipsis (only meaningful when overflow:hidden + width fixed)
  if (c.textOverflow === 'ellipsis') s.textTruncation = 'ending';

  // white-space — already enforced at scrape time (preserved literal text);
  // recorded so buildText knows not to trim final whitespace.
  if (c.whiteSpace === 'pre' || c.whiteSpace === 'pre-wrap' || c.whiteSpace === 'break-spaces') {
    s.whiteSpace = 'preserve';
  } else if (c.whiteSpace === 'pre-line') {
    s.whiteSpace = 'preserve-line';
  }

  if (c.opacity !== undefined && c.opacity < 1) s.opacity = c.opacity;

  if (c.backgroundImage) (s as any).__bgImage = c.backgroundImage;
  if (c.backgroundSize) (s as any).__bgSize = c.backgroundSize;
  if (c.backgroundPosition) (s as any).__bgPosition = c.backgroundPosition;
  if (c.backgroundRepeat) (s as any).__bgRepeat = c.backgroundRepeat;

  if (c.position && c.position !== 'static') s.position = c.position as any;
  if (c.top !== undefined) s.top = c.top;
  if (c.left !== undefined) s.left = c.left;

  return s;
}
