export interface KutuphaneApiOzeti {
  siniflar: string[]
  fonksiyonlar: string[]
  sabitler: string[]
}

const FONKSIYON_DESENI =
  /^\s*(?:(?:virtual|static|inline|explicit|constexpr|extern)\s+)*([A-Za-z_][\w:<>,*&\s]*?[\s*&])(~?[A-Za-z_]\w*)\s*\(([^;{)]*)\)\s*(?:const)?\s*(?:override)?\s*(?:;|\{)/
const SINIF_DESENI = /^\s*(?:class|struct)\s+([A-Za-z_]\w*)\s*(?::[^{;]+)?\{?\s*$/
const SABIT_DESENI = /^\s*#define\s+([A-Z][A-Z0-9_]{2,})\b/

const ATLANACAK_ANAHTARLAR = new Set(['if', 'for', 'while', 'switch', 'return', 'else', 'sizeof', 'delete', 'new'])

/**
 * Bir kütüphane başlık dosyasından model için faydalı API imzalarını çıkarır.
 * Gövde ve private bölümler atlanır; amaç tam ayrıştırma değil, "hangi fonksiyonlar var" bilgisidir.
 */
export function basliktanApiCikar(metin: string): KutuphaneApiOzeti {
  const siniflar: string[] = []
  const fonksiyonlar: string[] = []
  const sabitler: string[] = []
  const satirlar = metin.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/)

  let erisim: 'public' | 'private' | 'protected' = 'public'
  let siniftayiz = false

  for (const ham of satirlar) {
    const satir = ham.replace(/\/\/.*$/, '').trimEnd()
    if (!satir.trim()) continue

    const sabit = SABIT_DESENI.exec(satir)
    if (sabit) {
      if (!sabit[1].endsWith('_H') && !sabit[1].startsWith('_')) sabitler.push(sabit[1])
      continue
    }

    const sinif = SINIF_DESENI.exec(satir)
    if (sinif) {
      siniflar.push(sinif[1])
      siniftayiz = true
      erisim = /^\s*class\b/.test(satir) ? 'private' : 'public'
      continue
    }

    const erisimEslesmesi = /^\s*(public|private|protected)\s*:/.exec(satir)
    if (erisimEslesmesi) {
      erisim = erisimEslesmesi[1] as typeof erisim
      continue
    }
    if (/^\s*\};?\s*$/.test(satir)) {
      siniftayiz = false
      erisim = 'public'
      continue
    }
    if (siniftayiz && erisim !== 'public') continue

    const f = FONKSIYON_DESENI.exec(satir)
    if (f) {
      const ad = f[2]
      if (ATLANACAK_ANAHTARLAR.has(ad)) continue
      const imza = satir.trim().replace(/\s*\{.*$/, '').replace(/;$/, '').replace(/\s+/g, ' ')
      if (imza.length <= 160) fonksiyonlar.push(imza)
    }
  }

  return {
    siniflar: [...new Set(siniflar)],
    fonksiyonlar: [...new Set(fonksiyonlar)],
    sabitler: [...new Set(sabitler)]
  }
}

/** keywords.txt içindeki KEYWORD1/KEYWORD2/LITERAL1 adlarını döndürür. */
export function anahtarKelimeleriOku(metin: string): string[] {
  const adlar: string[] = []
  for (const satir of metin.split(/\r?\n/)) {
    if (!satir.trim() || satir.startsWith('#')) continue
    const [ad] = satir.split(/\s+/)
    if (ad && /^[A-Za-z_]\w*$/.test(ad)) adlar.push(ad)
  }
  return [...new Set(adlar)]
}

/** API özetini en fazla `parcaBoyutu` imzalık parçalara böler; her parça tek bir RAG kaydı olur. */
export function apiOzetiniParcala(ozet: KutuphaneApiOzeti, parcaBoyutu = 35): string[] {
  const baslik = [
    ozet.siniflar.length ? `Sınıflar: ${ozet.siniflar.join(', ')}` : '',
    ozet.sabitler.length ? `Sabitler: ${ozet.sabitler.slice(0, 20).join(', ')}` : ''
  ]
    .filter(Boolean)
    .join('\n')
  if (ozet.fonksiyonlar.length === 0) return baslik ? [baslik] : []
  const parcalar: string[] = []
  for (let i = 0; i < ozet.fonksiyonlar.length; i += parcaBoyutu) {
    const govde = ozet.fonksiyonlar.slice(i, i + parcaBoyutu).join('\n')
    parcalar.push(`${i === 0 && baslik ? `${baslik}\n` : ''}${govde}`)
  }
  return parcalar
}
