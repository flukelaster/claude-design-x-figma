// This module is serialized into a string and injected into the page via
// page.evaluate(). It must be self-contained — no imports, no closures over
// outer scope. Output schema mirrors src/main/ir/types.ts (IRNode + ComputedStyle).

export const SCRAPE_FN = `
(() => {
  const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','META','LINK','HEAD','TITLE']);
  const TEXT_NODE = 3, ELEMENT_NODE = 1;

  function px(v) {
    if (!v) return undefined;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }

  function pickComputed(el) {
    const c = window.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      display: c.display,
      flexDirection: c.flexDirection,
      justifyContent: c.justifyContent,
      alignItems: c.alignItems,
      gap: px(c.rowGap || c.columnGap || c.gap),
      paddingTop: px(c.paddingTop), paddingRight: px(c.paddingRight),
      paddingBottom: px(c.paddingBottom), paddingLeft: px(c.paddingLeft),
      marginTop: px(c.marginTop), marginRight: px(c.marginRight),
      marginBottom: px(c.marginBottom), marginLeft: px(c.marginLeft),
      width: px(c.width), height: px(c.height),
      backgroundColor: c.backgroundColor,
      backgroundImage: c.backgroundImage && c.backgroundImage !== 'none' ? c.backgroundImage : undefined,
      backdropFilter: (c.backdropFilter && c.backdropFilter !== 'none') ? c.backdropFilter
        : ((c.webkitBackdropFilter && c.webkitBackdropFilter !== 'none') ? c.webkitBackdropFilter : undefined),
      color: c.color,
      fontSize: px(c.fontSize),
      fontWeight: parseInt(c.fontWeight, 10) || undefined,
      fontFamily: c.fontFamily,
      fontStyle: c.fontStyle,
      lineHeight: px(c.lineHeight),
      letterSpacing: px(c.letterSpacing),
      textAlign: c.textAlign,
      borderTopLeftRadius: px(c.borderTopLeftRadius),
      borderTopRightRadius: px(c.borderTopRightRadius),
      borderBottomLeftRadius: px(c.borderBottomLeftRadius),
      borderBottomRightRadius: px(c.borderBottomRightRadius),
      borderTopWidth: px(c.borderTopWidth),
      borderRightWidth: px(c.borderRightWidth),
      borderBottomWidth: px(c.borderBottomWidth),
      borderLeftWidth: px(c.borderLeftWidth),
      borderColor: c.borderTopColor,
      borderRightColor: c.borderRightColor,
      borderBottomColor: c.borderBottomColor,
      borderLeftColor: c.borderLeftColor,
      borderTopStyle: c.borderTopStyle,
      borderRightStyle: c.borderRightStyle,
      borderBottomStyle: c.borderBottomStyle,
      borderLeftStyle: c.borderLeftStyle,
      boxShadow: c.boxShadow,
      opacity: parseFloat(c.opacity),
      position: c.position,
      top: px(c.top), right: px(c.right), bottom: px(c.bottom), left: px(c.left),
      zIndex: c.zIndex && c.zIndex !== 'auto' ? parseInt(c.zIndex, 10) : undefined,
      overflow: c.overflow,
      transform: c.transform && c.transform !== 'none' ? c.transform : undefined,
      textTransform: c.textTransform,
      textDecorationLine: c.textDecorationLine && c.textDecorationLine !== 'none' ? c.textDecorationLine : undefined,
      textDecorationStyle: c.textDecorationStyle,
      textDecorationColor: c.textDecorationColor,
      filter: c.filter && c.filter !== 'none' ? c.filter : undefined,
      mixBlendMode: c.mixBlendMode && c.mixBlendMode !== 'normal' ? c.mixBlendMode : undefined,
      objectFit: c.objectFit,
      objectPosition: c.objectPosition,
      backgroundSize: c.backgroundSize,
      backgroundPosition: c.backgroundPosition,
      backgroundRepeat: c.backgroundRepeat,
      clipPath: c.clipPath && c.clipPath !== 'none' ? c.clipPath : undefined,
      textOverflow: c.textOverflow,
      whiteSpace: c.whiteSpace,
      listStyleType: c.listStyleType,
      verticalAlign: c.verticalAlign,
      rectX: r.x, rectY: r.y, rectW: r.width, rectH: r.height,
    };
  }

  function attrs(el) {
    const out = {};
    for (const a of el.attributes) {
      // Strip omelette/internal attrs
      if (a.name.startsWith('data-om')) continue;
      out[a.name] = a.value;
    }
    return out;
  }

  // Replace keycap emoji sequences (e.g. "1\\uFE0F\\u20E3") with their
  // single-character circled-digit equivalents so Figma's default text font
  // renders them as one glyph instead of base+selector+combiner garbage.
  function substituteKeycaps(s) {
    if (!s) return s;
    var CIRCLED = ['⓪','①','②','③','④','⑤','⑥','⑦','⑧','⑨'];
    return s.replace(/([0-9])\\uFE0F\\u20E3/g, function (_, d) { return CIRCLED[+d]; });
  }

  function isInvisible(el, cs) {
    if (cs.display === 'none' || cs.visibility === 'hidden') return true;
    if (parseFloat(cs.opacity) === 0) return true;
    return false;
  }

  // Marker text for <li> based on list-style-type. CSS ::marker pseudo isn't
  // walkable across all browsers, so we synthesize one ourselves. Index counts
  // preceding LI siblings (matches counter() behavior for default ordering).
  function listMarker(el, type) {
    if (!type || type === 'none') return '';
    if (type === 'disc') return '• ';
    if (type === 'circle') return '◦ ';
    if (type === 'square') return '▪ ';
    if (type === 'decimal' || type === 'decimal-leading-zero'
        || type === 'lower-alpha' || type === 'lower-latin'
        || type === 'upper-alpha' || type === 'upper-latin'
        || type === 'lower-roman' || type === 'upper-roman') {
      let idx = 1;
      let prev = el.previousElementSibling;
      while (prev) { if (prev.tagName === 'LI') idx++; prev = prev.previousElementSibling; }
      if (type === 'decimal-leading-zero' && idx < 10) return '0' + idx + '. ';
      if (type === 'decimal') return idx + '. ';
      if (type === 'lower-alpha' || type === 'lower-latin') return String.fromCharCode(96 + ((idx - 1) % 26) + 1) + '. ';
      if (type === 'upper-alpha' || type === 'upper-latin') return String.fromCharCode(64 + ((idx - 1) % 26) + 1) + '. ';
      // Roman fallback (small numbers only)
      if (type === 'lower-roman' || type === 'upper-roman') {
        const ROM = ['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii','xiii','xiv','xv'];
        const r = ROM[Math.min(idx - 1, ROM.length - 1)];
        return (type === 'upper-roman' ? r.toUpperCase() : r) + '. ';
      }
    }
    return '';
  }

  // Capture ::before / ::after as a synthetic child IR node. Browsers don't
  // expose pseudo bounding rects directly, so we approximate via parent rect
  // + computed top/left/right/bottom for absolute pseudos, or collapse to
  // inline at the parent's edge for static ones.
  function getPseudoIR(el, pseudo) {
    let cs;
    try { cs = window.getComputedStyle(el, pseudo); } catch { return null; }
    if (!cs) return null;
    const display = cs.display;
    if (!display || display === 'none') return null;
    const rawContent = cs.content;
    if (!rawContent || rawContent === 'none' || rawContent === 'normal') return null;

    // content can be: '"text"', 'attr(href)', 'counter(...)', 'url(...)'.
    // Pull text out of quoted form; otherwise treat as decorative box.
    let text = '';
    const quoted = rawContent.match(/^["'](.*)["']$/);
    if (quoted) text = substituteKeycaps(quoted[1]);

    const w = px(cs.width) ?? 0;
    const h = px(cs.height) ?? 0;
    const hasText = text.length > 0;
    const hasBox = (w > 0 || h > 0) && (
      cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
      (cs.backgroundImage && cs.backgroundImage !== 'none') ||
      px(cs.borderTopWidth) || px(cs.borderRightWidth) ||
      px(cs.borderBottomWidth) || px(cs.borderLeftWidth)
    );
    if (!hasText && !hasBox) return null;

    const r = el.getBoundingClientRect();
    let rectX = r.x, rectY = r.y;
    const top = px(cs.top), left = px(cs.left), right = px(cs.right), bottom = px(cs.bottom);
    if (cs.position === 'absolute' || cs.position === 'fixed') {
      if (left !== undefined) rectX = r.x + left;
      else if (right !== undefined) rectX = r.x + r.width - right - w;
      if (top !== undefined) rectY = r.y + top;
      else if (bottom !== undefined) rectY = r.y + r.height - bottom - h;
    } else {
      // Non-absolute pseudo participates in normal flow / flex layout. We
      // can't getBoundingClientRect on a pseudo directly, so approximate its
      // position from the parent's layout context. Most common case: flex-row
      // with align-items:center where the pseudo sits at the parent's left
      // padding edge, vertically centred against the parent's content box.
      const hostCs = window.getComputedStyle(el);
      const padL = parseFloat(hostCs.paddingLeft) || 0;
      const padR = parseFloat(hostCs.paddingRight) || 0;
      const padT = parseFloat(hostCs.paddingTop) || 0;
      const padB = parseFloat(hostCs.paddingBottom) || 0;
      const isFlex = hostCs.display === 'flex' || hostCs.display === 'inline-flex';
      const isCol = isFlex && (hostCs.flexDirection === 'column' || hostCs.flexDirection === 'column-reverse');
      const align = isCol ? hostCs.justifyContent : hostCs.alignItems;
      const justify = isCol ? hostCs.alignItems : hostCs.justifyContent;

      // Cross-axis (vertical for row, horizontal for column)
      let crossStart = isCol ? r.x + padL : r.y + padT;
      const crossSize = isCol ? (r.width - padL - padR) : (r.height - padT - padB);
      const itemCross = isCol ? w : h;
      if (align === 'center') crossStart += (crossSize - itemCross) / 2;
      else if (align === 'flex-end' || align === 'end') crossStart += crossSize - itemCross;

      // Main-axis: ::before goes at the start, ::after at the end.
      let mainStart;
      if (pseudo === '::after') {
        const mainEnd = isCol ? r.y + r.height - padB : r.x + r.width - padR;
        const itemMain = isCol ? h : w;
        mainStart = mainEnd - itemMain;
      } else {
        mainStart = isCol ? r.y + padT : r.x + padL;
      }
      void justify;

      if (isCol) {
        rectX = crossStart;
        rectY = mainStart;
      } else {
        rectX = mainStart;
        rectY = crossStart;
      }
    }

    const computed = {
      display: display === 'inline' ? 'inline-block' : display,
      width: w, height: h,
      backgroundColor: cs.backgroundColor,
      backgroundImage: cs.backgroundImage && cs.backgroundImage !== 'none' ? cs.backgroundImage : undefined,
      color: cs.color,
      fontSize: px(cs.fontSize),
      fontWeight: parseInt(cs.fontWeight, 10) || undefined,
      fontFamily: cs.fontFamily,
      fontStyle: cs.fontStyle,
      lineHeight: px(cs.lineHeight),
      letterSpacing: px(cs.letterSpacing),
      textAlign: cs.textAlign,
      borderTopLeftRadius: px(cs.borderTopLeftRadius),
      borderTopRightRadius: px(cs.borderTopRightRadius),
      borderBottomLeftRadius: px(cs.borderBottomLeftRadius),
      borderBottomRightRadius: px(cs.borderBottomRightRadius),
      borderTopWidth: px(cs.borderTopWidth),
      borderRightWidth: px(cs.borderRightWidth),
      borderBottomWidth: px(cs.borderBottomWidth),
      borderLeftWidth: px(cs.borderLeftWidth),
      borderColor: cs.borderTopColor,
      boxShadow: cs.boxShadow,
      opacity: parseFloat(cs.opacity),
      position: cs.position === 'static' ? undefined : cs.position,
      transform: cs.transform && cs.transform !== 'none' ? cs.transform : undefined,
      zIndex: cs.zIndex && cs.zIndex !== 'auto' ? parseInt(cs.zIndex, 10) : undefined,
      rectX: rectX, rectY: rectY, rectW: w, rectH: h,
    };

    if (hasText && !hasBox) {
      // Pure-text pseudo (e.g. content: "•"): emit as text node so it joins
      // its sibling text run if any.
      return { tag: '#text', text, attrs: {}, classNames: [], inlineStyle: {}, style: {}, computed, children: [] };
    }
    // Box-style pseudo (decorative dot/strip): emit as div with optional text.
    const children = hasText
      ? [{ tag: '#text', text, attrs: {}, classNames: [], inlineStyle: {}, style: {}, computed, children: [] }]
      : [];
    return {
      tag: 'div',
      text: hasText && children.length === 1 ? text : undefined,
      attrs: { 'data-pseudo': pseudo.slice(2) },
      classNames: [],
      inlineStyle: {},
      style: {},
      computed,
      children,
    };
  }

  // True if every descendant is text or an inline-formatted element (span, strong, em, a, b, i)
  function isInlineTextContainer(el) {
    const INLINE = new Set(['SPAN','STRONG','EM','A','B','I','SMALL','SUP','SUB','MARK','U','CODE']);
    for (const c of el.childNodes) {
      if (c.nodeType === TEXT_NODE) continue;
      if (c.nodeType !== ELEMENT_NODE) return false;
      if (!INLINE.has(c.tagName)) return false;
      if (!isInlineTextContainer(c)) return false;
    }
    return true;
  }

  function walk(el) {
    if (el.nodeType === TEXT_NODE) {
      const parentEl = el.parentElement;
      const pws = parentEl ? window.getComputedStyle(parentEl).whiteSpace : 'normal';
      const preserveAll = pws === 'pre' || pws === 'pre-wrap' || pws === 'break-spaces';
      const preserveLine = pws === 'pre-line';
      let t;
      if (preserveAll) t = (el.nodeValue || '');
      else if (preserveLine) t = (el.nodeValue || '').replace(/[ \\t]+/g, ' ');
      else t = (el.nodeValue || '').replace(/\\s+/g, ' ');
      t = substituteKeycaps(t);
      if (!preserveAll && !t.trim()) return null;
      // Use Range to get the actual rendered rect of this raw text run so
      // it can be positioned relative to its parent in the mapper.
      let rect = null;
      try {
        const range = document.createRange();
        range.selectNodeContents(el);
        const r = range.getBoundingClientRect();
        if (r && (r.width || r.height)) rect = r;
      } catch {}
      const parent = el.parentElement;
      const pcs = parent ? window.getComputedStyle(parent) : null;
      const computed = rect ? {
        rectX: rect.x, rectY: rect.y, rectW: rect.width, rectH: rect.height,
        color: pcs ? pcs.color : undefined,
        fontSize: pcs ? parseFloat(pcs.fontSize) : undefined,
        fontWeight: pcs ? (parseInt(pcs.fontWeight, 10) || undefined) : undefined,
        fontFamily: pcs ? pcs.fontFamily : undefined,
        fontStyle: pcs ? pcs.fontStyle : undefined,
        lineHeight: pcs ? parseFloat(pcs.lineHeight) : undefined,
        letterSpacing: pcs ? parseFloat(pcs.letterSpacing) : undefined,
        textAlign: pcs ? pcs.textAlign : undefined,
        textTransform: pcs ? pcs.textTransform : undefined,
        textDecorationLine: pcs && pcs.textDecorationLine && pcs.textDecorationLine !== 'none' ? pcs.textDecorationLine : undefined,
      } : undefined;
      return { tag: '#text', text: t, attrs: {}, classNames: [], inlineStyle: {}, style: {}, computed, children: [] };
    }
    if (el.nodeType !== ELEMENT_NODE) return null;
    const tag = el.tagName.toLowerCase();
    if (SKIP.has(el.tagName)) return null;

    // <br> → newline text node so multi-line text in <h2>/<p> joins correctly
    if (tag === 'br') {
      return { tag: '#text', text: '\\n', attrs: {}, classNames: [], inlineStyle: {}, style: {}, children: [] };
    }

    const cs = window.getComputedStyle(el);
    if (isInvisible(el, cs)) return null;

    const computed = pickComputed(el);

    if ((!computed.rectW || !computed.rectH) && !el.childNodes.length) return null;

    // SVG → capture serialized markup so the plugin can use figma.createNodeFromSvg
    if (tag === 'svg') {
      return {
        tag: 'svg',
        text: undefined,
        attrs: { __svg: el.outerHTML, ...attrs(el) },
        classNames: [],
        inlineStyle: {},
        style: {},
        computed,
        children: [],
      };
    }

    // Canvas / video / WebGL → snapshot current frame as PNG and re-emit as <img>.
    // Only works when the source is same-origin and (for WebGL) preserveDrawingBuffer.
    if (tag === 'canvas' || tag === 'video') {
      let dataUrl = null;
      try {
        if (tag === 'canvas') {
          dataUrl = el.toDataURL('image/png');
        } else {
          const c = document.createElement('canvas');
          c.width = el.videoWidth || el.clientWidth || 1;
          c.height = el.videoHeight || el.clientHeight || 1;
          const ctx = c.getContext('2d');
          if (ctx) { ctx.drawImage(el, 0, 0, c.width, c.height); dataUrl = c.toDataURL('image/png'); }
        }
      } catch {}
      if (dataUrl) {
        return {
          tag: 'img',
          text: undefined,
          attrs: { src: dataUrl, alt: tag, ...attrs(el) },
          classNames: [],
          inlineStyle: {},
          style: {},
          computed,
          children: [],
        };
      }
      // Tainted/blank: fall through to empty placeholder div with computed styles.
    }

    const children = [];
    const before = getPseudoIR(el, '::before');
    if (before) children.push(before);

    // Form controls have no DOM children, so the value or placeholder text
    // would otherwise be lost. Inject a synthetic text node so the visible
    // string survives. Use ::placeholder color when no real value is set.
    // Also covers custom inputs: contenteditable divs, role="textbox", and
    // anything with aria-placeholder / data-placeholder attrs.
    const isContentEditable = el.isContentEditable || el.getAttribute('contenteditable') === 'true';
    const role = el.getAttribute('role');
    const isCustomInput = isContentEditable
      || role === 'textbox' || role === 'searchbox' || role === 'combobox';
    const ariaPlaceholder = el.getAttribute('aria-placeholder')
      || el.getAttribute('data-placeholder')
      || el.getAttribute('placeholder');
    const isFormControl = tag === 'input' || tag === 'textarea' || tag === 'select';
    const hasExistingText = !!((el.textContent || '').trim());
    const inputType = (tag === 'input' ? (el.getAttribute('type') || 'text') : '').toLowerCase();
    const isCheckable = tag === 'input' && (inputType === 'checkbox' || inputType === 'radio');
    const isChecked = isCheckable && !!el.checked;
    const isSelectControl = tag === 'select';
    const shouldInject = (isFormControl && !isCheckable)
      || ((isCustomInput || ariaPlaceholder) && !hasExistingText);
    if (shouldInject) {
      let displayText = '';
      let isPlaceholder = false;
      if (tag === 'select') {
        const opt = el.options && el.options[el.selectedIndex];
        displayText = opt ? (opt.textContent || '').trim() : '';
      } else if (isFormControl) {
        const value = (el.value || '').trim();
        if (value) displayText = value;
        else { displayText = (el.getAttribute('placeholder') || ariaPlaceholder || '').trim(); isPlaceholder = true; }
      } else {
        // Custom / contenteditable empty: fall back to placeholder attr.
        displayText = (ariaPlaceholder || '').trim();
        isPlaceholder = true;
      }
      // Native <select> doesn't have a child element for the dropdown chevron;
      // append a synthetic ▾ glyph so the styled select still reads as a
      // dropdown after import.
      if (isSelectControl && displayText) displayText = displayText + '  ▾';
      displayText = substituteKeycaps(displayText);
      if (displayText) {
        const r3 = el.getBoundingClientRect();
        let phColor;
        if (isPlaceholder) {
          try { phColor = window.getComputedStyle(el, '::placeholder').color; } catch {}
          // Mirror the placeholder color onto the input itself so the mapper's
          // text-inside-frame path picks it up via effectiveStyle.color.
          if (phColor) computed.color = phColor;
        }
        const padL = parseFloat(cs.paddingLeft) || 0;
        const padT = parseFloat(cs.paddingTop) || 0;
        const padR = parseFloat(cs.paddingRight) || 0;
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) || 16;
        children.push({
          tag: '#text', text: displayText,
          attrs: {}, classNames: [], inlineStyle: {}, style: {},
          computed: {
            rectX: r3.x + padL,
            rectY: r3.y + padT + Math.max(0, (r3.height - 2 * padT - lh) / 2),
            rectW: Math.max(1, r3.width - padL - padR),
            rectH: lh,
            color: phColor || cs.color,
            fontSize: parseFloat(cs.fontSize) || undefined,
            fontWeight: parseInt(cs.fontWeight, 10) || undefined,
            fontFamily: cs.fontFamily,
            fontStyle: cs.fontStyle,
            lineHeight: parseFloat(cs.lineHeight) || undefined,
            letterSpacing: parseFloat(cs.letterSpacing) || undefined,
            textAlign: cs.textAlign,
          },
          children: [],
        });
      }
    }

    // Checkbox / radio checked state: native browsers render a built-in glyph
    // that has no DOM presence. Inject a synthetic glyph so the imported frame
    // still reads as "checked".
    if (isCheckable && isChecked) {
      const r4 = el.getBoundingClientRect();
      const glyph = inputType === 'checkbox' ? '✓' : '●';
      const fs = Math.max(8, Math.min(r4.height, r4.width) * 0.7);
      const glyphColor = inputType === 'checkbox' ? '#FFFFFF' : (cs.color || '#1F2937');
      children.push({
        tag: '#text', text: glyph,
        attrs: {}, classNames: [], inlineStyle: {}, style: {},
        computed: {
          rectX: r4.x + (r4.width - fs * 0.6) / 2,
          rectY: r4.y + (r4.height - fs) / 2,
          rectW: fs,
          rectH: fs,
          color: glyphColor,
          fontSize: fs,
          fontWeight: 700,
          fontFamily: cs.fontFamily,
          fontStyle: 'normal',
          textAlign: 'center',
        },
        children: [],
      });
    }

    if (tag === 'li' && cs.display === 'list-item') {
      const markerText = listMarker(el, cs.listStyleType);
      if (markerText) {
        const r2 = el.getBoundingClientRect();
        // Place marker at the left edge of the li's content box. It overlaps
        // the natural bullet area (left padding) so visual alignment matches.
        const markerW = 24;
        children.push({
          tag: '#text', text: markerText,
          attrs: {}, classNames: [], inlineStyle: {}, style: {},
          computed: {
            rectX: r2.x, rectY: r2.y, rectW: markerW, rectH: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) || 16,
            color: cs.color,
            fontSize: parseFloat(cs.fontSize),
            fontWeight: parseInt(cs.fontWeight, 10) || undefined,
            fontFamily: cs.fontFamily,
            fontStyle: cs.fontStyle,
            lineHeight: parseFloat(cs.lineHeight),
          },
          children: [],
        });
      }
    }
    for (const c of el.childNodes) {
      const ir = walk(c);
      if (ir) children.push(ir);
    }
    const after = getPseudoIR(el, '::after');
    if (after) children.push(after);

    let text;
    if (children.length === 1 && children[0].tag === '#text') {
      text = children[0].text;
    }

    return {
      tag,
      text,
      attrs: attrs(el),
      classNames: (el.className && typeof el.className === 'string') ? el.className.split(/\\s+/).filter(Boolean) : [],
      inlineStyle: {},
      style: {},
      computed,
      children,
    };
  }

  // Detect "screens" — direct children of #root, or fallback to body roots
  const root = document.getElementById('root') || document.body;
  const screens = [];
  for (const child of root.children) {
    const ir = walk(child);
    if (ir) screens.push(ir);
  }
  return { screens, viewport: { w: window.innerWidth, h: window.innerHeight } };
})();
`;
