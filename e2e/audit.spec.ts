import { expect, test, type Route } from '@playwright/test';

/**
 * E2E del flujo de auditoría. El backend SSE se mockea con `page.route` para que el test sea
 * determinístico y no dependa de las APIs de IA: validamos la experiencia de la UI de punta a punta
 * (landing → envío → progreso → resultados, y la rama de error).
 */

/** Serializa eventos al formato SSE que produce el route handler (`event: <type>\ndata: <json>\n\n`). */
function sse(events: Array<Record<string, unknown>>): string {
  return events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
}

/** `AuditResult` completo y coherente para el evento terminal `done`. */
const RESULT = {
  profile: {
    name: 'Roku',
    category: 'plataformas de streaming',
    description: 'Reproductores y TVs con sistema operativo de streaming.',
    competitors: ['Amazon Fire TV', 'Chromecast'],
    detectedBy: 'gemini',
  },
  prompts: [
    { id: 'definitional', intent: 'definitional', text: '¿Qué es Roku?', mentionsBrand: true },
  ],
  runs: [
    {
      promptId: 'definitional',
      intent: 'definitional',
      engineId: 'gemini',
      label: 'Gemini',
      model: 'gemini-2.5-flash',
      answer: 'Roku lidera el mercado de streaming.',
      signals: {
        mentioned: true,
        accuracy: 0.9,
        sentiment: 'positive',
        competitivePosition: 1,
        citedSource: true,
      },
    },
  ],
  score: {
    overall: 79,
    dimensions: { presence: 100, accuracy: 83, sentiment: 82, competitive: 71, citation: 12 },
    byEngine: [
      {
        engineId: 'gemini',
        label: 'Gemini',
        overall: 79,
        dimensions: { presence: 100, accuracy: 83, sentiment: 82, competitive: 71, citation: 12 },
      },
    ],
  },
  enginesUsed: [{ id: 'gemini', label: 'Gemini', model: 'gemini-2.5-flash' }],
  locale: 'es',
  createdAt: '2026-06-22T12:00:00.000Z',
};

/** Stream feliz: perfil → prompts → respuesta → juzgado → score → done. */
const HAPPY_STREAM = sse([
  { type: 'profile', profile: RESULT.profile },
  { type: 'prompts', prompts: RESULT.prompts },
  { type: 'answer', promptId: 'definitional', engineId: 'gemini', ok: true },
  { type: 'judged', promptId: 'definitional' },
  { type: 'scored', score: RESULT.score },
  { type: 'done', result: RESULT },
]);

test('la landing muestra el formulario y las marcas de ejemplo', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('textbox')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notion' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Linear' })).toBeVisible();
});

test('flujo completo: auditar una marca lleva al dashboard de resultados', async ({ page }) => {
  await page.route('**/api/audit', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      body: HAPPY_STREAM,
    }),
  );

  await page.goto('/');
  await page.getByRole('textbox').fill('Roku');
  await page.getByRole('textbox').press('Enter');

  // Veredicto del tramo alto (overall 79) y una cita textual del motor.
  await expect(page.getByText('Buena visibilidad')).toBeVisible();
  await expect(page.getByText('Roku lidera el mercado de streaming.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva auditoría' })).toBeVisible();
});

test('ruta de error: un 503 sin motores muestra el estado de error accionable', async ({
  page,
}) => {
  await page.route('**/api/audit', (route: Route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'No hay motores de IA configurados en el servidor.' }),
    }),
  );

  await page.goto('/');
  await page.getByRole('textbox').fill('Roku');
  await page.getByRole('textbox').press('Enter');

  await expect(
    page.getByRole('heading', { name: 'No pudimos completar la auditoría' }),
  ).toBeVisible();
  // Mensaje accionable según el `kind` (no_engines) del 503.
  await expect(
    page.getByText('No hay motores de IA configurados en el servidor.').first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Empezar de nuevo' })).toBeVisible();
});
