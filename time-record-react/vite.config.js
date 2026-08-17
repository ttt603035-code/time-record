import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps every asset reference relative, exactly like the legacy
// build. That is what lets the app be served from any sub-path (today:
// https://ttt603035-code.github.io/time-record/) without touching the Shortcut.
// The jsdom-based gates (verify.mjs, donut-spec.mjs) execute the built bundle
// as a single classic <script>, so they cannot follow the dynamic import that
// code-splits Insights. `TR_SINGLE_BUNDLE=1 npm run build` emits one flat chunk
// for them; the default (shipping) build keeps the split.
const singleBundle = process.env.TR_SINGLE_BUNDLE === '1';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    // The inlined dynamic-import helper still mentions `import.meta.url`, which
    // is a syntax error in a classic script. Neutralise it for the test build.
    singleBundle && {
      name: 'tr-strip-import-meta',
      enforce: 'post',
      generateBundle(_options, bundle) {
        for (const file of Object.values(bundle)) {
          if (file.type === 'chunk') {
            file.code = file.code.replace(/import\.meta\.url/g, '"file:///bundle.js"')
              .replace(/import\.meta\.resolve/g, 'undefined');
          }
        }
      },
    },
  ].filter(Boolean),
  build: singleBundle
    ? {
        outDir: 'dist-test',
        // No preload helper: it references `import.meta.url`, which throws in a
        // classic <script> — and that is exactly how jsdom injects the bundle.
        modulePreload: false,
        rollupOptions: { output: { inlineDynamicImports: true } },
      }
    : {},
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
