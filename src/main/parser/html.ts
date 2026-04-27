// TODO: remove. URL-only mode in src/main/index.ts no longer routes raw HTML
// through this parser; the scrape server emits IR directly. Tests still pin
// the parser's behaviour for any future re-introduction, but the production
// bundle does not call parseHTML.
import { parse, HTMLElement, TextNode, Node } from 'node-html-parser';
import { IRNode } from '../ir/types';
import { resolveStyle } from '../style/resolve';
import { parseInlineStyle } from '../style/inline';

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'meta', 'link', 'head', 'title']);

export function parseHTML(source: string): IRNode[] {
  const root = parse(source, {
    lowerCaseTagName: true,
    comment: false,
    voidTag: { tags: ['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'area'], closingSlash: true },
  });
  const nodes: IRNode[] = [];
  for (const child of root.childNodes) {
    const ir = nodeToIR(child);
    if (ir) nodes.push(ir);
  }
  return nodes;
}

function nodeToIR(node: Node): IRNode | null {
  if (node instanceof TextNode) {
    const text = node.rawText.replace(/\s+/g, ' ');
    if (!text.trim()) return null;
    return {
      tag: '#text',
      text,
      attrs: {},
      classNames: [],
      inlineStyle: {},
      style: {},
      children: [],
    };
  }
  if (!(node instanceof HTMLElement)) return null;
  const tag = node.tagName?.toLowerCase() ?? 'div';
  if (SKIP_TAGS.has(tag)) return null;

  const attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(node.attributes)) {
    attrs[k] = v ?? '';
  }
  const classNames = (attrs.class ?? '').split(/\s+/).filter(Boolean);
  const inlineStyle = parseInlineStyle(attrs.style ?? '');
  const style = resolveStyle(classNames, inlineStyle, tag);

  const children: IRNode[] = [];
  for (const c of node.childNodes) {
    const ir = nodeToIR(c);
    if (ir) children.push(ir);
  }

  // Collapse pure-text container into text node when single text child
  let text: string | undefined;
  if (children.length === 1 && children[0].tag === '#text') {
    text = children[0].text;
  }

  return { tag, text, attrs, classNames, inlineStyle, style, children };
}
