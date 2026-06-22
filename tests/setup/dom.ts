/**
 * Setup de Vitest. Solo hace algo en los tests de componentes (entorno jsdom): registra los
 * matchers de jest-dom y limpia el DOM tras cada test. En los tests de Node (`*.test.ts`) no hay
 * `document`, así que se salta por completo y no carga Testing Library innecesariamente.
 */
export {};

if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');
  const { afterEach } = await import('vitest');
  afterEach(() => {
    cleanup();
  });
}
