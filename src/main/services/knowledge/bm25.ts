const TR_HARITA: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i̇: 'i', ö: 'o', ş: 's', ü: 'u' }

const DURAK_KELIMELER = new Set([
  've', 'ile', 'bir', 'bu', 'su', 'icin', 'de', 'da', 'mi', 'the', 'and', 'for', 'with', 'how', 'to', 'of', 'in', 'is', 'a', 'an',
  // Soru ve işlev kelimeleri: korpusta nadir olduklarından yüksek puan almamalı
  'nasil', 'nedir', 'neden', 'kac', 'kadar', 'bana', 'yapilir', 'yapmak', 'olur', 'ama', 'veya', 'gibi', 'daha', 'cok', 'sadece', 'lutfen', 'yaz', 'ver', 'goster'
])

/** Türkçe karakterleri ASCII'ye indirger (röle → role) ve küçük harfe çevirir. */
export function sadelestir(metin: string): string {
  return metin
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]|i̇/g, (c) => TR_HARITA[c] ?? c)
}

/**
 * Arama için metni parçalar. camelCase ve snake_case birleşik adlar hem bütün hem
 * parçalarıyla eklenir (digitalWrite → digitalwrite, digital, write).
 */
export function belirtecle(metin: string): string[] {
  const sonuc: string[] = []
  const kelimeler = metin.match(/[A-Za-zÇĞİIÖŞÜçğıöşü0-9_]+/g) ?? []
  for (const kelime of kelimeler) {
    const parcalar = kelime
      .replace(/([a-zçğıöşü0-9])([A-ZÇĞİÖŞÜ])/g, '$1 $2')
      .split(/[_\s]+/)
      .filter(Boolean)
    const butun = sadelestir(kelime.replace(/_/g, ''))
    if (butun.length >= 2 && !DURAK_KELIMELER.has(butun)) sonuc.push(butun)
    if (parcalar.length > 1) {
      for (const p of parcalar) {
        const t = sadelestir(p)
        if (t.length >= 2 && t !== butun && !DURAK_KELIMELER.has(t)) sonuc.push(t)
      }
    }
  }
  return sonuc
}

export interface Bm25Sonuc {
  indeks: number
  skor: number
}

/** Küçük ve bellekte çalışan BM25 dizini. Belgeler değiştiğinde yeniden kurulur. */
export class Bm25Dizini {
  private tf: Array<Map<string, number>> = []
  private df = new Map<string, number>()
  private uzunluk: number[] = []
  private ortalamaUzunluk = 0

  constructor(
    belgeler: string[],
    private k1 = 1.4,
    private b = 0.75
  ) {
    let toplam = 0
    for (const belge of belgeler) {
      const terimler = belirtecle(belge)
      const sayac = new Map<string, number>()
      for (const t of terimler) sayac.set(t, (sayac.get(t) ?? 0) + 1)
      this.tf.push(sayac)
      this.uzunluk.push(terimler.length)
      toplam += terimler.length
      for (const t of sayac.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1)
    }
    this.ortalamaUzunluk = belgeler.length ? toplam / belgeler.length : 0
  }

  ara(sorgu: string, enFazla = 20): Bm25Sonuc[] {
    const n = this.tf.length
    if (n === 0) return []
    const terimler = [...new Set(belirtecle(sorgu))]
    if (terimler.length === 0) return []
    // Uzun sorgularda tek bir (rastlantısal) kelime eşleşmesi yetmez
    const gerekliEslesme = terimler.length >= 5 ? 2 : 1
    const sonuclar: Bm25Sonuc[] = []
    for (let i = 0; i < n; i++) {
      let skor = 0
      let eslesen = 0
      for (const t of terimler) {
        const f = this.tf[i].get(t)
        if (!f) continue
        eslesen++
        const dfT = this.df.get(t) ?? 0
        const idf = Math.log(1 + (n - dfT + 0.5) / (dfT + 0.5))
        const norm = 1 - this.b + (this.b * this.uzunluk[i]) / (this.ortalamaUzunluk || 1)
        skor += idf * ((f * (this.k1 + 1)) / (f + this.k1 * norm))
      }
      if (skor > 0 && eslesen >= gerekliEslesme) sonuclar.push({ indeks: i, skor })
    }
    return sonuclar.sort((a, b) => b.skor - a.skor).slice(0, enFazla)
  }
}

/**
 * Reciprocal Rank Fusion: birden çok sıralı listeyi tek sıralamada birleştirir.
 * Girdi: her liste için sıralı indeks dizisi (en iyi başta). Çıktı: birleşik skorlu indeksler.
 */
export function rrfBirlestir(listeler: number[][], k = 60): Array<{ indeks: number; skor: number }> {
  const skorlar = new Map<number, number>()
  for (const liste of listeler) {
    liste.forEach((indeks, sira) => skorlar.set(indeks, (skorlar.get(indeks) ?? 0) + 1 / (k + sira + 1)))
  }
  return [...skorlar.entries()].map(([indeks, skor]) => ({ indeks, skor })).sort((a, b) => b.skor - a.skor)
}

/**
 * Sözcük aramasına girecek metinden yorumları ve metin sabitlerini ayıklar. Doğal dil
 * (özellikle Türkçe yorumlar) sıradan kelimelerle sahte eşleşme üretir; anlamsal arama zaten
 * yorumları kapsadığından BM25 yalnızca başlık ve kod tanımlayıcılarına bakar.
 */
export function kodTanimlayicilari(metin: string): string {
  return metin
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/"(?:[^"\\\n]|\\.)*"/g, ' ')
}
