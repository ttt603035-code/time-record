import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps every asset reference relative, exactly like the legacy
// build. That is what lets the app be served from any sub-path (today:
// https://ttt603035-code.github.io/time-record/) without touching the Shortcut.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Preview/proxy hosts (Arena sandbox, LAN iPhone/iPad testing) must be able
    // to reach the dev server.
    allowedHosts: true,
    strictPort: false,
  },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
});
