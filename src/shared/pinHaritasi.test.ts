import { describe, expect, it } from 'vitest'
import { pinHaritasi } from './pinHaritasi'

const pinler = (fqbn: string) => pinHaritasi(fqbn)!.gruplar.flatMap((g) => g.pinler)
const ozellikli = (fqbn: string, oz: string) => pinler(fqbn).filter((p) => (p.ozellikler as string[]).includes(oz)).map((p) => p.numara)

describe('pinHaritasi', () => {
  it('bilinmeyen kart için null döner', () => {
    expect(pinHaritasi(null)).toBeNull()
    expect(pinHaritasi('rp2040:rp2040:rpipico')).toBeNull()
    expect(pinHaritasi('esp32:esp32:esp32s3')).toBeNull()
  })

  it('Uno: PWM, kesme, I2C ve analog pinleri doğru', () => {
    const f = 'arduino:avr:uno'
    expect(ozellikli(f, 'pwm')).toEqual([3, 5, 6, 9, 10, 11])
    expect(ozellikli(f, 'kesme')).toEqual([2, 3])
    expect(ozellikli(f, 'i2c')).toEqual([18, 19]) // A4, A5
    expect(ozellikli(f, 'adc')).toEqual([14, 15, 16, 17, 18, 19])
    expect(pinler(f).find((p) => p.numara === 14)?.etiket).toBe('A0')
  })

  it('Nano: A6/A7 yalnızca giriş', () => {
    expect(ozellikli('arduino:avr:nano', 'sadece-giris')).toEqual([20, 21])
  })

  it('Mega: 54 dijital + 16 analog pin, PWM 2–13 ve 44–46', () => {
    const f = 'arduino:avr:mega'
    expect(pinler(f)).toHaveLength(54 + 16)
    expect(ozellikli(f, 'pwm')).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 44, 45, 46])
  })

  it('ESP32: flash pinleri işaretli, 34–39 yalnızca giriş ve PWM yok, DAC 25/26', () => {
    const f = 'esp32:esp32:esp32'
    expect(ozellikli(f, 'flash')).toEqual([6, 7, 8, 9, 10, 11])
    expect(ozellikli(f, 'sadece-giris')).toEqual([34, 35, 36, 37, 38, 39])
    expect(ozellikli(f, 'pwm')).not.toContain(34)
    expect(ozellikli(f, 'dac')).toEqual([25, 26])
    expect(ozellikli(f, 'i2c')).toEqual([21, 22])
  })

  it('pin denetimi ile tutarlı: haritada flash olan her pin denetimde hata verir', async () => {
    const { pinleriDenetle } = await import('./pinCheck')
    for (const p of ozellikli('esp32:esp32:esp32', 'flash')) {
      const sorun = pinleriDenetle([{ dosya: 'a.ino', icerik: `void setup(){ pinMode(${p}, OUTPUT); }` }], 'esp32:esp32:esp32')
      expect(sorun.some((s) => s.tur === 'error')).toBe(true)
    }
  })

  it('ESP8266: NodeMCU takma adları, GPIO16 kesme/PWM yok, A0', () => {
    const f = 'esp8266:esp8266:nodemcuv2'
    expect(pinler(f).find((p) => p.numara === 4)?.etiket).toBe('GPIO4 (D2)')
    expect(ozellikli(f, 'pwm')).not.toContain(16)
    expect(ozellikli(f, 'kesme')).not.toContain(16)
    expect(ozellikli(f, 'adc')).toEqual([17])
    expect(ozellikli(f, 'flash')).toEqual([6, 7, 8, 9, 10, 11])
  })
})
