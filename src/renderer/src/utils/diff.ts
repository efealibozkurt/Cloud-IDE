export type DiffTuru = 'ayni' | 'eklendi' | 'silindi'

export interface DiffSatiri {
  tur: DiffTuru
  metin: string
  /** Eski dosyadaki satır numarası (1 tabanlı); eklenen satırlarda yok */
  eskiNo?: number
  /** Yeni dosyadaki satır numarası (1 tabanlı); silinen satırlarda yok */
  yeniNo?: number
}

export interface DiffOzeti {
  eklenen: number
  silinen: number
}

const MAKS_LCS_HUCRE = 4_000_000

/**
 * İki metin arasında satır tabanlı fark üretir. Önce ortak baş/son satırlar atılır,
 * ortada kalan kısım için LCS çalıştırılır. Çok büyük farklarda (hücre sınırı aşılırsa)
 * orta kısım "tamamı silindi + tamamı eklendi" olarak gösterilir.
 */
export function satirFarki(eski: string, yeni: string): DiffSatiri[] {
  const a = eski === '' ? [] : eski.replace(/\r\n/g, '\n').split('\n')
  const b = yeni === '' ? [] : yeni.replace(/\r\n/g, '\n').split('\n')

  let bas = 0
  while (bas < a.length && bas < b.length && a[bas] === b[bas]) bas++
  let son = 0
  while (son < a.length - bas && son < b.length - bas && a[a.length - 1 - son] === b[b.length - 1 - son]) son++

  const ortaA = a.slice(bas, a.length - son)
  const ortaB = b.slice(bas, b.length - son)
  const sonuc: DiffSatiri[] = []

  for (let i = 0; i < bas; i++) sonuc.push({ tur: 'ayni', metin: a[i], eskiNo: i + 1, yeniNo: i + 1 })

  const n = ortaA.length
  const m = ortaB.length
  const eskiBaslangic = bas
  const yeniBaslangic = bas

  if (n * m > MAKS_LCS_HUCRE) {
    ortaA.forEach((t, i) => sonuc.push({ tur: 'silindi', metin: t, eskiNo: eskiBaslangic + i + 1 }))
    ortaB.forEach((t, j) => sonuc.push({ tur: 'eklendi', metin: t, yeniNo: yeniBaslangic + j + 1 }))
  } else {
    // lcs[i][j]: ortaA[i:] ile ortaB[j:] için en uzun ortak altdizi uzunluğu
    const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i][j] = ortaA[i] === ortaB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
      }
    }
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (ortaA[i] === ortaB[j]) {
        sonuc.push({ tur: 'ayni', metin: ortaA[i], eskiNo: eskiBaslangic + i + 1, yeniNo: yeniBaslangic + j + 1 })
        i++
        j++
      } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
        sonuc.push({ tur: 'silindi', metin: ortaA[i], eskiNo: eskiBaslangic + i + 1 })
        i++
      } else {
        sonuc.push({ tur: 'eklendi', metin: ortaB[j], yeniNo: yeniBaslangic + j + 1 })
        j++
      }
    }
    while (i < n) {
      sonuc.push({ tur: 'silindi', metin: ortaA[i], eskiNo: eskiBaslangic + i + 1 })
      i++
    }
    while (j < m) {
      sonuc.push({ tur: 'eklendi', metin: ortaB[j], yeniNo: yeniBaslangic + j + 1 })
      j++
    }
  }

  for (let k = 0; k < son; k++) {
    const ai = a.length - son + k
    const bi = b.length - son + k
    sonuc.push({ tur: 'ayni', metin: a[ai], eskiNo: ai + 1, yeniNo: bi + 1 })
  }
  return sonuc
}

export function farkOzeti(satirlar: DiffSatiri[]): DiffOzeti {
  let eklenen = 0
  let silinen = 0
  for (const s of satirlar) {
    if (s.tur === 'eklendi') eklenen++
    else if (s.tur === 'silindi') silinen++
  }
  return { eklenen, silinen }
}

/**
 * Değişmeyen uzun bölümleri kısaltır: her değişikliğin etrafında `baglam` satır bırakır,
 * aradaki boşluk `null` ile işaretlenir (arayüz "… N satır" gösterir).
 */
export function baglamliFark(satirlar: DiffSatiri[], baglam = 2): Array<DiffSatiri | { atlanan: number }> {
  const goster = new Array<boolean>(satirlar.length).fill(false)
  satirlar.forEach((s, i) => {
    if (s.tur === 'ayni') return
    for (let k = Math.max(0, i - baglam); k <= Math.min(satirlar.length - 1, i + baglam); k++) goster[k] = true
  })
  const cikti: Array<DiffSatiri | { atlanan: number }> = []
  let atlanan = 0
  satirlar.forEach((s, i) => {
    if (goster[i]) {
      if (atlanan > 0) {
        cikti.push({ atlanan })
        atlanan = 0
      }
      cikti.push(s)
    } else {
      atlanan++
    }
  })
  if (atlanan > 0) cikti.push({ atlanan })
  return cikti
}
