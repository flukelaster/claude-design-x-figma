var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
(function() {
  "use strict";
  function hexToRGB(hex) {
    let s = hex.replace("#", "");
    if (s.length === 3) s = s.split("").map((c) => c + c).join("");
    const r = parseInt(s.slice(0, 2), 16) / 255;
    const g = parseInt(s.slice(2, 4), 16) / 255;
    const b = parseInt(s.slice(4, 6), 16) / 255;
    const a = s.length >= 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  function splitTopLevelComma(v) {
    const out = [];
    let depth = 0, start = 0;
    for (let i = 0; i < v.length; i++) {
      const ch = v[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === "," && depth === 0) {
        out.push(v.slice(start, i).trim());
        start = i + 1;
      }
    }
    const tail = v.slice(start).trim();
    if (tail) out.push(tail);
    return out;
  }
  function rgbToHex(r, g, b, a) {
    const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
    let hex = "#" + [clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase();
    if (a < 1) hex += Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0").toUpperCase();
    return hex;
  }
  function hslToRgb$1(h, s, l) {
    h = (h % 360 + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(h / 60 % 2 - 1));
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
  function linearToSrgb(c) {
    const v = c <= 31308e-7 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, v * 255));
  }
  const D65 = { X: 0.95047, Y: 1, Z: 1.08883 };
  function labToLinearRgb(L, a, b) {
    const fy = (L + 16) / 116;
    const fx = a / 500 + fy;
    const fz = fy - b / 200;
    const eps = 8856e-6;
    const k = 903.3;
    const fxC = fx ** 3 > eps ? fx ** 3 : (116 * fx - 16) / k;
    const fyC = L > k * eps ? fy ** 3 : L / k;
    const fzC = fz ** 3 > eps ? fz ** 3 : (116 * fz - 16) / k;
    const X = fxC * D65.X;
    const Y = fyC * D65.Y;
    const Z = fzC * D65.Z;
    const r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
    const g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
    const bl = 0.0557 * X - 0.204 * Y + 1.057 * Z;
    return [r, g, bl];
  }
  function lchToLab(L, C, hDeg) {
    const h = hDeg * Math.PI / 180;
    return [L, C * Math.cos(h), C * Math.sin(h)];
  }
  function oklabToLinearRgb(L, a, b) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ];
  }
  function p3ToLinearRgb(r, g, b) {
    const lin = [r, g, b].map((c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const [pr, pg, pb] = lin;
    const X = 0.4865709 * pr + 0.2656677 * pg + 0.1982173 * pb;
    const Y = 0.2289746 * pr + 0.6917385 * pg + 0.0792869 * pb;
    const Z = 0 * pr + 0.0451134 * pg + 1.0439443 * pb;
    return [
      3.2406 * X - 1.5372 * Y - 0.4986 * Z,
      -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
      0.0557 * X - 0.204 * Y + 1.057 * Z
    ];
  }
  function linearRgbToHex(r, g, b, a) {
    return rgbToHex(linearToSrgb(r), linearToSrgb(g), linearToSrgb(b), a);
  }
  function parseAlpha$1(token) {
    if (!token) return 1;
    const t = token.trim();
    if (t.endsWith("%")) return parseFloat(t) / 100;
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : 1;
  }
  function parseChannel(token, scale) {
    const t = token.trim();
    if (t === "none") return 0;
    if (t.endsWith("%")) return parseFloat(t) / 100 * scale;
    return parseFloat(t);
  }
  function splitAlpha(inner) {
    const i = inner.lastIndexOf("/");
    if (i < 0) return { body: inner };
    return { body: inner.slice(0, i).trim(), alpha: inner.slice(i + 1).trim() };
  }
  function cssColorToHex(v) {
    if (!v) return null;
    const s = v.trim();
    if (s === "transparent" || s === "rgba(0, 0, 0, 0)") return null;
    if (s.startsWith("#")) return s.toUpperCase();
    const rgbM = s.match(/^rgba?\(([^)]+)\)$/);
    if (rgbM) {
      const inner = rgbM[1].replace(",", " ").replace(/,/g, " ");
      const { body, alpha } = splitAlpha(inner);
      const parts = body.trim().split(/\s+/);
      if (parts.length < 3) return null;
      const r = parseChannel(parts[0], 255);
      const g = parseChannel(parts[1], 255);
      const b = parseChannel(parts[2], 255);
      const aRaw = alpha != null ? alpha : parts[3];
      const a = parseAlpha$1(aRaw);
      if ([r, g, b].some((n) => Number.isNaN(n))) return null;
      return rgbToHex(r, g, b, a);
    }
    const hslM = s.match(/^hsla?\(([^)]+)\)$/);
    if (hslM) {
      const inner = hslM[1].replace(/,/g, " ");
      const { body, alpha } = splitAlpha(inner);
      const parts = body.trim().split(/\s+/);
      if (parts.length < 3) return null;
      const h = parseFloat(parts[0]);
      const sat = parseFloat(parts[1]) / 100;
      const lt = parseFloat(parts[2]) / 100;
      const a = parseAlpha$1(alpha != null ? alpha : parts[3]);
      if ([h, sat, lt].some((n) => Number.isNaN(n))) return null;
      const [r, g, b] = hslToRgb$1(h, sat, lt);
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
      return linearRgbToHex(lr, lg, lb, parseAlpha$1(alpha));
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
      return linearRgbToHex(lr, lg, lb, parseAlpha$1(alpha));
    }
    const oklabM = s.match(/^oklab\(([^)]+)\)$/);
    if (oklabM) {
      const { body, alpha } = splitAlpha(oklabM[1]);
      const parts = body.trim().split(/\s+/);
      const L = parseChannel(parts[0], 1);
      const a = parseFloat(parts[1]);
      const b = parseFloat(parts[2]);
      const [lr, lg, lb] = oklabToLinearRgb(L, a, b);
      return linearRgbToHex(lr, lg, lb, parseAlpha$1(alpha));
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
      return linearRgbToHex(lr, lg, lb, parseAlpha$1(alpha));
    }
    const colorM = s.match(/^color\(\s*(\S+)\s+([^)]+)\)$/);
    if (colorM) {
      const space = colorM[1].toLowerCase();
      const { body, alpha } = splitAlpha(colorM[2]);
      const parts = body.trim().split(/\s+/);
      const r0 = parseFloat(parts[0]);
      const g0 = parseFloat(parts[1]);
      const b0 = parseFloat(parts[2]);
      const a = parseAlpha$1(alpha);
      if ([r0, g0, b0].some((n) => Number.isNaN(n))) return null;
      if (space === "srgb") return rgbToHex(r0 * 255, g0 * 255, b0 * 255, a);
      if (space === "srgb-linear") return linearRgbToHex(r0, g0, b0, a);
      if (space === "display-p3") {
        const [lr, lg, lb] = p3ToLinearRgb(r0, g0, b0);
        return linearRgbToHex(lr, lg, lb, a);
      }
      return null;
    }
    return null;
  }
  function cssColorToRgba(v) {
    const s = v.trim();
    if (s.startsWith("#")) {
      let h = s.slice(1);
      if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      return {
        r: parseInt(h.slice(0, 2), 16) / 255,
        g: parseInt(h.slice(2, 4), 16) / 255,
        b: parseInt(h.slice(4, 6), 16) / 255,
        a: h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
      };
    }
    const m = s.match(/^rgba?\(([^)]+)\)$/);
    if (!m) return null;
    const parts = m[1].split(",").map((p) => parseFloat(p.trim()));
    if (parts.slice(0, 3).some((n) => Number.isNaN(n))) return null;
    return {
      r: parts[0] / 255,
      g: parts[1] / 255,
      b: parts[2] / 255,
      a: parts[3] !== void 0 ? parts[3] : 1
    };
  }
  function parseGradientStops(stopParts, unit) {
    const stops = [];
    for (let i = 0; i < stopParts.length; i++) {
      const s = stopParts[i];
      const colorMatch = s.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]+)/);
      if (!colorMatch) continue;
      const col = colorMatch[1];
      const rest = s.replace(col, "").trim();
      let pos = i / Math.max(1, stopParts.length - 1);
      if (unit === "deg") {
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
        stops[i] = __spreadProps(__spreadValues({}, stops[i]), { position: stops[i - 1].position });
      }
    }
    return stops;
  }
  function parseLinearGradient(value) {
    const m = value.match(new RegExp("^(?:repeating-)?linear-gradient\\((.+)\\)$", "s"));
    if (!m) return null;
    const parts = splitTopLevelComma(m[1]);
    let angleDeg = 180;
    let stopParts = parts;
    const first = parts[0];
    const angleMatch = first.match(/^(-?\d+(?:\.\d+)?)deg$/);
    if (angleMatch) {
      angleDeg = parseFloat(angleMatch[1]);
      stopParts = parts.slice(1);
    } else if (first.startsWith("to ")) {
      const dir = first.slice(3).trim();
      const DIR = {
        "top": 0,
        "right": 90,
        "bottom": 180,
        "left": 270,
        "top right": 45,
        "right top": 45,
        "bottom right": 135,
        "right bottom": 135,
        "bottom left": 225,
        "left bottom": 225,
        "top left": 315,
        "left top": 315
      };
      if (DIR[dir] !== void 0) angleDeg = DIR[dir];
      stopParts = parts.slice(1);
    }
    const stops = parseGradientStops(stopParts, "percent");
    if (stops.length < 2) return null;
    const rad = (angleDeg - 90) * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    return {
      type: "GRADIENT_LINEAR",
      gradientStops: stops,
      gradientTransform: [
        [cos, sin, 0.5 - 0.5 * cos - 0.5 * sin],
        [-sin, cos, 0.5 + 0.5 * sin - 0.5 * cos]
      ]
    };
  }
  function parseRadialGradient(value) {
    const m = value.match(new RegExp("^(?:repeating-)?radial-gradient\\((.+)\\)$", "s"));
    if (!m) return null;
    const parts = splitTopLevelComma(m[1]);
    let stopParts = parts;
    let cx = 0.5, cy = 0.5;
    const first = parts[0];
    const looksLikeStop = /^(rgba?\(|#)/i.test(first);
    if (!looksLikeStop) {
      stopParts = parts.slice(1);
      const atMatch = first.match(/at\s+([\d.]+)%\s+([\d.]+)%/);
      if (atMatch) {
        cx = parseFloat(atMatch[1]) / 100;
        cy = parseFloat(atMatch[2]) / 100;
      }
    }
    const stops = parseGradientStops(stopParts, "percent");
    if (stops.length < 2) return null;
    const rx = Math.max(cx, 1 - cx);
    const ry = Math.max(cy, 1 - cy);
    return {
      type: "GRADIENT_RADIAL",
      gradientStops: stops,
      gradientTransform: [
        [rx, 0, cx],
        [0, ry, cy]
      ]
    };
  }
  function parseConicGradient(value) {
    const m = value.match(new RegExp("^conic-gradient\\((.+)\\)$", "s"));
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
    if (atMatch) {
      cx = parseFloat(atMatch[1]) / 100;
      cy = parseFloat(atMatch[2]) / 100;
    }
    if (!looksLikeStop) stopParts = parts.slice(1);
    const stops = parseGradientStops(stopParts, "deg");
    if (stops.length < 2) return null;
    const rad = fromDeg * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    return {
      type: "GRADIENT_ANGULAR",
      gradientStops: stops,
      gradientTransform: [
        [cos * 0.5, -sin * 0.5, cx],
        [sin * 0.5, cos * 0.5, cy]
      ]
    };
  }
  function parseGradient(value) {
    if (value.startsWith("linear-gradient") || value.startsWith("repeating-linear-gradient")) return parseLinearGradient(value);
    if (value.startsWith("radial-gradient") || value.startsWith("repeating-radial-gradient")) return parseRadialGradient(value);
    if (value.startsWith("conic-gradient")) return parseConicGradient(value);
    return null;
  }
  function parseShadowItem(item) {
    var _a;
    const inset = /\binset\b/.test(item);
    const cleaned = item.replace(/\binset\b/, "").trim();
    const colorMatch = cleaned.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]+)/);
    const color = colorMatch ? (_a = cssColorToHex(colorMatch[1])) != null ? _a : "#00000040" : "#00000040";
    const numSrc = colorMatch ? cleaned.replace(colorMatch[0], "") : cleaned;
    const nums = numSrc.match(/-?\d*\.?\d+/g);
    if (!nums || nums.length < 2) return null;
    const [x = 0, y = 0, blur = 0, spread = 0] = nums.map(Number);
    return { x, y, blur, spread, color, inset };
  }
  function parseBoxShadows(v) {
    if (!v || v === "none") return void 0;
    const items = splitTopLevelComma(v);
    const effects = [];
    for (const item of items) {
      const eff = parseShadowItem(item);
      if (eff) effects.push(eff);
    }
    return effects.length ? effects : void 0;
  }
  function parseBlurPx(filter) {
    if (!filter) return void 0;
    const m = filter.match(/blur\(([\d.]+)px\)/);
    return m ? parseFloat(m[1]) : void 0;
  }
  function parsePolygonPoints(cp) {
    if (!cp) return null;
    const m = cp.match(/^polygon\((.+)\)$/);
    if (!m) return null;
    const inner = m[1];
    const items = splitTopLevelComma(inner);
    const points = [];
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
  function parseDimOrPercent(v) {
    if (v.endsWith("%")) {
      const n2 = parseFloat(v.slice(0, -1));
      return Number.isFinite(n2) ? n2 / 100 : null;
    }
    if (v.endsWith("px")) {
      const n2 = parseFloat(v.slice(0, -2));
      return Number.isFinite(n2) ? n2 : null;
    }
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  function parseFilterDropShadows(filter) {
    if (!filter) return [];
    const out = [];
    const re = /drop-shadow\(([^)]+)\)/g;
    let m;
    while ((m = re.exec(filter)) !== null) {
      const eff = parseShadowItem(m[1]);
      if (eff) out.push(__spreadProps(__spreadValues({}, eff), { inset: false }));
    }
    return out;
  }
  const BLEND_MODES = /* @__PURE__ */ new Set([
    "normal",
    "multiply",
    "screen",
    "overlay",
    "darken",
    "lighten",
    "color-dodge",
    "color-burn",
    "hard-light",
    "soft-light",
    "difference",
    "exclusion",
    "hue",
    "saturation",
    "color",
    "luminosity"
  ]);
  const OBJECT_FITS = /* @__PURE__ */ new Set(["fill", "contain", "cover", "none", "scale-down"]);
  function computedToResolved(c, existing) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o;
    const s = __spreadValues({}, existing);
    if (c.display === "flex" || c.display === "inline-flex") {
      s.layout = "flex";
      s.direction = c.flexDirection === "column" || c.flexDirection === "column-reverse" ? "column" : "row";
    } else if (c.display === "none") {
      s.layout = "none";
    } else if (c.display === "block" && !s.layout) {
      s.layout = "block";
    }
    if (c.gap !== void 0) s.gap = c.gap;
    const pT = (_a = c.paddingTop) != null ? _a : 0;
    const pR = (_b = c.paddingRight) != null ? _b : 0;
    const pB = (_c = c.paddingBottom) != null ? _c : 0;
    const pL = (_d = c.paddingLeft) != null ? _d : 0;
    if (pT || pR || pB || pL) s.padding = { t: pT, r: pR, b: pB, l: pL };
    const w = (_e = c.rectW) != null ? _e : c.width;
    const h = (_f = c.rectH) != null ? _f : c.height;
    if (typeof w === "number" && w > 0) s.width = w;
    if (typeof h === "number" && h > 0) s.height = h;
    const JUSTIFY = {
      "flex-start": "start",
      "start": "start",
      "center": "center",
      "flex-end": "end",
      "end": "end",
      "space-between": "space-between"
    };
    if (c.justifyContent && JUSTIFY[c.justifyContent]) s.justify = JUSTIFY[c.justifyContent];
    const ALIGN = {
      "flex-start": "start",
      "start": "start",
      "center": "center",
      "flex-end": "end",
      "end": "end",
      "baseline": "baseline",
      "stretch": "stretch"
    };
    if (c.alignItems && ALIGN[c.alignItems]) s.align = ALIGN[c.alignItems];
    let bg = cssColorToHex(c.backgroundColor);
    if (bg && c.backdropFilter && bg.length === 9) {
      const alpha = parseInt(bg.slice(7, 9), 16) / 255;
      if (alpha >= 0.7) bg = bg.slice(0, 7);
    }
    if (bg) s.bg = bg;
    const color = cssColorToHex(c.color);
    if (color) s.color = color;
    if (c.fontSize) s.fontSize = c.fontSize;
    if (c.fontWeight) s.fontWeight = c.fontWeight;
    if (c.fontFamily) s.fontFamily = c.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
    if (c.fontStyle && c.fontStyle !== "normal") s.fontStyle = c.fontStyle;
    if (c.lineHeight && c.lineHeight > 0) s.lineHeight = c.lineHeight;
    if (c.letterSpacing && Math.abs(c.letterSpacing) > 0.01) s.letterSpacing = c.letterSpacing;
    if (c.textAlign && ["left", "center", "right", "justify"].includes(c.textAlign)) s.textAlign = c.textAlign;
    if (c.textDecorationLine === "underline") s.textDecoration = "underline";
    else if (c.textDecorationLine === "line-through") s.textDecoration = "line-through";
    const tl = (_g = c.borderTopLeftRadius) != null ? _g : 0;
    const tr = (_h = c.borderTopRightRadius) != null ? _h : 0;
    const bl = (_i = c.borderBottomLeftRadius) != null ? _i : 0;
    const br = (_j = c.borderBottomRightRadius) != null ? _j : 0;
    if (tl || tr || bl || br) {
      if (tl === tr && tr === bl && bl === br) s.radius = tl;
      else s.corners = { tl, tr, bl, br };
    }
    const cp = c.clipPath;
    if (cp) {
      if (/^circle\(/.test(cp)) {
        s.radius = 9999;
        s.corners = void 0;
      } else if (/^polygon\(/.test(cp)) {
        const pts = parsePolygonPoints(cp);
        if (pts) s.clipPathPolygon = pts;
      } else {
        const insetRound = cp.match(/^inset\([^)]*round\s+([\d.]+)px\)/);
        if (insetRound) {
          const r = parseFloat(insetRound[1]);
          if (Number.isFinite(r) && r > 0) {
            s.radius = r;
            s.corners = void 0;
          }
        }
      }
    }
    const bt = (_k = c.borderTopWidth) != null ? _k : 0;
    const brw = (_l = c.borderRightWidth) != null ? _l : 0;
    const bb = (_m = c.borderBottomWidth) != null ? _m : 0;
    const blw = (_n = c.borderLeftWidth) != null ? _n : 0;
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
      const styles = [c.borderTopStyle, c.borderRightStyle, c.borderBottomStyle, c.borderLeftStyle];
      const firstStyle = styles.find((x) => x && x !== "none");
      if (firstStyle === "dashed" || firstStyle === "dotted" || firstStyle === "solid") {
        s.borderStyle = firstStyle;
      }
    }
    const boxShadows = (_o = parseBoxShadows(c.boxShadow)) != null ? _o : [];
    const filterShadows = parseFilterDropShadows(c.filter);
    const allShadows = [...boxShadows, ...filterShadows];
    if (allShadows.length) {
      s.shadows = allShadows;
      const firstDrop = allShadows.find((e) => !e.inset);
      if (firstDrop) s.shadow = { x: firstDrop.x, y: firstDrop.y, blur: firstDrop.blur, spread: firstDrop.spread, color: firstDrop.color };
    }
    const layerBlur = parseBlurPx(c.filter);
    if (layerBlur) s.layerBlur = layerBlur;
    const bgBlur = parseBlurPx(c.backdropFilter);
    if (bgBlur) s.backgroundBlur = bgBlur;
    if (c.mixBlendMode && BLEND_MODES.has(c.mixBlendMode)) {
      s.blendMode = c.mixBlendMode;
    }
    if (c.objectFit && OBJECT_FITS.has(c.objectFit)) {
      s.objectFit = c.objectFit;
    }
    if (c.textOverflow === "ellipsis") s.textTruncation = "ending";
    if (c.whiteSpace === "pre" || c.whiteSpace === "pre-wrap" || c.whiteSpace === "break-spaces") {
      s.whiteSpace = "preserve";
    } else if (c.whiteSpace === "pre-line") {
      s.whiteSpace = "preserve-line";
    }
    if (c.opacity !== void 0 && c.opacity < 1) s.opacity = c.opacity;
    if (c.backgroundImage) s.__bgImage = c.backgroundImage;
    if (c.backgroundSize) s.__bgSize = c.backgroundSize;
    if (c.backgroundPosition) s.__bgPosition = c.backgroundPosition;
    if (c.backgroundRepeat) s.__bgRepeat = c.backgroundRepeat;
    if (c.position && c.position !== "static") s.position = c.position;
    if (c.top !== void 0) s.top = c.top;
    if (c.left !== void 0) s.left = c.left;
    return s;
  }
  const VAR_REF_RE = /^var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,[^)]*)?\)\s*$/;
  function detectAlias(value) {
    const m = value.trim().match(VAR_REF_RE);
    return m ? m[1] : null;
  }
  function parseColor(raw) {
    const v = raw.trim();
    if (!v) return null;
    if (v.startsWith("#")) {
      const s = v.length === 4 || v.length === 5 ? "#" + v.slice(1).split("").map((c) => c + c).join("") : v;
      if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(s)) return null;
      return hexToRGB(s);
    }
    const fnMatch = v.match(/^([a-z]+)\s*\(\s*([^)]+)\s*\)$/i);
    if (!fnMatch) return null;
    const fn = fnMatch[1].toLowerCase();
    const argsRaw = fnMatch[2].replace("/", " ").split(/[,\s]+/).filter(Boolean);
    if (fn === "rgb" || fn === "rgba") {
      if (argsRaw.length < 3) return null;
      const [r, g, b] = argsRaw.slice(0, 3).map(parsePctOrByte);
      const a = argsRaw[3] !== void 0 ? parseAlpha(argsRaw[3]) : 1;
      if ([r, g, b].some((n) => Number.isNaN(n))) return null;
      return { r, g, b, a };
    }
    if (fn === "hsl" || fn === "hsla") {
      if (argsRaw.length < 3) return null;
      const h = parseFloat(argsRaw[0]);
      const s = parsePercent(argsRaw[1]);
      const l = parsePercent(argsRaw[2]);
      const a = argsRaw[3] !== void 0 ? parseAlpha(argsRaw[3]) : 1;
      if ([h, s, l].some((n) => Number.isNaN(n))) return null;
      return __spreadProps(__spreadValues({}, hslToRgb(h, s, l)), { a });
    }
    return null;
  }
  function parsePctOrByte(s) {
    if (s.endsWith("%")) return Math.max(0, Math.min(1, parseFloat(s) / 100));
    const n = parseFloat(s);
    if (Number.isNaN(n)) return NaN;
    return Math.max(0, Math.min(1, n / 255));
  }
  function parsePercent(s) {
    if (s.endsWith("%")) return Math.max(0, Math.min(1, parseFloat(s) / 100));
    const n = parseFloat(s);
    return Number.isNaN(n) ? NaN : Math.max(0, Math.min(1, n));
  }
  function parseAlpha(s) {
    if (s.endsWith("%")) return Math.max(0, Math.min(1, parseFloat(s) / 100));
    const n = parseFloat(s);
    return Number.isNaN(n) ? 1 : Math.max(0, Math.min(1, n));
  }
  function hslToRgb(h, s, l) {
    const hh = (h % 360 + 360) % 360 / 360;
    if (s === 0) return { r: l, g: l, b: l };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return { r: hue2rgb(hh + 1 / 3), g: hue2rgb(hh), b: hue2rgb(hh - 1 / 3) };
  }
  function parseFloatValue(raw) {
    const v = raw.trim();
    const m = v.match(/^(-?\d*\.?\d+)(px|rem|em|%)?$/i);
    if (!m) return null;
    const n = parseFloat(m[1]);
    if (!Number.isFinite(n)) return null;
    const unit = (m[2] || "px").toLowerCase();
    if (unit === "rem" || unit === "em") return n * 16;
    if (unit === "%") return n;
    return n;
  }
  function parseValue(raw, type) {
    if (raw == null) return { kind: "unknown" };
    const aliasRef = detectAlias(raw);
    if (aliasRef) return { kind: "alias", refName: aliasRef };
    if (type === "COLOR") {
      const c = parseColor(raw);
      return c ? { kind: "color", value: c } : { kind: "unknown" };
    }
    if (type === "FLOAT") {
      const n = parseFloatValue(raw);
      return n != null ? { kind: "float", value: n } : { kind: "unknown" };
    }
    return { kind: "string", value: raw.trim() };
  }
  function variableNameForFigma(rawName, stripPrefixes = ["token-"]) {
    let n = rawName.replace(/^--/, "");
    for (const p of stripPrefixes) {
      if (n.startsWith(p)) {
        n = n.slice(p.length);
        break;
      }
    }
    return n.replace(/-/g, "/");
  }
  function colorKey(c) {
    const h = (n) => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, "0").toUpperCase();
    let s = "#" + h(c.r) + h(c.g) + h(c.b);
    if (c.a < 0.999) s += h(c.a);
    return s;
  }
  function colorKeyFromCss(raw) {
    const c = parseColor(raw);
    return c ? colorKey(c) : null;
  }
  function buildIndexEntries(set) {
    const color = /* @__PURE__ */ new Map();
    const colorBlocked = /* @__PURE__ */ new Set();
    const number = /* @__PURE__ */ new Map();
    const numberBlocked = /* @__PURE__ */ new Set();
    const string = /* @__PURE__ */ new Map();
    const stringBlocked = /* @__PURE__ */ new Set();
    const defaultMode = set.modes[0] || "Light";
    for (const v of set.vars) {
      const raw = v.values[defaultMode];
      if (!raw) continue;
      if (detectAlias(raw)) continue;
      if (v.type === "COLOR") {
        const k = colorKeyFromCss(raw);
        if (!k) continue;
        if (colorBlocked.has(k)) continue;
        if (color.has(k)) {
          color.delete(k);
          colorBlocked.add(k);
          continue;
        }
        color.set(k, v.name);
      } else if (v.type === "FLOAT") {
        const n = parseFloatValue(raw);
        if (n == null) continue;
        if (numberBlocked.has(n)) continue;
        if (number.has(n)) {
          number.delete(n);
          numberBlocked.add(n);
          continue;
        }
        number.set(n, v.name);
      } else {
        const s = raw.trim();
        if (!s) continue;
        if (stringBlocked.has(s)) continue;
        if (string.has(s)) {
          string.delete(s);
          stringBlocked.add(s);
          continue;
        }
        string.set(s, v.name);
      }
    }
    return { color, number, string };
  }
  function resolveAliasTypes(set) {
    const byName = new Map(set.vars.map((v) => [v.name, v]));
    const cache = /* @__PURE__ */ new Map();
    function isPureAlias(v) {
      const vals = Object.values(v.values);
      if (!vals.length) return false;
      return vals.every((raw) => detectAlias(raw) !== null);
    }
    function resolve(name, seen) {
      if (cache.has(name)) return cache.get(name);
      if (seen.has(name)) return null;
      const v = byName.get(name);
      if (!v) return null;
      seen.add(name);
      if (!isPureAlias(v)) {
        cache.set(name, v.type);
        return v.type;
      }
      for (const raw of Object.values(v.values)) {
        const ref = detectAlias(raw);
        if (!ref) continue;
        const t = resolve(ref, seen);
        if (t && t !== "STRING") {
          cache.set(name, t);
          return t;
        }
      }
      cache.set(name, v.type);
      return v.type;
    }
    return {
      modes: set.modes,
      vars: set.vars.map((v) => {
        if (!isPureAlias(v)) return v;
        const inferred = resolve(v.name, /* @__PURE__ */ new Set());
        return inferred && inferred !== v.type ? __spreadProps(__spreadValues({}, v), { type: inferred }) : v;
      })
    };
  }
  function topoOrderVars(set) {
    const byName = new Map(set.vars.map((v) => [v.name, v]));
    const visited = /* @__PURE__ */ new Set();
    const stack = /* @__PURE__ */ new Set();
    const out = [];
    function visit(v) {
      if (visited.has(v.name)) return;
      if (stack.has(v.name)) return;
      stack.add(v.name);
      for (const raw of Object.values(v.values)) {
        const ref = detectAlias(raw);
        if (ref) {
          const target = byName.get(ref);
          if (target) visit(target);
        }
      }
      stack.delete(v.name);
      visited.add(v.name);
      out.push(v);
    }
    for (const v of set.vars) visit(v);
    return out;
  }
  let _bindings = null;
  const BLEND_MAP = {
    "normal": "NORMAL",
    "multiply": "MULTIPLY",
    "screen": "SCREEN",
    "overlay": "OVERLAY",
    "darken": "DARKEN",
    "lighten": "LIGHTEN",
    "color-dodge": "COLOR_DODGE",
    "color-burn": "COLOR_BURN",
    "hard-light": "HARD_LIGHT",
    "soft-light": "SOFT_LIGHT",
    "difference": "DIFFERENCE",
    "exclusion": "EXCLUSION",
    "hue": "HUE",
    "saturation": "SATURATION",
    "color": "COLOR",
    "luminosity": "LUMINOSITY"
  };
  const OBJECT_FIT_MAP = {
    "fill": "FILL",
    "contain": "FIT",
    "cover": "CROP",
    "none": "FILL",
    "scale-down": "FIT"
  };
  const FONT_FAMILY_DEFAULT = "Inter";
  const MULTILINE_LH_RATIO = 1.5;
  const TEXT_ALIGN_TO_PRIMARY = {
    left: "MIN",
    center: "CENTER",
    right: "MAX",
    justify: "MIN"
  };
  function effectiveStyle(ir) {
    return ir.computed ? computedToResolved(ir.computed, ir.style) : ir.style;
  }
  function styleNameForWeight(w) {
    if (w >= 850) return "Black";
    if (w >= 750) return "ExtraBold";
    if (w >= 650) return "Bold";
    if (w >= 550) return "SemiBold";
    if (w >= 450) return "Medium";
    if (w >= 350) return "Regular";
    if (w >= 250) return "Light";
    if (w >= 150) return "ExtraLight";
    return "Thin";
  }
  let _availableFonts = null;
  async function ensureFontIndex() {
    if (_availableFonts) return _availableFonts;
    _availableFonts = /* @__PURE__ */ new Map();
    try {
      const fonts = await figma.listAvailableFontsAsync();
      for (const f of fonts) {
        const lc = f.fontName.family.toLowerCase();
        let entry = _availableFonts.get(lc);
        if (!entry) {
          entry = { canonical: f.fontName.family, styles: /* @__PURE__ */ new Set() };
          _availableFonts.set(lc, entry);
        }
        entry.styles.add(f.fontName.style);
      }
    } catch (e) {
    }
    return _availableFonts;
  }
  const THAI_RE = /[฀-๿]/;
  const CJK_RE = /[㐀-鿿가-힯぀-ゟ゠-ヿ]/;
  function findClosestFamily(index, want, sampleText) {
    if (index.size === 0) return null;
    const wantLower = want.toLowerCase();
    const exact = index.get(wantLower);
    if (exact) return exact;
    for (const [key, entry] of index) {
      if (key.includes(wantLower) || wantLower.includes(key)) return entry;
    }
    const needsThai = THAI_RE.test(sampleText);
    const needsCjk = CJK_RE.test(sampleText);
    const SCRIPT_HINTS = {
      thai: ["noto sans thai", "sarabun", "kanit", "prompt", "mitr", "ibm plex sans thai", "k2d", "taviraj"],
      cjk: ["noto sans sc", "noto sans jp", "noto sans kr", "source han sans", "pingfang", "hiragino", "meiryo"]
    };
    const hints = needsThai ? SCRIPT_HINTS.thai : needsCjk ? SCRIPT_HINTS.cjk : [];
    for (const hint of hints) {
      const direct = index.get(hint);
      if (direct) return direct;
      for (const [key, entry] of index) if (key.includes(hint)) return entry;
    }
    return null;
  }
  function pickStyle(available, requested) {
    var _a;
    if (available.has(requested)) return requested;
    const ALIASES = {
      "Regular": ["Normal", "Book", "Roman", "400"],
      "Medium": ["Demi", "500"],
      "SemiBold": ["Demibold", "Semi Bold", "600"],
      "Bold": ["700"],
      "ExtraBold": ["Extra Bold", "Heavy", "800"],
      "Black": ["900"],
      "Light": ["300"],
      "ExtraLight": ["Extra Light", "UltraLight", "200"],
      "Thin": ["Hairline", "100"]
    };
    const aliases = (_a = ALIASES[requested]) != null ? _a : [];
    for (const a of aliases) if (available.has(a)) return a;
    const lower = requested.toLowerCase();
    for (const s of available) if (s.toLowerCase() === lower) return s;
    if (available.has("Regular")) return "Regular";
    return available.values().next().value || "Regular";
  }
  async function loadFont(family, style, sampleText = "") {
    const index = await ensureFontIndex();
    if (index.size > 0) {
      const matched = findClosestFamily(index, family, sampleText);
      if (matched) {
        const matchedStyle = pickStyle(matched.styles, style);
        try {
          const font = { family: matched.canonical, style: matchedStyle };
          await figma.loadFontAsync(font);
          return font;
        } catch (e) {
        }
      }
    }
    try {
      const font = { family, style };
      await figma.loadFontAsync(font);
      return font;
    } catch (e) {
      const fallback = { family: "Inter", style: "Regular" };
      await figma.loadFontAsync(fallback);
      return fallback;
    }
  }
  function solidPaint(hex) {
    const { r, g, b, a } = hexToRGB(hex);
    return { type: "SOLID", color: { r, g, b }, opacity: a };
  }
  function boundColorPaint(hex) {
    const paint = solidPaint(hex);
    if (!_bindings || _bindings.byColor.size === 0) return paint;
    const key = colorKeyFromCss(hex);
    if (!key) return paint;
    const variable = _bindings.byColor.get(key);
    if (!variable) return paint;
    try {
      return figma.variables.setBoundVariableForPaint(paint, "color", variable);
    } catch (e) {
      return paint;
    }
  }
  function bindNumericField(node, field, value) {
    if (!_bindings || value == null || _bindings.byNumber.size === 0) return;
    const variable = _bindings.byNumber.get(value);
    if (!variable) return;
    try {
      node.setBoundVariable(field, variable);
    } catch (e) {
    }
  }
  function bindStringField(node, field, value) {
    if (!_bindings || !value || _bindings.byString.size === 0) return;
    const variable = _bindings.byString.get(value);
    if (!variable) return;
    try {
      node.setBoundVariable(field, variable);
    } catch (e) {
    }
  }
  function hasContainerStyling(ir) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const c = ir.computed;
    if (!c) return false;
    const bg = c.backgroundColor;
    const hasBg = !!bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
    const hasBgImage = !!c.backgroundImage;
    const hasBorder = ((_a = c.borderTopWidth) != null ? _a : 0) > 0 || ((_b = c.borderRightWidth) != null ? _b : 0) > 0 || ((_c = c.borderBottomWidth) != null ? _c : 0) > 0 || ((_d = c.borderLeftWidth) != null ? _d : 0) > 0;
    const hasRadius = ((_e = c.borderTopLeftRadius) != null ? _e : 0) > 0 || ((_f = c.borderTopRightRadius) != null ? _f : 0) > 0 || ((_g = c.borderBottomLeftRadius) != null ? _g : 0) > 0 || ((_h = c.borderBottomRightRadius) != null ? _h : 0) > 0;
    const hasShadow = !!c.boxShadow && c.boxShadow !== "none";
    return hasBg || hasBgImage || hasBorder || hasRadius || hasShadow;
  }
  const INLINE_TEXT_TAGS = /* @__PURE__ */ new Set([
    "span",
    "strong",
    "em",
    "a",
    "b",
    "i",
    "small",
    "u",
    "mark",
    "code",
    "sub",
    "sup"
  ]);
  function isInlineTextDescendantsOnly(ir) {
    for (const c of ir.children) {
      if (c.tag === "#text") continue;
      if (!INLINE_TEXT_TAGS.has(c.tag)) return false;
      if (hasContainerStyling(c)) return false;
      if (!isInlineTextDescendantsOnly(c)) return false;
    }
    return true;
  }
  function hasInlineElementChild(ir) {
    return ir.children.some((c) => c.tag !== "#text");
  }
  function isTextLeaf(ir) {
    if (ir.tag === "#text") return true;
    if (hasContainerStyling(ir)) return false;
    if (ir.children.length === 0 && ir.text) return true;
    if (ir.children.length > 0 && ir.children.every((c) => c.tag === "#text")) return true;
    if (ir.children.length > 0 && isInlineTextDescendantsOnly(ir)) return true;
    return false;
  }
  function isTextOnlyChildren(ir) {
    var _a;
    if (ir.children.length === 0) return ir.text !== void 0;
    const display = (_a = ir.computed) == null ? void 0 : _a.display;
    if (display === "flex" || display === "inline-flex" || display === "grid") return false;
    if (ir.children.every((c) => c.tag === "#text")) return true;
    return isInlineTextDescendantsOnly(ir);
  }
  function joinTextChildren(ir) {
    var _a, _b;
    let raw;
    if (ir.text !== void 0 && ir.children.length === 0) raw = ir.text;
    else raw = ir.children.map((c) => {
      var _a2;
      return (_a2 = c.text) != null ? _a2 : "";
    }).join("");
    const tt = (_a = ir.computed) == null ? void 0 : _a.textTransform;
    if (tt === "uppercase") raw = raw.toUpperCase();
    else if (tt === "lowercase") raw = raw.toLowerCase();
    else if (tt === "capitalize") raw = raw.replace(/\b\w/g, (c) => c.toUpperCase());
    const ws = (_b = ir.computed) == null ? void 0 : _b.whiteSpace;
    if (ws === "pre" || ws === "pre-wrap" || ws === "pre-line" || ws === "break-spaces") return raw;
    return raw.trim();
  }
  function zIndexOf(ir, fallback) {
    var _a, _b;
    const z = (_a = ir.computed) == null ? void 0 : _a.zIndex;
    if (z !== void 0) return z;
    const pos = (_b = ir.computed) == null ? void 0 : _b.position;
    if (pos === "absolute" || pos === "fixed" || pos === "sticky" || pos === "relative") return 1;
    return fallback;
  }
  function buildSvg(ir) {
    var _a, _b, _c;
    let svg = ir.attrs.__svg;
    if (!svg) return null;
    const cur = (_a = ir.computed) == null ? void 0 : _a.color;
    if (cur && cur !== "rgb(0, 0, 0)") {
      svg = svg.replace(/currentColor/gi, cur);
    }
    try {
      const node = figma.createNodeFromSvg(svg);
      node.name = "svg";
      if (((_b = ir.computed) == null ? void 0 : _b.rectW) && ((_c = ir.computed) == null ? void 0 : _c.rectH)) {
        try {
          node.resize(Math.max(1, ir.computed.rectW), Math.max(1, ir.computed.rectH));
        } catch (e) {
        }
      }
      return node;
    } catch (e) {
      console.warn("SVG parse failed:", e);
      return null;
    }
  }
  function toFigmaGradient(g) {
    if (!g) return null;
    return {
      type: g.type,
      gradientStops: g.gradientStops,
      gradientTransform: g.gradientTransform
    };
  }
  function effectiveTextStyle(ir, parent) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const s = effectiveStyle(ir);
    return {
      family: (_b = (_a = s.fontFamily) != null ? _a : parent == null ? void 0 : parent.family) != null ? _b : FONT_FAMILY_DEFAULT,
      styleName: s.fontStyle && s.fontStyle !== "normal" ? s.fontStyle : s.fontWeight !== void 0 ? styleNameForWeight(s.fontWeight) : (_c = parent == null ? void 0 : parent.styleName) != null ? _c : "Regular",
      size: (_e = (_d = s.fontSize) != null ? _d : parent == null ? void 0 : parent.size) != null ? _e : 16,
      color: (_f = s.color) != null ? _f : parent == null ? void 0 : parent.color,
      decoration: (_g = s.textDecoration) != null ? _g : parent == null ? void 0 : parent.decoration,
      letterSpacing: (_h = s.letterSpacing) != null ? _h : parent == null ? void 0 : parent.letterSpacing,
      textTransform: (_j = (_i = ir.computed) == null ? void 0 : _i.textTransform) != null ? _j : parent == null ? void 0 : parent.textTransform
    };
  }
  function applyTextTransform(text, tt) {
    if (tt === "uppercase") return text.toUpperCase();
    if (tt === "lowercase") return text.toLowerCase();
    if (tt === "capitalize") return text.replace(/\b\w/g, (c) => c.toUpperCase());
    return text;
  }
  function collectTextRuns(ir, parent) {
    var _a, _b;
    const own = effectiveTextStyle(ir, parent);
    if (ir.tag === "#text") {
      const raw = (_a = ir.text) != null ? _a : "";
      return raw ? [__spreadProps(__spreadValues({}, own), { text: applyTextTransform(raw, own.textTransform) })] : [];
    }
    if (ir.children.length === 0) {
      const raw = (_b = ir.text) != null ? _b : "";
      return raw ? [__spreadProps(__spreadValues({}, own), { text: applyTextTransform(raw, own.textTransform) })] : [];
    }
    const out = [];
    for (const c of ir.children) out.push(...collectTextRuns(c, own));
    return out;
  }
  async function buildRichText(ir) {
    const root = effectiveTextStyle(ir);
    const runs = collectTextRuns(ir, root).filter((r) => r.text.length > 0);
    if (!runs.length) return null;
    const fontMap = /* @__PURE__ */ new Map();
    for (const r of runs) {
      const key = `${r.family}|${r.styleName}`;
      if (!fontMap.has(key)) fontMap.set(key, await loadFont(r.family, r.styleName, r.text));
    }
    const t = figma.createText();
    const firstFont = fontMap.get(`${runs[0].family}|${runs[0].styleName}`);
    t.fontName = firstFont;
    t.fontSize = runs[0].size;
    t.characters = runs.map((r) => r.text).join("");
    const s = effectiveStyle(ir);
    if (s.lineHeight) t.lineHeight = { value: s.lineHeight, unit: "PIXELS" };
    if (s.textAlign) {
      const map = {
        left: "LEFT",
        center: "CENTER",
        right: "RIGHT",
        justify: "JUSTIFIED"
      };
      t.textAlignHorizontal = map[s.textAlign];
    }
    if (s.textTruncation === "ending") {
      try {
        t.textTruncation = "ENDING";
      } catch (e) {
      }
    }
    let cursor = 0;
    for (const r of runs) {
      const end = cursor + r.text.length;
      if (end > cursor) {
        const font = fontMap.get(`${r.family}|${r.styleName}`);
        try {
          t.setRangeFontName(cursor, end, font);
        } catch (e) {
        }
        try {
          t.setRangeFontSize(cursor, end, r.size);
        } catch (e) {
        }
        if (r.color) {
          try {
            t.setRangeFills(cursor, end, [solidPaint(r.color)]);
          } catch (e) {
          }
        }
        if (r.letterSpacing) {
          try {
            t.setRangeLetterSpacing(cursor, end, { value: r.letterSpacing, unit: "PIXELS" });
          } catch (e) {
          }
        }
        if (r.decoration === "underline") {
          try {
            t.setRangeTextDecoration(cursor, end, "UNDERLINE");
          } catch (e) {
          }
        } else if (r.decoration === "line-through") {
          try {
            t.setRangeTextDecoration(cursor, end, "STRIKETHROUGH");
          } catch (e) {
          }
        }
      }
      cursor = end;
    }
    t.name = ir.tag === "#text" ? "Text" : ir.tag;
    return t;
  }
  async function buildText(ir) {
    var _a, _b, _c;
    const s = effectiveStyle(ir);
    const family = (_a = s.fontFamily) != null ? _a : FONT_FAMILY_DEFAULT;
    const styleName = (_c = s.fontStyle) != null ? _c : styleNameForWeight((_b = s.fontWeight) != null ? _b : 400);
    const characters = joinTextChildren(ir);
    const font = await loadFont(family, styleName, characters);
    const t = figma.createText();
    t.fontName = font;
    t.characters = characters;
    if (s.fontSize) {
      t.fontSize = s.fontSize;
      bindNumericField(t, "fontSize", s.fontSize);
    }
    if (s.lineHeight) {
      t.lineHeight = { value: s.lineHeight, unit: "PIXELS" };
      bindNumericField(t, "lineHeight", s.lineHeight);
    }
    if (s.letterSpacing) {
      t.letterSpacing = { value: s.letterSpacing, unit: "PIXELS" };
      bindNumericField(t, "letterSpacing", s.letterSpacing);
    }
    if (s.color) t.fills = [boundColorPaint(s.color)];
    bindStringField(t, "fontFamily", family);
    if (s.textAlign) {
      const map = {
        left: "LEFT",
        center: "CENTER",
        right: "RIGHT",
        justify: "JUSTIFIED"
      };
      t.textAlignHorizontal = map[s.textAlign];
    }
    if (s.textDecoration === "underline") {
      try {
        t.textDecoration = "UNDERLINE";
      } catch (e) {
      }
    } else if (s.textDecoration === "line-through") {
      try {
        t.textDecoration = "STRIKETHROUGH";
      } catch (e) {
      }
    }
    if (s.textTruncation === "ending") {
      try {
        t.textTruncation = "ENDING";
      } catch (e) {
      }
    }
    t.name = ir.tag === "#text" ? "Text" : ir.tag;
    return t;
  }
  async function buildImage(ir) {
    var _a, _b;
    const s = effectiveStyle(ir);
    const rect = figma.createRectangle();
    rect.name = ir.attrs.alt || "Image";
    const w = typeof s.width === "number" ? s.width : 200;
    const h = typeof s.height === "number" ? s.height : 200;
    rect.resize(Math.max(1, w), Math.max(1, h));
    if (s.radius) rect.cornerRadius = s.radius;
    const src = ir.attrs.src;
    const scaleMode = (_b = OBJECT_FIT_MAP[(_a = s.objectFit) != null ? _a : "fill"]) != null ? _b : "FILL";
    if (src) {
      try {
        const bytes = await fetchImageBytes(src);
        if (bytes) {
          const image = figma.createImage(bytes);
          rect.fills = [{ type: "IMAGE", scaleMode, imageHash: image.hash }];
          return rect;
        }
      } catch (e) {
        console.warn("Image load failed:", src, e);
      }
    }
    rect.fills = [solidPaint("#E5E7EB")];
    return rect;
  }
  const _B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const _B64_LOOKUP = (() => {
    const arr = new Uint8Array(256);
    for (let i = 0; i < _B64_CHARS.length; i++) arr[_B64_CHARS.charCodeAt(i)] = i;
    return arr;
  })();
  function _b64decode(input) {
    let data = input.replace(/[^A-Za-z0-9+/]/g, "");
    const pad = data.length % 4;
    if (pad) data += "=".repeat(4 - pad);
    const len = data.length / 4 * 3 - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0);
    const bytes = new Uint8Array(len);
    let p = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = _B64_LOOKUP[data.charCodeAt(i)];
      const b = _B64_LOOKUP[data.charCodeAt(i + 1)];
      const c = _B64_LOOKUP[data.charCodeAt(i + 2)];
      const d = _B64_LOOKUP[data.charCodeAt(i + 3)];
      if (p < len) bytes[p++] = a << 2 | b >> 4;
      if (p < len) bytes[p++] = (b & 15) << 4 | c >> 2;
      if (p < len) bytes[p++] = (c & 3) << 6 | d;
    }
    return bytes;
  }
  async function fetchImageBytes(src) {
    if (src.startsWith("data:")) {
      const comma = src.indexOf(",");
      const meta = src.slice(5, comma);
      const data = src.slice(comma + 1);
      if (meta.includes("base64")) return _b64decode(data);
      return null;
    }
    const res = await fetch(src);
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  }
  function applySize(node, s) {
    const w = s.width;
    const h = s.height;
    let width = typeof w === "number" ? w : 100;
    let height = typeof h === "number" ? h : 100;
    width = Math.max(width, 1);
    height = Math.max(height, 1);
    node.resize(width, height);
    if ("layoutSizingHorizontal" in node) {
      if (w === "fill") node.layoutSizingHorizontal = "FILL";
      else if (w === "hug") node.layoutSizingHorizontal = "HUG";
      else if (typeof w === "number") node.layoutSizingHorizontal = "FIXED";
    }
    if ("layoutSizingVertical" in node) {
      if (h === "fill") node.layoutSizingVertical = "FILL";
      else if (h === "hug") node.layoutSizingVertical = "HUG";
      else if (typeof h === "number") node.layoutSizingVertical = "FIXED";
    }
  }
  function shouldSkipImageLayers(s) {
    const bgImg = s.__bgImage;
    if (!bgImg) return false;
    if (/^url\(/.test(bgImg)) return false;
    if (/repeating-(linear|radial)-gradient/.test(bgImg)) return true;
    const sz = s.__bgSize;
    const rep = s.__bgRepeat;
    const tilePxSize = !!sz && /^\d+(?:\.\d+)?px(?:\s+\d+(?:\.\d+)?px)?$/.test(sz);
    const tilingRepeat = !!rep && (rep === "repeat" || rep === "repeat-x" || rep === "repeat-y");
    return tilePxSize && tilingRepeat;
  }
  async function buildBgFills(s) {
    const layers = [];
    const bgImg = s.__bgImage;
    const skipImageLayers = shouldSkipImageLayers(s);
    if (s.bg) layers.push(boundColorPaint(s.bg));
    if (bgImg && !skipImageLayers) {
      const cssLayers = splitTopLevelComma(bgImg);
      const imgLayers = [];
      for (const layer of cssLayers) {
        const grad = toFigmaGradient(parseGradient(layer));
        if (grad) {
          imgLayers.push(grad);
          continue;
        }
        const urlMatch = layer.match(/url\(\s*["']?([^"')]+)["']?\s*\)/);
        if (urlMatch) {
          try {
            const bytes = await fetchImageBytes(urlMatch[1]);
            if (bytes) {
              const image = figma.createImage(bytes);
              const bgSize = s.__bgSize;
              const bgRepeat = s.__bgRepeat;
              const repeats = bgRepeat && bgRepeat !== "no-repeat" && bgRepeat !== "none";
              let scaleMode;
              if (repeats) scaleMode = "TILE";
              else if (bgSize === "contain") scaleMode = "FIT";
              else if (bgSize === "cover") scaleMode = "FILL";
              else scaleMode = "FILL";
              let scalingFactor;
              if (scaleMode === "TILE") {
                const sizeMatch = bgSize == null ? void 0 : bgSize.match(/(\d+(?:\.\d+)?)px/);
                if (sizeMatch) scalingFactor = parseFloat(sizeMatch[1]) / 100;
              }
              const paint = scalingFactor !== void 0 ? { type: "IMAGE", scaleMode: "TILE", imageHash: image.hash, scalingFactor } : { type: "IMAGE", scaleMode, imageHash: image.hash };
              imgLayers.push(paint);
            }
          } catch (e) {
            console.warn("bg-image url load failed:", urlMatch[1], e);
          }
        }
      }
      for (let i = imgLayers.length - 1; i >= 0; i--) layers.push(imgLayers[i]);
    }
    return layers;
  }
  function buildEffects(s) {
    var _a;
    const out = [];
    const shadows = (_a = s.shadows) != null ? _a : s.shadow ? [__spreadValues({}, s.shadow)] : [];
    for (const sh of shadows) {
      const { r, g, b, a } = hexToRGB(sh.color);
      const isInset = sh.inset === true;
      if (isInset) {
        out.push({
          type: "INNER_SHADOW",
          color: { r, g, b, a },
          offset: { x: sh.x, y: sh.y },
          radius: sh.blur,
          spread: sh.spread,
          visible: true,
          blendMode: "NORMAL"
        });
      } else {
        out.push({
          type: "DROP_SHADOW",
          color: { r, g, b, a },
          offset: { x: sh.x, y: sh.y },
          radius: sh.blur,
          spread: sh.spread,
          visible: true,
          blendMode: "NORMAL",
          showShadowBehindNode: false
        });
      }
    }
    if (s.layerBlur && s.layerBlur > 0) {
      out.push({ type: "LAYER_BLUR", blurType: "NORMAL", radius: s.layerBlur, visible: true });
    }
    if (s.backgroundBlur && s.backgroundBlur > 0) {
      out.push({ type: "BACKGROUND_BLUR", blurType: "NORMAL", radius: s.backgroundBlur, visible: true });
    }
    return out;
  }
  function applyPolygonMask(frame, points) {
    const w = frame.width || 1;
    const h = frame.height || 1;
    const coords = points.map((p) => `${p.x * w},${p.y * h}`);
    const data = `M ${coords.join(" L ")} Z`;
    let v;
    try {
      v = figma.createVector();
    } catch (e) {
      return;
    }
    try {
      v.vectorPaths = [{ windingRule: "NONZERO", data }];
      v.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
      v.isMask = true;
      v.name = "clip-path mask";
      frame.insertChild(0, v);
    } catch (e) {
      console.warn("clip-path polygon mask failed:", e);
      try {
        v.remove();
      } catch (e2) {
      }
    }
  }
  function applyCornerRadius(frame, s) {
    if (s.corners) {
      try {
        frame.topLeftRadius = s.corners.tl;
        frame.topRightRadius = s.corners.tr;
        frame.bottomLeftRadius = s.corners.bl;
        frame.bottomRightRadius = s.corners.br;
      } catch (e) {
      }
      bindNumericField(frame, "topLeftRadius", s.corners.tl);
      bindNumericField(frame, "topRightRadius", s.corners.tr);
      bindNumericField(frame, "bottomLeftRadius", s.corners.bl);
      bindNumericField(frame, "bottomRightRadius", s.corners.br);
    } else if (s.radius !== void 0) {
      frame.cornerRadius = s.radius;
      bindNumericField(frame, "topLeftRadius", s.radius);
      bindNumericField(frame, "topRightRadius", s.radius);
      bindNumericField(frame, "bottomLeftRadius", s.radius);
      bindNumericField(frame, "bottomRightRadius", s.radius);
    }
  }
  function applyBorder(frame, s) {
    const sides = s.borderSides;
    const hasUniform = s.borderWidth !== void 0 && s.borderWidth > 0;
    const hasSides = sides && (sides.t || sides.r || sides.b || sides.l);
    if (!hasUniform && !hasSides) return;
    frame.strokes = [s.borderColor ? boundColorPaint(s.borderColor) : solidPaint("#E5E7EB")];
    if (hasSides) {
      try {
        frame.strokeTopWeight = sides.t;
        frame.strokeRightWeight = sides.r;
        frame.strokeBottomWeight = sides.b;
        frame.strokeLeftWeight = sides.l;
        bindNumericField(frame, "strokeTopWeight", sides.t);
        bindNumericField(frame, "strokeRightWeight", sides.r);
        bindNumericField(frame, "strokeBottomWeight", sides.b);
        bindNumericField(frame, "strokeLeftWeight", sides.l);
      } catch (e) {
        frame.strokeWeight = Math.max(sides.t, sides.r, sides.b, sides.l);
      }
    } else if (hasUniform) {
      frame.strokeWeight = s.borderWidth;
      bindNumericField(frame, "strokeWeight", s.borderWidth);
    }
    if (s.borderStyle === "dashed") frame.dashPattern = [6, 4];
    else if (s.borderStyle === "dotted") frame.dashPattern = [2, 2];
  }
  async function applyFrameStyle(frame, s) {
    var _a;
    if (s.layout === "flex") {
      frame.layoutMode = s.direction === "column" ? "VERTICAL" : "HORIZONTAL";
    } else {
      frame.layoutMode = "NONE";
    }
    if (frame.layoutMode !== "NONE") {
      if (s.gap !== void 0) {
        frame.itemSpacing = s.gap;
        bindNumericField(frame, "itemSpacing", s.gap);
      }
      if (s.padding) {
        frame.paddingTop = s.padding.t;
        frame.paddingRight = s.padding.r;
        frame.paddingBottom = s.padding.b;
        frame.paddingLeft = s.padding.l;
        bindNumericField(frame, "paddingTop", s.padding.t);
        bindNumericField(frame, "paddingRight", s.padding.r);
        bindNumericField(frame, "paddingBottom", s.padding.b);
        bindNumericField(frame, "paddingLeft", s.padding.l);
      }
      const ALIGN_MAP = {
        start: "MIN",
        center: "CENTER",
        end: "MAX",
        "space-between": "SPACE_BETWEEN",
        baseline: "BASELINE",
        stretch: "MIN"
      };
      if (s.justify) frame.primaryAxisAlignItems = ALIGN_MAP[s.justify];
      if (s.align) frame.counterAxisAlignItems = (_a = ALIGN_MAP[s.align]) != null ? _a : "MIN";
    }
    frame.fills = await buildBgFills(s);
    applyCornerRadius(frame, s);
    applyBorder(frame, s);
    const effects = buildEffects(s);
    if (effects.length) frame.effects = effects;
    if (s.opacity !== void 0) frame.opacity = s.opacity;
    if (s.blendMode && BLEND_MAP[s.blendMode]) {
      try {
        frame.blendMode = BLEND_MAP[s.blendMode];
      } catch (e) {
      }
    }
    applySize(frame, s);
  }
  function placeChildByRect(child, childIr, parentIr) {
    var _a, _b, _c, _d, _e, _f;
    if (!(parentIr == null ? void 0 : parentIr.computed) || !childIr.computed) return;
    const cc = childIr.computed;
    const pc = parentIr.computed;
    const rot = cc.transform ? parseRotateDeg(cc.transform) : null;
    const usePreTransform = rot !== null && rot !== 0 && typeof cc.width === "number" && typeof cc.height === "number" && cc.width > 0 && cc.height > 0;
    const aabbX = ((_a = cc.rectX) != null ? _a : 0) - ((_b = pc.rectX) != null ? _b : 0);
    const aabbY = ((_c = cc.rectY) != null ? _c : 0) - ((_d = pc.rectY) != null ? _d : 0);
    const aabbW = (_e = cc.rectW) != null ? _e : 0;
    const aabbH = (_f = cc.rectH) != null ? _f : 0;
    if (usePreTransform && "resize" in child) {
      const w = cc.width;
      const h = cc.height;
      try {
        child.resize(Math.max(1, w), Math.max(1, h));
      } catch (e) {
      }
      child.x = aabbX + aabbW / 2 - w / 2;
      child.y = aabbY + aabbH / 2 - h / 2;
    } else {
      child.x = aabbX;
      child.y = aabbY;
    }
    if (cc.transform && "rotation" in child) {
      if (rot !== null && rot !== 0) child.rotation = -rot;
    }
  }
  function parseRotateDeg(transform) {
    if (!transform || transform === "none") return null;
    const m = transform.match(/matrix\(([^)]+)\)/);
    if (m) {
      const parts = m[1].split(",").map((p) => parseFloat(p.trim()));
      const [a, b] = parts;
      if (Number.isFinite(a) && Number.isFinite(b)) return Math.atan2(b, a) * 180 / Math.PI;
    }
    const m3 = transform.match(/matrix3d\(([^)]+)\)/);
    if (m3) {
      const parts = m3[1].split(",").map((p) => parseFloat(p.trim()));
      const [a, b] = parts;
      if (Number.isFinite(a) && Number.isFinite(b)) return Math.atan2(b, a) * 180 / Math.PI;
    }
    const r = transform.match(/rotate(?:Z)?\(([-\d.]+)deg\)/);
    if (r) return parseFloat(r[1]);
    const rad = transform.match(/rotate(?:Z)?\(([-\d.]+)rad\)/);
    if (rad) return parseFloat(rad[1]) * 180 / Math.PI;
    return null;
  }
  async function buildNode(ir, parent = null) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O;
    const s = effectiveStyle(ir);
    if (s.layout === "none") return null;
    let node = null;
    if (ir.tag === "svg") {
      node = buildSvg(ir);
    } else if (ir.tag === "img") {
      node = await buildImage(ir);
      if (ir.computed && ((_a = parent == null ? void 0 : parent.computed) == null ? void 0 : _a.rectW)) {
        const pPadR = (_b = parent.computed.paddingRight) != null ? _b : 0;
        const parentRight = ((_c = parent.computed.rectX) != null ? _c : 0) + ((_d = parent.computed.rectW) != null ? _d : 0) - pPadR;
        const availableW = parentRight - ((_e = ir.computed.rectX) != null ? _e : 0);
        if (availableW > ((_f = ir.computed.rectW) != null ? _f : 0)) {
          ir.computed.rectW = availableW;
        }
      }
      node = hasInlineElementChild(ir) ? await buildRichText(ir) : await buildText(ir);
      if (node && "textAutoResize" in node) {
        const tn = node;
        const measuredW = (_g = ir.computed) == null ? void 0 : _g.rectW;
        const measuredH = (_i = (_h = ir.computed) == null ? void 0 : _h.rectH) != null ? _i : 0;
        const lh = (_m = (_l = (_j = ir.computed) == null ? void 0 : _j.lineHeight) != null ? _l : (_k = ir.computed) == null ? void 0 : _k.fontSize) != null ? _m : 16;
        const isMultiline = measuredH > lh * MULTILINE_LH_RATIO;
        if (measuredW && measuredW > 0 && isMultiline) {
          try {
            tn.textAutoResize = "HEIGHT";
          } catch (e) {
          }
          try {
            tn.resize(measuredW, tn.height);
          } catch (e) {
          }
        } else {
          try {
            tn.textAutoResize = "WIDTH_AND_HEIGHT";
          } catch (e) {
          }
        }
      }
    } else {
      const frame = figma.createFrame();
      frame.name = ir.tag;
      const styleForFrame = __spreadProps(__spreadValues({}, s), {
        layout: "block",
        direction: void 0,
        gap: void 0,
        padding: void 0,
        justify: void 0,
        align: void 0
      });
      await applyFrameStyle(frame, styleForFrame);
      frame.layoutMode = "NONE";
      const shotUrl = ir.attrs.__screenshot;
      if (shotUrl && parent === null) {
        try {
          const bytes = await fetchImageBytes(shotUrl);
          if (bytes) {
            const image = figma.createImage(bytes);
            frame.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: image.hash }];
          }
        } catch (e) {
          console.warn("screen root screenshot fill failed:", e);
        }
      }
      const overflow = (_n = ir.computed) == null ? void 0 : _n.overflow;
      frame.clipsContent = !!overflow && overflow !== "visible";
      if (isTextOnlyChildren(ir)) {
        const inner = hasInlineElementChild(ir) ? await buildRichText(ir) : await buildText(ir);
        if (inner) {
          const padL = (_p = (_o = ir.computed) == null ? void 0 : _o.paddingLeft) != null ? _p : 0;
          const padR = (_r = (_q = ir.computed) == null ? void 0 : _q.paddingRight) != null ? _r : 0;
          const padT = (_t = (_s = ir.computed) == null ? void 0 : _s.paddingTop) != null ? _t : 0;
          const padB = (_v = (_u = ir.computed) == null ? void 0 : _u.paddingBottom) != null ? _v : 0;
          const w = (_x = (_w = ir.computed) == null ? void 0 : _w.rectW) != null ? _x : frame.width;
          const h = (_z = (_y = ir.computed) == null ? void 0 : _y.rectH) != null ? _z : frame.height;
          const ALIGN_MAP = {
            "flex-start": "MIN",
            "start": "MIN",
            "left": "MIN",
            "center": "CENTER",
            "flex-end": "MAX",
            "end": "MAX",
            "right": "MAX",
            "space-between": "SPACE_BETWEEN"
          };
          const justify = (_B = (_A = ir.computed) == null ? void 0 : _A.justifyContent) != null ? _B : "flex-start";
          const display = (_C = ir.computed) == null ? void 0 : _C.display;
          const va = (_D = ir.computed) == null ? void 0 : _D.verticalAlign;
          let align = (_F = (_E = ir.computed) == null ? void 0 : _E.alignItems) != null ? _F : "stretch";
          if ((display === "table-cell" || display === "inline-table" || display === "table") && va) {
            if (va === "middle") align = "center";
            else if (va === "top") align = "flex-start";
            else if (va === "bottom") align = "flex-end";
          } else if ((display === "table-cell" || display === "inline-table") && !va) {
            align = "center";
          }
          const textAlign = (_G = ir.computed) == null ? void 0 : _G.textAlign;
          frame.layoutMode = "HORIZONTAL";
          frame.paddingLeft = padL;
          frame.paddingRight = padR;
          frame.paddingTop = padT;
          frame.paddingBottom = padB;
          const primaryFromTextAlign = textAlign ? TEXT_ALIGN_TO_PRIMARY[textAlign] : void 0;
          frame.primaryAxisAlignItems = (_H = primaryFromTextAlign != null ? primaryFromTextAlign : ALIGN_MAP[justify]) != null ? _H : "MIN";
          frame.counterAxisAlignItems = (_I = ALIGN_MAP[align]) != null ? _I : "CENTER";
          try {
            frame.resize(Math.max(1, w), Math.max(1, h));
          } catch (e) {
          }
          try {
            frame.primaryAxisSizingMode = "FIXED";
          } catch (e) {
          }
          try {
            frame.counterAxisSizingMode = "FIXED";
          } catch (e) {
          }
          try {
            frame.layoutSizingHorizontal = "FIXED";
            frame.layoutSizingVertical = "FIXED";
          } catch (e) {
          }
          const innerLh = (_M = (_L = (_J = ir.computed) == null ? void 0 : _J.lineHeight) != null ? _L : (_K = ir.computed) == null ? void 0 : _K.fontSize) != null ? _M : 16;
          const contentH = ((_O = (_N = ir.computed) == null ? void 0 : _N.rectH) != null ? _O : h) - padT - padB;
          const isMultilineInner = contentH > innerLh * MULTILINE_LH_RATIO;
          frame.appendChild(inner);
          if (isMultilineInner) {
            try {
              inner.textAutoResize = "HEIGHT";
            } catch (e) {
            }
            try {
              inner.layoutGrow = 1;
            } catch (e) {
            }
            try {
              inner.layoutSizingHorizontal = "FILL";
            } catch (e) {
            }
            try {
              inner.layoutSizingVertical = "HUG";
            } catch (e) {
            }
          } else {
            try {
              inner.textAutoResize = "WIDTH_AND_HEIGHT";
            } catch (e) {
            }
            try {
              inner.layoutGrow = 0;
            } catch (e) {
            }
            try {
              inner.layoutSizingHorizontal = "HUG";
            } catch (e) {
            }
            try {
              inner.layoutSizingVertical = "HUG";
            } catch (e) {
            }
          }
          if (textAlign && ["left", "center", "right", "justify"].includes(textAlign)) {
            try {
              inner.textAlignHorizontal = textAlign.toUpperCase();
            } catch (e) {
            }
          }
        }
      } else {
        const orderedChildren = ir.children.map((c, i) => ({ c, i })).sort((a, b) => zIndexOf(a.c, 0) - zIndexOf(b.c, 0) || a.i - b.i);
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
    if (node) {
      if (s.blendMode && BLEND_MAP[s.blendMode] && "blendMode" in node) {
        try {
          node.blendMode = BLEND_MAP[s.blendMode];
        } catch (e) {
        }
      }
      if (ir.tag !== "svg" && (ir.tag === "img" || isTextLeaf(ir))) {
        const effects = buildEffects(s);
        if (effects.length && "effects" in node) {
          try {
            node.effects = effects;
          } catch (e) {
          }
        }
        if (s.opacity !== void 0 && "opacity" in node) {
          try {
            node.opacity = s.opacity;
          } catch (e) {
          }
        }
      }
    }
    return node;
  }
  async function buildTree(roots, bindings = null) {
    _bindings = bindings;
    try {
      const out = [];
      for (const r of roots) {
        const n = await buildNode(r, null);
        if (n) out.push(n);
      }
      return out;
    } finally {
      _bindings = null;
    }
  }
  const COLLECTION_NAME = "Scraped tokens";
  const PREFIXES = ["token-", "ds-", "color-", "colour-"];
  function colorToValue(c) {
    return { r: c.r, g: c.g, b: c.b, a: c.a };
  }
  async function createVariablesFromTokens(set) {
    var _a, _b, _c;
    const empty = {
      collectionId: null,
      modes: [],
      variableCount: 0,
      skipped: 0,
      bindings: { byColor: /* @__PURE__ */ new Map(), byNumber: /* @__PURE__ */ new Map(), byString: /* @__PURE__ */ new Map() }
    };
    if (!set || !((_a = set.vars) == null ? void 0 : _a.length)) return empty;
    if (typeof figma === "undefined" || !figma.variables) return empty;
    let collection = null;
    try {
      const all = await figma.variables.getLocalVariableCollectionsAsync();
      collection = (_b = all.find((c) => c.name === COLLECTION_NAME)) != null ? _b : null;
    } catch (e) {
      collection = null;
    }
    if (!collection) collection = figma.variables.createVariableCollection(COLLECTION_NAME);
    const desiredModes = set.modes.length ? set.modes : ["Light"];
    if (collection.modes.length > 0) {
      try {
        collection.renameMode(collection.modes[0].modeId, desiredModes[0]);
      } catch (e) {
      }
    }
    const modeIdByName = /* @__PURE__ */ new Map();
    modeIdByName.set(desiredModes[0], collection.modes[0].modeId);
    for (let i = 1; i < desiredModes.length; i++) {
      const name = desiredModes[i];
      const existing = collection.modes.find((m) => m.name === name);
      if (existing) modeIdByName.set(name, existing.modeId);
      else {
        try {
          const id = collection.addMode(name);
          modeIdByName.set(name, id);
        } catch (e) {
        }
      }
    }
    let existingVars = [];
    try {
      existingVars = await figma.variables.getLocalVariablesAsync();
    } catch (e) {
      existingVars = [];
    }
    const byFigmaName = /* @__PURE__ */ new Map();
    for (const v of existingVars) {
      if (v.variableCollectionId === collection.id) byFigmaName.set(v.name, v);
    }
    const typed = resolveAliasTypes(set);
    const ordered = topoOrderVars(typed);
    const created = /* @__PURE__ */ new Map();
    let variableCount = 0;
    let skipped = 0;
    for (const tv of ordered) {
      const figmaName = variableNameForFigma(tv.name, PREFIXES);
      const figmaType = tv.type === "COLOR" ? "COLOR" : tv.type === "FLOAT" ? "FLOAT" : "STRING";
      let v = byFigmaName.get(figmaName);
      if (!v) {
        try {
          v = figma.variables.createVariable(figmaName, collection, figmaType);
        } catch (e) {
          skipped++;
          continue;
        }
      }
      created.set(tv.name, v);
      variableCount++;
    }
    for (const tv of ordered) {
      const v = created.get(tv.name);
      if (!v) continue;
      for (const mode of desiredModes) {
        const raw = (_c = tv.values[mode]) != null ? _c : tv.values[desiredModes[0]];
        if (raw == null) continue;
        const modeId = modeIdByName.get(mode);
        if (!modeId) continue;
        const aliasRef = detectAlias(raw);
        if (aliasRef) {
          const target = created.get(aliasRef);
          if (!target || target.id === v.id) continue;
          try {
            v.setValueForMode(modeId, figma.variables.createVariableAlias(target));
          } catch (e) {
            skipped++;
          }
          continue;
        }
        const parsed = parseValue(raw, tv.type);
        try {
          if (parsed.kind === "color" && v.resolvedType === "COLOR") {
            v.setValueForMode(modeId, colorToValue(parsed.value));
          } else if (parsed.kind === "float" && v.resolvedType === "FLOAT") {
            v.setValueForMode(modeId, parsed.value);
          } else if (parsed.kind === "string" && v.resolvedType === "STRING") {
            v.setValueForMode(modeId, parsed.value);
          } else {
            skipped++;
          }
        } catch (e) {
          skipped++;
        }
      }
    }
    const entries = buildIndexEntries(typed);
    const bindings = {
      byColor: /* @__PURE__ */ new Map(),
      byNumber: /* @__PURE__ */ new Map(),
      byString: /* @__PURE__ */ new Map()
    };
    for (const [k, name] of entries.color) {
      const v = created.get(name);
      if (v) bindings.byColor.set(k, v);
    }
    for (const [k, name] of entries.number) {
      const v = created.get(name);
      if (v) bindings.byNumber.set(k, v);
    }
    for (const [k, name] of entries.string) {
      const v = created.get(name);
      if (v) bindings.byString.set(k, v);
    }
    return {
      collectionId: collection.id,
      modes: desiredModes,
      variableCount,
      skipped,
      bindings
    };
  }
  figma.showUI(__html__, { width: 420, height: 720, themeColors: true });
  function send(msg) {
    figma.ui.postMessage(msg);
  }
  const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  (() => {
    const arr = new Uint8Array(256);
    for (let i = 0; i < B64_CHARS.length; i++) arr[B64_CHARS.charCodeAt(i)] = i;
    return arr;
  })();
  function hasSize(node) {
    return "width" in node && "height" in node;
  }
  function fitFrameToContent(frame) {
    if (frame.children.length === 0) return;
    let maxRight = 0;
    let maxBottom = 0;
    for (const c of frame.children) {
      if (hasSize(c)) {
        maxRight = Math.max(maxRight, c.x + c.width);
        maxBottom = Math.max(maxBottom, c.y + c.height);
      }
    }
    if (maxRight <= 0 || maxBottom <= 0) return;
    try {
      frame.resize(Math.max(1, maxRight), Math.max(1, maxBottom));
    } catch (e) {
    }
  }
  async function handleConvertJson(payload) {
    var _a, _b;
    const ir = (_a = payload == null ? void 0 : payload.screens) != null ? _a : [];
    if (!ir.length) {
      send({ type: "error", message: "No nodes parsed." });
      return;
    }
    let variableCount = 0;
    let bindings = null;
    try {
      const result = await createVariablesFromTokens((_b = payload == null ? void 0 : payload.tokens) != null ? _b : null);
      variableCount = result.variableCount;
      bindings = result.bindings;
    } catch (e) {
      console.warn("Variable creation failed:", e);
    }
    const nodes = await buildTree(ir, bindings);
    if (!nodes.length) {
      send({ type: "error", message: "Nothing to render." });
      return;
    }
    const center = figma.viewport.center;
    let xCursor = center.x;
    for (const n of nodes) {
      figma.currentPage.appendChild(n);
      if (n.type === "FRAME") {
        n.clipsContent = true;
        fitFrameToContent(n);
      }
      n.x = xCursor;
      n.y = center.y;
      if (hasSize(n)) xCursor += n.width + 40;
    }
    figma.currentPage.selection = nodes;
    figma.viewport.scrollAndZoomIntoView(nodes);
    send({ type: "done", nodeCount: nodes.length, variableCount });
  }
  const HANDLERS = {
    "convert-json": (msg) => handleConvertJson(msg.payload)
  };
  figma.ui.onmessage = async (msg) => {
    var _a;
    try {
      const handler = HANDLERS[msg.type];
      await handler(msg);
    } catch (e) {
      const err = e;
      const text = ((_a = err == null ? void 0 : err.message) != null ? _a : String(e)) + ((err == null ? void 0 : err.stack) ? "\n" + err.stack.split("\n").slice(0, 4).join("\n") : "");
      console.error("Convert error:", e);
      send({ type: "error", message: text });
    }
  };
})();
