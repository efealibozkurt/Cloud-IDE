import type { AIProviderId } from '@shared/types'

/** Canlı model listesi alınamadığında kullanılan çevrimdışı yedek model listeleri */
export const STATIK_MODELLER: Record<AIProviderId, string[]> = {
  gemini: [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash-thinking-exp-01-21',
    'gemini-2.5-flash'
  ],
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
