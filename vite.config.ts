/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Caminhos relativos: o build funciona em qualquer hospedagem estática
  // (GitHub Pages, Netlify, pasta local servida por http) sem configuração extra.
  base: './',
  build: {
    rollupOptions: {
      // Duas páginas: o painel de estudos e a montagem 3D do carrinho cervejeiro.
      input: {
        main: 'index.html',
        'carrinho-cervejeiro': 'carrinho-cervejeiro.html',
      },
    },
    // O three.js sozinho passa de 500 kB; a página 3D carrega só ele e o próprio código.
    chunkSizeWarningLimit: 800,
  },
  // Em desenvolvimento, as chamadas /api vão para o servidor local da Cloudflare (npm run dev:api).
  server: {
    proxy: { '/api': 'http://127.0.0.1:8788' },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
