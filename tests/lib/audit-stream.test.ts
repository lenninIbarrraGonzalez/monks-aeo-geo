import { describe, expect, it } from 'vitest';

import { createAuditStreamParser } from '@/lib/audit-stream';
import { formatSse, type AuditStreamEvent } from '@/server/audit/sse';

const JUDGED: AuditStreamEvent = { type: 'judged', promptId: 'definitional' };
const ANSWER: AuditStreamEvent = {
  type: 'answer',
  promptId: 'definitional',
  engineId: 'gemini',
  ok: true,
};
const ERROR: AuditStreamEvent = { type: 'error', kind: 'rate_limit', message: 'límite excedido' };

describe('createAuditStreamParser', () => {
  it('emite un evento parseado a partir de un bloque completo', () => {
    const parser = createAuditStreamParser();
    expect(parser.push(formatSse(JUDGED))).toEqual([JUDGED]);
  });

  it('emite todos los eventos cuando llegan juntos en un solo chunk, en orden', () => {
    const parser = createAuditStreamParser();
    const chunk = formatSse(ANSWER) + formatSse(JUDGED);
    expect(parser.push(chunk)).toEqual([ANSWER, JUDGED]);
  });

  it('retiene el parcial y emite cuando el evento se completa en un push posterior', () => {
    const parser = createAuditStreamParser();
    const full = formatSse(JUDGED);
    const cut = Math.floor(full.length / 2);

    // Primera mitad: bloque incompleto → nada todavía.
    expect(parser.push(full.slice(0, cut))).toEqual([]);
    // Resto: completa el bloque → emite el evento.
    expect(parser.push(full.slice(cut))).toEqual([JUDGED]);
  });

  it('mantiene en buffer el siguiente evento aún incompleto tras emitir uno completo', () => {
    const parser = createAuditStreamParser();
    const full = formatSse(ANSWER) + formatSse(JUDGED);
    // Cortamos en medio del segundo bloque.
    const cut = full.indexOf('judged');
    expect(parser.push(full.slice(0, cut))).toEqual([ANSWER]);
    expect(parser.push(full.slice(cut))).toEqual([JUDGED]);
  });

  it('ignora bloques sin línea data: sin romper el resto', () => {
    const parser = createAuditStreamParser();
    // Un comentario/keep-alive SSE (`: ping`) seguido de un evento real.
    const chunk = ': ping\n\n' + formatSse(JUDGED);
    expect(parser.push(chunk)).toEqual([JUDGED]);
  });

  it('ignora un bloque con JSON inválido (devuelve [] sin lanzar)', () => {
    const parser = createAuditStreamParser();
    expect(parser.push('event: judged\ndata: {no es json\n\n')).toEqual([]);
  });

  it('reconstruye un data: multilínea antes de parsear', () => {
    const parser = createAuditStreamParser();
    const json = JSON.stringify(ERROR);
    // Partimos justo tras una coma: el \n con que el parser une las líneas cae entre tokens
    // (whitespace válido en JSON), no dentro de un string literal.
    const splitAt = json.indexOf(',') + 1;
    const block = `event: error\ndata: ${json.slice(0, splitAt)}\ndata: ${json.slice(splitAt)}\n\n`;
    expect(parser.push(block)).toEqual([ERROR]);
  });
});
