import { describe, expect, it } from 'vitest'
import {
  isCustomProvider,
  isValidCustomProviderUrl,
  newCustomProviderId,
  providersLosingKey,
  type CustomAIProvider
} from './ozelSaglayici'

const a: CustomAIProvider = { id: 'ozel-aaaa1111', name: 'A', baseUrl: 'https://a.example/v1' }
const b: CustomAIProvider = { id: 'ozel-bbbb2222', name: 'B', baseUrl: 'https://b.example/v1' }

describe('özel sağlayıcı', () => {
  it('üretilen kimlik geçerlidir; hazır sağlayıcılar özel sayılmaz', () => {
    expect(isCustomProvider(newCustomProviderId())).toBe(true)
    expect(isCustomProvider('openai')).toBe(false)
    expect(isCustomProvider('ozel-__proto__')).toBe(false)
  })

  it('internette yalnızca https, http yalnızca bu bilgisayarda kabul edilir', () => {
    expect(isValidCustomProviderUrl('https://openrouter.ai/api/v1')).toBe(true)
    expect(isValidCustomProviderUrl('http://localhost:8000/v1')).toBe(true)
    expect(isValidCustomProviderUrl('http://127.0.0.1:8000')).toBe(true)
    expect(isValidCustomProviderUrl('http://evil.example/v1')).toBe(false)
    expect(isValidCustomProviderUrl('http://127.0.0.1.evil.example')).toBe(false)
    expect(isValidCustomProviderUrl('https://kullanici:sifre@a.example')).toBe(false)
    expect(isValidCustomProviderUrl('a.example')).toBe(false)
  })

  it('silinen ya da sunucusu değişen sağlayıcının anahtarı silinir', () => {
    expect(providersLosingKey([a, b], [a])).toEqual([b.id])
    expect(providersLosingKey([a], [{ ...a, baseUrl: 'https://baska.example/v1' }])).toEqual([a.id])
    expect(providersLosingKey([a], [{ ...a, name: 'Yeni ad', baseUrl: 'https://a.example/api/v1' }])).toEqual([])
  })
})
