import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    assetsDir: 'vite-assets',
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'index.html'),
        sanguoShooter: resolve(__dirname, 'sanguo-shooter/index.html')
      }
    }
  }
});
