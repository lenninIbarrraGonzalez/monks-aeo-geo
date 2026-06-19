# Inventario de tooling — AEO/GEO Auditor

Documento de referencia del **tooling** (skills y MCP) que se usa a lo largo de las fases del
proyecto. Mantenerlo actualizado si se agregan o quitan skills/MCP.

## Skills activos del proyecto

Skills disponibles en la sesión (globales del usuario o provistos por la plataforma) que se
usan en el ciclo de trabajo de cada fase:

| Skill | Uso en el proyecto |
|-------|--------------------|
| `conventional-commit` | Mensajes de commit Conventional Commits (sin referencias a IA, por regla global). |
| `pre-commit-review` | Code review obligatorio de cambios staged **antes** de cada commit. |
| `code-review` | Review reforzado en fases de lógica crítica (p. ej. motor de scoring, Fase 3). |
| `unit-testing` | Tests unitarios (Vitest + Testing Library) de scoring, parsers y utilidades. |
| `verify` | Verificación manual de cambios corriendo la app y observando comportamiento. |
| `run` | Levantar la app del proyecto para validar cambios end-to-end. |
| `claude-api` | Referencia de modelos/API de Claude al integrar LLMs. |
| `find-skills` | Descubrir e instalar skills adicionales si hicieran falta. |
| `engram:memory` | Memoria persistente: decisiones, convenciones y descubrimientos. |

## Skills externos instalados (project-local)

Instalados con `npx skills add <slug> --copy -a claude` en `.claude/skills/` (copias reales
versionadas en el repo, demo autocontenido). La procedencia queda registrada en
`skills-lock.json`.

| Skill | Slug (skills.sh) | Para qué fase |
|-------|------------------|---------------|
| `next-best-practices` | `vercel-labs/next-skills@next-best-practices` | Fases 1–6: convenciones Next.js (App Router, RSC, data patterns, route handlers, optimización). |
| `frontend-design` | `anthropics/skills@frontend-design` | Fases 5–7: dirección visual, tipografía, UI intencional (no templada). |
| `high-end-visual-design` | `leonxlnx/taste-skill@high-end-visual-design` | Fases 5–7: estética "agencia premium" (fuentes, espaciado, sombras, animaciones). |
| `webapp-testing` | `anthropics/skills@webapp-testing` | Fase 8: testing/E2E de la web app con Playwright (verificación, screenshots, logs). |

Reinstalar en otra máquina (si hiciera falta): `npx skills add <slug> --copy -a claude` con
los slugs de la tabla.

## MCP relevantes

| MCP | Uso |
|-----|-----|
| **context7** | Documentación al día de librerías/SDKs (Next.js, next-intl, Zod, etc.). |
| **Playwright** | Pruebas E2E de los flujos clave (Fase 8) y verificación sobre la URL live (Fase 9). |
| **Vercel** | Despliegue a URL pública y configuración de variables de entorno (Fase 9). |

**MCP no relevantes para este proyecto:** `roku-docs`, Gmail, Google Calendar, Google Drive.

## Flujo por fase (recordatorio)

Cada fase: **implementar → `pre-commit-review` (+ `/code-review` en lógica crítica) → commit
con `conventional-commit`**. Una fase se cierra solo cuando todas sus casillas en
`docs/plan_de_trabajo.md` están marcadas.
