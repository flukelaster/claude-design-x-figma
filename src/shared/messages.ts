import type { IRNode, TokenSet } from '../main/ir/types';

export type UIMessage =
  | { type: 'convert-json'; payload: { screens: IRNode[]; tokens?: TokenSet | null } };

export type PluginMessage =
  | { type: 'done'; nodeCount: number; variableCount?: number }
  | { type: 'error'; message: string }
  | { type: 'log'; message: string };
