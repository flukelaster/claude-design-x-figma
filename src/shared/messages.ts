import type { IRNode } from '../main/ir/types';

export type UIMessage =
  | { type: 'convert-json'; payload: { screens: IRNode[] } };

export type PluginMessage =
  | { type: 'done'; nodeCount: number }
  | { type: 'error'; message: string }
  | { type: 'log'; message: string };
