import 'server-only';

import type { Engine } from './base';
import type { EngineConfig } from './env';
import { createOpenAICompatibleEngine, labelFromModel } from './openai-compatible';

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Headers opcionales de atribución que OpenRouter usa para rankings.
 * Configurables por env; no son obligatorios para que la llamada funcione.
 */
const REFERER = process.env.OPENROUTER_SITE_URL ?? 'https://aeo-geo-auditor.vercel.app';
const TITLE = process.env.OPENROUTER_SITE_NAME ?? 'AEO/GEO Auditor';

/**
 * Crea un motor que habla con la API OpenAI-compatible de OpenRouter (modelos `:free`).
 * La lógica de request/response vive en {@link createOpenAICompatibleEngine}.
 */
export function createOpenRouterEngine(config: EngineConfig): Engine {
  return createOpenAICompatibleEngine({
    engineId: 'openrouter',
    label: labelFromModel(config.model),
    model: config.model,
    url: API_URL,
    providerName: 'OpenRouter',
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      'HTTP-Referer': REFERER,
      'X-Title': TITLE,
    },
  });
}
