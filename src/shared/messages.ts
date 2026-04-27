export type UIMessage =
  | { type: 'convert'; source: string; format: 'html' | 'jsx' }
  | { type: 'convert-json'; payload: any };

export type PluginMessage =
  | { type: 'done'; nodeCount: number }
  | { type: 'error'; message: string }
  | { type: 'log'; message: string };
