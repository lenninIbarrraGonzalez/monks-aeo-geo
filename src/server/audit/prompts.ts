/**
 * Generación determinística de los prompts de auditoría desde el perfil de la marca.
 *
 * Son las preguntas que un cliente real le haría a una IA. Es una función pura (sin red): mismas
 * entradas → mismos prompts, fácil de testear.
 *
 * Acotamos a TRES intenciones de alto valor para que la auditoría completa entre en el límite de
 * tiempo de la función serverless (Vercel corta a 60 s) sin perder señal: una pregunta directa,
 * una competitiva y una categórica sin nombrar la marca.
 */

import type { AuditPrompt, BrandProfile, Locale } from './types';

/** Plantillas por idioma. `{brand}` y `{category}` se interpolan. */
const TEMPLATES: Record<
  Locale,
  {
    definitional: string;
    alternatives: string;
    categorical: string;
  }
> = {
  es: {
    definitional: '¿Qué es {brand}? Explicámelo brevemente.',
    alternatives: '¿Cuáles son las mejores alternativas a {brand}?',
    categorical: '¿Cuáles son las mejores opciones en {category} hoy?',
  },
  en: {
    definitional: 'What is {brand}? Briefly explain it.',
    alternatives: 'What are the best alternatives to {brand}?',
    categorical: 'What are the best options in {category} today?',
  },
};

/** Interpola `{brand}` y `{category}` en una plantilla. */
function fill(template: string, values: { brand: string; category: string }): string {
  return template.replaceAll('{brand}', values.brand).replaceAll('{category}', values.category);
}

/**
 * Construye los prompts de la auditoría para un perfil y un idioma.
 *
 * Tres intenciones complementarias:
 * - `definitional`: pregunta directa por la marca (presencia, exactitud y sentimiento).
 * - `comparative-alternatives`: la sitúa frente a su set competitivo.
 * - `categorical`: NO nombra la marca (`mentionsBrand: false`) — mide si emerge sola en su
 *   categoría, la señal AEO/GEO más valiosa.
 */
export function buildPrompts(profile: BrandProfile, locale: Locale): AuditPrompt[] {
  const t = TEMPLATES[locale];
  const values = { brand: profile.name, category: profile.category };

  return [
    {
      id: 'definitional',
      intent: 'definitional',
      text: fill(t.definitional, values),
      mentionsBrand: true,
    },
    {
      id: 'comparative-alternatives',
      intent: 'comparative',
      text: fill(t.alternatives, values),
      mentionsBrand: true,
    },
    {
      id: 'categorical',
      intent: 'categorical',
      text: fill(t.categorical, values),
      mentionsBrand: false,
    },
  ];
}
