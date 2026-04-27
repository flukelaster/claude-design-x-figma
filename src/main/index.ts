import { buildTree } from './mapper';
import type { IRNode } from './ir/types';
import type { UIMessage, PluginMessage } from '../shared/messages';

figma.showUI(__html__, { width: 420, height: 720, themeColors: true });

function send(msg: PluginMessage) {
  figma.ui.postMessage(msg);
}

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = (() => {
  const arr = new Uint8Array(256);
  for (let i = 0; i < B64_CHARS.length; i++) arr[B64_CHARS.charCodeAt(i)] = i;
  return arr;
})();

type SizedNode = SceneNode & { width: number; height: number };

function hasSize(node: SceneNode): node is SizedNode {
  return 'width' in node && 'height' in node;
}

function fitFrameToContent(frame: FrameNode) {
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
  try { frame.resize(Math.max(1, maxRight), Math.max(1, maxBottom)); } catch {}
}

function base64ToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  let data = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  data = data.replace(/[^A-Za-z0-9+/]/g, '');
  const pad = data.length % 4;
  if (pad) data += '='.repeat(4 - pad);
  const len = (data.length / 4) * 3 - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
  const bytes = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = B64_LOOKUP[data.charCodeAt(i)];
    const b = B64_LOOKUP[data.charCodeAt(i + 1)];
    const c = B64_LOOKUP[data.charCodeAt(i + 2)];
    const d = B64_LOOKUP[data.charCodeAt(i + 3)];
    if (p < len) bytes[p++] = (a << 2) | (b >> 4);
    if (p < len) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < len) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes;
}

async function handleConvertJson(payload: { screens: IRNode[] }) {
  const ir = payload?.screens ?? [];
  if (!ir.length) {
    send({ type: 'error', message: 'No nodes parsed.' });
    return;
  }
  const nodes = await buildTree(ir);
  if (!nodes.length) {
    send({ type: 'error', message: 'Nothing to render.' });
    return;
  }

  const center = figma.viewport.center;
  let xCursor = center.x;
  for (const n of nodes) {
    figma.currentPage.appendChild(n);
    if (n.type === 'FRAME') {
      // Force-clip the screen root so off-canvas carousel/scroll content
      // doesn't bleed onto neighbouring frames or the tab bar.
      n.clipsContent = true;
      // Shrink the screen frame to its content's bounding box. The browser
      // viewport may have left empty space below/right of the actual layout
      // (e.g. fixed-height body taller than rendered content).
      fitFrameToContent(n);
    }
    n.x = xCursor;
    n.y = center.y;
    if (hasSize(n)) xCursor += n.width + 40;
  }
  figma.currentPage.selection = nodes;
  figma.viewport.scrollAndZoomIntoView(nodes);

  send({ type: 'done', nodeCount: nodes.length });
}

// Mapped over UIMessage['type'] so adding a new variant requires adding a
// matching handler key — compiler error catches missing cases at expand time.
type Handlers = { [K in UIMessage['type']]: (msg: Extract<UIMessage, { type: K }>) => Promise<void> };

const HANDLERS: Handlers = {
  'convert-json': msg => handleConvertJson(msg.payload),
};

figma.ui.onmessage = async (msg: UIMessage) => {
  try {
    const handler = HANDLERS[msg.type] as (m: UIMessage) => Promise<void>;
    await handler(msg);
  } catch (e: unknown) {
    const err = e as { message?: string; stack?: string } | undefined;
    const text = (err?.message ?? String(e))
      + (err?.stack ? '\n' + err.stack.split('\n').slice(0, 4).join('\n') : '');
    console.error('Convert error:', e);
    send({ type: 'error', message: text });
  }
};
