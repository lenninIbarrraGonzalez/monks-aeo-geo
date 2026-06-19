import 'server-only';

import type { Engine } from './base';
import type { EngineConfig } from './env';
import { createOpenAICompatibleEngine, labelFromModel } from './openai-compatible';

const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Crea un motor que habla con la API OpenAI-compatible de Groq (free tier, sin tarjeta).
 * La lógica de request/response vive en {@link createOpenAICompatibleEngine}.
 */
export function createGroqEngine(config: EngineConfig): Engine {
  return createOpenAICompatibleEngine({
    engineId: 'groq',
    label: labelFromModel(config.model),
    model: config.model,
    url: API_URL,
    providerName: 'Groq',
    headers: {
      authorization: `Bearer ${config.apiKey}`,
    },
  });
}
