/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import cssInjectedByJs from 'vite-plugin-css-injected-by-js';

export default defineConfig({
  plugins: [svelte(), cssInjectedByJs()],
  resolve: {
    conditions: ['browser'],
    alias: {
      // dev: compile the svelte entry from source — vite-plugin-svelte rejects
      // re-processing the minified dist bundle (reserved `$` identifiers)
      '@chord-ts/clef/svelte': fileURLToPath(new URL('./src/svelte-entry.ts', import.meta.url))
    }
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    cssCodeSplit: false,
    lib: {
      entry: 'src/index.ts',
      name: 'clef',
      formats: ['es', 'iife'],
      fileName: (format) => (format === 'es' ? 'clef.esm.js' : 'clef.iife.js')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});