import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SecretsService } from '../SecretsService'
import type { SettingsService } from '../SettingsService'
import { saglayiciyiSina } from './models'
import { resolveProvider } from './providers'

const ID = 'ozel-test1234'

function ayarlar(baseUrl: string): SettingsService {
  return {
    get: (anahtar: string) => (anahtar === 'customAiProviders' ? [{ id: ID, name: 'Deneme', baseUrl }] : undefined)
  } as unknown as SettingsService
}

function anahtar(deger: string | null): SecretsService {
  return { getDecryptedApiKey: () => deger } as unknown as SecretsService
}

describe('özel sağlayıcı', () => {
  let sunucu: Server
  let adres = ''

  beforeAll(async () => {
    // Model listesi vermeyen OpenAI uyumlu sunucu
    sunucu = createServer((req, res) => {
      if (req.url?.endsWith('/models')) {
        res.writeHead(404)
        res.end()
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: 'tamam' } }] })}\n\n`)
      res.end('data: [DONE]\n\n')
    })
    await new Promise<void>((r) => sunucu.listen(0, '127.0.0.1', r))
    adres = `http://127.0.0.1:${(sunucu.address() as AddressInfo).port}`
  })

  afterAll(() => {
    sunucu.close()
  })

  it('adresi tanımdan alır ve OpenAI uyumlu çözümlenir', () => {
    const p = resolveProvider(ID, 'm', anahtar('k'), ayarlar('https://a.example'))
    expect(p).toMatchObject({ kind: 'openai', baseUrl: 'https://a.example/v1', apiKey: 'k', isLocal: false })
  })

  it('internetteki sunucu anahtarsız çözümlenmez; silinmiş sağlayıcı anlaşılır hata verir', () => {
    expect(() => resolveProvider(ID, 'm', anahtar(null), ayarlar('https://a.example'))).toThrow(/API anahtarı/)
    expect(() => resolveProvider('ozel-yok00000', 'm', anahtar('k'), ayarlar('https://a.example'))).toThrow(/artık tanımlı değil/)
  })

  it('model listesi vermeyen yerel sunucu elle yazılan modelle sınanabilir', async () => {
    const sonuc = await saglayiciyiSina(ID, 'elle-model', anahtar(null), ayarlar(adres))
    expect(sonuc.ok).toBe(true)
  })
})
