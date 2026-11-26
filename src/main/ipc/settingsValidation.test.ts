import { describe, expect, it } from 'vitest'
import { ayarDegeriniDogrula } from './settingsValidation'

describe('ayarDegeriniDogrula', () => {
  it('geçerli değerleri kabul eder', () => {
    expect(() => ayarDegeriniDogrula('agentPermissionMode', 'ask')).not.toThrow()
    expect(() => ayarDegeriniDogrula('editorFontSize', 14)).not.toThrow()
    expect(() => ayarDegeriniDogrula('aiBaseUrls', { ollama: 'http://localhost:11434' })).not.toThrow()
  })

  it('bilinmeyen anahtarı reddeder', () => {
    expect(() => ayarDegeriniDogrula('__proto__', {})).toThrow()
    expect(() => ayarDegeriniDogrula('evil', 1)).toThrow()
  })

  it('geçersiz izin modunu reddeder', () => {
    expect(() => ayarDegeriniDogrula('agentPermissionMode', 'root')).toThrow()
  })

  it('bulut sağlayıcıda http adresini reddeder (API anahtarı sızmasın)', () => {
    expect(() => ayarDegeriniDogrula('aiBaseUrls', { openai: 'http://evil.example' })).toThrow()
    expect(() => ayarDegeriniDogrula('aiBaseUrls', { openai: 'https://proxy.example/v1' })).not.toThrow()
  })

  it('özel sağlayıcıyı kabul eder, güvensiz adresi ve bozuk kimliği reddeder', () => {
    const s = { id: 'ozel-abcd1234', name: 'Sunucum', baseUrl: 'https://a.example/v1' }
    expect(() => ayarDegeriniDogrula('customAiProviders', [s])).not.toThrow()
    expect(() => ayarDegeriniDogrula('selectedAiProvider', s.id)).not.toThrow()
    expect(() => ayarDegeriniDogrula('selectedModelPerProvider', { [s.id]: 'model' })).not.toThrow()
    expect(() => ayarDegeriniDogrula('customAiProviders', [{ ...s, baseUrl: 'http://evil.example' }])).toThrow()
    expect(() => ayarDegeriniDogrula('customAiProviders', [{ ...s, id: 'openai' }])).toThrow()
    expect(() => ayarDegeriniDogrula('customAiProviders', [{ ...s, name: '  ' }])).toThrow()
    expect(() => ayarDegeriniDogrula('customAiProviders', [s, s])).toThrow()
  })

  it('bilinmeyen sağlayıcı anahtarını reddeder', () => {
    expect(() => ayarDegeriniDogrula('customContextLimits', { foo: 4096 })).toThrow()
  })
})
