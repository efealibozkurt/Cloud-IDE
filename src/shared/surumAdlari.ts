/**
 * Sürüm kod adları: bulut türleri. Proje geliştikçe daha yüksek ve daha yoğun bir buluta geçilir.
 * Her kod adı bir "ana.küçük" sürümden itibaren geçerlidir (0.1.x Stratus, 0.2.x Cumulus …).
 */

export interface SurumAdi {
  ad: string
  /** Bu kod adının başladığı sürüm [ana, küçük] */
  baslangic: [number, number]
  /** Bulutun yaklaşık rakımı */
  yukseklik: string
  /** Bulutun kendisi hakkında tek cümle */
  bulut: string
  /** Bu sürüm döneminin yazılım tarafındaki karşılığı */
  donem: string
}

export const SURUM_ADLARI: SurumAdi[] = [
  {
    ad: 'Stratus',
    baslangic: [0, 1],
    yukseklik: '0–2 km',
    bulut: 'Yeri örten alçak, düz ve sakin bulut tabakası.',
    donem: 'Temeller: editör, derleme, yükleme, ilk yapay zekâ asistanı.'
  },
  {
    ad: 'Cumulus',
    baslangic: [0, 2],
    yukseklik: '1–3 km',
    bulut: 'Gün ısındıkça yükselen, pamuk gibi kabarık bulut.',
    donem: 'Büyüme: daha çok kart, daha akıllı asistan, günlük kullanım rahatlığı.'
  },
  {
    ad: 'Altostratus',
    baslangic: [0, 3],
    yukseklik: '2–6 km',
    bulut: 'Gökyüzünü geniş bir perde gibi kaplayan orta katman bulutu.',
    donem: 'Genişleme: proje paylaşımı, yedekleme, daha geniş donanım desteği.'
  },
  {
    ad: 'Nimbostratus',
    baslangic: [0, 4],
    yukseklik: '1–5 km',
    bulut: 'Kalın, koyu ve yağmur getiren bulut.',
    donem: 'Olgunlaşma: sağlamlık, performans ve ayrıntılı cilalama.'
  },
  {
    ad: 'Cumulonimbus',
    baslangic: [0, 5],
    yukseklik: '0,5–16 km',
    bulut: 'Dev bir kule gibi yükselen fırtına bulutu; bulutların en güçlüsü.',
    donem: 'Zirve: kararlı sürüm.'
  }
]

function surumAyir(surum: string): [number, number] {
  const m = /^(\d+)\.(\d+)/.exec(surum.trim().replace(/^v/i, ''))
  return m ? [Number(m[1]), Number(m[2])] : [0, 1]
}

function once(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1])
}

/** Verilen sürüm numarasının (ör. "0.1.5") kod adını döndürür. */
export function surumAdiBul(surum: string): SurumAdi {
  const s = surumAyir(surum)
  let bulunan = SURUM_ADLARI[0]
  for (const a of SURUM_ADLARI) if (once(a.baslangic, s)) bulunan = a
  return bulunan
}

/** Bir sonraki kod adı; son kod adındaysa null. */
export function sonrakiSurumAdi(surum: string): SurumAdi | null {
  const simdiki = surumAdiBul(surum)
  const i = SURUM_ADLARI.indexOf(simdiki)
  return SURUM_ADLARI[i + 1] ?? null
}
