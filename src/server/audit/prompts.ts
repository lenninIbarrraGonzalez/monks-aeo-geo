/**
 * Generación determinística de los prompts de auditoría desde el perfil de la marca.
 *
 * Son las preguntas que un cliente real le haría a una IA, cubriendo las cinco intenciones del
 * plan. Es una función pura (sin red): mismas entradas → mismos prompts, fácil de testear.
 */

import type { AuditPrompt, BrandProfile, Locale } from './types';

/** Plantillas por idioma. `{brand}`, `{category}` y `{competitor}` se interpolan. */
const TEMPLATES: Record<
  Locale,
  {
    definitional: string;
    evaluative: string;
    alternatives: string;
    versus: string;
    categorical: string;
    recommendation: string;
  }
> = {
  es: {
    definitional: '¿Qué es {brand}? Explicámelo brevemente.',
    evaluative: '¿Es buena {brand}? ¿Vale la pena? Dame ventajas y desventajas.',
    alternatives: '¿Cuáles son las mejores alternativas a {brand}?',
    versus: '{brand} vs {competitor}: ¿cuál conviene más y por qué?',
    categorical: '¿Cuáles son las mejores opciones en {category} hoy?',
    recommendation: 'Recomendame {category} para un equipo pequeño. ¿Cuál elegirías y por qué?',
  },
  en: {
    definitional: 'What is {brand}? Briefly explain it.',
    evaluative: 'Is {brand} good? Is it worth it? Give me pros and cons.',
    alternatives: 'What are the best alternatives to {brand}?',
    versus: '{brand} vs {competitor}: which one is better and why?',
    categorical: 'What are the best options in {category} today?',
    recommendation: 'Recommend {category} for a small team. Which would you pick and why?',
  },
};

/** Interpola `{brand}`, `{category}` y `{competitor}` en una plantilla. */
function fill(
  template: string,
  values: { brand: string; category: string; competitor?: string },
): string {
  return template
    .replaceAll('{brand}', values.brand)
    .replaceAll('{category}', values.category)
    .replaceAll('{competitor}', values.competitor ?? '');
}

/**
 * Construye los prompts de la auditoría para un perfil y un idioma.
 *
 * Los prompts `categorical` y `recommendation` NO nombran la marca (`mentionsBrand: false`):
 * miden si la marca emerge sola en su categoría. El prompt `comparative-vs` solo se incluye si
 * el perfil tiene al menos un competidor.
 */
export function buildPrompts(profile: BrandProfile, locale: Locale): AuditPrompt[] {
  const t = TEMPLATES[locale];
  const values = { brand: profile.name, category: profile.category };
  const competitor = profile.competitors[0];

  const prompts: AuditPrompt[] = [
    {
      id: 'definitional',
      intent: 'definitional',
      text: fill(t.definitional, values),
      mentionsBrand: true,
    },
    {
      id: 'evaluative',
      intent: 'evaluative',
      text: fill(t.evaluative, values),
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
    {
      id: 'recommendation',
      intent: 'recommendation',
      text: fill(t.recommendation, values),
      mentionsBrand: false,
    },
  ];

  if (competitor) {
    prompts.splice(3, 0, {
      id: 'comparative-vs',
      intent: 'comparative',
      text: fill(t.versus, { ...values, competitor }),
      mentionsBrand: true,
    });
  }

  return prompts;
}
