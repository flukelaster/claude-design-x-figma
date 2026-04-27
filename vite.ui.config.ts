import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { renameSync, existsSync } from 'fs';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),
    {
      name: 'rename-to-ui-html',
      closeBundle() {
        const out = resolve(__dirname, 'dist');
        const src = resolve(out, 'index.html');
        const dest = resolve(out, 'ui.html');
        if (existsSync(src)) renameSync(src, dest);
      },
    },
  ],
  root: 'src/ui',
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
  },
});
