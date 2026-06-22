import { defineConfig, devices } from '@playwright/test';

/**
 * Config de Playwright para los E2E del flujo de auditoría.
 *
 * Los specs interceptan `/api/audit` (no pegan a APIs de IA reales), así que basta con levantar el
 * servidor de Next. En local reusa un server ya corriendo; en CI lo arranca y espera a que responda.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    // La app tiene español por defecto; fijamos el locale del navegador para que next-intl
    // sirva la UI en español (si no, Chrome negocia `en` por su Accept-Language).
    locale: 'es-ES',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
