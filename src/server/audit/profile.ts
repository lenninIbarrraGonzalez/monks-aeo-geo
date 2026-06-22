import 'server-only';

import type { Engine } from '@/server/engines';
import { isEngineError } from '@/server/engines';
import type { EngineId } from '@/types/engine';
import { generateStructuredWithFallback } from './json';
import { profileOutputSchema } from './schemas';
import type { BrandProfile, Locale } from './types';

/**
 * Auto-detección del perfil de la marca (1 llamada LLM).
 *
 * Produce la "verdad de referencia" contra la que se mide la exactitud de las demás IAs:
 * categoría, descripción canónica y competidores. Si la detección falla, degrada con un perfil
 * mínimo (`degraded: true`) para que la auditoría continúe en vez de romperse.
 */

const SYSTEM: Record<Locale, string> = {
  es: 'Sos un analista de mercado. Identificás marcas y su categoría con precisión y sin inventar. Respondés SOLO con JSON.',
  en: 'You are a market analyst. You identify brands and their category accurately, without making things up. You reply ONLY with JSON.',
};

/**
 * Distingue si el input parece una URL para ajustar la instrucción.
 * Requiere esquema, `www.` o un path explícito: así nombres de marca con punto (p. ej. "Vue.js",
 * "Node.js") NO se confunden con sitios web. Un dominio "pelado" se trata como nombre de marca y
 * el analista igual puede detectar su URL real.
 */
function looksLikeUrl(input: string): boolean {
  return /^https?:\/\//i.test(input) || /^www\./i.test(input) || /\.[a-z]{2,}\/\S/i.test(input);
}

function buildUser(input: string, locale: Locale): string {
  const target = looksLikeUrl(input) ? `el sitio web "${input}"` : `la marca "${input}"`;
  const targetEn = looksLikeUrl(input) ? `the website "${input}"` : `the brand "${input}"`;

  if (locale === 'en') {
    return [
      `Analyze ${targetEn} and return a JSON object with exactly these fields:`,
      '- "category": the product/industry category (concise, e.g. "note-taking and productivity software").',
      '- "description": one canonical sentence describing what it is and what it does.',
      '- "competitors": array of 3 to 5 real, well-known competitor brand names.',
      '- "url": the official website if you know it, otherwise null.',
      'If you do not recognize it, give your best honest guess from the name. Do not invent fake competitors.',
    ].join('\n');
  }

  return [
    `Analizá ${target} y devolvé un objeto JSON con exactamente estos campos:`,
    '- "category": la categoría de producto/industria (concisa, p. ej. "software de notas y productividad").',
    '- "description": una oración canónica que describa qué es y qué hace.',
    '- "competitors": array de 3 a 5 nombres de marcas competidoras reales y conocidas.',
    '- "url": el sitio oficial si lo conocés, si no null.',
    'Si no la reconocés, dá tu mejor estimación honesta a partir del nombre. No inventes competidores falsos.',
  ].join('\n');
}

/** Categoría de fallback usada cuando la detección falla, por idioma. */
const FALLBACK_CATEGORY: Record<Locale, string> = {
  es: 'categoría no determinada',
  en: 'undetermined category',
};

const FALLBACK_DESCRIPTION: Record<Locale, string> = {
  es: 'No se pudo detectar automáticamente el perfil de la marca.',
  en: 'The brand profile could not be detected automatically.',
};

/**
 * Detecta el perfil de `input` (nombre o URL) probando los `analysts` en orden (fallback).
 *
 * El primero que responda gana y queda registrado en `detectedBy`. Nunca lanza por un motor
 * caído: ante error devuelve un perfil mínimo marcado como `degraded`. `onUnavailable` permite al
 * orquestador enterarse de qué analista cayó para no reintentarlo en el juez.
 */
export async function detectBrandProfile(
  input: string,
  analysts: Engine[],
  locale: Locale,
  onUnavailable?: (engineId: EngineId) => void,
): Promise<BrandProfile> {
  const name = input.trim();
  const url = looksLikeUrl(name) ? name : undefined;

  try {
    const { data: output, engine } = await generateStructuredWithFallback(
      analysts,
      {
        schema: profileOutputSchema,
        system: SYSTEM[locale],
        user: buildUser(name, locale),
        temperature: 0,
      },
      onUnavailable,
    );

    return {
      name,
      ...(output.url ? { url: output.url } : url ? { url } : {}),
      category: output.category.trim(),
      description: output.description.trim(),
      competitors: output.competitors.map((c) => c.trim()).filter((c) => c.length > 0),
      detectedBy: engine.id,
    };
  } catch (error) {
    // Si NINGÚN analista pudo y el último fallo es de autenticación, todos están mal configurados:
    // toda la auditoría sería ruido. Se propaga para que el llamador lo reporte como error de
    // config, en vez de devolver un perfil degradado que parezca un resultado legítimo.
    if (isEngineError(error) && error.kind === 'auth') throw error;
    return {
      name,
      ...(url && { url }),
      category: FALLBACK_CATEGORY[locale],
      description: FALLBACK_DESCRIPTION[locale],
      competitors: [],
      detectedBy: analysts[0]?.id ?? 'gemini',
      degraded: true,
    };
  }
}
