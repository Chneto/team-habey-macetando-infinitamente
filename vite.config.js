import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensures relative asset paths work on GitHub Pages subpaths (e.g. username.github.io/repo-name/)
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 2000
  }
});
