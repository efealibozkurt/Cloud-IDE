import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * Gerçek e5 gömme modeli ve uygulamanın kendi RAG deposuyla isabet kalitesi ölçümü.
 * Yalnızca isteğe bağlı çalışır:  RAG_GERCEK=1 npx vitest run src/main/services/RagService.gercek.test.ts
 * (Uygulamanın veri klasöründeki model önbelleği ve rag_store.json gerekir; depo geçici klasöre kopyalanır.)
 */
const GERCEK_VERI = process.env.RAG_VERI_KLASORU ?? join(process.env.APPDATA ?? '', 'Cloud IDE')
const CALISTIR = Boolean(process.env.RAG_GERCEK) && existsSync(join(GERCEK_VERI, 'rag_store.json'))

const { TMP } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mkdtempSync: mk } = require('fs') as typeof import('fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { tmpdir: td } = require('os') as typeof import('os')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join: j } = require('path') as typeof import('path')
  return { TMP: mk(j(td(), 'cloudide-ragreal-')) }
})
vi.mock('electron', () => ({ app: { getPath: () => TMP } }))

import { RagService } from './RagService'

interface Sorgu {
  sorgu: string
  /** İlk 5 sonucun başlık+içeriğinde geçmesi beklenen ifade (küçük harf) */
  beklenen: RegExp | null
}

const SORGULAR: Sorgu[] = [
  { sorgu: 'LoRa ile veri gönder', beklenen: /lora/i },
  { sorgu: 'SPI ile SD karttan dosya oku', beklenen: /\bSD\b/ },
  { sorgu: 'ESP32 derin uyku moduna al', beklenen: /sleep/i },
  { sorgu: 'OLED ekrana yazı yazdır', beklenen: /oled|ssd1306|u8g2|display/i },
  { sorgu: 'servo motoru 90 dereceye çevir', beklenen: /servo/i },
  { sorgu: 'WiFi ağına bağlan', beklenen: /wifi/i },
  { sorgu: 'Bluetooth BLE cihaz tara', beklenen: /ble|bluetooth/i },
  { sorgu: 'butona basılınca LED yak', beklenen: /button|buton|digitalRead/i },
  { sorgu: 'potansiyometre ile analog değer oku', beklenen: /analogRead/i },
  { sorgu: 'RGB LED rengini değiştir', beklenen: /rgb/i },
  { sorgu: 'kalıcı hafızaya değer kaydet', beklenen: /preferences|eeprom/i },
  { sorgu: 'Deneyap kartın ivmeölçer sensörünü oku', beklenen: /imu|accel/i },
  { sorgu: 'sıcaklık ve nem sensörü oku', beklenen: /temperature|humidity|sıcaklık|dht/i },
  { sorgu: 'step motoru sür', beklenen: /step|motor/i },
  { sorgu: 'ultrasonik sensörle mesafe ölç', beklenen: /ultrason|mesafe|distance|trig/i },
  { sorgu: 'röleyi aç kapat', beklenen: /röle|relay/i },
  { sorgu: 'seri porttan veri oku', beklenen: /serial/i },
  { sorgu: 'zamanlayıcı kesmesi kur', beklenen: /timer|interrupt|kesme/i },
  { sorgu: 'ışık yak', beklenen: /led|ışık/i },
  { sorgu: 'pizza tarifi nasıl yapılır', beklenen: null },
  { sorgu: 'futbol maçı skoru kaç', beklenen: null },
  { sorgu: 'bana bir şiir yaz', beklenen: null },
  { sorgu: 'ikinci dereceden denklemi çöz', beklenen: null },
  { sorgu: 'Ankara nüfusu ne kadar', beklenen: null }
]

let rag: RagService

beforeAll(() => {
  if (!CALISTIR) return
  // Gerçek depoyu geçici klasöre kopyala (testin depoya yazması riskini sıfırlar); modeli gerçek klasörden oku
  for (const d of ['rag_store.json', 'rag_vectors.bin']) {
    if (existsSync(join(GERCEK_VERI, d))) copyFileSync(join(GERCEK_VERI, d), join(TMP, d))
  }
  mkdirSync(join(TMP, 'models'), { recursive: true })
  rag = new RagService(undefined)
  // Model önbelleği gerçek klasörde: cacheDir'i oraya yönlendir
  ;(rag as unknown as { ensureModelLoaded: () => Promise<boolean> }).ensureModelLoaded = (async () => {
    const { pipeline, env } = await import('@xenova/transformers')
    env.cacheDir = join(GERCEK_VERI, 'models')
    const r = rag as unknown as { extractor: unknown }
    if (!r.extractor) r.extractor = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', { quantized: true })
    return true
  }) as () => Promise<boolean>
})

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true })
  void mkdtempSync
  void tmpdir
})

describe.skipIf(!CALISTIR)('RagService gerçek model ile isabet kalitesi', () => {
  it(
    'tipik görev sorgularında beklenen kayıt ilk 5 sonuçta yer alır',
    async () => {
      let isabet = 0
      let olcul = 0
      const satirlar: string[] = []
      for (const { sorgu, beklenen } of SORGULAR) {
        const ic = rag as unknown as { embedText: (t: string, k: string) => Promise<Float32Array | null>; chunks: Array<{ embedding?: Float32Array }> }
        const qv = await ic.embedText(sorgu, 'query')
        const kosinler = ic.chunks.map((c) => (c.embedding && qv ? c.embedding.reduce((t, v, i) => t + v * qv[i], 0) : 0)).sort((a, b) => b - a)
        satirlar.push(`COS  | ${sorgu} | en iyi ${kosinler[0]?.toFixed(3)} | 5. ${kosinler[4]?.toFixed(3)} | 20. ${kosinler[19]?.toFixed(3)}`)
        const sonuc = await rag.search(sorgu, undefined, 5)
        const metinler = sonuc.map((s) => `${s.chunk.title}\n${s.chunk.content}`)
        const ilkler = sonuc.slice(0, 3).map((s) => s.chunk.title.slice(0, 60))
        if (beklenen === null) {
          satirlar.push(`${sonuc.length === 0 ? 'OK  ' : 'FAZLA'} | ${sorgu} | ${sonuc.length} sonuç`)
          expect(sonuc.length, `ilgisiz sorguya sonuç döndü: ${sorgu}`).toBe(0)
          continue
        }
        olcul++
        const bulundu = metinler.some((m) => beklenen.test(m))
        if (bulundu) isabet++
        satirlar.push(`${bulundu ? 'OK  ' : 'KAÇTI'} | ${sorgu} | ${sonuc.length} sonuç | ${ilkler.join(' || ')}`)
      }
      console.log('\n' + satirlar.join('\n') + `\n\nİsabet: ${isabet}/${olcul}`)
      expect(isabet / olcul).toBeGreaterThanOrEqual(0.8)
    },
    300_000
  )
})
