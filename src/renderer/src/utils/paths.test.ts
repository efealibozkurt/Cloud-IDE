import { describe, expect, it } from 'vitest'
import { ayniDosyaMi, normalizeYol } from './paths'

describe('paths', () => {
  it('ayraç yönü ve büyük/küçük harf farkını yok sayar', () => {
    expect(ayniDosyaMi(String.raw`C:\Users\Kullanici\Blink\Blink.ino`, 'c:/users/kullanici/blink/blink.ino')).toBe(true)
  })

  it('farklı dosyaları ayırır', () => {
    expect(ayniDosyaMi('C:/a/b.ino', 'C:/a/c.ino')).toBe(false)
  })

  it('baştaki / işaretini atar', () => {
    expect(normalizeYol('/C:/a')).toBe('c:/a')
  })
})
