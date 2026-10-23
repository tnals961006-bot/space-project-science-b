import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root: root + 'pages',
  base: './',
  plugins: [react(), {
    name: 'space-runtime-config',
    transformIndexHtml: { order: 'post', handler: () => [{ tag: 'script', attrs: { src: './config.js' }, injectTo: 'head-prepend' }] }
  }],
  publicDir: root + 'pages/public',
  resolve: { alias: { '@': root } },
  css: { postcss: { plugins: [] } },
  build: {
    outDir: root + 'dist-pages',
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rolldownOptions: { output: { codeSplitting: false } }
  }
});
