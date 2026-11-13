import { describe, expect, it } from 'vitest'
import { baslikTemizle } from './ChatCompactionService'

describe('baslikTemizle', () => {
  it('tırnak, nokta ve markdown işaretlerini temizler', () => {
    expect(baslikTemizle('"DHT22 ile sıcaklık okuma."')).toBe('DHT22 ile sıcaklık okuma')
    expect(baslikTemizle('**ESP32 Wi-Fi web sunucusu**')).toBe('ESP32 Wi-Fi web sunucusu')
    expect(baslikTemizle('# LED yakıp söndürme')).toBe('LED yakıp söndürme')
  })

  it('"Başlık:" önekini atar ve yalnızca ilk satırı alır', () => {
    expect(baslikTemizle('Başlık: Servo motor kontrolü\nAçıklama: bla bla')).toBe('Servo motor kontrolü')
  })

  it('düşünce bloklarını yok sayar', () => {
    expect(baslikTemizle('<think>önce düşünelim</think>\nLoRa verici kurulumu')).toBe('LoRa verici kurulumu')
  })

  it('boş ya da çok kısa çıktıda null döner', () => {
    expect(baslikTemizle('')).toBeNull()
    expect(baslikTemizle('  \n ')).toBeNull()
    expect(baslikTemizle('"."')).toBeNull()
  })

  it('çok uzun başlığı kısaltır', () => {
    const sonuc = baslikTemizle('a'.repeat(100)) ?? ''
    expect(sonuc.length).toBeLessThanOrEqual(60)
    expect(sonuc.endsWith('…')).toBe(true)
  })
})
