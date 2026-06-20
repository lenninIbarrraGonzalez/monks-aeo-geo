import { describe, expect, it } from 'vitest';

import { formatSse, SSE_HEADERS, type AuditStreamEvent } from '@/server/audit/sse';
import type { AuditPrompt, AuditResult, AuditScore, BrandProfile } from '@/server/audit/types';

const PROFILE: BrandProfile = {
  name: 'Notion',
  category: 'software de notas y productividad',
  description: 'App de notas, docs y bases de datos.',
  competitors: ['Evernote', 'Obsidian'],
  detectedBy: 'gemini',
};

const PROMPTS: AuditPrompt[] = [
  { id: 'definitional', intent: 'definitional', text: '¿Qué es Notion?', mentionsBrand: true },
];

const SCORE: AuditScore = {
  overall: 72,
  dimensions: { presence: 80, accuracy: 70, sentiment: 75, competitive: 60, citation: 50 },
  byEngine: [],
};

const RESULT: AuditResult = {
  profile: PROFILE,
  prompts: PROMPTS,
  runs: [],
  score: SCORE,
  enginesUsed: [{ id: 'gemini', label: 'Gemini', model: 'gemini-2.5-flash' }],
  locale: 'es',
  createdAt: '2026-06-19T00:00:00.000Z',
};

/** Parsea un bloque SSE de vuelta a `{ event, data }` para verificar el round-trip. */
function parseSse(raw: string): { event: string; data: unknown } {
  const lines = raw.split('\n');
  const event = lines[0]!.replace(/^event: /, '');
  const data = JSON.parse(lines[1]!.replace(/^data: /, ''));
  return { event, data };
}

describe('formatSse', () => {
  it('emite el formato SSE exacto: línea event, línea data y doble salto final', () => {
    const out = formatSse({ type: 'judged', promptId: 'definitional' });
    expect(out).toBe('event: judged\ndata: {"type":"judged","promptId":"definitional"}\n\n');
    expect(out.endsWith('\n\n')).toBe(true);
  });

  it.each<AuditStreamEvent>([
    { type: 'profile', profile: PROFILE },
    { type: 'prompts', prompts: PROMPTS },
    { type: 'answer', promptId: 'definitional', engineId: 'gemini', ok: true },
    { type: 'judged', promptId: 'definitional' },
    { type: 'scored', score: SCORE },
    { type: 'done', result: RESULT },
    { type: 'error', kind: 'rate_limit', message: 'límite excedido' },
  ])('serializa el evento "$type" con data JSON que round-trips al payload', (event) => {
    const { event: name, data } = parseSse(formatSse(event));
    expect(name).toBe(event.type);
    expect(data).toEqual(event);
  });
});

describe('SSE_HEADERS', () => {
  it('declara el content-type de event-stream y desactiva la caché', () => {
    expect(SSE_HEADERS['Content-Type']).toContain('text/event-stream');
    expect(SSE_HEADERS['Cache-Control']).toContain('no-cache');
  });
});
