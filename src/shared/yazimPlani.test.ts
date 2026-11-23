import { describe, expect, it } from 'vitest'
import { satirTaramaPlani, taramaPlaniUygula, yazimPlani } from './yazimPlani'

/** Planı eski içeriğe uygulayıp sonucu verir; hedefle eşit çıkmalı */
function uygula(onceki: string, hedef: string): string {
  const p = yazimPlani(onceki, hedef)
  return onceki.slice(0, p.onekUzunlugu) + p.yeniOrta + onceki.slice(p.onekUzunlugu + p.eskiOrtaUzunlugu)
}

describe('yazimPlani', () => {
  const durumlar: Array<[string, string, string]> = [
    ['sonuna satır ekleme', 'a\nb\n', 'a\nb\nc\n'],
    ['ortadan satır değiştirme', 'a\nb\nc\n', 'a\nX\nc\n'],
    ['baştan ekleme', 'b\nc', 'a\nb\nc'],
    ['tamamen farklı', 'abc', 'xyz'],
    ['boş dosyaya yazma', '', 'void setup() {}\n'],
    ['dosyayı boşaltma', 'a\nb', ''],
    ['aynı içerik', 'a\nb', 'a\nb'],
    ['satır içi değişiklik', 'int a = 1;\nint b = 2;\n', 'int a = 1;\nint b = 3;\n'],
    ['tekrarlayan satırlar', 'x\nx\nx\n', 'x\nx\nx\nx\n']
  ]
  for (const [ad, a, b] of durumlar) {
    it(ad, () => {
      expect(uygula(a, b)).toBe(b)
    })
  }

  it('değişmeyen başlangıç satır başına hizalanır', () => {
    const p = yazimPlani('abc\ndef\n', 'abc\ndXf\n')
    expect(p.onekUzunlugu).toBe(4)
  })
})

describe('satirTaramaPlani', () => {
  const durumlar: Array<[string, string, string]> = [
    ['sonuna satır ekleme', 'a\nb\n', 'a\nb\nc\n'],
    ['baştan ekleme', 'b\nc', 'a\nb\nc'],
    ['ortadan satır değiştirme', 'a\nb\nc\n', 'a\nX\nc\n'],
    ['boş dosyaya yazma', '', 'void setup() {}\n'],
    ['dosyayı boşaltma', 'a\nb', ''],
    ['aynı içerik', 'a\nb', 'a\nb'],
    ['CRLF girişleri', 'int a = 1;\r\nint b = 2;\r\n', 'int a = 1;\r\nint b = 3;\r\nint c = 4;\r\n'],
    ['tekrarlayan satırlar', 'x\nx\nx\n', 'x\nx\nx\nx\n']
  ]

  for (const [ad, onceki, hedef] of durumlar) {
    it(ad, () => {
      const plan = satirTaramaPlani(onceki, hedef)
      expect(taramaPlaniUygula(onceki, plan)).toBe(hedef.replace(/\r\n/g, '\n'))
    })
  }

  it('aynı içerik için boş plan döner', () => {
    const plan = satirTaramaPlani('void setup() {}', 'void setup() {}')
    expect(plan.adimlar).toHaveLength(0)
    expect(plan.degisenSatirSayisi).toBe(0)
  })

  it('çoklu hunk arasında değişmeyen satırları gec adımı olarak korur', () => {
    const onceki = ['satir1', 'eskiA', 'ortak1', 'ortak2', 'eskiB', 'satirSon'].join('\n')
    const hedef = ['satir1', 'yeniA', 'ortak1', 'ortak2', 'yeniB', 'satirSon'].join('\n')
    const plan = satirTaramaPlani(onceki, hedef)

    expect(plan.baslangicSatiri).toBe(2)
    expect(plan.adimlar).toEqual([
      { tur: 'degistir', eski: 'eskiA', yeni: 'yeniA' },
      { tur: 'gec', satir: 'ortak1' },
      { tur: 'gec', satir: 'ortak2' },
      { tur: 'degistir', eski: 'eskiB', yeni: 'yeniB' }
    ])
    expect(taramaPlaniUygula(onceki, plan)).toBe(hedef)
  })

  it('1 satırı 4 satırla değiştirirken 1 degistir + 3 ekle üretir', () => {
    const onceki = 'bas\neski\nson'
    const hedef = 'bas\ny1\ny2\ny3\ny4\nson'
    const plan = satirTaramaPlani(onceki, hedef)

    expect(plan.adimlar).toEqual([
      { tur: 'degistir', eski: 'eski', yeni: 'y1' },
      { tur: 'ekle', yeni: 'y2' },
      { tur: 'ekle', yeni: 'y3' },
      { tur: 'ekle', yeni: 'y4' }
    ])
    expect(taramaPlaniUygula(onceki, plan)).toBe(hedef)
  })

  it('4 satırı 1 satırla değiştirirken 1 degistir + 3 sil üretir', () => {
    const onceki = 'bas\ne1\ne2\ne3\ne4\nson'
    const hedef = 'bas\ny1\nson'
    const plan = satirTaramaPlani(onceki, hedef)

    expect(plan.adimlar).toEqual([
      { tur: 'degistir', eski: 'e1', yeni: 'y1' },
      { tur: 'sil', eski: 'e2' },
      { tur: 'sil', eski: 'e3' },
      { tur: 'sil', eski: 'e4' }
    ])
    expect(taramaPlaniUygula(onceki, plan)).toBe(hedef)
  })

  it('büyük dosyalarda (M * N > 250000) fallback yoluyla hatasız çalışır', () => {
    const eski = Array.from({ length: 600 }, (_, i) => `eski_${i}`).join('\n')
    const yeni = Array.from({ length: 600 }, (_, i) => `yeni_${i}`).join('\n')
    const plan = satirTaramaPlani(eski, yeni)

    expect(plan.degisenSatirSayisi).toBe(600)
    expect(taramaPlaniUygula(eski, plan)).toBe(yeni)
  })
})
