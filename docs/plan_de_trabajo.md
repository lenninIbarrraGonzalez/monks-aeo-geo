# Plan de trabajo — AEO/GEO Auditor (demo para Monks)

> **Cómo usar este documento:** cada fase tiene un checklist. Al implementar, marcá `- [x]` lo
> completado y dejá en `- [ ]` lo pendiente. Una fase se considera **cerrada** solo cuando todas
> sus casillas (incluidos *code review* y *commit*) están marcadas.

## Estado global

- [x] Fase 0 — Validación de tooling (skills & MCP)
- [x] Fase 1 — Scaffold del proyecto
- [x] Fase 2 — Capa de motores de IA
- [x] Fase 3 — Motor de auditoría y scoring
- [x] Fase 4 — API + streaming (SSE)
- [x] Fase 5 — UI: Landing + progreso en vivo
- [ ] Fase 6 — UI: Dashboard de resultados
- [ ] Fase 7 — i18n completo + pulido visual
- [ ] Fase 8 — Tests y verificación
- [ ] Fase 9 — Deploy a Vercel

---

## Contexto

La forma de buscar información cambió: cada vez más personas le preguntan directo a asistentes
de IA (ChatGPT, Claude, Gemini, Perplexity) en lugar de usar un buscador, y la IA responde sin
que el usuario visite ningún sitio. Eso deja a las marcas ciegas: no saben qué dice la IA sobre
ellas, si las mencionan, si las describen bien o si las ignoran frente a la competencia. El SEO
no responde esta pregunta; nace una disciplina nueva: **AEO/GEO** (Answer / Generative Engine
Optimization).

**Qué resuelve la app:** le muestra a una marca cómo la perciben los asistentes de IA, le pone
una nota a esa percepción (0–100) y le dice qué hacer para mejorarla.

**Objetivo real:** este proyecto es un **demo de portafolio** cuyo fin es que **Monks contrate
al autor**. La audiencia son especialistas en AEO/GEO, así que el demo debe ser **creíble en su
metodología** e **impecable en lo visual**.

## Decisiones de alcance

| Tema | Decisión |
|------|----------|
| Usuario / framing | Producto self-serve para marcas; audiencia real = Monks (demo) |
| Motores de IA | Multi-motor solo con free tier: Gemini (Google AI Studio) + modelos libres vía OpenRouter. Mostrar contraste entre motores |
| Honestidad del modelo | Etiquetado claro de qué motor respondió. Nunca afirmar "ChatGPT dice X" si corre otro modelo |
| Temporalidad | Auditoría puntual (one-shot), sin monitoreo en el tiempo |
| Categoría y competidores | Auto-detectados por IA desde el nombre/URL |
| Entregable | App web desplegada en URL pública (Vercel free) |
| Cobertura | Cualquier marca + botones de ejemplos destacados |
| Idiomas | Multiidioma: español (default) + inglés, con selector |

## Stack confirmado

- **Framework:** Next.js (App Router) con **TypeScript estricto**.
- **UI:** Tailwind CSS + **shadcn/ui** (componentes accesibles y pulidos).
- **i18n:** next-intl (es default + en).
- **Hosting:** Vercel (free tier, URL pública).
- **IA:** llamadas del lado del servidor (API keys nunca en el cliente). Capa de abstracción de
  motores para agregar/quitar sin tocar la lógica de auditoría.
- **Progreso:** streaming en vivo vía SSE.
- **Persistencia:** sin base de datos para el MVP (opcional: caché de auditorías de ejemplo).
- **Análisis:** LLM-as-judge con salida estructurada (JSON validado con Zod) + scoring
  determinístico por encima.

## Metodología de auditoría (el corazón del demo)

1. **Input:** nombre de marca o URL.
2. **Auto-detección (1 llamada LLM):** categoría, descripción canónica de la marca y top
   competidores. Este "perfil real" sirve de referencia para medir exactitud.
3. **Generación de prompts** (preguntas como las haría un cliente real):
   - *Definitoria:* "¿Qué es [marca]?"
   - *Evaluativa:* "¿Es buena [marca]? ¿Vale la pena?"
   - *Comparativa:* "Alternativas a [marca]", "[marca] vs [competidor]"
   - *Categórica (sin marca):* "¿Cuáles son las mejores opciones en [categoría]?" → mide si la
     marca emerge sin que se la nombre.
   - *Recomendación:* "Recomiéndame [categoría] para [caso de uso]"
4. **Ejecución:** cada prompt se corre en cada motor gratuito disponible.
5. **Análisis (LLM-as-judge):** señales estructuradas por respuesta:
   - **Presencia/Mención** (peso alto en prompts categóricos sin marca)
   - **Exactitud** (vs perfil real del paso 2)
   - **Sentimiento** (positivo / neutro / negativo)
   - **Posición competitiva** (antes/después de competidores; ranking)
   - **Citación de fuente** (¿cita el sitio de la marca?)
6. **Scoring:** AI Visibility Score 0–100 con sub-puntajes por dimensión y por motor.
7. **Reporte:** score + desgloses, "Cómo te ve la IA hoy" con citas textuales, comparación de
   motores, posicionamiento competitivo y recomendaciones accionables AEO/GEO.

## Flujo de trabajo de implementación (regla para TODAS las fases)

Cada fase sigue el mismo ciclo, sin excepción:

1. **Implementar** los entregables de la fase.
2. **Code review obligatorio ANTES del commit** → skill `pre-commit-review` sobre los cambios
   staged (y además `/code-review` en fases de lógica crítica). Si encuentra problemas, se
   corrigen antes de continuar.
3. **Commit** con el skill `conventional-commit` (Conventional Commits; sin ninguna referencia a
   IA/Claude, por regla global del usuario).

## Inventario de tooling

**Skills activos que se usan:** `conventional-commit`, `pre-commit-review`, `code-review`,
`unit-testing`, `verify`, `run`, `claude-api`, `find-skills`, `engram:memory`.

**MCP relevantes instalados:** **context7** (docs al día), **Playwright** (e2e), **Vercel**
(despliegue). No relevantes: `roku-docs`, Gmail/Calendar/Drive.

**Skills a instalar desde skills.sh** (`npx skills add <owner/repo>`):
`next-best-practices` (vercel-labs), `frontend-design` (anthropics), `webapp-testing`
(anthropics), `high-end-visual-design` (leonxlnx).

---

## Fase 0 — Validación de tooling (skills & MCP)

- [x] `git init` y `.gitignore` base
- [x] Documentar inventario de skills y MCP en `docs/TOOLING.md`
- [x] Instalar `next-best-practices` (vercel-labs)
- [x] Instalar `frontend-design` (anthropics)
- [x] Instalar `webapp-testing` (anthropics)
- [x] Instalar `high-end-visual-design` (leonxlnx)
- [x] **Code review** (`pre-commit-review`)
- [x] **Commit:** `chore(tooling): inventario de skills/mcp e instalación de skills`

## Fase 1 — Scaffold del proyecto

- [x] Next.js (App Router) + TypeScript estricto
- [x] Tailwind CSS + shadcn/ui inicializado
- [x] ESLint + Prettier configurados
- [x] next-intl con rutas `es`/`en` (`es` default) y mensajes base
- [x] Estructura de carpetas del proyecto
- [x] `.env.example` + `README.md`
- [x] `docs/IMPLEMENTATION_PLAN.md` (espejo de este plan, versionado en el repo)
- [x] **Code review** (`pre-commit-review`)
- [x] **Commit:** `chore: scaffold Next.js + TypeScript + Tailwind + shadcn + i18n`

## Fase 2 — Capa de motores de IA (abstracción multi-motor)

- [x] Interfaz `Engine` con tipos TS
- [x] Adaptador Gemini (Google AI Studio)
- [x] Adaptador Groq (free tier, OpenAI-compatible)
- [x] Adaptador OpenRouter (modelos `:free`)
- [x] Factory compartida OpenAI-compatible (reusada por Groq y OpenRouter)
- [x] Manejo de errores y rate-limits
- [x] Lectura de keys desde env (server-only)
- [x] Tests unitarios con mocks
- [x] **Smoke-test en vivo** (Gemini `2.5-flash` + Groq `llama-3.3-70b-versatile`): 2/2 OK
- [x] **Code review** (`pre-commit-review`)
- [x] **Commit:** `feat(engines): capa de abstracción multi-motor de IA`

> **Validación en vivo (cerrada):** `tests/integration/engines.live.test.ts` (gateado tras
> `LIVE_SMOKE=1`) corre prompts reales. Resultado: **Gemini** y **Groq** responden OK y son la
> dupla por defecto del demo (gratis, sin tarjeta, contraste entre proveedores distintos).
> **OpenRouter** queda configurado como tercer motor opcional; su free tier ($0 crédito) está
> saturado y devuelve 429 intermitente, así que no es el motor primario del demo. El default de
> Gemini se ajustó a `gemini-2.5-flash` (el `2.0-flash` no tenía cuota free en el proyecto).

## Fase 3 — Motor de auditoría y scoring (el corazón)

- [x] Auto-detección de perfil/categoría/competidores
- [x] Generación de prompts (las 5 intenciones)
- [x] Ejecución multi-motor de los prompts
- [x] LLM-as-judge con salida estructurada validada con Zod (5 señales)
- [x] Scoring 0–100 determinístico con sub-puntajes por dimensión y motor
- [x] Tests unitarios del scoring
- [x] **Code review reforzado** (`pre-commit-review` + `/code-review`)
- [x] **Commit:** `feat(audit): motor de auditoría y scoring`

> **Cierre (decisiones clave):** módulo en `src/server/audit/` (perfil → prompts → ejecución
> multi-motor → juez batcheado por prompt → scoring). Salida LLM en **modo JSON nativo**
> (`responseMimeType`/`response_format`, flag `json` agregado a `EngineRequest`) + parseo robusto
> y validación Zod con 1 reintento. El **juez** corre 1 llamada por prompt (juzga todos los
> motores juntos → menos llamadas, mejor comparación). `runAudit` expone `onProgress` para que la
> Fase 4 lo envuelva en SSE sin tocar el núcleo. **Fixes del review:** fallo del juez se marca
> como error de celda (excluida del scoring, no cuenta como ausencia real); errores de **auth**
> del analista se propagan (no degradan a un score 0 que parezca legítimo); match de motor en el
> juez sin distinguir mayúsculas; la dimensión competitiva se excluye del overall cuando no hubo
> comparación (renormalizando pesos). El analista por defecto es **Gemini** (si está); ejecución
> sobre todos los motores disponibles.

## Fase 4 — API + streaming (SSE)

- [x] API route que orquesta la auditoría
- [x] Emisión de progreso en vivo por SSE (qué pregunta, a qué motor, parciales)
- [x] Manejo de cancelación/errores del stream
- [x] **Code review** (`pre-commit-review`)
- [x] **Commit:** `feat(api): endpoint de auditoría con streaming SSE`

> **Cierre (decisiones clave):** transporte **POST + fetch ReadableStream** (no `EventSource`),
> para evitar el auto-reconnect que re-dispararía la auditoría completa y permitir body JSON
> limpio con URLs. Contrato del wire en `src/server/audit/sse.ts`: `AuditStreamEvent` =
> `AuditProgress` + terminales `done` (lleva el `AuditResult`) y `error` (con `kind` reutilizando
> `EngineErrorKind` para que la UI distinga `auth`/`rate_limit`/…), serializado con `formatSse`.
> Route handler en `src/app/api/audit/route.ts` (fuera de `[locale]`; `runtime=nodejs`,
> `dynamic=force-dynamic`, `maxDuration=60`): valida el body con Zod (400), corta con 503 si no
> hay motores, y envuelve `runAudit` en un `ReadableStream` reenviando cada `onProgress` 1:1.
> Cancelación robusta: flag `closed` compartido entre `start`/`cancel` + `send` con try/catch
> sobre `enqueue` (el abort puede llegar sin pasar por `cancel`); el `AbortSignal` se propaga a
> `runAudit` para cortar las llamadas de motor en vuelo. El error viaja como **evento**, no como
> throw, para no dejar a la UI a ciegas. Verificado en vivo: 400 (body inválido), 503 (sin
> motores), happy path con `profile → prompts → answer×N → judged×N → scored → done` en vivo y
> degradación elegante ante 429 de motor (errores por celda, cierra con `done`, sin crash).

## Fase 5 — UI: Landing + progreso en vivo

- [x] Landing con input de marca/URL
- [x] Botones de ejemplos destacados
- [x] Selector de idioma
- [x] Vista de progreso consumiendo el SSE
- [x] Aplicar guías de `frontend-design` / `high-end-visual-design`
- [x] **Code review** (`pre-commit-review`)
- [x] **Commit:** `feat(ui): landing y progreso en vivo`

## Fase 6 — UI: Dashboard de resultados

- [ ] Score titular + desgloses por dimensión y por motor
- [ ] Citas textuales de las respuestas
- [ ] Comparación entre motores
- [ ] Posicionamiento competitivo
- [ ] Recomendaciones accionables AEO/GEO
- [ ] **Code review** (`pre-commit-review`)
- [ ] **Commit:** `feat(ui): dashboard de resultados`

## Fase 7 — i18n completo + pulido visual

- [ ] Traducciones es/en completas de la UI
- [ ] Textos de reporte generados en el idioma activo
- [ ] Responsive + accesibilidad
- [ ] Estados de error/vacío y animaciones
- [ ] **Code review** (`pre-commit-review`)
- [ ] **Commit:** `feat(i18n): traducciones completas y pulido visual`

## Fase 8 — Tests y verificación

- [ ] Cobertura unitaria de scoring/parsers (`unit-testing`)
- [ ] e2e con Playwright MCP de los flujos clave (`webapp-testing`)
- [ ] **Code review** (`pre-commit-review`)
- [ ] **Commit:** `test: cobertura de auditoría y e2e`

## Fase 9 — Deploy a Vercel

- [ ] Configurar proyecto en Vercel (MCP Vercel)
- [ ] Cargar variables de entorno
- [ ] Desplegar a URL pública
- [ ] Verificar end-to-end con Playwright sobre la URL live
- [ ] **Code review** (`pre-commit-review`)
- [ ] **Commit:** `chore(deploy): configuración de despliegue en Vercel`

---

## Guía: obtener las API keys gratuitas (antes de Fase 2)

- **Gemini:** Google AI Studio (aistudio.google.com) → "Get API key" → crear key gratuita →
  `GEMINI_API_KEY` en `.env.local`.
- **OpenRouter:** openrouter.ai → registrarse → Keys → crear key → `OPENROUTER_API_KEY`. Usar
  modelos con sufijo `:free`.
- Ambas en `.env.local` (git-ignored); `.env.example` documenta los nombres sin valores.

## Verificación (global)

1. Correr en local (`npm run dev`, skill `run`) y auditar una marca de ejemplo → reporte coherente.
2. Auditar una marca conocida arbitraria → presencia/sentimiento razonables con citas reales.
3. Auditar una marca inventada → degrada con elegancia (no rompe; comunica baja visibilidad).
4. Cada cita/respuesta etiqueta qué motor la generó; el idioma del reporte sigue al selector.
5. e2e Playwright sobre la URL de Vercel desde fuera → carga y funciona end-to-end.
