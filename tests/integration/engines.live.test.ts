import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { getAvailableEngines } from '@/server/engines';

/**
 * Smoke-test EN VIVO contra las APIs reales (Gemini / OpenRouter).
 *
 * No corre en la suite normal: solo si `LIVE_SMOKE=1`, para no hacer llamadas de red ni
 * gastar cuota en cada `pnpm test`. Carga las claves desde `.env.local` (git-ignored) en
 * un `beforeAll`; los módulos de motor leen el entorno de forma perezosa, así que basta con
 * poblar `process.env` antes de invocar `getAvailableEngines()`.
 *
 * Correr con: `LIVE_SMOKE=1 pnpm exec vitest run tests/integration/engines.live.test.ts`
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

liveDescribe('engines (LIVE)', () => {
  beforeAll(() => {
    loadEnvLocal();
  });

  it('lista al menos un motor disponible', () => {
    const engines = getAvailableEngines();
    console.log(
      `\nMotores disponibles: ${engines.map((e) => `${e.id} (${e.model})`).join(', ') || '—'}`,
    );
    expect(engines.length).toBeGreaterThan(0);
  });

  it('cada motor responde un prompt real con texto etiquetado', async () => {
    const engines = getAvailableEngines();
    let okCount = 0;

    // Probamos cada motor por separado: un fallo (p. ej. cuota agotada) no debe
    // ocultar el resultado de los demás.
    for (const engine of engines) {
      try {
        const res = await engine.generate({
          prompt: 'Respondé en una sola frase: ¿qué es la optimización para motores de IA (AEO)?',
          maxTokens: 200,
        });

        console.log(`\n✅ ${res.label} [${res.engineId}/${res.model}]`);
        console.log(res.text.slice(0, 400));
        if (res.usage) console.log(`   tokens: ${JSON.stringify(res.usage)}`);

        expect(res.engineId).toBe(engine.id);
        expect(res.text.trim().length).toBeGreaterThan(0);
        okCount++;
      } catch (error) {
        const kind = error instanceof Error ? error.name : 'Error';
        const message = error instanceof Error ? error.message : String(error);
        console.log(`\n❌ ${engine.label} [${engine.id}/${engine.model}]`);
        console.log(`   ${kind}: ${message.slice(0, 300)}`);
      }
    }

    console.log(`\n${okCount}/${engines.length} motor(es) respondieron OK.`);
    expect(okCount).toBeGreaterThan(0);
  }, 60_000);
});
