import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const { TMP } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mkdtempSync: mk } = require('fs') as typeof import('fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { tmpdir: td } = require('os') as typeof import('os')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join: j } = require('path') as typeof import('path')
  return { TMP: mk(j(td(), 'cloudide-rag-')) }
})

vi.mock('electron', () => ({ app: { getPath: () => TMP } }))

import { RagService } from './RagService'

const SERVO_H = `
#define SERVO_MIN 544
class Servo {
 public:
  Servo();
  uint8_t attach(int pin);
  void detach();
  void write(int value);
  int read();
  bool attached();
 private:
  void gizliYardimci(int x);
};
`
const NEOPIXEL_H = `
class Adafruit_NeoPixel {
 public:
  Adafruit_NeoPixel(uint16_t n, int16_t pin, neoPixelType type);
  void begin(void);
  void show(void);
  void setPixelColor(uint16_t n, uint8_t r, uint8_t g, uint8_t b);
  void setBrightness(uint8_t brightness);
  void clear(void);
};
`
const DHT_H = `
class DHT {
 public:
  DHT(uint8_t pin, uint8_t type);
  void begin(uint8_t usec = 55);
  float readTemperature(bool S = false, bool force = false);
  float readHumidity(bool force = false);
};
`

class SahteCli {
  constructor(private kutuphaneDizini: string) {}
  async listLibraries(): Promise<Array<{ name: string; version: string; installDir: string }>> {
    return [
      { name: 'Servo', version: '1.2.1', installDir: join(this.kutuphaneDizini, 'Servo') },
      { name: 'Adafruit NeoPixel', version: '1.12.0', installDir: join(this.kutuphaneDizini, 'Adafruit_NeoPixel') },
      { name: 'DHT sensor library', version: '1.4.6', installDir: join(this.kutuphaneDizini, 'DHT') }
    ]
  }
  async listExamples(): Promise<unknown[]> {
    return []
  }
}

let rag: RagService

beforeAll(async () => {
  const kutDir = mkdtempSync(join(tmpdir(), 'cloudide-libs-'))
  for (const [ad, h, dosya] of [
    ['Servo', SERVO_H, 'Servo.h'],
    ['Adafruit_NeoPixel', NEOPIXEL_H, 'Adafruit_NeoPixel.h'],
    ['DHT', DHT_H, 'DHT.h']
  ] as const) {
    mkdirSync(join(kutDir, ad, 'src'), { recursive: true })
    writeFileSync(join(kutDir, ad, 'src', dosya), h)
  }
  rag = new RagService(new SahteCli(kutDir) as never)
  // Yalnızca sözcük (BM25) aramasını sına: gömme modeli yüklenmesin
  ;(rag as unknown as { ensureModelLoaded: () => Promise<boolean> }).ensureModelLoaded = async () => false
  await rag.indexLibraryApis(10)
})

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true })
})

async function ilkler(sorgu: string, n = 3, board?: { fqbn?: string; name?: string }): Promise<string[]> {
  const sonuc = await rag.search(sorgu, board, n)
  return sonuc.map((s) => s.chunk.title)
}

describe('RagService (yalnızca sözcük araması)', () => {
  it('kütüphane API kayıtlarını indeksler ve private üyeleri dışarıda bırakır', async () => {
    const tumu = rag.listChunks('Servo')
    const servo = tumu.find((c) => c.title.startsWith('Servo kütüphanesi'))
    expect(servo).toBeDefined()
    expect(servo?.content).toContain('uint8_t attach(int pin)')
    expect(servo?.content).not.toContain('gizliYardimci')
    expect(servo?.content).toContain('#include <Servo.h>')
  })

  it('"Servo attach" aramasında Servo kütüphanesi ilk sıradadır', async () => {
    expect((await ilkler('Servo attach'))[0]).toMatch(/^Servo kütüphanesi/)
  })

  it('Türkçe sorguyla ("servo motoru açıya döndür") yine Servo gelir', async () => {
    expect(await ilkler('servo motoru açıya döndür')).toEqual(expect.arrayContaining([expect.stringMatching(/^Servo kütüphanesi/)]))
  })

  it('fonksiyon adıyla arama: setPixelColor → NeoPixel', async () => {
    expect((await ilkler('setPixelColor ile renk ayarla'))[0]).toMatch(/NeoPixel/)
  })

  it('camelCase fonksiyon parçalarıyla arama: "read temperature" → DHT', async () => {
    expect((await ilkler('read temperature'))[0]).toMatch(/DHT/)
  })

  it('hazır kart parçaları aranabilir: Deneyap IMU', async () => {
    expect(await ilkler('deneyap imu ivmeölçer jiroskop')).toEqual(expect.arrayContaining([expect.stringMatching(/IMU/)]))
  })

  it('hazır kart parçaları aranabilir: ESP32 Wi-Fi web sunucu', async () => {
    expect(await ilkler('esp32 wifi web sunucu')).toEqual(expect.arrayContaining([expect.stringMatching(/Wi-Fi/)]))
  })

  it('Türkçe karakter farkı sorun çıkarmaz: "kalici hafiza" → Preferences', async () => {
    expect(await ilkler('kalici hafiza kaydet')).toEqual(expect.arrayContaining([expect.stringMatching(/Kalıcı Hafıza/)]))
  })

  it('ilgisiz sorguda sonuç döndürmez (uydurma bağlam enjekte etmez)', async () => {
    expect(await ilkler('pizza tarifi nasıl yapılır')).toEqual([])
  })

  it('kaynak türü süzgeci: yalnızca kütüphane kayıtları', async () => {
    const sonuc = await rag.search('begin show', undefined, 5, { kinds: ['library'] })
    expect(sonuc.length).toBeGreaterThan(0)
    expect(sonuc.every((s) => s.chunk.kind === 'library')).toBe(true)
  })

  it('kart ailesi ayarı: ESP32 seçiliyken ESP32 parçası, AVR parçasının önüne geçer', async () => {
    const sonuc = await rag.search('flash hafıza değişken kaydet', { fqbn: 'esp32:esp32:esp32', name: 'ESP32 Dev Module' }, 5)
    const esp = sonuc.findIndex((s) => s.chunk.boardFamily === 'esp32')
    const avr = sonuc.findIndex((s) => s.chunk.boardFamily === 'avr')
    if (esp >= 0 && avr >= 0) expect(esp).toBeLessThan(avr)
    expect(esp).toBeGreaterThanOrEqual(0)
  })

  it('aynı kütüphane ikinci kez indekslenince kopya oluşmaz', async () => {
    const onceki = rag.getChunkCount()
    await rag.indexLibraryApis(10)
    expect(rag.getChunkCount()).toBe(onceki)
  })

  it('depo diske yazılır ve yeni bir örnek tarafından aynen okunur (ikili vektör dosyası dahil)', async () => {
    await rag.addCustomSkillChunk({
      id: 'k1',
      title: 'Röle modülü kuralı',
      type: 'rule',
      boardFamily: 'general',
      content: 'Röle sürerken transistör ve flyback diyot kullan.',
      updatedAt: Date.now()
    } as never)
    const ikinci = new RagService(undefined)
    ;(ikinci as unknown as { ensureModelLoaded: () => Promise<boolean> }).ensureModelLoaded = async () => false
    const sonuc = await ikinci.search('röle diyot', undefined, 3)
    expect(sonuc.some((s) => s.chunk.id === 'custom_k1')).toBe(true)
    expect(ikinci.getChunkCount()).toBe(rag.getChunkCount())
  })
})
