export function parseInlineStyle(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!value) return out;
  for (const decl of value.split(';')) {
    const idx = decl.indexOf(':');
    if (idx < 0) continue;
    const k = decl.slice(0, idx).trim().toLowerCase();
    const v = decl.slice(idx + 1).trim();
    if (k && v) out[k] = v;
  }
  return out;
}
