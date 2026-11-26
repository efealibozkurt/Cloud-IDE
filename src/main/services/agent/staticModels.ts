import type { BuiltinAIProviderId } from '@shared/types'

/**
 * Gemini'de seçim yapılmamışsa denenecek ve kullanılacak modeller, tercih sırasıyla; ilki varsayılandır.
 * Google eski modelleri yeni kullanıcılara kapatabildiği için sürüm çıkarmadan önce
 * https://ai.google.dev/gemini-api/docs/models adresinden doğrulayın.
 */
export const GEMINI_ONERILEN_MODELLER = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']

/** Önerilen modelleri listenin başına alır; kalanların sırası değişmez */
export function geminiModelleriniSirala(liste: string[]): string[] {
  const onerilen = GEMINI_ONERILEN_MODELLER.filter((m) => liste.includes(m))
  return [...onerilen, ...liste.filter((m) => !onerilen.includes(m))]
}

/** Canlı model listesi alınamadığında kullanılan çevrimdışı yedek model listeleri */
export const STATIK_MODELLER: Record<BuiltinAIProviderId, string[]> = {
  gemini: [...GEMINI_ONERILEN_MODELLER, 'gemini-3.1-flash-lite'],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'o1',
    'o1-mini',
    'o3-mini',
    'gpt-4-turbo'
  ],
  anthropic: [
    'claude-3-7-sonnet-latest',
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest',
    'claude-3-opus-latest',
    'claude-3-5-sonnet-20241022'
  ],
  deepseek: [
    'deepseek-chat',
    'deepseek-reasoner'
  ],
  kimi: [
    'kimi-k3',
    'kimi-k2.5',
    'kimi-latest',
    'kimi-k2-instruct',
    'kimi-k2.7-code',
    'moonshot-v1-auto',
    'moonshot-v1-128k',
    'moonshot-v1-32k',
    'moonshot-v1-8k'
  ],
  nvidia: [
    'moonshotai/kimi-k3',
    'meta/llama-3.3-70b-instruct',
    'deepseek-ai/deepseek-r1',
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'qwen/qwen2.5-coder-32b-instruct',
    'meta/llama-3.1-70b-instruct',
    'mistralai/mistral-large-2-instruct'
  ],
  lmstudio: [
    'local-model'
  ],
  ollama: []
}
