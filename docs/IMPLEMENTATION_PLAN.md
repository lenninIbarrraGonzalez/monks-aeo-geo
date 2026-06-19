# Plan de implementación — AEO/GEO Auditor

> **Fuente de verdad:** [`plan_de_trabajo.md`](./plan_de_trabajo.md) contiene el plan completo por
> fases con checklists, contexto, decisiones de alcance, stack y metodología de auditoría. Este
> documento es un **espejo versionado** que resume el estado y la secuencia de fases para una
> lectura rápida desde el repo. Si ambos difieren, manda `plan_de_trabajo.md`.

## Estado de fases

| Fase | Descripción                                     | Estado        |
| ---- | ----------------------------------------------- | ------------- |
| 0    | Validación de tooling (skills & MCP)            | ✅ Completada |
| 1    | Scaffold del proyecto                           | 🔄 En curso   |
| 2    | Capa de motores de IA (abstracción multi-motor) | ⬜ Pendiente  |
| 3    | Motor de auditoría y scoring                    | ⬜ Pendiente  |
| 4    | API + streaming (SSE)                           | ⬜ Pendiente  |
| 5    | UI: Landing + progreso en vivo                  | ⬜ Pendiente  |
| 6    | UI: Dashboard de resultados                     | ⬜ Pendiente  |
| 7    | i18n completo + pulido visual                   | ⬜ Pendiente  |
| 8    | Tests y verificación                            | ⬜ Pendiente  |
| 9    | Deploy a Vercel                                 | ⬜ Pendiente  |

## Decisiones de arquitectura (Fase 1)

- **Framework:** Next.js 16 (App Router) + TypeScript estricto
  (`noUncheckedIndexedAccess`, `noImplicitOverride`).
- **UI:** Tailwind CSS v4 + shadcn/ui (estilo `new-york`, base `slate`).
- **i18n:** next-intl con `localePrefix: 'as-needed'` → `/` español (default), `/en` inglés.
  Rutas bajo `src/app/[locale]/`, mensajes en `messages/{es,en}.json`, proxy en `src/proxy.ts`.
- **Calidad:** ESLint (flat config de Next) + Prettier (con `prettier-plugin-tailwindcss`).
- **Estructura preparada para fases siguientes:** `src/server/engines/` (motores de IA, Fase 2),
  `src/server/audit/` (auditoría/scoring, Fase 3), `src/types/` (tipos compartidos).

## Flujo de trabajo por fase (regla)

Cada fase: **implementar → `pre-commit-review` (+ `/code-review` en lógica crítica) → commit con
`conventional-commit`** (Conventional Commits, sin referencias a IA). Una fase se cierra solo
cuando todas sus casillas en `plan_de_trabajo.md` están marcadas.
