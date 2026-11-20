/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import cssInjectedByJs from 'vite-plugin-css-injected-by-js';

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