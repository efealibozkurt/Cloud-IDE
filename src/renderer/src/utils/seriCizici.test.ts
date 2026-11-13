import { describe, expect, it } from 'vitest'
import { seriOrnekleriniTopla, seriSatiriniAyristir } from './seriCizici'

describe('seriSatiriniAyristir', () => {
  it('tek sayıyı okur', () => {
    expect(seriSatiriniAyristir('512')).toEqual([{ ad: '1', deger: 512 }])
    expect(seriSatiriniAyristir(' -3.5 ')).toEqual([{ ad: '1', deger: -3.5 }])
  })
  it('virgül, boşluk ve sekmeyle ayrılmış sayıları sıra numaralı seri yapar', () => {
    expect(seriSatiriniAyristir('10, 20, 30')).toEqual([
      { ad: '1', deger: 10 },
      { ad: '2', deger: 20 },
      { ad: '3', deger: 30 }
    ])
    expect(seriSatiriniAyristir('1\t2')).toHaveLength(2)
  })
  it('etiketli değerleri okur (Türkçe harfler ve ondalık virgül dahil)', () => {
    expect(seriSatiriniAyristir('sıcaklık:23.5 nem=60')).toEqual([
      { ad: 'sıcaklık', deger: 23.5 },
      { ad: 'nem', deger: 60 }
    ])
    expect(seriSatiriniAyristir('Isı: 21,5')).toEqual([{ ad: 'Isı', deger: 21.5 }])
  })
  it('birim eki olan değeri etiketli biçimde okur, düz metni yok sayar', () => {
    expect(seriSatiriniAyristir('Mesafe: 12.5 cm')).toEqual([{ ad: 'Mesafe', deger: 12.5 }])
    expect(seriSatiriniAyristir('Sistem basladi')).toEqual([])
    expect(seriSatiriniAyristir('')).toEqual([])
    expect(seriSatiriniAyristir('rst:0x1 (POWERON_RESET)')).toEqual([])
  })
})

describe('seriOrnekleriniTopla', () => {
  it('serileri toplar ve son N örneği tutar', () => {
    const s = seriOrnekleriniTopla(['a:1', 'a:2', 'a:3', 'b:9'], 2)
    expect(s.find((x) => x.ad === 'a')?.noktalar).toEqual([2, 3])
    expect(s.find((x) => x.ad === 'b')?.noktalar).toEqual([9])
  })
})
