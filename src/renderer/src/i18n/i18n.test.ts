import { describe, expect, it } from 'vitest'
import { cevir } from './index'
import { EN } from './en'

describe('cevir', () => {
  it('Türkçede metni aynen döndürür', () => {
    expect(cevir('Derle', undefined, 'tr')).toBe('Derle')
  })
  it('İngilizce karşılığı varsa onu döndürür', () => {
    expect(cevir('Derle', undefined, 'en')).toBe('Build')
  })
  it('çeviri yoksa Türkçe metne düşer', () => {
    expect(cevir('Olmayan metin', undefined, 'en')).toBe('Olmayan metin')
  })
  it('yer tutucuları doldurur', () => {
    expect(cevir('{n} güncelleme var', { n: 3 }, 'en')).toBe('3 update(s) available')
    expect(cevir('{n} güncelleme var', { n: 3 }, 'tr')).toBe('3 güncelleme var')
  })
  it('sözlük değerleri boş değildir', () => {
    for (const [k, v] of Object.entries(EN)) expect(v.trim(), k).not.toBe('')
  })
})
