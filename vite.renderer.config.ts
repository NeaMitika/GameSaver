import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

function cspMetaPlugin(mode: string) {
  return {
    name: 'csp-meta',
    transformIndexHtml(html: string) {
      const isDev = mode === 'development';
      const csp = isDev
        ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' http://localhost:5175 ws://localhost:5175;"
        : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self';";
      return html.replace(
        /<meta http-equiv=\"Content-Security-Policy\"[^>]*>/,
        `<meta http-equiv=\"Content-Security-Policy\" content=\"${csp}\" />`
      );
    }
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [tailwindcss(), react(), cspMetaPlugin(mode)],
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    sourcemap: true
  },
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  },
  server: {
    port: 5175,
    strictPort: true
  }
}));
