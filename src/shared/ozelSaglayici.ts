// Kullanıcının eklediği (OpenAI uyumlu) yapay zekâ sağlayıcıları

export type CustomAIProviderId = `ozel-${string}`

export interface CustomAIProvider {
  id: CustomAIProviderId
  name: string
  baseUrl: string
}

export const MAX_CUSTOM_PROVIDERS = 10

/** Formdaki hazır şablonlar; adres elle de değiştirilebilir */
export const CUSTOM_PROVIDER_TEMPLATES = [
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
  { name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1' },
  { name: 'Together', baseUrl: 'https://api.together.xyz/v1' }
] as const

export function isCustomProvider(id: unknown): id is CustomAIProviderId {
  return typeof id === 'string' && /^ozel-[a-z0-9]{4,16}$/.test(id)
}

export function newCustomProviderId(): CustomAIProviderId {
  return `ozel-${Math.random().toString(36).slice(2, 10).padEnd(8, '0')}`
}

/** Adres bu bilgisayarın kendisini mi gösteriyor? */
export function isLoopbackUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return host === 'localhost' || host === '[::1]' || /^127(\.\d{1,3}){3}$/.test(host)
  } catch {
    return false
  }
}

/**
 * API anahtarı bu adrese gönderileceği için internet sunucularında yalnızca https kabul edilir;
 * http yalnızca bu bilgisayardaki sunucular içindir.
 */
export function isValidCustomProviderUrl(url: string): boolean {
  if (url.length > 300) return false
  try {
    const u = new URL(url)
    if (u.username || u.password) return false
    return u.protocol === 'https:' || (u.protocol === 'http:' && isLoopbackUrl(url))
  } catch {
    return false
  }
}

function origin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

/**
 * Silinen ya da sunucusu değişen sağlayıcılar: kayıtlı anahtarları silinmelidir,
 * yoksa eski anahtar yeni adrese gönderilir.
 */
export function providersLosingKey(
  eski: readonly CustomAIProvider[],
  yeni: readonly CustomAIProvider[]
): CustomAIProviderId[] {
  return eski
    .filter((e) => {
      const karsilik = yeni.find((y) => y.id === e.id)
      return !karsilik || origin(karsilik.baseUrl) !== origin(e.baseUrl)
    })
    .map((e) => e.id)
}
