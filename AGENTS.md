# Estándares de código — AEO/GEO Auditor

Convenciones reales del repo. El guardian de pre-commit las usa para revisar cada cambio.

## TypeScript

- `strict: true` + `noUncheckedIndexedAccess` + `noImplicitOverride`. No relajar el tsconfig.
- Prohibido `any`. Para datos sin forma usar `unknown` y estrechar (Zod o type guards).
- Preferir predicados de tipo (`x is T`) antes que aserciones (`as T`).
- Tipos de dominio explícitos y compartidos (`server/audit/types.ts`, `types/engine.ts`).
- Imports de solo tipo con `import type`.
- Alias `@/*` → `src/*` tanto en código como en tests.

## React / Next.js (App Router)

- Componentes funcionales con named exports (sin `default`).
- `'use client'` solo en componentes que usan hooks o estado de cliente.
- Un componente por archivo; los subcomponentes con lógica propia van a su archivo
  (ver `components/dashboard/`), no anidados inline en un god component.
- Código de servidor con `server-only`; nunca filtrar secretos al bundle de cliente.
- i18n con next-intl: el texto visible viaja por claves de traducción, nunca hardcodeado.

## Arquitectura

- Respetar las capas: UI → hook/stream → API route → orquestador → engines → tipos.
- Las dependencias entran por los barrels públicos (`server/audit`, `server/engines`),
  no por módulos internos. Sin dependencias circulares.
- Depender de interfaces (`Engine`), no de implementaciones concretas.
- Funciones puras (scoring, prompts, parsers) sin red ni efectos: deterministas y testeables.

## Errores y resiliencia

- Errores normalizados (`EngineError`) con `kind`; al cliente solo cruza el `kind`, el detalle
  crudo queda en logs.
- Validar input en la frontera (Zod) antes de trabajo costoso.
- Propagar cancelación (`AbortController`) a las llamadas externas.
- Nada de descartes silenciosos: si una rama se ignora, dejar rastro (`console.warn`).

## Testing

- Vitest para unidad/componentes, Playwright para e2e. Tests junto a la capa que cubren.
- Tests de comportamiento, no de implementación. Componentes con Testing Library
  (`renderWithIntl`) ejercitando las traducciones reales.
- No bajar la cobertura por debajo del gate de `vitest.config.ts`.

## Estilo y commits

- Prettier: comillas simples, `semi`, `trailingComma: all`, `printWidth: 100`, 2 espacios.
- `pnpm` (no npm). `pnpm lint`, `pnpm typecheck` y `pnpm test` deben pasar antes de commitear.
- Commits convencionales en español (`feat`, `fix`, `refactor`, `test`, `ci`, `chore`).
- Comentarios en español, neutro/profesional; explican el PORQUÉ, no el qué.
