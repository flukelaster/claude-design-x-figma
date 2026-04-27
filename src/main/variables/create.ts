// Figma-side creator: takes a TokenSet and materialises a Variable Collection
// with one variable per --token. Aliases (var(--x)) become VariableAlias
// references after a topological sort. Returns a summary the caller surfaces
// in the UI's "done" message.

import type { TokenSet, TokenVar } from '../ir/types';
import {
  buildIndexEntries,
  detectAlias,
  parseValue,
  resolveAliasTypes,
  topoOrderVars,
  variableNameForFigma,
} from './parse';

export type BindingIndex = {
  byColor: Map<string, Variable>;   // colorKey → Variable
  byNumber: Map<number, Variable>;
  byString: Map<string, Variable>;
};

export type CreateResult = {
  collectionId: string | null;
  modes: string[];
  variableCount: number;
  skipped: number;
  bindings: BindingIndex;
};

export const EMPTY_BINDINGS: BindingIndex = {
  byColor: new Map(),
  byNumber: new Map(),
  byString: new Map(),
};

const COLLECTION_NAME = 'Scraped tokens';
const PREFIXES = ['token-', 'ds-', 'color-', 'colour-'];

function colorToValue(c: { r: number; g: number; b: number; a: number }) {
  return { r: c.r, g: c.g, b: c.b, a: c.a };
}

export async function createVariablesFromTokens(set: TokenSet | null | undefined): Promise<CreateResult> {
  const empty: CreateResult = {
    collectionId: null,
    modes: [],
    variableCount: 0,
    skipped: 0,
    bindings: { byColor: new Map(), byNumber: new Map(), byString: new Map() },
  };
  if (!set || !set.vars?.length) return empty;
  if (typeof figma === 'undefined' || !figma.variables) return empty;

  // Reuse an existing collection of the same name so re-imports update in
  // place rather than littering the file with duplicates.
  let collection: VariableCollection | null = null;
  try {
    const all = await figma.variables.getLocalVariableCollectionsAsync();
    collection = all.find(c => c.name === COLLECTION_NAME) ?? null;
  } catch {
    collection = null;
  }
  if (!collection) collection = figma.variables.createVariableCollection(COLLECTION_NAME);

  const desiredModes = set.modes.length ? set.modes : ['Light'];
  // First mode keeps the collection's default mode id; rename it to match.
  if (collection.modes.length > 0) {
    try { collection.renameMode(collection.modes[0].modeId, desiredModes[0]); } catch {}
  }
  const modeIdByName = new Map<string, string>();
  modeIdByName.set(desiredModes[0], collection.modes[0].modeId);
  for (let i = 1; i < desiredModes.length; i++) {
    const name = desiredModes[i];
    const existing = collection.modes.find(m => m.name === name);
    if (existing) modeIdByName.set(name, existing.modeId);
    else {
      try {
        const id = collection.addMode(name);
        modeIdByName.set(name, id);
      } catch {
        // Free-tier files cap at one mode; degrade gracefully — the rest of
        // the values for this var will be dropped.
      }
    }
  }

  // Existing vars in the collection: index by Figma name so we update instead
  // of duplicating. Pre-fetch once.
  let existingVars: Variable[] = [];
  try { existingVars = await figma.variables.getLocalVariablesAsync(); } catch { existingVars = []; }
  const byFigmaName = new Map<string, Variable>();
  for (const v of existingVars) {
    if (v.variableCollectionId === collection.id) byFigmaName.set(v.name, v);
  }

  const typed = resolveAliasTypes(set);
  const ordered = topoOrderVars(typed);
  const created = new Map<string, Variable>(); // raw "--token-x" → Variable

  let variableCount = 0;
  let skipped = 0;

  // Pass 1: ensure a Variable exists for every entry, but defer setting values
  // until aliases can resolve. Using ordered list means we can set values in a
  // single forward pass.
  for (const tv of ordered) {
    const figmaName = variableNameForFigma(tv.name, PREFIXES);
    const figmaType: VariableResolvedDataType =
      tv.type === 'COLOR' ? 'COLOR' : tv.type === 'FLOAT' ? 'FLOAT' : 'STRING';
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

  // Pass 2: populate values per mode, resolving aliases against `created`.
  for (const tv of ordered) {
    const v = created.get(tv.name);
    if (!v) continue;
    for (const mode of desiredModes) {
      const raw = tv.values[mode] ?? tv.values[desiredModes[0]];
      if (raw == null) continue;
      const modeId = modeIdByName.get(mode);
      if (!modeId) continue;
      const aliasRef = detectAlias(raw);
      if (aliasRef) {
        const target = created.get(aliasRef);
        if (!target || target.id === v.id) continue;
        try {
          v.setValueForMode(modeId, figma.variables.createVariableAlias(target));
        } catch { skipped++; }
        continue;
      }
      const parsed = parseValue(raw, tv.type);
      try {
        if (parsed.kind === 'color' && v.resolvedType === 'COLOR') {
          v.setValueForMode(modeId, colorToValue(parsed.value));
        } else if (parsed.kind === 'float' && v.resolvedType === 'FLOAT') {
          v.setValueForMode(modeId, parsed.value);
        } else if (parsed.kind === 'string' && v.resolvedType === 'STRING') {
          v.setValueForMode(modeId, parsed.value);
        } else {
          skipped++;
        }
      } catch {
        skipped++;
      }
    }
  }

  // Build the back-binding index: literal default-mode value → Variable.
  // Ambiguous values (two vars with the same colour/number) are dropped by
  // buildIndexEntries already.
  const entries = buildIndexEntries(typed);
  const bindings: BindingIndex = {
    byColor: new Map(),
    byNumber: new Map(),
    byString: new Map(),
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
    bindings,
  };
}

// Exported for completeness in case future callers want to bind by raw name.
export { variableNameForFigma };
export type { TokenVar };
