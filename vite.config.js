import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: {
    // The standalone WebGL engine is intentionally local, not a runtime CDN.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three-engine';
        }
      }
    }
  }
});
