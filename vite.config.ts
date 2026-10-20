/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Caminhos relativos: o build funciona em qualquer hospedagem estática
  // (GitHub Pages, Netlify, pasta local servida por http) sem configuração extra.
  base: './',
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
