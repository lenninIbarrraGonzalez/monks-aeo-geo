import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { runAudit } from '@/server/audit';
import { getAvailableEngines } from '@/server/engines';

/**
 * Auditoría EN VIVO de punta a punta contra las APIs reales.
 *
 * No corre en la suite normal: solo si `LIVE_SMOKE=1`, para no gastar cuota en cada `pnpm test`.
 * Audita una marca conocida y verifica que el resultado sea coherente (score 0–100, runs
 * etiquetadas por motor, perfil detectado). Imprime el desglose para inspección manual.
 *
 * Correr con: `LIVE_SMOKE=1 pnpm exec vitest run tests/integration/audit.live.test.ts`
 */
const liveDescribe = process.env.LIVE_SMOKE === '1' ? describe : describe.skip;

/** Parsea un `.env` minimalista (KEY=VALUE por línea) hacia `process.env`. */
function loadEnvLocal() {
  const path = fileURLToPath(new URL('../../.env.local', import.meta.url));
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (value && process.env[key] === undefined) process.env[key] = value;
  }
}

liveDescribe('runAudit (LIVE)', () => {
  beforeAll(() => {
    loadEnvLocal();
  });

  it('audita una marca conocida y devuelve un score coherente', async () => {
    const engines = getAvailableEngines();
    expect(engines.length).toBeGreaterThan(0);

    const result = await runAudit('Notion', {
      locale: 'es',
      onProgress: (e) => console.log(`· ${e.type}`),
    });

    console.log(`\n📊 AI Visibility Score: ${result.score.overall}/100`);
    console.log(
      `   Perfil: ${result.profile.category} — competidores: ${result.profile.competitors.join(', ')}`,
    );
    console.log(`   Dimensiones: ${JSON.stringify(result.score.dimensions)}`);
    for (const e of result.score.byEngine) {
      console.log(`   ${e.label}: ${e.overall}/100`);
    }

    expect(result.profile.name).toBe('Notion');
    expect(result.prompts.length).toBeGreaterThan(0);
    expect(result.runs.length).toBe(result.prompts.length * engines.length);
    expect(result.score.overall).toBeGreaterThanOrEqual(0);
    expect(result.score.overall).toBeLessThanOrEqual(100);
    expect(result.score.byEngine.length).toBe(engines.length);
  }, 180_000);
});
