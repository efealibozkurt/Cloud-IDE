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

  it('bilinmeyen sağlayıcı anahtarını reddeder', () => {
    expect(() => ayarDegeriniDogrula('customContextLimits', { foo: 4096 })).toThrow()
  })
})
