/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import cssInjectedByJs from 'vite-plugin-css-injected-by-js';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// the Svelte entry compiles against the consumer's svelte copy, so every
// svelte import stays external; the CDN single-file build is untouched
export default defineConfig({
  plugins: [svelte(), cssInjectedByJs()],
  define: {
    __CLEF_VERSION__: JSON.stringify(pkg.version)
  },
  resolve: {
    conditions: ['browser']
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    cssCodeSplit: false,
    lib: {
      entry: 'src/svelte-entry.ts',
      formats: ['es'],
      fileName: () => 'clef.svelte.js'
    },
    rollupOptions: {
      external: (id) => id === 'svelte' || id.startsWith('svelte/')
    },
    outDir: 'dist',
    emptyOutDir: false
  }
});
