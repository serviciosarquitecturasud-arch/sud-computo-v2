import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base './' → rutas relativas: funciona en GitHub Pages sin importar el nombre del repo.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}']
  }
} as never);
