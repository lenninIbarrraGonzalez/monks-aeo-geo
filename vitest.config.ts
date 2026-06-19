import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Configuración de Vitest.
 *
 * La capa de motores es server-side puro, así que corre en `node`. El alias `@` espeja el de
 * `tsconfig.json` (`@/*` → `src/*`) para que tests y código fuente importen igual.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` solo existe dentro del bundler de Next; en node lo reemplazamos
      // por un no-op para poder testear la capa de motores directamente.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/server/engines/**', 'src/types/**'],
      reporter: ['text', 'html'],
    },
  },
});
