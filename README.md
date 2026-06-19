# AEO/GEO Auditor

Aplicación web que **audita cómo los asistentes de IA perciben una marca**, le asigna un
**AI Visibility Score (0–100)** y entrega **recomendaciones accionables** de AEO/GEO (Answer /
Generative Engine Optimization, la disciplina sucesora del SEO).

> **Contexto:** demo de portafolio. Audiencia = especialistas en AEO/GEO, por lo que el proyecto
> busca ser **creíble en su metodología** e **impecable en lo visual**.

## Cómo funciona

1. **Input:** nombre de marca o URL.
2. **Auto-detección (IA):** categoría, descripción canónica y competidores principales.
3. **Generación de prompts** con las intenciones de un cliente real (definitoria, evaluativa,
   comparativa, categórica sin marca, recomendación).
4. **Ejecución multi-motor:** cada prompt se corre en los motores de IA disponibles (free tier).
5. **Análisis (LLM-as-judge):** presencia, exactitud, sentimiento, posición competitiva y
   citación de fuente, con salida estructurada validada.
6. **Scoring + reporte:** puntaje 0–100 con desgloses por dimensión y motor, citas textuales,
   comparación entre motores y recomendaciones.

Cada cita o respuesta se etiqueta con **qué motor la generó** (honestidad del modelo): nunca se
afirma "ChatGPT dice X" si la respuesta provino de otro modelo.

## Stack

- **Next.js** (App Router) + **TypeScript** estricto
- **Tailwind CSS v4** + **shadcn/ui** (base slate)
- **next-intl** — español (default, `/`) e inglés (`/en`)
- IA del lado del servidor (Gemini vía Google AI Studio + modelos `:free` de OpenRouter)
- Progreso en vivo vía **SSE**
- Deploy en **Vercel** (free tier)

## Requisitos

- Node.js 20+
- pnpm 10+ (`corepack enable pnpm`)

## Puesta en marcha

```bash
pnpm install
cp .env.example .env.local   # completá las API keys
pnpm dev                     # http://localhost:3000
```

- `/` → español (idioma por defecto)
- `/en` → inglés

## Scripts

| Script              | Descripción                       |
| ------------------- | --------------------------------- |
| `pnpm dev`          | Servidor de desarrollo            |
| `pnpm build`        | Build de producción               |
| `pnpm start`        | Servir el build                   |
| `pnpm lint`         | ESLint                            |
| `pnpm typecheck`    | Chequeo de tipos (`tsc --noEmit`) |
| `pnpm format`       | Formatear con Prettier            |
| `pnpm format:check` | Verificar formato sin escribir    |

## Variables de entorno

Ver [`.env.example`](./.env.example). Las claves se leen **solo del servidor** y nunca se
exponen al cliente.

## Documentación

- [`docs/plan_de_trabajo.md`](./docs/plan_de_trabajo.md) — plan por fases (fuente de verdad).
- [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) — plan de implementación versionado.
- [`docs/TOOLING.md`](./docs/TOOLING.md) — inventario de skills y MCP del proyecto.
