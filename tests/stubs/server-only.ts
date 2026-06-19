/**
 * Stub vacío de `server-only` para los tests.
 *
 * En producción, `import 'server-only'` lo provee Next.js y solo sirve como guardia de
 * build (impide importar la capa de motores desde un Client Component). En Vitest (entorno
 * node) ese módulo no resuelve, así que lo aliasamos a este no-op desde `vitest.config.ts`.
 */
export {};
