import { IRNode, ResolvedStyle, TEXT_TAGS, BlendModeName } from '../ir/types';
import { hexToRGB } from '../style/color';
import { computedToResolved } from './computed';
import { colorKeyFromCss } from '../variables/parse';
import type { BindingIndex } from '../variables/create';

// Mapper writes paints/numerics directly. To bind a variable we have to
// intercept at write time. Threading a context arg through ~30 functions is
// noisy; a module-scoped slot, set/cleared by buildTree, keeps each call site
// to a single line change. Always reset in buildTree's `finally`.
let _bindings: BindingIndex | null = null;

const BLEND_MAP: Record<BlendModeName, BlendMode> = {
  'normal': 'NORMAL',
  'multiply': 'MULTIPLY',
  'screen': 'SCREEN',
  'overlay': 'OVERLAY',
  'darken': 'DARKEN',
  'lighten': 'LIGHTEN',
  'color-dodge': 'COLOR_DODGE',
  'color-burn': 'COLOR_BURN',
  'hard-light': 'HARD_LIGHT',
  'soft-light': 'SOFT_LIGHT',
  'difference': 'DIFFERENCE',
  'exclusion': 'EXCLUSION',
  'hue': 'HUE',
  'saturation': 'SATURATION',
  'color': 'COLOR',
  'luminosity': 'LUMINOSITY',
};

const OBJECT_FIT_MAP: Record<string, 'FILL' | 'FIT' | 'CROP' | 'TILE'> = {
  'fill': 'FILL',
  'contain': 'FIT',
  'cover': 'CROP',
  'none': 'FILL',
  'scale-down': 'FIT',
};

const FONT_FAMILY_DEFAULT = 'Inter';

function effectiveStyle(ir: IRNode): ResolvedStyle {
  return ir.computed ? computedToResolved(ir.computed, ir.style) : ir.style;
}

function styleNameForWeight(w: number): string {
  // Round to nearest 100 instead of flooring so non-standard values like 450
  // map to Medium rather than Regular (a 50-unit shift either way).
  if (w >= 850) return 'Black';
  if (w >= 750) return 'ExtraBold';
  if (w >= 650) return 'Bold';
  if (w >= 550) return 'SemiBold';
  if (w >= 450) return 'Medium';
  if (w >= 350) return 'Regular';
  if (w >= 250) return 'Light';
  if (w >= 150) return 'ExtraLight';
  return 'Thin';
}

// Cache: lowercased family → { canonical name, available styles }
type FamilyEntry = { canonical: string; styles: Set<string> };
let _availableFonts: Map<string, FamilyEntry> | null = null;
async function ensureFontIndex(): Promise<Map<string, FamilyEntry>> {
  if (_availableFonts) return _availableFonts;
  _availableFonts = new Map();
  try {
    const fonts = await figma.listAvailableFontsAsync();
    for (const f of fonts) {
      const lc = f.fontName.family.toLowerCase();
      let entry = _availableFonts.get(lc);
      if (!entry) { entry = { canonical: f.fontName.family, styles: new Set() }; _availableFonts.set(lc, entry); }
      entry.styles.add(f.fontName.style);
    }
  } catch {
    // Older Figma runtime without listAvailableFontsAsync — empty index, fall
    // back to direct loadFontAsync attempts.
  }
  return _availableFonts;
}

// Find the closest available family. Strategy:
//   1. Exact case-insensitive match
//   2. Substring match (e.g. "Sarabun" matches "Sarabun New")
//   3. Same writing-system bucket (Thai → first Thai-capable family)
//   4. null → caller falls back to Inter
const THAI_RE = /[฀-๿]/;
const CJK_RE = /[㐀-鿿가-힯぀-ゟ゠-ヿ]/;

function familyFromCss(css: string | undefined): string | undefined {
  if (!css) return undefined;
  // CSS font-family is comma-separated; first non-generic name wins.
  const GENERIC = new Set(['serif','sans-serif','monospace','cursive','fantasy','system-ui','ui-serif','ui-sans-serif','ui-monospace','ui-rounded','math','emoji','fangsong']);
  for (const raw of css.split(',')) {
    const name = raw.trim().replace(/^["']|["']$/g, '');
    if (!name) continue;
    if (GENERIC.has(name.toLowerCase())) continue;
    return name;
  }
  return undefined;
}

function findClosestFamily(index: Map<string, FamilyEntry>, want: string, sampleText: string): FamilyEntry | null {
  if (index.size === 0) return null;
  const wantLower = want.toLowerCase();
  const exact = index.get(wantLower);
  if (exact) return exact;

  // Substring match — preferred when user requests "Sarabun" but Figma only has "Sarabun New".
  for (const [key, entry] of index) {
    if (key.includes(wantLower) || wantLower.includes(key)) return entry;
  }

  // Writing-system fallback. Thai text needs a Thai-capable font.
  const needsThai = THAI_RE.test(sampleText);
  const needsCjk = CJK_RE.test(sampleText);
  const SCRIPT_HINTS: Record<string, string[]> = {
    thai: ['noto sans thai', 'sarabun', 'kanit', 'prompt', 'mitr', 'ibm plex sans thai', 'k2d', 'taviraj'],
    cjk: ['noto sans sc', 'noto sans jp', 'noto sans kr', 'source han sans', 'pingfang', 'hiragino', 'meiryo'],
  };
  const hints = needsThai ? SCRIPT_HINTS.thai : (needsCjk ? SCRIPT_HINTS.cjk : []);
  for (const hint of hints) {
    const direct = index.get(hint);
    if (direct) return direct;
    for (const [key, entry] of index) if (key.includes(hint)) return entry;
  }
  return null;
}

function pickStyle(available: Set<string>, requested: string): string {
  if (available.has(requested)) return requested;
  // Common alias normalisations
  const ALIASES: Record<string, string[]> = {
    'Regular':    ['Normal', 'Book', 'Roman', '400'],
    'Medium':     ['Demi', '500'],
    'SemiBold':   ['Demibold', 'Semi Bold', '600'],
    'Bold':       ['700'],
    'ExtraBold':  ['Extra Bold', 'Heavy', '800'],
    'Black':      ['900'],
    'Light':      ['300'],
    'ExtraLight': ['Extra Light', 'UltraLight', '200'],
    'Thin':       ['Hairline', '100'],
  };
  const aliases = ALIASES[requested] ?? [];
  for (const a of aliases) if (available.has(a)) return a;
  // Case-insensitive fallback
  const lower = requested.toLowerCase();
  for (const s of available) if (s.toLowerCase() === lower) return s;
  // Try Regular as a last resort
  if (available.has('Regular')) return 'Regular';
  // Pick anything available
  return available.values().next().value || 'Regular';
}

async function loadFont(family: string, style: string, sampleText = ''): Promise<FontName> {
  const index = await ensureFontIndex();
  if (index.size > 0) {
    const matched = findClosestFamily(index, family, sampleText);
    if (matched) {
      const matchedStyle = pickStyle(matched.styles, style);
      try {
        const font = { family: matched.canonical, style: matchedStyle } as FontName;
        await figma.loadFontAsync(font);
        return font;
      } catch {}
    }
  }
  try {
    const font = { family, style } as FontName;
    await figma.loadFontAsync(font);
    return font;
  } catch {
    const fallback = { family: 'Inter', style: 'Regular' } as FontName;
    await figma.loadFontAsync(fallback);
    return fallback;
  }
}

function solidPaint(hex: string): SolidPaint {
  const { r, g, b, a } = hexToRGB(hex);
  return { type: 'SOLID', color: { r, g, b }, opacity: a };
}

// Returns a SolidPaint bound to a Variable when the hex matches an indexed
// token; otherwise the same plain paint solidPaint() would produce. Caller
// uses this at sites that hold a real, declared colour — not at fallback
// placeholders like `#E5E7EB` for missing image fills.
function boundColorPaint(hex: string): SolidPaint {
  const paint = solidPaint(hex);
  if (!_bindings || _bindings.byColor.size === 0) return paint;
  const key = colorKeyFromCss(hex);
  if (!key) return paint;
  const variable = _bindings.byColor.get(key);
  if (!variable) return paint;
  try {
    return figma.variables.setBoundVariableForPaint(paint, 'color', variable) as SolidPaint;
  } catch {
    return paint;
  }
}

// Bind a numeric field (paddingLeft, itemSpacing, cornerRadius corners, …) to
// a FLOAT variable when the value matches. setBoundVariable accepts the field
// names defined as VariableBindableNodeField / VariableBindableTextField.
function bindNumericField(node: SceneNode | TextNode, field: string, value: number | undefined) {
  if (!_bindings || value == null || _bindings.byNumber.size === 0) return;
  const variable = _bindings.byNumber.get(value);
  if (!variable) return;
  try {
    (node as any).setBoundVariable(field, variable);
  } catch {}
}

function bindStringField(node: TextNode, field: 'fontFamily', value: string | undefined) {
  if (!_bindings || !value || _bindings.byString.size === 0) return;
  const variable = _bindings.byString.get(value);
  if (!variable) return;
  try {
    (node as any).setBoundVariable(field, variable);
  } catch {}
}

function hasContainerStyling(ir: IRNode): boolean {
  const c = ir.computed;
  if (!c) return false;
  const bg = c.backgroundColor;
  const hasBg = !!bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
  const hasBgImage = !!c.backgroundImage;
  const hasBorder = (c.borderTopWidth ?? 0) > 0 || (c.borderRightWidth ?? 0) > 0
    || (c.borderBottomWidth ?? 0) > 0 || (c.borderLeftWidth ?? 0) > 0;
  const hasRadius = (c.borderTopLeftRadius ?? 0) > 0 || (c.borderTopRightRadius ?? 0) > 0
    || (c.borderBottomLeftRadius ?? 0) > 0 || (c.borderBottomRightRadius ?? 0) > 0;
  const hasShadow = !!c.boxShadow && c.boxShadow !== 'none';
  return hasBg || hasBgImage || hasBorder || hasRadius || hasShadow;
}

const INLINE_TEXT_TAGS = new Set([
  'span', 'strong', 'em', 'a', 'b', 'i', 'small', 'u', 'mark', 'code', 'sub', 'sup',
]);

function isInlineTextDescendantsOnly(ir: IRNode): boolean {
  for (const c of ir.children) {
    if (c.tag === '#text') continue;
    if (!INLINE_TEXT_TAGS.has(c.tag)) return false;
    // Inline element with its own container styling (e.g. <span class="badge">)
    // would otherwise lose its bg/border when flattened; treat as block instead.
    if (hasContainerStyling(c)) return false;
    if (!isInlineTextDescendantsOnly(c)) return false;
  }
  return true;
}

function hasInlineElementChild(ir: IRNode): boolean {
  return ir.children.some(c => c.tag !== '#text');
}

function isTextLeaf(ir: IRNode): boolean {
  if (ir.tag === '#text') return true;
  // Elements with their own container styling (bg/border/radius/shadow) must
  // be rendered as frames so the chrome (pill/avatar/badge) survives.
  if (hasContainerStyling(ir)) return false;
  if (ir.children.length === 0 && ir.text) return true;
  if (ir.children.length > 0 && ir.children.every(c => c.tag === '#text')) return true;
  // Inline-only descendant tree (<p><strong>x</strong></p>) renders as a single
  // rich TextNode so emphasis runs survive — see buildRichText.
  if (ir.children.length > 0 && isInlineTextDescendantsOnly(ir)) return true;
  return false;
}

function isTextOnlyChildren(ir: IRNode): boolean {
  if (ir.children.length === 0) return ir.text !== undefined;
  // Flex / grid containers position children with their own layout. Merging
  // multiple inline children (e.g. <span>icon</span><span>label</span> inside
  // a flex-row button) into one rich-text node forces them to share a single
  // wrapping width, which can stack them onto two lines when the combined
  // text doesn't fit. Keep absolute placement instead.
  const display = ir.computed?.display;
  if (display === 'flex' || display === 'inline-flex' || display === 'grid') return false;
  if (ir.children.every(c => c.tag === '#text')) return true;
  return isInlineTextDescendantsOnly(ir);
}

function joinTextChildren(ir: IRNode): string {
  let raw: string;
  if (ir.text !== undefined && ir.children.length === 0) raw = ir.text;
  else raw = ir.children.map(c => c.text ?? '').join('');
  // Browsers apply text-transform at render time; getComputedStyle returns
  // the source string. Replicate the transform here so labels like
  // "MEMBER WEEK" / "DELIVER TO" match the visual output.
  const tt = ir.computed?.textTransform;
  if (tt === 'uppercase') raw = raw.toUpperCase();
  else if (tt === 'lowercase') raw = raw.toLowerCase();
  else if (tt === 'capitalize') raw = raw.replace(/\b\w/g, c => c.toUpperCase());
  // Preserve trailing whitespace/newlines for white-space: pre / pre-wrap /
  // pre-line — trim collapses meaningful indentation in <pre> blocks.
  const ws = ir.computed?.whiteSpace;
  if (ws === 'pre' || ws === 'pre-wrap' || ws === 'pre-line' || ws === 'break-spaces') return raw;
  return raw.trim();
}

function zIndexOf(ir: IRNode, fallback: number): number {
  const z = ir.computed?.zIndex;
  if (z !== undefined) return z;
  // CSS spec: positioned siblings (non-static) paint after static ones,
  // so SALE / floating badges land on top of in-flow icons by default.
  const pos = ir.computed?.position;
  if (pos === 'absolute' || pos === 'fixed' || pos === 'sticky' || pos === 'relative') return 1;
  return fallback;
}

function buildSvg(ir: IRNode): SceneNode | null {
  let svg = ir.attrs.__svg;
  if (!svg) return null;
  // SVG often uses fill="currentColor" / stroke="currentColor"; the browser
  // resolves that against the element's CSS color. createNodeFromSvg has no
  // such context, so substitute the resolved color in the markup.
  const cur = ir.computed?.color;
  if (cur && cur !== 'rgb(0, 0, 0)') {
    svg = svg.replace(/currentColor/gi, cur);
  }
  try {
    const node = figma.createNodeFromSvg(svg);
    node.name = 'svg';
    if (ir.computed?.rectW && ir.computed?.rectH) {
      try { node.resize(Math.max(1, ir.computed.rectW), Math.max(1, ir.computed.rectH)); } catch {}
    }
    return node;
  } catch (e) {
    console.warn('SVG parse failed:', e);
    return null;
  }
}

import { parseGradient, AnyGradient, splitTopLevelComma as splitCommas } from './parsers';

// Cast pure parser output (matrix is plain number[][]) to Figma's GradientPaint.
function toFigmaGradient(g: AnyGradient | null): GradientPaint | null {
  if (!g) return null;
  return {
    type: g.type,
    gradientStops: g.gradientStops as ReadonlyArray<ColorStop>,
    gradientTransform: g.gradientTransform as Transform,
  };
}

type TextRunStyle = {
  family: string;
  styleName: string;
  size: number;
  color?: string;
  decoration?: 'underline' | 'line-through';
  letterSpacing?: number;
  textTransform?: string;
};

type TextRun = TextRunStyle & { text: string };

function effectiveTextStyle(ir: IRNode, parent?: TextRunStyle): TextRunStyle {
  const s = effectiveStyle(ir);
  return {
    family: s.fontFamily ?? parent?.family ?? FONT_FAMILY_DEFAULT,
    styleName: (s.fontStyle && s.fontStyle !== 'normal')
      ? s.fontStyle
      : (s.fontWeight !== undefined ? styleNameForWeight(s.fontWeight) : (parent?.styleName ?? 'Regular')),
    size: s.fontSize ?? parent?.size ?? 16,
    color: s.color ?? parent?.color,
    decoration: s.textDecoration ?? parent?.decoration,
    letterSpacing: s.letterSpacing ?? parent?.letterSpacing,
    textTransform: ir.computed?.textTransform ?? parent?.textTransform,
  };
}

function applyTextTransform(text: string, tt?: string): string {
  if (tt === 'uppercase') return text.toUpperCase();
  if (tt === 'lowercase') return text.toLowerCase();
  if (tt === 'capitalize') return text.replace(/\b\w/g, c => c.toUpperCase());
  return text;
}

function collectTextRuns(ir: IRNode, parent: TextRunStyle): TextRun[] {
  const own = effectiveTextStyle(ir, parent);
  if (ir.tag === '#text') {
    const raw = ir.text ?? '';
    return raw ? [{ ...own, text: applyTextTransform(raw, own.textTransform) }] : [];
  }
  if (ir.children.length === 0) {
    const raw = ir.text ?? '';
    return raw ? [{ ...own, text: applyTextTransform(raw, own.textTransform) }] : [];
  }
  const out: TextRun[] = [];
  for (const c of ir.children) out.push(...collectTextRuns(c, own));
  return out;
}

async function buildRichText(ir: IRNode): Promise<TextNode | null> {
  const root = effectiveTextStyle(ir);
  const runs = collectTextRuns(ir, root).filter(r => r.text.length > 0);
  if (!runs.length) return null;

  const fontMap = new Map<string, FontName>();
  for (const r of runs) {
    const key = `${r.family}|${r.styleName}`;
    if (!fontMap.has(key)) fontMap.set(key, await loadFont(r.family, r.styleName, r.text));
  }

  const t = figma.createText();
  const firstFont = fontMap.get(`${runs[0].family}|${runs[0].styleName}`)!;
  t.fontName = firstFont;
  t.fontSize = runs[0].size;
  t.characters = runs.map(r => r.text).join('');

  const s = effectiveStyle(ir);
  if (s.lineHeight) t.lineHeight = { value: s.lineHeight, unit: 'PIXELS' };
  if (s.textAlign) {
    const map: Record<string, 'LEFT'|'CENTER'|'RIGHT'|'JUSTIFIED'> = {
      left: 'LEFT', center: 'CENTER', right: 'RIGHT', justify: 'JUSTIFIED',
    };
    t.textAlignHorizontal = map[s.textAlign];
  }
  if (s.textTruncation === 'ending') {
    try { (t as any).textTruncation = 'ENDING'; } catch {}
  }

  let cursor = 0;
  for (const r of runs) {
    const end = cursor + r.text.length;
    if (end > cursor) {
      const font = fontMap.get(`${r.family}|${r.styleName}`)!;
      try { t.setRangeFontName(cursor, end, font); } catch {}
      try { t.setRangeFontSize(cursor, end, r.size); } catch {}
      if (r.color) { try { t.setRangeFills(cursor, end, [solidPaint(r.color)]); } catch {} }
      if (r.letterSpacing) {
        try { t.setRangeLetterSpacing(cursor, end, { value: r.letterSpacing, unit: 'PIXELS' }); } catch {}
      }
      if (r.decoration === 'underline') {
        try { t.setRangeTextDecoration(cursor, end, 'UNDERLINE'); } catch {}
      } else if (r.decoration === 'line-through') {
        try { t.setRangeTextDecoration(cursor, end, 'STRIKETHROUGH'); } catch {}
      }
    }
    cursor = end;
  }

  t.name = ir.tag === '#text' ? 'Text' : ir.tag;
  return t;
}

async function buildText(ir: IRNode): Promise<TextNode> {
  const s = effectiveStyle(ir);
  const family = s.fontFamily ?? FONT_FAMILY_DEFAULT;
  const styleName = s.fontStyle ?? styleNameForWeight(s.fontWeight ?? 400);
  const characters = joinTextChildren(ir);
  const font = await loadFont(family, styleName, characters);

  const t = figma.createText();
  t.fontName = font;
  t.characters = characters;
  if (s.fontSize) {
    t.fontSize = s.fontSize;
    bindNumericField(t, 'fontSize', s.fontSize);
  }
  if (s.lineHeight) {
    t.lineHeight = { value: s.lineHeight, unit: 'PIXELS' };
    bindNumericField(t, 'lineHeight', s.lineHeight);
  }
  if (s.letterSpacing) {
    t.letterSpacing = { value: s.letterSpacing, unit: 'PIXELS' };
    bindNumericField(t, 'letterSpacing', s.letterSpacing);
  }
  if (s.color) t.fills = [boundColorPaint(s.color)];
  bindStringField(t, 'fontFamily', family);
  if (s.textAlign) {
    const map: Record<string, 'LEFT'|'CENTER'|'RIGHT'|'JUSTIFIED'> = {
      left: 'LEFT', center: 'CENTER', right: 'RIGHT', justify: 'JUSTIFIED',
    };
    t.textAlignHorizontal = map[s.textAlign];
  }
  if (s.textDecoration === 'underline') {
    try { t.textDecoration = 'UNDERLINE'; } catch {}
  } else if (s.textDecoration === 'line-through') {
    try { t.textDecoration = 'STRIKETHROUGH'; } catch {}
  }
  if (s.textTruncation === 'ending') {
    try { (t as any).textTruncation = 'ENDING'; } catch {}
  }
  t.name = ir.tag === '#text' ? 'Text' : ir.tag;
  return t;
}

async function buildImage(ir: IRNode): Promise<RectangleNode> {
  const s = effectiveStyle(ir);
  const rect = figma.createRectangle();
  rect.name = ir.attrs.alt || 'Image';
  const w = typeof s.width === 'number' ? s.width : 200;
  const h = typeof s.height === 'number' ? s.height : 200;
  rect.resize(Math.max(1, w), Math.max(1, h));
  if (s.radius) rect.cornerRadius = s.radius;

  const src = ir.attrs.src;
  const scaleMode = OBJECT_FIT_MAP[s.objectFit ?? 'fill'] ?? 'FILL';
  if (src) {
    try {
      const bytes = await fetchImageBytes(src);
      if (bytes) {
        const image = figma.createImage(bytes);
        rect.fills = [{ type: 'IMAGE', scaleMode, imageHash: image.hash }];
        return rect;
      }
    } catch (e) {
      console.warn('Image load failed:', src, e);
    }
  }
  rect.fills = [solidPaint('#E5E7EB')];
  return rect;
}

const _B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const _B64_LOOKUP = (() => {
  const arr = new Uint8Array(256);
  for (let i = 0; i < _B64_CHARS.length; i++) arr[_B64_CHARS.charCodeAt(i)] = i;
  return arr;
})();
function _b64decode(input: string): Uint8Array {
  let data = input.replace(/[^A-Za-z0-9+/]/g, '');
  const pad = data.length % 4;
  if (pad) data += '='.repeat(4 - pad);
  const len = (data.length / 4) * 3 - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
  const bytes = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = _B64_LOOKUP[data.charCodeAt(i)];
    const b = _B64_LOOKUP[data.charCodeAt(i + 1)];
    const c = _B64_LOOKUP[data.charCodeAt(i + 2)];
    const d = _B64_LOOKUP[data.charCodeAt(i + 3)];
    if (p < len) bytes[p++] = (a << 2) | (b >> 4);
    if (p < len) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < len) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes;
}

async function fetchImageBytes(src: string): Promise<Uint8Array | null> {
  if (src.startsWith('data:')) {
    const comma = src.indexOf(',');
    const meta = src.slice(5, comma);
    const data = src.slice(comma + 1);
    if (meta.includes('base64')) return _b64decode(data);
    return null;
  }
  const res = await fetch(src);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

function applySize(node: FrameNode | RectangleNode, s: ResolvedStyle) {
  const w = s.width;
  const h = s.height;
  let width = typeof w === 'number' ? w : 100;
  let height = typeof h === 'number' ? h : 100;
  width = Math.max(width, 1);
  height = Math.max(height, 1);
  node.resize(width, height);

  if ('layoutSizingHorizontal' in node) {
    if (w === 'fill') node.layoutSizingHorizontal = 'FILL';
    else if (w === 'hug') node.layoutSizingHorizontal = 'HUG';
    else if (typeof w === 'number') node.layoutSizingHorizontal = 'FIXED';
  }
  if ('layoutSizingVertical' in node) {
    if (h === 'fill') node.layoutSizingVertical = 'FILL';
    else if (h === 'hug') node.layoutSizingVertical = 'HUG';
    else if (typeof h === 'number') node.layoutSizingVertical = 'FIXED';
  }
}

async function buildBgFills(s: ResolvedStyle): Promise<Paint[]> {
  // Figma fills paint last-on-top; CSS background layers paint first-on-top.
  // Build in CSS order, reverse before returning. bg color always sits beneath
  // every bg image (CSS spec) — push it first so it ends up at the bottom of
  // the reversed list.
  const layers: Paint[] = [];
  const bgImg = (s as any).__bgImage as string | undefined;
  // Skip fills entirely for decorative-only divs whose bg is a tiled / repeating
  // gradient (grid patterns, stripes). Figma can't tile gradient paints; the
  // screen root's screenshot fill will show through instead.
  const isUnrenderableBg = !!bgImg && (
    /repeating-(linear|radial)-gradient/.test(bgImg)
    || (() => {
      const sz = (s as any).__bgSize as string | undefined;
      return !!sz && /^\d+(?:\.\d+)?px(?:\s+\d+(?:\.\d+)?px)?$/.test(sz);
    })()
  );
  // The tile rasterizer (in render.ts) rewrites those bg-images to data: URLs
  // BEFORE scrape. If bg-image is now url(data:…), it's already rasterized and
  // should render as a normal image fill — not skipped.
  const bgIsRasterized = !!bgImg && /^url\(/.test(bgImg);
  const skipDueToTiledGradient = isUnrenderableBg && !bgIsRasterized;
  if (s.bg && !skipDueToTiledGradient) layers.push(boundColorPaint(s.bg));
  if (bgImg && !skipDueToTiledGradient) {
    const cssLayers = splitCommas(bgImg);
    // CSS first layer = top. Walk in reverse so caller-side fills.reverse()
    // puts the first CSS layer at the end (top) of the Figma fills array.
    const imgLayers: Paint[] = [];
    for (const layer of cssLayers) {
      const grad = toFigmaGradient(parseGradient(layer));
      if (grad) { imgLayers.push(grad); continue; }
      const urlMatch = layer.match(/url\(\s*["']?([^"')]+)["']?\s*\)/);
      if (urlMatch) {
        try {
          const bytes = await fetchImageBytes(urlMatch[1]);
          if (bytes) {
            const image = figma.createImage(bytes);
            const bgSize = (s as any).__bgSize as string | undefined;
            const bgRepeat = (s as any).__bgRepeat as string | undefined;
            const repeats = bgRepeat && bgRepeat !== 'no-repeat' && bgRepeat !== 'none';
            let scaleMode: 'FILL' | 'FIT' | 'TILE' | 'CROP';
            if (repeats) scaleMode = 'TILE';
            else if (bgSize === 'contain') scaleMode = 'FIT';
            else if (bgSize === 'cover') scaleMode = 'FILL';
            else scaleMode = 'FILL';
            let scalingFactor: number | undefined;
            if (scaleMode === 'TILE') {
              const sizeMatch = bgSize?.match(/(\d+(?:\.\d+)?)px/);
              if (sizeMatch) scalingFactor = parseFloat(sizeMatch[1]) / 100;
            }
            const paint: ImagePaint = scalingFactor !== undefined
              ? { type: 'IMAGE', scaleMode: 'TILE', imageHash: image.hash, scalingFactor }
              : { type: 'IMAGE', scaleMode, imageHash: image.hash };
            imgLayers.push(paint);
          }
        } catch (e) {
          console.warn('bg-image url load failed:', urlMatch[1], e);
        }
      }
    }
    // Reverse image layers so CSS-first ends up last in the fill array (top).
    for (let i = imgLayers.length - 1; i >= 0; i--) layers.push(imgLayers[i]);
  }
  return layers;
}

function buildEffects(s: ResolvedStyle): Effect[] {
  const out: Effect[] = [];
  const shadows = s.shadows ?? (s.shadow ? [{ ...s.shadow }] : []);
  for (const sh of shadows) {
    const { r, g, b, a } = hexToRGB(sh.color);
    const isInset = (sh as any).inset === true;
    if (isInset) {
      out.push({
        type: 'INNER_SHADOW',
        color: { r, g, b, a },
        offset: { x: sh.x, y: sh.y },
        radius: sh.blur,
        spread: sh.spread,
        visible: true,
        blendMode: 'NORMAL',
      });
    } else {
      out.push({
        type: 'DROP_SHADOW',
        color: { r, g, b, a },
        offset: { x: sh.x, y: sh.y },
        radius: sh.blur,
        spread: sh.spread,
        visible: true,
        blendMode: 'NORMAL',
        showShadowBehindNode: false,
      });
    }
  }
  if (s.layerBlur && s.layerBlur > 0) {
    out.push({ type: 'LAYER_BLUR', blurType: 'NORMAL', radius: s.layerBlur, visible: true });
  }
  if (s.backgroundBlur && s.backgroundBlur > 0) {
    out.push({ type: 'BACKGROUND_BLUR', blurType: 'NORMAL', radius: s.backgroundBlur, visible: true });
  }
  return out;
}

function applyPolygonMask(frame: FrameNode, points: Array<{ x: number; y: number }>) {
  // Build SVG-style path data scaled to frame dims; insert as a vector mask
  // at child index 0 so following siblings get clipped to the polygon.
  const w = frame.width || 1;
  const h = frame.height || 1;
  const coords = points.map(p => `${p.x * w},${p.y * h}`);
  const data = `M ${coords.join(' L ')} Z`;
  let v: VectorNode;
  try { v = figma.createVector(); }
  catch { return; }
  try {
    v.vectorPaths = [{ windingRule: 'NONZERO', data }];
    v.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
    v.isMask = true;
    v.name = 'clip-path mask';
    frame.insertChild(0, v);
  } catch (e) {
    console.warn('clip-path polygon mask failed:', e);
    try { v.remove(); } catch {}
  }
}

function applyCornerRadius(frame: FrameNode, s: ResolvedStyle) {
  if (s.corners) {
    try {
      frame.topLeftRadius = s.corners.tl;
      frame.topRightRadius = s.corners.tr;
      frame.bottomLeftRadius = s.corners.bl;
      frame.bottomRightRadius = s.corners.br;
    } catch {}
    bindNumericField(frame, 'topLeftRadius', s.corners.tl);
    bindNumericField(frame, 'topRightRadius', s.corners.tr);
    bindNumericField(frame, 'bottomLeftRadius', s.corners.bl);
    bindNumericField(frame, 'bottomRightRadius', s.corners.br);
  } else if (s.radius !== undefined) {
    frame.cornerRadius = s.radius;
    // cornerRadius isn't itself bindable; bind each corner instead.
    bindNumericField(frame, 'topLeftRadius', s.radius);
    bindNumericField(frame, 'topRightRadius', s.radius);
    bindNumericField(frame, 'bottomLeftRadius', s.radius);
    bindNumericField(frame, 'bottomRightRadius', s.radius);
  }
}

function applyBorder(frame: FrameNode, s: ResolvedStyle) {
  const sides = s.borderSides;
  const hasUniform = s.borderWidth !== undefined && s.borderWidth > 0;
  const hasSides = sides && (sides.t || sides.r || sides.b || sides.l);
  if (!hasUniform && !hasSides) return;

  // Only the explicit border colour gets bound. The fallback gray is a
  // placeholder for "border declared but no colour parsed", not a real token.
  frame.strokes = [s.borderColor ? boundColorPaint(s.borderColor) : solidPaint('#E5E7EB')];

  if (hasSides) {
    try {
      (frame as any).strokeTopWeight = sides!.t;
      (frame as any).strokeRightWeight = sides!.r;
      (frame as any).strokeBottomWeight = sides!.b;
      (frame as any).strokeLeftWeight = sides!.l;
      bindNumericField(frame, 'strokeTopWeight', sides!.t);
      bindNumericField(frame, 'strokeRightWeight', sides!.r);
      bindNumericField(frame, 'strokeBottomWeight', sides!.b);
      bindNumericField(frame, 'strokeLeftWeight', sides!.l);
    } catch {
      // Older Figma plugin runtime: fall back to uniform max side
      frame.strokeWeight = Math.max(sides!.t, sides!.r, sides!.b, sides!.l);
    }
  } else if (hasUniform) {
    frame.strokeWeight = s.borderWidth!;
    bindNumericField(frame, 'strokeWeight', s.borderWidth!);
  }

  if (s.borderStyle === 'dashed') frame.dashPattern = [6, 4];
  else if (s.borderStyle === 'dotted') frame.dashPattern = [2, 2];
}

async function applyFrameStyle(frame: FrameNode, s: ResolvedStyle) {
  if (s.layout === 'flex') {
    frame.layoutMode = s.direction === 'column' ? 'VERTICAL' : 'HORIZONTAL';
  } else {
    frame.layoutMode = 'NONE';
  }

  if (frame.layoutMode !== 'NONE') {
    if (s.gap !== undefined) {
      frame.itemSpacing = s.gap;
      bindNumericField(frame, 'itemSpacing', s.gap);
    }
    if (s.padding) {
      frame.paddingTop = s.padding.t;
      frame.paddingRight = s.padding.r;
      frame.paddingBottom = s.padding.b;
      frame.paddingLeft = s.padding.l;
      bindNumericField(frame, 'paddingTop', s.padding.t);
      bindNumericField(frame, 'paddingRight', s.padding.r);
      bindNumericField(frame, 'paddingBottom', s.padding.b);
      bindNumericField(frame, 'paddingLeft', s.padding.l);
    }
    const ALIGN_MAP: Record<string, 'MIN'|'CENTER'|'MAX'|'SPACE_BETWEEN'|'BASELINE'> = {
      start: 'MIN', center: 'CENTER', end: 'MAX', 'space-between': 'SPACE_BETWEEN', baseline: 'BASELINE', stretch: 'MIN',
    };
    if (s.justify) frame.primaryAxisAlignItems = ALIGN_MAP[s.justify] as any;
    if (s.align) frame.counterAxisAlignItems = (ALIGN_MAP[s.align] as any) ?? 'MIN';
  }

  frame.fills = await buildBgFills(s);
  applyCornerRadius(frame, s);
  applyBorder(frame, s);

  const effects = buildEffects(s);
  if (effects.length) frame.effects = effects;

  if (s.opacity !== undefined) frame.opacity = s.opacity;
  if (s.blendMode && BLEND_MAP[s.blendMode]) {
    try { frame.blendMode = BLEND_MAP[s.blendMode]; } catch {}
  }

  applySize(frame, s);
}

// Place a child node relative to its parent using browser-computed rects.
function placeChildByRect(child: SceneNode, childIr: IRNode, parentIr: IRNode | null) {
  if (!parentIr?.computed || !childIr.computed) return;
  const cc = childIr.computed;
  const pc = parentIr.computed;

  // For rotated children, getBoundingClientRect returns the AABB of the rotated
  // box (larger than the original). If we use AABB size + apply rotation in
  // Figma, the visible element grows. Prefer the CSS-declared width/height when
  // a rotation is present, and position so the centres line up.
  const rot = cc.transform ? parseRotateDeg(cc.transform) : null;
  const usePreTransform = rot !== null && rot !== 0
    && typeof cc.width === 'number' && typeof cc.height === 'number'
    && cc.width > 0 && cc.height > 0;
  const aabbX = (cc.rectX ?? 0) - (pc.rectX ?? 0);
  const aabbY = (cc.rectY ?? 0) - (pc.rectY ?? 0);
  const aabbW = cc.rectW ?? 0;
  const aabbH = cc.rectH ?? 0;

  if (usePreTransform && 'resize' in child) {
    const w = cc.width as number;
    const h = cc.height as number;
    try { (child as any).resize(Math.max(1, w), Math.max(1, h)); } catch {}
    child.x = aabbX + aabbW / 2 - w / 2;
    child.y = aabbY + aabbH / 2 - h / 2;
  } else {
    child.x = aabbX;
    child.y = aabbY;
  }

  if (cc.transform && 'rotation' in child) {
    if (rot !== null && rot !== 0) (child as any).rotation = -rot;
  }
}

function parseRotateDeg(transform: string): number | null {
  if (!transform || transform === 'none') return null;
  // matrix(a, b, c, d, tx, ty) — rotation = atan2(b, a)
  const m = transform.match(/matrix\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(',').map(p => parseFloat(p.trim()));
    const [a, b] = parts;
    if (Number.isFinite(a) && Number.isFinite(b)) return (Math.atan2(b, a) * 180) / Math.PI;
  }
  // matrix3d(...) — first column carries the 2D rotation in the planar case.
  const m3 = transform.match(/matrix3d\(([^)]+)\)/);
  if (m3) {
    const parts = m3[1].split(',').map(p => parseFloat(p.trim()));
    const [a, b] = parts;
    if (Number.isFinite(a) && Number.isFinite(b)) return (Math.atan2(b, a) * 180) / Math.PI;
  }
  const r = transform.match(/rotate(?:Z)?\(([-\d.]+)deg\)/);
  if (r) return parseFloat(r[1]);
  const rad = transform.match(/rotate(?:Z)?\(([-\d.]+)rad\)/);
  if (rad) return (parseFloat(rad[1]) * 180) / Math.PI;
  return null;
}

export async function buildNode(ir: IRNode, parent: IRNode | null = null): Promise<SceneNode | null> {
  const s = effectiveStyle(ir);
  if (s.layout === 'none') return null;

  let node: SceneNode | null = null;

  if (ir.tag === 'svg') {
    node = buildSvg(ir);
  } else if (ir.tag === 'img') {
    node = await buildImage(ir);
    // Range / element rect can be narrower than the actual container — e.g.
    // wrapped text returns the longest line's width, not the box width. If
    // Figma's font metrics are slightly wider than the browser's, that
    // narrower width re-wraps the text and the last word gets clipped. Expand
    // to the available space from the text's own x to the parent's content-box
    // right edge — keeps siblings (e.g. an icon/badge sitting before the text
    // in a flex row) from being overlapped while still giving the text enough
    // room to wrap the way the browser did.
    if (ir.computed && parent?.computed?.rectW) {
      const pPadR = parent.computed.paddingRight ?? 0;
      const parentRight = (parent.computed.rectX ?? 0) + (parent.computed.rectW ?? 0) - pPadR;
      const availableW = parentRight - (ir.computed.rectX ?? 0);
      if (availableW > (ir.computed.rectW ?? 0)) {
        ir.computed.rectW = availableW;
      }
    }
    node = hasInlineElementChild(ir) ? await buildRichText(ir) : await buildText(ir);
    if (node && 'textAutoResize' in node) {
      const tn = node as TextNode;
      const measuredW = ir.computed?.rectW;
      const measuredH = ir.computed?.rectH ?? 0;
      const lh = ir.computed?.lineHeight ?? ir.computed?.fontSize ?? 16;
      const isMultiline = measuredH > lh * 1.5;
      if (measuredW && measuredW > 0 && isMultiline) {
        // Wrapped text → fixed width, height hugs. Width preserves browser wrap.
        try { tn.textAutoResize = 'HEIGHT'; } catch {}
        try { tn.resize(measuredW, tn.height); } catch {}
      } else {
        // Single-line text → hug both axes so editing in Figma can grow it.
        try { tn.textAutoResize = 'WIDTH_AND_HEIGHT'; } catch {}
      }
    }
  } else {
    const frame = figma.createFrame();
    frame.name = ir.tag;

    // Absolute mode: every frame is layoutMode NONE; children placed by rect.
    // This trades semantic auto-layout for pixel-perfect fidelity.
    const styleForFrame: ResolvedStyle = { ...s, layout: 'block', direction: undefined,
      gap: undefined, padding: undefined, justify: undefined, align: undefined };
    await applyFrameStyle(frame, styleForFrame);
    frame.layoutMode = 'NONE';
    // Screen root carries a full-page screenshot as a guaranteed visual backstop
    // for backgrounds we can't faithfully reproduce (tiled gradients, complex
    // multi-layer bgs, ::before/::after grids). Replace fills with the screenshot
    // so children still render as editable Figma nodes on top.
    const shotUrl = ir.attrs.__screenshot;
    if (shotUrl && parent === null) {
      try {
        const bytes = await fetchImageBytes(shotUrl);
        if (bytes) {
          const image = figma.createImage(bytes);
          frame.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: image.hash }];
        }
      } catch (e) {
        console.warn('screen root screenshot fill failed:', e);
      }
    }
    // CSS overflow other than 'visible' clips in the browser; mirror that so
    // off-screen carousel items / scrolled content don't leak into the canvas.
    const overflow = ir.computed?.overflow;
    frame.clipsContent = !!overflow && overflow !== 'visible';

    // If the frame is a styled text container (chip/badge/avatar), render the
    // text *inside* the frame so the bg/border/radius are preserved. Use
    // Auto Layout here so the text centers/aligns per CSS justify/align.
    if (isTextOnlyChildren(ir)) {
      const inner = hasInlineElementChild(ir) ? await buildRichText(ir) : await buildText(ir);
      if (inner) {
        const padL = ir.computed?.paddingLeft ?? 0;
        const padR = ir.computed?.paddingRight ?? 0;
        const padT = ir.computed?.paddingTop ?? 0;
        const padB = ir.computed?.paddingBottom ?? 0;
        const w = ir.computed?.rectW ?? frame.width;
        const h = ir.computed?.rectH ?? frame.height;

        const ALIGN_MAP: Record<string, 'MIN'|'CENTER'|'MAX'|'SPACE_BETWEEN'> = {
          'flex-start': 'MIN', 'start': 'MIN', 'left': 'MIN',
          'center': 'CENTER',
          'flex-end': 'MAX', 'end': 'MAX', 'right': 'MAX',
          'space-between': 'SPACE_BETWEEN',
        };
        const justify = ir.computed?.justifyContent ?? 'flex-start';
        // Table cells use vertical-align (default middle) instead of flex
        // alignItems. Pick whichever the element actually relies on.
        const display = ir.computed?.display;
        const va = ir.computed?.verticalAlign;
        let align: string = ir.computed?.alignItems ?? 'stretch';
        if ((display === 'table-cell' || display === 'inline-table' || display === 'table') && va) {
          if (va === 'middle') align = 'center';
          else if (va === 'top') align = 'flex-start';
          else if (va === 'bottom') align = 'flex-end';
        } else if ((display === 'table-cell' || display === 'inline-table') && !va) {
          align = 'center';
        }
        const textAlign = ir.computed?.textAlign;

        frame.layoutMode = 'HORIZONTAL';
        frame.paddingLeft = padL;
        frame.paddingRight = padR;
        frame.paddingTop = padT;
        frame.paddingBottom = padB;
        // CSS text-align takes precedence over flex justify when the inner text
        // is hugged — otherwise centered text in a wide frame would left-align
        // (default justify-content). Map text-align → primaryAxisAlignItems.
        const TEXT_ALIGN_TO_PRIMARY: Record<string, 'MIN'|'CENTER'|'MAX'|'SPACE_BETWEEN'> = {
          left: 'MIN', center: 'CENTER', right: 'MAX', justify: 'MIN',
        };
        const primaryFromTextAlign = textAlign ? TEXT_ALIGN_TO_PRIMARY[textAlign] : undefined;
        frame.primaryAxisAlignItems = primaryFromTextAlign ?? ALIGN_MAP[justify] ?? 'MIN';
        frame.counterAxisAlignItems = (ALIGN_MAP[align] as any) ?? 'CENTER';
        try { frame.resize(Math.max(1, w), Math.max(1, h)); } catch {}
        // primaryAxisSizingMode/counterAxisSizingMode default to AUTO (hug
        // contents) — that BLOCKS child layoutSizingHorizontal='FILL' because
        // there's no fixed parent width to fill into. Force FIXED so children
        // can FILL the frame's known rect dimensions.
        try { frame.primaryAxisSizingMode = 'FIXED'; } catch {}
        try { frame.counterAxisSizingMode = 'FIXED'; } catch {}
        // Modern API equivalent — also set so layoutSizing* readers stay in sync.
        try {
          frame.layoutSizingHorizontal = 'FIXED';
          frame.layoutSizingVertical = 'FIXED';
        } catch {}

        // Inner text sizing rule:
        //   - Multi-line text: FILL width so wrap matches the container's
        //     known width (browser already wrapped at this width — preserve).
        //   - Single-line text: HUG. Centering/right-alignment still works via
        //     frame.primaryAxisAlignItems (already mapped from CSS justify).
        //     Filling a single-line text in a chip wraps "Attach" to "Attac\nh".
        const innerLh = ir.computed?.lineHeight ?? ir.computed?.fontSize ?? 16;
        const contentH = (ir.computed?.rectH ?? h) - padT - padB;
        const isMultilineInner = contentH > innerLh * 1.5;
        frame.appendChild(inner);
        if (isMultilineInner) {
          // textAutoResize must be HEIGHT (fixed width, hug height) BEFORE
          // toggling layoutSizingHorizontal to FILL — otherwise Figma rejects
          // the FILL transition. layoutGrow=1 backs FILL on older runtimes.
          try { (inner as TextNode).textAutoResize = 'HEIGHT'; } catch {}
          try { (inner as TextNode).layoutGrow = 1; } catch {}
          try { (inner as TextNode).layoutSizingHorizontal = 'FILL'; } catch {}
          try { (inner as TextNode).layoutSizingVertical = 'HUG'; } catch {}
        } else {
          try { (inner as TextNode).textAutoResize = 'WIDTH_AND_HEIGHT'; } catch {}
          try { (inner as TextNode).layoutGrow = 0; } catch {}
          try { (inner as TextNode).layoutSizingHorizontal = 'HUG'; } catch {}
          try { (inner as TextNode).layoutSizingVertical = 'HUG'; } catch {}
        }
        // If text-align CSS says center/right and justify isn't already set,
        // honour text-align via the inner text node's own alignment.
        if (textAlign && ['left', 'center', 'right', 'justify'].includes(textAlign)) {
          try {
            (inner as TextNode).textAlignHorizontal = textAlign.toUpperCase() as any;
          } catch {}
        }
      }
    } else {
      const orderedChildren = ir.children
        .map((c, i) => ({ c, i }))
        .sort((a, b) => zIndexOf(a.c, 0) - zIndexOf(b.c, 0) || a.i - b.i);

      for (const { c: child } of orderedChildren) {
        const childNode = await buildNode(child, ir);
        if (!childNode) continue;
        frame.appendChild(childNode);
        placeChildByRect(childNode, child, ir);
      }
    }

    if (s.clipPathPolygon) applyPolygonMask(frame, s.clipPathPolygon);

    node = frame;
  }

  // Node-level effects + blend mode apply to text/img/svg too (frame already
  // handled inside applyFrameStyle, but re-applying is idempotent / cheap).
  if (node) {
    if (s.blendMode && BLEND_MAP[s.blendMode] && 'blendMode' in node) {
      try { (node as any).blendMode = BLEND_MAP[s.blendMode]; } catch {}
    }
    if (ir.tag !== 'svg' && (ir.tag === 'img' || isTextLeaf(ir))) {
      const effects = buildEffects(s);
      if (effects.length && 'effects' in node) {
        try { (node as any).effects = effects; } catch {}
      }
      if (s.opacity !== undefined && 'opacity' in node) {
        try { (node as any).opacity = s.opacity; } catch {}
      }
    }
  }

  return node;
}

export async function buildTree(
  roots: IRNode[],
  bindings: BindingIndex | null = null,
): Promise<SceneNode[]> {
  _bindings = bindings;
  try {
    const out: SceneNode[] = [];
    for (const r of roots) {
      const n = await buildNode(r, null);
      if (n) out.push(n);
    }
    return out;
  } finally {
    _bindings = null;
  }
}
