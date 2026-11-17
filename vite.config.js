import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Set SOURCEMAP=true to emit source maps (off in production to avoid publishing a 3 MB .map).
    sourcemap: process.env.SOURCEMAP === 'true'
  }
});
