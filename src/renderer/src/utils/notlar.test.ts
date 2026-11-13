import { describe, expect, it } from 'vitest'
import { koddanOzetBlogu, kutuIlerlemesi, kutuphaneBaslikliklariniBul, kutuyuDegistir, notSatirlariniAyir } from './notlar'

describe('notSatirlariniAyir', () => {
  it('başlık, kutu, madde ve düz satırları ayırt eder', () => {
    const s = notSatirlariniAyir('# Başlık\n## Alt\n- madde\n- [ ] yap\n- [x] bitti\n\nmetin')
    expect(s.map((x) => x.tur)).toEqual(['baslik1', 'baslik2', 'madde', 'kutu', 'kutu', 'bos', 'metin'])
    expect(s[3]).toMatchObject({ tur: 'kutu', isaretli: false, satir: 3, metin: 'yap' })
    expect(s[4]).toMatchObject({ isaretli: true, satir: 4 })
  })
  it('CRLF satır sonlarını tanır', () => {
    expect(notSatirlariniAyir('- [ ] a\r\n- [x] b').map((x) => x.tur)).toEqual(['kutu', 'kutu'])
  })
})

describe('kutuyuDegistir', () => {
  it('işaretler ve işareti kaldırır', () => {
    const m = '- [ ] a\n- [x] b'
    expect(kutuyuDegistir(m, 0)).toBe('- [x] a\n- [x] b')
    expect(kutuyuDegistir(m, 1)).toBe('- [ ] a\n- [ ] b')
  })
  it('kutu olmayan ya da olmayan satırda metni değiştirmez', () => {
    expect(kutuyuDegistir('- madde', 0)).toBe('- madde')
    expect(kutuyuDegistir('a', 5)).toBe('a')
  })
})

describe('kutuIlerlemesi', () => {
  it('yapılan ve toplamı sayar', () => {
    expect(kutuIlerlemesi('- [x] a\n- [ ] b\n- [ ] c\n- d')).toEqual({ yapilan: 1, toplam: 3 })
    expect(kutuIlerlemesi('yok')).toEqual({ yapilan: 0, toplam: 0 })
  })
})

describe('kutuphaneBaslikliklariniBul', () => {
  it('gömülü başlıkları atar, tekrarları birleştirir, klasörlü başlıkta dosya adını alır', () => {
    const kod = '#include <Wire.h>\n#include <Servo.h>\n#include <Adafruit/Adafruit_NeoPixel.h>\n// #include <Yorum.h>\n#include <Servo.h>'
    expect(kutuphaneBaslikliklariniBul([kod])).toEqual(['Adafruit_NeoPixel.h', 'Servo.h'])
  })
})

describe('koddanOzetBlogu', () => {
  it('kart, kütüphane ve pinleri yazar', () => {
    const b = koddanOzetBlogu(['Servo.h'], [{ pin: 9, roller: ['Servo'] }], 'arduino:avr:uno', new Date(2026, 0, 5))
    expect(b).toContain('## Koddan çıkarıldı')
    expect(b).toContain('- Kart: arduino:avr:uno')
    expect(b).toContain('- Kütüphaneler: Servo.h')
    expect(b).toContain('  - 9: Servo')
  })
  it('hiçbir şey bulunamazsa bunu söyler', () => {
    expect(koddanOzetBlogu([], [], null)).toContain('bulunamadı')
  })
})
