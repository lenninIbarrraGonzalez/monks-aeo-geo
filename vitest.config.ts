import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Configuración de Vitest.
 *
 * Conviven dos clases de test:
 * - Capa server/lib (`*.test.ts`): es código puro de Node, corre en `environment: 'node'`.
 * - Componentes React (`*.test.tsx`): cada archivo declara `// @vitest-environment jsdom` en la
 *   primera línea para renderizar con Testing Library. El plugin de React transpila el JSX y el
 *   setup `tests/setup/dom.ts` carga los matchers de jest-dom y el cleanup automático.
 *
 * El alias `@` espeja el de `tsconfig.json` (`@/*` → `src/*`) para que tests y código importen igual.
 */
export default defineConfig({
  plugins: [react()],
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
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['./tests/setup/dom.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/server/**',
        'src/lib/**',
        'src/types/**',
        'src/app/api/**',
        'src/hooks/**',
        'src/components/**',
      ],
      reporter: ['text', 'html'],
    },
  },
});
