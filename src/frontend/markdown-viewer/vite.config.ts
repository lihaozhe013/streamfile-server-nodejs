import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  base: '/public/markdown-viewer/',
  plugins: [react()],
  css: {
    postcss: './postcss.config.js',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
      },
      output: {
        // Single bundle output
        entryFileNames: 'markdown-viewer.js',
        chunkFileNames: 'markdown-viewer.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'markdown-viewer.css';
          }
          // Keep font files with their original names
          return '[name].[ext]';
        },
        // Inline all assets and create a single bundle
        inlineDynamicImports: true
      }
    },
    // Increase chunk size warning limit since we're bundling everything
    chunkSizeWarningLimit: 1000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/test': path.resolve(__dirname, './src/test')
    }
  }
});
