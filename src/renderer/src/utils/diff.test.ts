import { describe, expect, it } from 'vitest'
import { baglamliFark, farkOzeti, satirFarki } from './diff'

describe('satirFarki', () => {
  it('aynı metinde değişiklik üretmez', () => {
    const f = satirFarki('a\nb\nc', 'a\nb\nc')
    expect(farkOzeti(f)).toEqual({ eklenen: 0, silinen: 0 })
  })

  it('tek satır değişikliğini bir silme ve bir ekleme olarak bulur', () => {
    const f = satirFarki('a\nb\nc', 'a\nX\nc')
    expect(farkOzeti(f)).toEqual({ eklenen: 1, silinen: 1 })
    expect(f.find((s) => s.tur === 'silindi')?.metin).toBe('b')
    expect(f.find((s) => s.tur === 'eklendi')?.metin).toBe('X')
  })

  it('yeni dosyada tüm satırlar eklenmiş sayılır', () => {
    const f = satirFarki('', 'a\nb')
    expect(farkOzeti(f)).toEqual({ eklenen: 2, silinen: 0 })
  })

  it('CRLF farkını yok sayar', () => {
    const f = satirFarki('a\r\nb', 'a\nb')
    expect(farkOzeti(f)).toEqual({ eklenen: 0, silinen: 0 })
  })

  it('satır numaralarını doğru verir', () => {
    const f = satirFarki('a\nb\nc', 'a\nc')
    const silinen = f.find((s) => s.tur === 'silindi')
    expect(silinen?.eskiNo).toBe(2)
    expect(f[f.length - 1]).toMatchObject({ tur: 'ayni', metin: 'c', eskiNo: 3, yeniNo: 2 })
  })
})

describe('baglamliFark', () => {
  it('uzun değişmeyen bölümü kısaltır', () => {
    const eski = Array.from({ length: 30 }, (_, i) => `s${i}`).join('\n')
    const yeni = eski.replace('s15', 'DEGISTI')
    const k = baglamliFark(satirFarki(eski, yeni), 2)
    expect(k.some((x) => 'atlanan' in x)).toBe(true)
    expect(k.length).toBeLessThan(15)
  })
})
