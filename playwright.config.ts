import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // Site + funções do servidor + banco D1 local, recriado do zero a cada execução.
  webServer: {
    command: [
      'rm -rf .wrangler/e2e',
      'npm run build',
      'npx wrangler d1 migrations apply evolua-meus-estudos --local --persist-to .wrangler/e2e',
      `npx wrangler pages dev --port ${PORT} --ip 127.0.0.1 --persist-to .wrangler/e2e`,
    ].join(' && '),
    url: `http://127.0.0.1:${PORT}/api/config`,
    env: { WRANGLER_SEND_METRICS: 'false' },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
