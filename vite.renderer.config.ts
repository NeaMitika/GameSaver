import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

function readAppVersion(): string {
  try {
    const packageJsonPath = path.resolve(__dirname, 'package.json');
    const raw = fs.readFileSync(packageJsonPath, 'utf-8');
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === 'string' && parsed.version.trim().length > 0 ? parsed.version.trim() : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const appVersion = readAppVersion();

function cspMetaPlugin(mode: string) {
  return {
    name: 'csp-meta',
    transformIndexHtml(html: string) {
      const isDev = mode === 'development';
      const csp = isDev
        ? "default-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' http://localhost:5175 ws://localhost:5175;"
        : "default-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self';";
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
  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  },
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
