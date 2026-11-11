// Gera ../public/landing3d/landing3d.js (e o que ele precisar). Rodar: npm run build
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/landing3d/',
  build: {
    outDir: '../public/landing3d',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    lib: { entry: 'src/main.js', formats: ['es'], fileName: () => 'landing3d.js' },
  },
});
