import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2017',
    lib: {
      entry: 'src/main/index.ts',
      formats: ['iife'],
      name: 'plugin',
      fileName: () => 'main.js',
    },
    rollupOptions: {
      output: { extend: true, inlineDynamicImports: true },
    },
    outDir: 'dist',
    emptyOutDir: false,
    minify: false,
  },
});
