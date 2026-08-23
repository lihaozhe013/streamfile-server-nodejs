import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const staticPublicDir = path.resolve(__dirname, '../public');
const productionPublicDir = path.resolve(__dirname, '../../../dist/public');
const backendUrl = process.env.BACKEND_URL ?? 'http://127.0.0.1:3000';

const backendProxy = {
  target: backendUrl,
  changeOrigin: true,
};

export default defineConfig({
  root: __dirname,
  base: '/',
  publicDir: staticPublicDir,
  plugins: [react()],
  css: {
    postcss: path.resolve(__dirname, 'postcss.config.js'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': backendProxy,
      '/upload': backendProxy,
      '/files': {
        ...backendProxy,
        bypass(request: { url?: string }) {
          const requestUrl = new URL(request.url ?? '/', 'http://vite.local');
          if (requestUrl.searchParams.get('raw') !== '1') return request.url;
          return undefined;
        },
      },
    },
  },
  build: {
    outDir: productionPublicDir,
    emptyOutDir: true,
    modulePreload: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('video.js')) return 'media';
            if (
              id.includes('react-markdown') ||
              id.includes('remark-') ||
              id.includes('rehype-') ||
              id.includes('katex')
            )
              return 'markdown';
          }
          return undefined;
        },
      },
    },
  },
});
