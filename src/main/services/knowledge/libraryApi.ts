import type { KutuphaneUyeSembolu } from '@shared/types'

export interface KutuphaneApiOzeti {
  siniflar: string[]
  fonksiyonlar: string[]
  sabitler: string[]
}

export interface BaslikSembolSonucu {
  siniflar: string[]
  uyeler: KutuphaneUyeSembolu[]
  sabitler: string[]
}

const FONKSIYON_DESENI =
  /^\s*(?:(?:virtual|static|inline|explicit|constexpr|extern)\s+)*([A-Za-z_][\w:<>,*&\s]*?[\s*&])(~?[A-Za-z_]\w*)\s*\(([^;{)]*)\)\s*(?:const)?\s*(?:override)?\s*(?:;|\{)/
const UYE_FONKSIYON_DESENI =
  /^\s*(?:(?:virtual|static|inline|explicit|constexpr|extern)\s+)*([A-Za-z_][\w:<>,*&\s]*?[\s*&])([A-Za-z_]\w*)\s*\(([^;{)]*)\)\s*(?:const)?\s*(?:noexcept)?\s*(?:override)?\s*(?:=\s*0\s*)?(?:;|\{|$)/
const KURUCU_DESENI =
  /^\s*(?:(?:explicit|inline|constexpr)\s+)*([A-Za-z_]\w*)\s*\(([^;{)]*)\)\s*(?::[^{;]*)?(?:;|\{|$)/
const SINIF_DESENI = /^\s*(?:class|struct)\s+([A-Za-z_]\w*)\s*(?::[^{;]+)?\{?\s*$/
const SINIF_ACILIS_DESENI = /^\s*(class|struct)\s+([A-Za-z_]\w*)(?:\s*:\s*[^{;]+)?\s*\{/
const SINIF_BEKLEME_DESENI = /^\s*(class|struct)\s+([A-Za-z_]\w*)(?:\s*:\s*[^{;]+)?\s*$/
const ILERI_BILDIRIM_DESENI = /^\s*(?:class|struct)\s+[A-Za-z_]\w*\s*;\s*$/
const SABIT_DESENI = /^\s*#define\s+([A-Z][A-Z0-9_]{2,})\b/

const ATLANACAK_ANAHTARLAR = new Set(['if', 'for', 'while', 'switch', 'return', 'else', 'sizeof', 'delete', 'new', 'operator'])
const ATLANACAK_DONUS_TIPLERI = new Set(['return', 'else', 'case', 'delete', 'new', 'typedef', 'using', 'friend'])

const AZAMI_UYE = 120
const AZAMI_SABIT = 80

/** Metin ve karakter sabitlerinin dışındaki `{` / `}` sayılarını hesaplar */
function susluParantezSay(satir: string): { acilan: number; kapanan: number } {
  let acilan = 0
  let kapanan = 0
  let metinKarakteri: string | null = null
  for (let i = 0; i < satir.length; i++) {
    const c = satir[i]
    if (metinKarakteri) {
      if (c === '\\') {
        i++
      } else if (c === metinKarakteri) {
        metinKarakteri = null
      }
      continue
    }
    if (c === '"' || c === "'") {
      metinKarakteri = c
    } else if (c === '{') {
      acilan++
    } else if (c === '}') {
      kapanan++
    }
  }
  return { acilan, kapanan }
}

/**
 * Tek satıra sıkıştırılmış sınıf/metot bildirimlerini de ayrıştırabilmek için,
 * `#` ön işlemci satırlarına dokunmadan tırnak ve parantez dışındaki `{`, `}`, `;`
 * sınırlarından mantıksal satırlara böler.
 */
function mantiksalSatirlar(bloksuz: string): string[] {
  const sonuc: string[] = []
  for (const ham of bloksuz.split(/\r?\n/)) {
    const satir = ham.replace(/\/\/.*$/, '').trim()
    if (!satir) continue
    if (satir.startsWith('#')) {
      sonuc.push(satir)
      continue
    }

    let parca = ''
    let parantezDerinligi = 0
    let metinKarakteri: string | null = null
    for (let i = 0; i < satir.length; i++) {
      const c = satir[i]
      if (metinKarakteri) {
        parca += c
        if (c === '\\' && i + 1 < satir.length) {
          parca += satir[++i]
        } else if (c === metinKarakteri) {
          metinKarakteri = null
        }
        continue
      }
      if (c === '"' || c === "'") {
        metinKarakteri = c
        parca += c
        continue
      }
      if (c === '(') parantezDerinligi++
      else if (c === ')' && parantezDerinligi > 0) parantezDerinligi--

      if (parantezDerinligi === 0 && (c === '{' || c === ';')) {
        parca += c
        if (parca.trim()) sonuc.push(parca.trim())
        parca = ''
        continue
      }
      if (parantezDerinligi === 0 && c === '}') {
        if (parca.trim()) sonuc.push(parca.trim())
        const sonraki = satir[i + 1]
        if (sonraki === ';') {
          sonuc.push('};')
          i++
        } else {
          sonuc.push('}')
        }
        parca = ''
        continue
      }
      parca += c
    }
    if (parca.trim()) sonuc.push(parca.trim())
  }
  return sonuc
}

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

/**
 * Bir kütüphane başlık dosyasından çevrimdışı IntelliSense için yapılandırılmış
 * sınıf, üye metot, yapıcı, serbest fonksiyon ve sabit bilgilerini çıkarır.
 * Süslü parantez derinliğini izleyerek satır içi metot gövdelerinin sınıf
 * kapsamını erken kapatmasını önler.
 */
export function basliktanSembolCikar(metin: string): BaslikSembolSonucu {
  const siniflar: string[] = []
  const sinifSeti = new Set<string>()
  const uyeler: KutuphaneUyeSembolu[] = []
  const uyeAnahtarlari = new Set<string>()
  const sabitler: string[] = []
  const sabitSeti = new Set<string>()

  // Blok yorumları temizlerken satır sonlarını koru ki ardışık satırlar birleşmesin
  const bloksuz = metin.replace(/\/\*[\s\S]*?\*\//g, (parca) => parca.replace(/[^\n]/g, ' '))
  const satirlar = mantiksalSatirlar(bloksuz)

  let derinlik = 0
  const sinifYigini: Array<{ ad: string; baslangicDerinligi: number; erisim: 'public' | 'private' | 'protected' }> = []
  let bekleyenSinif: { ad: string; erisim: 'public' | 'private' | 'protected' } | null = null

  const sinifEkle = (ad: string): void => {
    if (!sinifSeti.has(ad)) {
      sinifSeti.add(ad)
      siniflar.push(ad)
    }
  }

  const uyeEkle = (sembol: KutuphaneUyeSembolu): void => {
    if (uyeler.length >= AZAMI_UYE) return
    const anahtar = `${sembol.sinif ?? ''}#${sembol.ad}#${sembol.parametreler}`
    if (uyeAnahtarlari.has(anahtar)) return
    uyeAnahtarlari.add(anahtar)
    uyeler.push(sembol)
  }

  for (const ham of satirlar) {
    let satir = ham.trim()
    if (!satir) continue

    const sabit = SABIT_DESENI.exec(satir)
    if (sabit) {
      const ad = sabit[1]
      if (!ad.endsWith('_H') && !ad.endsWith('_HPP') && !ad.startsWith('_') && !sabitSeti.has(ad) && sabitler.length < AZAMI_SABIT) {
        sabitSeti.add(ad)
        sabitler.push(ad)
      }
    }

    if (satir.startsWith('#')) continue

    if (bekleyenSinif) {
      if (satir === ';') {
        bekleyenSinif = null
      } else if (satir.includes('{')) {
        sinifEkle(bekleyenSinif.ad)
        sinifYigini.push({ ...bekleyenSinif, baslangicDerinligi: derinlik })
        bekleyenSinif = null
      } else if (!/^\s*:/.test(satir)) {
        bekleyenSinif = null
      }
    }

    let yeniSinifBuSatirda = false
    if (!ILERI_BILDIRIM_DESENI.test(satir)) {
      const aktifOnceki = sinifYigini[sinifYigini.length - 1]
      const ustKapsamdaMi = aktifOnceki ? derinlik === aktifOnceki.baslangicDerinligi + 1 : derinlik === 0
      if (ustKapsamdaMi) {
        const acilis = SINIF_ACILIS_DESENI.exec(satir)
        if (acilis) {
          const ad = acilis[2]
          sinifEkle(ad)
          sinifYigini.push({
            ad,
            baslangicDerinligi: derinlik,
            erisim: acilis[1] === 'class' ? 'private' : 'public'
          })
          yeniSinifBuSatirda = true
        } else {
          const bekle = SINIF_BEKLEME_DESENI.exec(satir)
          if (bekle) {
            bekleyenSinif = {
              ad: bekle[2],
              erisim: bekle[1] === 'class' ? 'private' : 'public'
            }
          }
        }
      }
    }

    const aktifSinif = sinifYigini[sinifYigini.length - 1]
    if (!yeniSinifBuSatirda && aktifSinif && derinlik === aktifSinif.baslangicDerinligi + 1) {
      const erisimEslesmesi = /^\s*(public|private|protected)\s*:\s*(.*)$/.exec(satir)
      if (erisimEslesmesi) {
        aktifSinif.erisim = erisimEslesmesi[1] as typeof aktifSinif.erisim
        satir = erisimEslesmesi[2].trim()
      }
    }

    const kapsamUygun =
      !yeniSinifBuSatirda &&
      Boolean(satir) &&
      (aktifSinif ? derinlik === aktifSinif.baslangicDerinligi + 1 && aktifSinif.erisim === 'public' : derinlik === 0)

    if (kapsamUygun) {
      let cikarildi = false
      if (aktifSinif) {
        const kurucu = KURUCU_DESENI.exec(satir)
        if (kurucu && kurucu[1] === aktifSinif.ad) {
          const parametreler = kurucu[2].replace(/\s+/g, ' ').trim()
          const imza = `${aktifSinif.ad}(${parametreler})`
          if (imza.length <= 160) {
            uyeEkle({
              ad: aktifSinif.ad,
              sinif: aktifSinif.ad,
              donusTipi: '',
              parametreler,
              imza,
              kurucu: true
            })
          }
          cikarildi = true
        }
      }

      if (!cikarildi) {
        const f = UYE_FONKSIYON_DESENI.exec(satir)
        if (f) {
          const donusTipi = f[1].replace(/\s+/g, ' ').trim()
          const ad = f[2]
          const parametreler = f[3].replace(/\s+/g, ' ').trim()
          const ilkKelime = donusTipi.split(/\s+/)[0]
          if (
            !ATLANACAK_ANAHTARLAR.has(ad) &&
            !ad.startsWith('operator') &&
            !ATLANACAK_DONUS_TIPLERI.has(ilkKelime)
          ) {
            const imza = `${donusTipi ? `${donusTipi} ` : ''}${ad}(${parametreler})`
            if (imza.length <= 160) {
              uyeEkle({
                ad,
                sinif: aktifSinif?.ad,
                donusTipi,
                parametreler,
                imza
              })
            }
          }
        }
      }
    }

    const { acilan, kapanan } = susluParantezSay(satir)
    derinlik = Math.max(0, derinlik + acilan - kapanan)
    while (sinifYigini.length > 0 && derinlik <= sinifYigini[sinifYigini.length - 1].baslangicDerinligi) {
      sinifYigini.pop()
    }
  }

  return { siniflar, uyeler, sabitler }
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
