import { beforeEach, describe, expect, it, vi } from 'vitest';

// Los mocks se declaran con `vi.hoisted` porque `vi.mock` se eleva al tope del módulo.
const { runAudit, hasAnyEngine } = vi.hoisted(() => ({
  runAudit: vi.fn(),
  hasAnyEngine: vi.fn(() => true),
}));

// `runAudit` se mockea para no salir a la red: cada test inyecta su comportamiento.
vi.mock('@/server/audit', () => ({ runAudit }));

// `hasAnyEngine` se controla por test; el resto de la capa de motores es el real (EngineError, etc.).
vi.mock('@/server/engines', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/engines')>()),
  hasAnyEngine,
}));

import { POST } from '@/app/api/audit/route';
import { EngineError } from '@/server/engines';
import type { AuditStreamEvent } from '@/server/audit/sse';

/** Construye un POST a /api/audit con una IP fija (para no chocar con el rate-limit entre tests). */
function auditRequest(body: unknown, ip = '10.0.0.1'): Request {
  return new Request('http://localhost/api/audit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** Lee el stream SSE completo y devuelve los eventos parseados. */
async function readEvents(response: Response): Promise<AuditStreamEvent[]> {
  const text = await response.text();
  return text
    .split('\n\n')
    .filter((block) => block.includes('data:'))
    .map((block) => {
      const data = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      return JSON.parse(data) as AuditStreamEvent;
    });
}

beforeEach(() => {
  runAudit.mockReset();
  hasAnyEngine.mockReset();
  hasAnyEngine.mockReturnValue(true);
});

describe('POST /api/audit', () => {
  it('rechaza un body inválido con 400 sin abrir el stream', async () => {
    const response = await POST(auditRequest({ brand: '' }, '10.0.0.2'));
    expect(response.status).toBe(400);
    expect(runAudit).not.toHaveBeenCalled();
  });

  it('responde 503 si no hay motores configurados', async () => {
    hasAnyEngine.mockReturnValue(false);
    const response = await POST(auditRequest({ brand: 'Roku' }, '10.0.0.3'));
    expect(response.status).toBe(503);
    expect(runAudit).not.toHaveBeenCalled();
  });

  it('transmite el progreso y cierra con `done`', async () => {
    runAudit.mockImplementation(async (_brand, options) => {
      await options.onProgress({ type: 'profile', profile: { name: 'Roku' } });
      return { score: { overall: 80 } };
    });

    const response = await POST(auditRequest({ brand: 'Roku' }, '10.0.0.4'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const events = await readEvents(response);
    expect(events[0]).toMatchObject({ type: 'profile' });
    expect(events.at(-1)).toMatchObject({ type: 'done' });
  });

  it('emite el error como evento `error` sin filtrar el detalle del proveedor', async () => {
    runAudit.mockRejectedValue(
      new EngineError('El motor respondió 429: {"secreto":"interno del proveedor"}', {
        kind: 'rate_limit',
        engineId: 'gemini',
      }),
    );

    const response = await POST(auditRequest({ brand: 'Roku' }, '10.0.0.5'));
    const events = await readEvents(response);
    const errorEvent = events.find((e) => e.type === 'error');

    expect(errorEvent).toMatchObject({ type: 'error', kind: 'rate_limit', message: '' });
    // El cuerpo crudo del proveedor NUNCA debe aparecer en lo que se transmite al cliente.
    expect(JSON.stringify(events)).not.toContain('interno del proveedor');
  });

  it('aplica rate-limit por IP tras superar el cupo', async () => {
    runAudit.mockResolvedValue({ score: { overall: 1 } });
    const ip = '10.9.9.9';
    let last: Response | undefined;
    // El límite es 5 por ventana; la sexta debe ser 429.
    for (let i = 0; i < 6; i++) {
      last = await POST(auditRequest({ brand: 'Roku' }, ip));
      if (last.status !== 429) await last.text(); // drena el stream para no dejarlo abierto
    }
    expect(last?.status).toBe(429);
    expect(last?.headers.get('retry-after')).toBeTruthy();
  });
});
