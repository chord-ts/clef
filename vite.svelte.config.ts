/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import cssInjectedByJs from 'vite-plugin-css-injected-by-js';

// the Svelte entry compiles against the consumer's svelte copy, so every
// svelte import stays external; the CDN single-file build is untouched
export default defineConfig({
  plugins: [svelte(), cssInjectedByJs()],
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
