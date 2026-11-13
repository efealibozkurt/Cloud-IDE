export interface OrnekDeger {
  /** Seri adı; etiketsiz değerlerde sırası ("1", "2", …) */
  ad: string
  deger: number
}

const SAYI = String.raw`[-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][-+]?\d+)?`
const ETIKETLI = new RegExp(String.raw`([\p{L}_][\p{L}\p{N}_ ]*?)\s*[:=]\s*(${SAYI})(?![\p{L}\p{N}_])`, 'gu')
const SAYI_TAM = new RegExp(`^${SAYI}$`)

function sayiYap(metin: string): number | null {
  const n = Number(metin.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Seri monitör satırından çizilecek değerleri çıkarır. Desteklenen biçimler:
 *  - "512"                      → tek seri
 *  - "10, 20, 30" / "10 20 30"  → sıra numaralı seriler (1, 2, 3)
 *  - "sicaklik:23.5 nem:60"     → etiketli seriler (Arduino Serial Plotter biçimi)
 * Satırda sayı yoksa ya da biçim tanınmazsa boş dizi döner.
 */
export function seriSatiriniAyristir(satir: string): OrnekDeger[] {
  const metin = satir.trim()
  if (!metin) return []

  const sonuc: OrnekDeger[] = []
  for (const m of metin.matchAll(ETIKETLI)) {
    const deger = sayiYap(m[2])
    if (deger !== null) sonuc.push({ ad: m[1].trim(), deger })
  }
  if (sonuc.length > 0) return sonuc

  const parcalar = metin.split(/[\s,;\t]+/).filter(Boolean)
  if (parcalar.length === 0 || parcalar.length > 16 || !parcalar.every((p) => SAYI_TAM.test(p))) return []
  return parcalar.map((p, i) => ({ ad: String(i + 1), deger: sayiYap(p) as number }))
}

export interface CizgiSerisi {
  ad: string
  noktalar: number[]
}

/** Satırlardan (en yeni `enFazla` örnek) seri başına nokta listesi çıkarır. */
export function seriOrnekleriniTopla(satirlar: string[], enFazla: number): CizgiSerisi[] {
  const harita = new Map<string, number[]>()
  for (const satir of satirlar) {
    for (const { ad, deger } of seriSatiriniAyristir(satir)) {
      let liste = harita.get(ad)
      if (!liste) harita.set(ad, (liste = []))
      liste.push(deger)
    }
  }
  return [...harita.entries()].map(([ad, noktalar]) => ({ ad, noktalar: noktalar.slice(-enFazla) }))
}
