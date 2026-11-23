import type { KutuphaneSembolIndeksi, KutuphaneSembolKaydi, KutuphaneUyeSembolu } from './types'
import { yorumlariTemizle } from './pinCheck'
import {
  ARDUINO_FONKSIYONLARI,
  ARDUINO_NESNELERI,
  ARDUINO_SABITLERI,
  ARDUINO_SNIPPETLERI,
  STANDART_BASLIKLAR,
  avrKartMi,
  kartPinSabitleri,
  type ApiFonksiyonKaydi,
  type ApiNesneKaydi
} from './arduinoApiKatalogu'

export type OneriTuru = 'fonksiyon' | 'metot' | 'sinif' | 'degisken' | 'sabit' | 'makro' | 'snippet' | 'dosya' | 'anahtar'

export interface TamamlamaOnerisi {
  etiket: string
  tur: OneriTuru
  ekleMetni: string
  snippetMi: boolean
  detay?: string
  aciklama?: string
  siraOnceligi: string
  includeDegistirmeMetni?: string
}

export interface HoverBilgisi {
  baslik: string
  imza?: string
  aciklama: string
  kaynak: string
}

export interface ImzaParametresi {
  etiket: string
  aciklama?: string
}

export interface ImzaBilgisi {
  etiket: string
  aciklama?: string
  parametreler: ImzaParametresi[]
}

export interface ImzaYardimi {
  imzalar: ImzaBilgisi[]
  aktifImza: number
  aktifParametre: number
}

export interface YerelMakro {
  ad: string
  deger: string
  parametreler?: string
  imza: string
  satir: number
}

export interface YerelDegisken {
  ad: string
  tip: string
  imza: string
  satir: number
}

export interface YerelFonksiyon {
  ad: string
  donusTipi: string
  parametreler: string
  imza: string
  satir: number
}

export interface BelgeSembolleri {
  eklenenBasliklar: string[]
  makrolar: YerelMakro[]
  degiskenler: YerelDegisken[]
  fonksiyonlar: YerelFonksiyon[]
}

export interface TamamlamaBaglami {
  kod: string
  satir: number
  sutun: number
  fqbn?: string | null
  kutuphaneIndeksi?: KutuphaneSembolIndeksi | null
  projeBasliklari?: string[]
}

export interface HoverBaglami {
  kod: string
  satir: number
  sutun: number
  fqbn?: string | null
  kutuphaneIndeksi?: KutuphaneSembolIndeksi | null
}

export interface ImzaBaglami {
  kod: string
  satir: number
  sutun: number
  kutuphaneIndeksi?: KutuphaneSembolIndeksi | null
}

const ILKEL_TIPLER = new Set([
  'void',
  'bool',
  'boolean',
  'byte',
  'char',
  'signed',
  'unsigned',
  'short',
  'int',
  'long',
  'float',
  'double',
  'size_t',
  'ssize_t',
  'int8_t',
  'uint8_t',
  'int16_t',
  'uint16_t',
  'int32_t',
  'uint32_t',
  'int64_t',
  'uint64_t',
  'auto',
  'String'
])

const KONTROL_ANAHTARLARI = new Set([
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'default',
  'return',
  'break',
  'continue',
  'goto',
  'sizeof',
  'typeof',
  'alignof',
  'delete',
  'new',
  'throw',
  'catch',
  'try',
  'typedef',
  'using',
  'struct',
  'class',
  'enum',
  'namespace',
  'friend',
  'virtual',
  'template',
  'public',
  'private',
  'protected'
])

/** Parametre listesini `<...>`, `(...)`, `[...]` derinliğine saygı duyarak böler */
export function parametreListesiniBol(parametreler: string): string[] {
  const temiz = parametreler.trim()
  if (!temiz || temiz === 'void') return []

  const parcalar: string[] = []
  let bas = 0
  let parantez = 0
  let aci = 0
  let kose = 0
  let metinKarakteri: string | null = null

  for (let i = 0; i < temiz.length; i++) {
    const c = temiz[i]
    if (metinKarakteri) {
      if (c === '\\') i++
      else if (c === metinKarakteri) metinKarakteri = null
      continue
    }
    if (c === '"' || c === "'") {
      metinKarakteri = c
    } else if (c === '(') {
      parantez++
    } else if (c === ')' && parantez > 0) {
      parantez--
    } else if (c === '<') {
      aci++
    } else if (c === '>' && aci > 0) {
      aci--
    } else if (c === '[') {
      kose++
    } else if (c === ']' && kose > 0) {
      kose--
    } else if (c === ',' && parantez === 0 && aci === 0 && kose === 0) {
      const parca = temiz.slice(bas, i).trim()
      if (parca) parcalar.push(parca)
      bas = i + 1
    }
  }
  const son = temiz.slice(bas).trim()
  if (son) parcalar.push(son)
  return parcalar
}

function esittirIndeksiBul(param: string): number {
  let parantez = 0
  let aci = 0
  let metinKarakteri: string | null = null
  for (let i = 0; i < param.length; i++) {
    const c = param[i]
    if (metinKarakteri) {
      if (c === '\\') i++
      else if (c === metinKarakteri) metinKarakteri = null
      continue
    }
    if (c === '"' || c === "'") metinKarakteri = c
    else if (c === '(') parantez++
    else if (c === ')' && parantez > 0) parantez--
    else if (c === '<') aci++
    else if (c === '>' && aci > 0) aci--
    else if (c === '=' && parantez === 0 && aci === 0) return i
  }
  return -1
}

function parametredenAdCikar(param: string, sira: number): string {
  const esittir = esittirIndeksiBul(param)
  const varsayilansiz = (esittir >= 0 ? param.slice(0, esittir) : param).trim()
  if (varsayilansiz === '...') return '...'

  const fnPtr = /\(\s*\*\s*([A-Za-z_]\w*)\s*\)\s*\(/.exec(varsayilansiz)
  if (fnPtr) return fnPtr[1]

  const dizisiz = varsayilansiz.replace(/\[[^\]]*\]/g, '').trim()
  const parcalar = dizisiz.replace(/[*&]/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (parcalar.length === 0) return `param${sira}`

  const son = parcalar[parcalar.length - 1]
  if (parcalar.length === 1 && (ILKEL_TIPLER.has(son) || son === 'const')) {
    return `arg${sira}`
  }
  return /^[A-Za-z_]\w*$/.test(son) ? son.replace(/[}$\\]/g, '') : `param${sira}`
}

/**
 * Fonksiyon veya metot adı ile C++ parametre dizisinden Monaco snippet'i üretir.
 * Örn: `begin`, `"uint8_t pin, uint8_t type = 11"` → `"begin(${1:pin}, ${2:type})"`
 */
export function parametredenSnippetUret(ad: string, parametreler: string): string {
  const parcalar = parametreListesiniBol(parametreler)
  if (parcalar.length === 0) return `${ad}()`
  const yerTutucular = parcalar.map((p, idx) => `\${${idx + 1}:${parametredenAdCikar(p, idx + 1)}}`)
  return `${ad}(${yerTutucular.join(', ')})`
}

function satirlariHazirla(kod: string): { satirlar: string[]; satirBaslangiclari: number[] } {
  const hamSatirlar = kod.split('\n')
  const satirlar: string[] = []
  const satirBaslangiclari: number[] = []
  let konum = 0
  for (const ham of hamSatirlar) {
    satirBaslangiclari.push(konum)
    satirlar.push(ham.endsWith('\r') ? ham.slice(0, -1) : ham)
    konum += ham.length + 1
  }
  return { satirlar, satirBaslangiclari }
}

function konumuOffseteCevir(kod: string, satir: number, sutun: number): {
  offset: number
  satirMetni: string
  satirOncesi: string
  satirSonrasi: string
} {
  const { satirlar, satirBaslangiclari } = satirlariHazirla(kod)
  const guvenliSatir = Math.max(1, Math.min(satir, satirlar.length || 1))
  const satirMetni = satirlar[guvenliSatir - 1] ?? ''
  const guvenliSutun = Math.max(1, Math.min(sutun, satirMetni.length + 1))
  const offset = (satirBaslangiclari[guvenliSatir - 1] ?? 0) + (guvenliSutun - 1)
  return {
    offset,
    satirMetni,
    satirOncesi: satirMetni.slice(0, guvenliSutun - 1),
    satirSonrasi: satirMetni.slice(guvenliSutun - 1)
  }
}

function imlecDurumu(kod: string, hedefOffset: number): 'normal' | 'yorum' | 'metin' {
  let durum: 'normal' | 'satirYorumu' | 'blokYorumu' | 'string' | 'char' = 'normal'
  const sinir = Math.min(hedefOffset, kod.length)

  for (let i = 0; i < sinir; i++) {
    const c = kod[i]
    const sonraki = kod[i + 1]

    if (durum === 'satirYorumu') {
      if (c === '\n') durum = 'normal'
      continue
    }
    if (durum === 'blokYorumu') {
      if (c === '*' && sonraki === '/') {
        durum = 'normal'
        i++
      }
      continue
    }
    if (durum === 'string') {
      if (c === '\\') i++
      else if (c === '"') durum = 'normal'
      continue
    }
    if (durum === 'char') {
      if (c === '\\') i++
      else if (c === "'") durum = 'normal'
      continue
    }

    if (c === '/' && sonraki === '/') {
      durum = 'satirYorumu'
      i++
    } else if (c === '/' && sonraki === '*') {
      durum = 'blokYorumu'
      i++
    } else if (c === '"') {
      durum = 'string'
    } else if (c === "'") {
      durum = 'char'
    }
  }

  if (durum === 'satirYorumu' || durum === 'blokYorumu') return 'yorum'
  if (durum === 'string' || durum === 'char') return 'metin'
  return 'normal'
}

/** İmlecin yorum veya metin/karakter sabiti içinde olup olmadığını bildirir */
export function imlecYorumVeyaMetindeMi(kod: string, satir: number, sutun: number): boolean {
  const { offset } = konumuOffseteCevir(kod, satir, sutun)
  return imlecDurumu(kod, offset) !== 'normal'
}

function temelTipAdiCikar(tip: string): string {
  return tip
    .replace(/\b(?:const|static|volatile|extern|unsigned|signed)\b/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/[*&]/g, '')
    .replace(/.*::/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function argumanlarTipBildirimiMi(argMetni: string): boolean {
  const parcalar = parametreListesiniBol(argMetni)
  if (parcalar.length === 0) return false
  return parcalar.every((p) => {
    const temiz = p.replace(/\s*=.*$/, '').trim()
    const kelimeler = temiz.replace(/[*&]/g, ' ').trim().split(/\s+/).filter(Boolean)
    return kelimeler.length >= 2 && (ILKEL_TIPLER.has(kelimeler[0]) || kelimeler[0] === 'const' || kelimeler[0] === 'struct')
  })
}

function degiskenEkle(
  liste: YerelDegisken[],
  gorulen: Set<string>,
  tip: string,
  ad: string,
  imza: string,
  satir: number
): void {
  if (!ad || !tip || KONTROL_ANAHTARLARI.has(tip) || KONTROL_ANAHTARLARI.has(ad)) return
  const temizTip = temelTipAdiCikar(tip)
  if (!temizTip || KONTROL_ANAHTARLARI.has(temizTip)) return
  const anahtar = `${ad}#${temizTip}`
  if (gorulen.has(anahtar)) return
  gorulen.add(anahtar)
  liste.push({ ad, tip: temizTip, imza, satir })
}

/**
 * Aktif dosyadan `#include` başlıklarını, `#define` makrolarını, değişken/nesne
 * tanımlarını (ör. `DHT sensor(4, DHT11);`) ve yerel fonksiyonları çıkarır.
 */
export function belgeSembolleriCikar(kod: string): BelgeSembolleri {
  const eklenenBasliklar: string[] = []
  const baslikSeti = new Set<string>()
  const makrolar: YerelMakro[] = []
  const makroSeti = new Set<string>()
  const degiskenler: YerelDegisken[] = []
  const degiskenSeti = new Set<string>()
  const fonksiyonlar: YerelFonksiyon[] = []
  const fonksiyonSeti = new Set<string>()

  const hamSatirlar = kod.split(/\r?\n/)
  const temizKod = yorumlariTemizle(kod)
  const temizSatirlar = temizKod.split('\n')

  for (let i = 0; i < hamSatirlar.length; i++) {
    const hamSatir = hamSatirlar[i]
    const temizSatir = (temizSatirlar[i] ?? '').trim()
    const satirNo = i + 1
    if (!temizSatir) continue

    const inc = /^\s*#\s*include\s*[<"]([^>"]+)[>"]/.exec(hamSatir)
    if (inc) {
      const baslik = inc[1].trim()
      if (baslik && !baslikSeti.has(baslik)) {
        baslikSeti.add(baslik)
        eklenenBasliklar.push(baslik)
      }
      continue
    }

    const fonkMakro = /^\s*#\s*define\s+([A-Za-z_]\w*)\(([^)]*)\)\s*(.*)$/.exec(hamSatir)
    if (fonkMakro) {
      const ad = fonkMakro[1]
      const parametreler = fonkMakro[2].trim()
      const deger = fonkMakro[3].replace(/\/\/.*$/, '').trim()
      if (!makroSeti.has(ad)) {
        makroSeti.add(ad)
        makrolar.push({
          ad,
          deger,
          parametreler,
          imza: `#define ${ad}(${parametreler}) ${deger}`.trim(),
          satir: satirNo
        })
      }
      continue
    }

    const sabitMakro = /^\s*#\s*define\s+([A-Za-z_]\w*)(?:\s+(.*))?$/.exec(hamSatir)
    if (sabitMakro) {
      const ad = sabitMakro[1]
      const deger = (sabitMakro[2] ?? '').replace(/\/\/.*$/, '').trim()
      if (!makroSeti.has(ad)) {
        makroSeti.add(ad)
        makrolar.push({
          ad,
          deger,
          imza: deger ? `#define ${ad} ${deger}` : `#define ${ad}`,
          satir: satirNo
        })
      }
      continue
    }

    if (temizSatir.startsWith('#')) continue

    // Fonksiyon tanımı veya bildirimi / kurucu nesne tanımı
    const parantezliBildirim =
      /^(?:(?:static|inline|extern|virtual|constexpr)\s+)*((?:(?:const|unsigned|signed|volatile)\s+)*[A-Za-z_][\w:<>]*)\s*([*&]*)\s*([A-Za-z_]\w*)\s*\(([^;{}]*)\)\s*(?:const)?\s*(\{|;)?$/.exec(
        temizSatir
      )
    if (parantezliBildirim) {
      const donusTipi = `${parantezliBildirim[1]}${parantezliBildirim[2] ? ` ${parantezliBildirim[2]}` : ''}`.replace(/\s+/g, ' ').trim()
      const ad = parantezliBildirim[3]
      const parametreler = parantezliBildirim[4].replace(/\s+/g, ' ').trim()
      const sonKarakter = parantezliBildirim[5]
      const ilkTipKelimesi = donusTipi.split(/\s+/)[0]

      if (!KONTROL_ANAHTARLARI.has(ilkTipKelimesi) && !KONTROL_ANAHTARLARI.has(ad)) {
        let blokAcar = sonKarakter === '{'
        if (!sonKarakter) {
          for (let j = i + 1; j < temizSatirlar.length; j++) {
            const sonraki = temizSatirlar[j].trim()
            if (!sonraki) continue
            blokAcar = sonraki.startsWith('{')
            break
          }
        }

        if (blokAcar) {
          const anahtar = `${ad}#${parametreler}`
          if (!fonksiyonSeti.has(anahtar)) {
            fonksiyonSeti.add(anahtar)
            fonksiyonlar.push({
              ad,
              donusTipi,
              parametreler,
              imza: `${donusTipi} ${ad}(${parametreler})`,
              satir: satirNo
            })
          }
          for (const p of parametreListesiniBol(parametreler)) {
            const pEs = /^\s*(?:(?:const|unsigned|signed|volatile)\s+)*([A-Za-z_][\w:<>]*)\s*[*&]*\s*([A-Za-z_]\w*)/.exec(p)
            if (pEs) degiskenEkle(degiskenler, degiskenSeti, pEs[1], pEs[2], p.trim(), satirNo)
          }
          continue
        }

        if (sonKarakter === ';') {
          const temelDonus = temelTipAdiCikar(donusTipi)
          if (ILKEL_TIPLER.has(temelDonus) || argumanlarTipBildirimiMi(parametreler)) {
            const anahtar = `${ad}#${parametreler}`
            if (!fonksiyonSeti.has(anahtar)) {
              fonksiyonSeti.add(anahtar)
              fonksiyonlar.push({
                ad,
                donusTipi,
                parametreler,
                imza: `${donusTipi} ${ad}(${parametreler})`,
                satir: satirNo
              })
            }
          } else {
            degiskenEkle(
              degiskenler,
              degiskenSeti,
              donusTipi,
              ad,
              temizSatir.replace(/;$/, '').replace(/\s+/g, ' '),
              satirNo
            )
          }
          continue
        }
      }
    }

    // Düz değişken veya kurucu parametresiz nesne tanımı (ör. Servo motor; const int LED = 13;)
    const degiskenEslesme =
      /^(?:(?:const|static|volatile|extern)\s+)*((?:unsigned\s+|signed\s+)?[A-Za-z_][\w:<>]*)\s*[*&]*\s*([A-Za-z_]\w*)(?:\s*\[[^\]]*\])?\s*(?:=\s*[^;{}]+)?\s*;$/.exec(
        temizSatir
      )
    if (degiskenEslesme) {
      degiskenEkle(
        degiskenler,
        degiskenSeti,
        degiskenEslesme[1],
        degiskenEslesme[2],
        temizSatir.replace(/;$/, '').replace(/\s+/g, ' '),
        satirNo
      )
    }
  }

  return { eklenenBasliklar, makrolar, degiskenler, fonksiyonlar }
}

function kutuphaneDahilEdildiMi(kut: KutuphaneSembolKaydi, eklenenBasliklar: string[]): boolean {
  if (eklenenBasliklar.length === 0) return false
  const eklenenSet = new Set(eklenenBasliklar.map((b) => b.split(/[\\/]/).pop()!.toLowerCase()))
  return kut.basliklar.some((b) => eklenenSet.has(b.toLowerCase()))
}

function includeBaglamiOnerileri(baglam: TamamlamaBaglami, satirOncesi: string, satirSonrasi: string): TamamlamaOnerisi[] | null {
  const eslesme = /^\s*#\s*include\s*([<"])([^>"]*)$/.exec(satirOncesi)
  if (!eslesme) return null

  const ayrac = eslesme[1]
  const kapanis = ayrac === '<' ? '>' : '"'
  const kapanisEkle = !satirSonrasi.startsWith(kapanis)
  const avrMi = avrKartMi(baglam.fqbn)
  const esp8266Mi = Boolean(baglam.fqbn?.toLowerCase().includes('esp8266'))

  const oneriler: TamamlamaOnerisi[] = []
  const gorulen = new Set<string>()

  const ekle = (baslik: string, detay: string, aciklama: string | undefined, oncelik: string): void => {
    const anahtar = baslik.toLowerCase()
    if (gorulen.has(anahtar)) return
    gorulen.add(anahtar)
    oneriler.push({
      etiket: baslik,
      tur: 'dosya',
      ekleMetni: `${baslik}${kapanisEkle ? kapanis : ''}`,
      snippetMi: false,
      detay,
      aciklama,
      siraOnceligi: `${oncelik}_${baslik}`,
      includeDegistirmeMetni: eslesme[2]
    })
  }

  if (ayrac === '"') {
    for (const dosya of baglam.projeBasliklari ?? []) {
      ekle(dosya, 'Proje başlık dosyası', 'Aktif projedeki yerel başlık dosyası.', '0')
    }
  }

  for (const kut of baglam.kutuphaneIndeksi?.kutuphaneler ?? []) {
    for (const baslik of kut.basliklar) {
      ekle(baslik, `Kütüphane: ${kut.kutuphane}${kut.surum ? ` (${kut.surum})` : ''}`, kut.aciklama, '1')
    }
  }

  for (const std of STANDART_BASLIKLAR) {
    if (avrMi && std.platform) continue
    if (std.platform === 'esp8266' && baglam.fqbn && !esp8266Mi) continue
    ekle(std.baslik, 'Standart Arduino/Çekirdek Başlığı', std.aciklama, '2')
  }

  return oneriler
}

function apiFonksiyondanOneri(fn: ApiFonksiyonKaydi, tur: OneriTuru, oncelik: string, kaynakAciklama?: string): TamamlamaOnerisi {
  return {
    etiket: fn.ad,
    tur,
    ekleMetni: fn.snippet,
    snippetMi: true,
    detay: fn.imza,
    aciklama: kaynakAciklama ? `${fn.aciklama}\n\n${kaynakAciklama}` : fn.aciklama,
    siraOnceligi: `${oncelik}_${fn.ad}`
  }
}

function kutuphaneUyesindenOneri(
  uye: KutuphaneUyeSembolu,
  kut: KutuphaneSembolKaydi,
  tur: OneriTuru,
  oncelik: string
): TamamlamaOnerisi {
  const detay = `${uye.imza} · ${kut.kutuphane}`
  const aciklama = kut.aciklama
    ? `${kut.kutuphane}${kut.surum ? ` (${kut.surum})` : ''}: ${kut.aciklama}`
    : `Kurulu kütüphane: ${kut.kutuphane}${kut.surum ? ` v${kut.surum}` : ''}`
  return {
    etiket: uye.ad,
    tur,
    ekleMetni: parametredenSnippetUret(uye.ad, uye.parametreler),
    snippetMi: true,
    detay,
    aciklama,
    siraOnceligi: `${oncelik}_${uye.ad}`
  }
}

function nesneSinifUyeEslesmeleriBul(
  alici: string,
  belge: BelgeSembolleri,
  indeks?: KutuphaneSembolIndeksi | null
): {
  yerlesik?: ApiNesneKaydi
  kutuphaneUyeleri: Array<{ kut: KutuphaneSembolKaydi; uye: KutuphaneUyeSembolu; dahil: boolean }>
} {
  const yerlesikTekil = ARDUINO_NESNELERI.find((n) => !n.sinifMi && n.ad === alici)
  if (yerlesikTekil) {
    return { yerlesik: yerlesikTekil, kutuphaneUyeleri: [] }
  }

  const degisken = belge.degiskenler.find((d) => d.ad === alici)
  const hedefTip = degisken?.tip ?? alici

  const yerlesikSinif = ARDUINO_NESNELERI.find((n) => n.sinifMi && n.ad === hedefTip)
  const kutuphaneUyeleri: Array<{ kut: KutuphaneSembolKaydi; uye: KutuphaneUyeSembolu; dahil: boolean }> = []

  for (const kut of indeks?.kutuphaneler ?? []) {
    const dahil = kutuphaneDahilEdildiMi(kut, belge.eklenenBasliklar)
    for (const uye of kut.uyeler) {
      if (uye.kurucu) continue
      if (uye.sinif === hedefTip) {
        kutuphaneUyeleri.push({ kut, uye, dahil })
      }
    }
  }

  return { yerlesik: yerlesikSinif, kutuphaneUyeleri }
}

/** Verilen kod ve imleç konumuna göre tamamen çevrimdışı otomatik tamamlama önerileri üretir. */
export function tamamlamaOnerileriUret(baglam: TamamlamaBaglami): TamamlamaOnerisi[] {
  const { offset, satirOncesi, satirSonrasi } = konumuOffseteCevir(baglam.kod, baglam.satir, baglam.sutun)
  const durum = imlecDurumu(baglam.kod, offset)
  if (durum === 'yorum') return []

  const includeOnerileri = includeBaglamiOnerileri(baglam, satirOncesi, satirSonrasi)
  if (includeOnerileri) return includeOnerileri
  if (durum === 'metin') return []

  const belge = belgeSembolleriCikar(baglam.kod)

  // Üye tamamlama (nesne. veya nesne->)
  const uyeEslesmesi = /([A-Za-z_]\w*)\s*(?:\.|->)\s*[A-Za-z_0-9]*$/.exec(satirOncesi)
  if (uyeEslesmesi) {
    const alici = uyeEslesmesi[1]
    const bulunan = nesneSinifUyeEslesmeleriBul(alici, belge, baglam.kutuphaneIndeksi)
    const oneriler: TamamlamaOnerisi[] = []
    const gorulen = new Set<string>()

    if (bulunan.yerlesik) {
      for (const uye of bulunan.yerlesik.uyeler) {
        const anahtar = `${uye.ad}#${uye.imza}`
        if (gorulen.has(anahtar)) continue
        gorulen.add(anahtar)
        oneriler.push(apiFonksiyondanOneri(uye, 'metot', '0', bulunan.yerlesik.aciklama))
      }
    }

    const sirali = [...bulunan.kutuphaneUyeleri].sort((a, b) => Number(b.dahil) - Number(a.dahil))
    for (const { kut, uye, dahil } of sirali) {
      const anahtar = `${uye.ad}#${uye.imza}`
      if (gorulen.has(anahtar)) continue
      gorulen.add(anahtar)
      oneriler.push(kutuphaneUyesindenOneri(uye, kut, 'metot', dahil ? '0' : '1'))
    }
    return oneriler
  }

  // Genel bağlam tamamlaması
  const avrMi = avrKartMi(baglam.fqbn)
  const oneriler: TamamlamaOnerisi[] = []
  const gorulenEtiketler = new Set<string>()
  const ekleTekil = (oneri: TamamlamaOnerisi): void => {
    const anahtar = `${oneri.tur}#${oneri.etiket}`
    if (gorulenEtiketler.has(anahtar)) return
    gorulenEtiketler.add(anahtar)
    oneriler.push(oneri)
  }

  // 0_ Aktif dosya yerel sembolleri
  for (const fn of belge.fonksiyonlar) {
    ekleTekil({
      etiket: fn.ad,
      tur: 'fonksiyon',
      ekleMetni: parametredenSnippetUret(fn.ad, fn.parametreler),
      snippetMi: true,
      detay: fn.imza,
      aciklama: `Bu dosyada tanımlı fonksiyon (Satır ${fn.satir}).`,
      siraOnceligi: `0_${fn.ad}`
    })
  }
  for (const deg of belge.degiskenler) {
    ekleTekil({
      etiket: deg.ad,
      tur: 'degisken',
      ekleMetni: deg.ad,
      snippetMi: false,
      detay: deg.imza,
      aciklama: `Yerel değişken / nesne (${deg.tip}, Satır ${deg.satir}).`,
      siraOnceligi: `0_${deg.ad}`
    })
  }
  for (const mak of belge.makrolar) {
    ekleTekil({
      etiket: mak.ad,
      tur: 'makro',
      ekleMetni: mak.parametreler !== undefined ? parametredenSnippetUret(mak.ad, mak.parametreler) : mak.ad,
      snippetMi: mak.parametreler !== undefined,
      detay: mak.imza,
      aciklama: `Bu dosyadaki makro tanımı (Satır ${mak.satir}).`,
      siraOnceligi: `0_${mak.ad}`
    })
  }

  // 1_ #include edilmiş kurulu kütüphane sembolleri, 4_ dahil edilmemişler
  for (const kut of baglam.kutuphaneIndeksi?.kutuphaneler ?? []) {
    const dahil = kutuphaneDahilEdildiMi(kut, belge.eklenenBasliklar)
    const oncelik = dahil ? '1' : '4'

    for (const sinif of kut.siniflar) {
      ekleTekil({
        etiket: sinif,
        tur: 'sinif',
        ekleMetni: sinif,
        snippetMi: false,
        detay: `class ${sinif} · ${kut.kutuphane}`,
        aciklama: kut.aciklama ?? `${kut.kutuphane} kütüphane sınıfı.`,
        siraOnceligi: `${oncelik}_${sinif}`
      })
    }

    for (const uye of kut.uyeler) {
      if (uye.kurucu || uye.sinif) continue
      ekleTekil(kutuphaneUyesindenOneri(uye, kut, 'fonksiyon', oncelik))
    }

    if (dahil) {
      for (const sabit of kut.sabitler) {
        ekleTekil({
          etiket: sabit,
          tur: 'sabit',
          ekleMetni: sabit,
          snippetMi: false,
          detay: `Sabit · ${kut.kutuphane}`,
          aciklama: kut.aciklama,
          siraOnceligi: `1_${sabit}`
        })
      }
      for (const kw of kut.anahtarKelimeler) {
        ekleTekil({
          etiket: kw,
          tur: 'anahtar',
          ekleMetni: kw,
          snippetMi: false,
          detay: `${kut.kutuphane} anahtar kelimesi`,
          siraOnceligi: `1_${kw}`
        })
      }
    } else {
      for (const sabit of kut.sabitler.slice(0, 20)) {
        ekleTekil({
          etiket: sabit,
          tur: 'sabit',
          ekleMetni: sabit,
          snippetMi: false,
          detay: `Sabit · ${kut.kutuphane}`,
          aciklama: kut.aciklama,
          siraOnceligi: `4_${sabit}`
        })
      }
    }
  }

  // 2_ Çekirdek Arduino / ESP32 fonksiyonları, nesneleri ve snippet'leri
  for (const fn of ARDUINO_FONKSIYONLARI) {
    if (avrMi && fn.platform === 'esp32') continue
    ekleTekil(apiFonksiyondanOneri(fn, 'fonksiyon', '2'))
  }
  for (const nesne of ARDUINO_NESNELERI) {
    if (avrMi && nesne.platform === 'esp32') continue
    ekleTekil({
      etiket: nesne.ad,
      tur: nesne.sinifMi ? 'sinif' : 'degisken',
      ekleMetni: nesne.ad,
      snippetMi: false,
      detay: nesne.sinifMi ? `class ${nesne.ad}` : `Yerleşik nesne ${nesne.ad}`,
      aciklama: nesne.aciklama,
      siraOnceligi: `2_${nesne.ad}`
    })
  }
  for (const snip of ARDUINO_SNIPPETLERI) {
    if (avrMi && snip.platform === 'esp32') continue
    ekleTekil({
      etiket: snip.etiket,
      tur: 'snippet',
      ekleMetni: snip.snippet,
      snippetMi: true,
      detay: snip.baslik,
      aciklama: snip.aciklama,
      siraOnceligi: `2_${snip.etiket}`
    })
  }

  // 3_ Çekirdek sabitler, tipler ve seçili karta göre pin sabitleri
  for (const sabit of ARDUINO_SABITLERI) {
    if (avrMi && sabit.platform === 'esp32') continue
    ekleTekil({
      etiket: sabit.ad,
      tur: sabit.tur === 'makro' ? 'makro' : 'sabit',
      ekleMetni: sabit.snippet ?? sabit.ad,
      snippetMi: Boolean(sabit.snippet),
      detay: sabit.deger ? `${sabit.ad} = ${sabit.deger}` : sabit.ad,
      aciklama: sabit.aciklama,
      siraOnceligi: `3_${sabit.ad}`
    })
  }
  for (const pin of kartPinSabitleri(baglam.fqbn)) {
    ekleTekil({
      etiket: pin.ad,
      tur: 'sabit',
      ekleMetni: pin.ad,
      snippetMi: false,
      detay: 'Kart pin sabiti',
      aciklama: pin.aciklama,
      siraOnceligi: `3_${pin.ad}`
    })
  }

  return oneriler
}

function kelimeBul(satirMetni: string, sutun: number): { kelime: string; baslangicSutunu: number } | null {
  const idx = sutun - 1
  let bas = idx
  let son = idx
  const isIdent = (c: string | undefined): boolean => Boolean(c && /[A-Za-z0-9_]/.test(c))
  if (!isIdent(satirMetni[bas]) && isIdent(satirMetni[bas - 1])) bas--
  if (!isIdent(satirMetni[bas])) return null

  while (bas > 0 && isIdent(satirMetni[bas - 1])) bas--
  while (son < satirMetni.length && isIdent(satirMetni[son])) son++
  const kelime = satirMetni.slice(bas, son)
  if (!kelime || /^\d+$/.test(kelime)) return null
  return { kelime, baslangicSutunu: bas + 1 }
}

/** İmleç altındaki sembol için çevrimdışı Türkçe hover açıklaması ve C++ imzası döndürür. */
export function hoverBilgisiBul(baglam: HoverBaglami): HoverBilgisi | null {
  const { offset, satirMetni } = konumuOffseteCevir(baglam.kod, baglam.satir, baglam.sutun)
  if (imlecDurumu(baglam.kod, offset) !== 'normal') return null

  const bulunanKelime = kelimeBul(satirMetni, baglam.sutun)
  if (!bulunanKelime) return null
  const { kelime, baslangicSutunu } = bulunanKelime

  const belge = belgeSembolleriCikar(baglam.kod)
  const oncesi = satirMetni.slice(0, baslangicSutunu - 1)
  const uyeErisim = /([A-Za-z_]\w*)\s*(?:\.|->)\s*$/.exec(oncesi)

  if (uyeErisim) {
    const alici = uyeErisim[1]
    const eslesmeler = nesneSinifUyeEslesmeleriBul(alici, belge, baglam.kutuphaneIndeksi)

    if (eslesmeler.yerlesik) {
      const uye = eslesmeler.yerlesik.uyeler.find((u) => u.ad === kelime)
      if (uye) {
        return {
          baslik: `${eslesmeler.yerlesik.ad}.${uye.ad}`,
          imza: uye.imza,
          aciklama: uye.aciklama,
          kaynak: eslesmeler.yerlesik.sinifMi ? 'Arduino Yerleşik Sınıf' : 'Arduino Yerleşik Nesne'
        }
      }
    }

    const sirali = [...eslesmeler.kutuphaneUyeleri].sort((a, b) => Number(b.dahil) - Number(a.dahil))
    const kutEslesmesi = sirali.find((k) => k.uye.ad === kelime)
    if (kutEslesmesi) {
      return {
        baslik: `${kutEslesmesi.uye.sinif ?? alici}.${kutEslesmesi.uye.ad}`,
        imza: kutEslesmesi.uye.imza,
        aciklama: kutEslesmesi.kut.aciklama ?? `${kutEslesmesi.kut.kutuphane} kütüphane üyesi.`,
        kaynak: `${kutEslesmesi.kut.kutuphane}${kutEslesmesi.kut.surum ? ` v${kutEslesmesi.kut.surum}` : ''}`
      }
    }
    return null
  }

  // Çekirdek fonksiyon
  const fn = ARDUINO_FONKSIYONLARI.find((f) => f.ad === kelime)
  if (fn) {
    const paramMetni =
      fn.parametreler.length > 0
        ? `\n\n**Parametreler:**\n${fn.parametreler.map((p) => `- \`${p.ad}\`: ${p.aciklama}`).join('\n')}`
        : ''
    return {
      baslik: fn.ad,
      imza: fn.imza,
      aciklama: `${fn.aciklama}${paramMetni}`,
      kaynak: `Arduino Çekirdek API · ${fn.kategori}`
    }
  }

  // Yerleşik nesne / sınıf
  const nesne = ARDUINO_NESNELERI.find((n) => n.ad === kelime)
  if (nesne) {
    return {
      baslik: nesne.ad,
      imza: nesne.sinifMi ? `class ${nesne.ad}` : `${nesne.ad} (Yerleşik nesne)`,
      aciklama: nesne.aciklama,
      kaynak: nesne.sinifMi ? 'Arduino Yerleşik Sınıf' : 'Arduino Yerleşik Nesne'
    }
  }

  // Çekirdek sabit / pin sabiti
  const pin = kartPinSabitleri(baglam.fqbn).find((p) => p.ad === kelime)
  if (pin) {
    return { baslik: pin.ad, imza: `#define ${pin.ad}`, aciklama: pin.aciklama, kaynak: 'Seçili Kart Pin Haritası' }
  }
  const sabit = ARDUINO_SABITLERI.find((s) => s.ad === kelime)
  if (sabit) {
    return {
      baslik: sabit.ad,
      imza: sabit.deger ? `${sabit.ad} = ${sabit.deger}` : sabit.ad,
      aciklama: sabit.aciklama,
      kaynak: 'Arduino Sabit / Veri Tipi'
    }
  }

  // Yerel makro, fonksiyon, değişken
  const makro = belge.makrolar.find((m) => m.ad === kelime)
  if (makro) {
    return {
      baslik: makro.ad,
      imza: makro.imza,
      aciklama: makro.deger ? `Makro değeri: \`${makro.deger}\`` : 'Aktif dosyada tanımlı önişlemci makrosu.',
      kaynak: `Aktif Dosya (Satır ${makro.satir})`
    }
  }
  const yerelFonk = belge.fonksiyonlar.find((f) => f.ad === kelime)
  if (yerelFonk) {
    return {
      baslik: yerelFonk.ad,
      imza: yerelFonk.imza,
      aciklama: 'Aktif sketch dosyasında tanımlanan fonksiyon.',
      kaynak: `Aktif Dosya (Satır ${yerelFonk.satir})`
    }
  }
  const yerelDeg = belge.degiskenler.find((d) => d.ad === kelime)
  if (yerelDeg) {
    return {
      baslik: yerelDeg.ad,
      imza: yerelDeg.imza,
      aciklama: `Değişken / nesne tipi: \`${yerelDeg.tip}\``,
      kaynak: `Aktif Dosya (Satır ${yerelDeg.satir})`
    }
  }

  // Kurulu kütüphane sınıf, serbest fonksiyon ve sabitleri (#include öncelikli)
  const kutuphaneler = [...(baglam.kutuphaneIndeksi?.kutuphaneler ?? [])].sort(
    (a, b) => Number(kutuphaneDahilEdildiMi(b, belge.eklenenBasliklar)) - Number(kutuphaneDahilEdildiMi(a, belge.eklenenBasliklar))
  )
  for (const kut of kutuphaneler) {
    const kaynak = `${kut.kutuphane}${kut.surum ? ` v${kut.surum}` : ''}`
    if (kut.siniflar.includes(kelime)) {
      const kurucu = kut.uyeler.find((u) => u.sinif === kelime && u.kurucu)
      return {
        baslik: kelime,
        imza: kurucu ? kurucu.imza : `class ${kelime}`,
        aciklama: kut.aciklama ?? `${kut.kutuphane} kütüphanesinin sağladığı sınıf.`,
        kaynak
      }
    }
    const serbest = kut.uyeler.find((u) => !u.sinif && u.ad === kelime)
    if (serbest) {
      return {
        baslik: serbest.ad,
        imza: serbest.imza,
        aciklama: kut.aciklama ?? `${kut.kutuphane} kütüphane fonksiyonu.`,
        kaynak
      }
    }
    if (kut.sabitler.includes(kelime)) {
      return {
        baslik: kelime,
        imza: `#define ${kelime}`,
        aciklama: kut.aciklama ?? `${kut.kutuphane} kütüphane sabiti.`,
        kaynak
      }
    }
  }

  return null
}

function imzaParametrelerineCevir(fn: ApiFonksiyonKaydi): ImzaBilgisi {
  return {
    etiket: fn.imza,
    aciklama: fn.aciklama,
    parametreler: fn.parametreler.map((p) => ({ etiket: p.imza, aciklama: p.aciklama }))
  }
}

function kutuphaneImzaBilgisineCevir(uye: KutuphaneUyeSembolu, kut: KutuphaneSembolKaydi): ImzaBilgisi {
  const paramParcalari = parametreListesiniBol(uye.parametreler)
  return {
    etiket: uye.imza,
    aciklama: kut.aciklama ? `${kut.kutuphane}: ${kut.aciklama}` : `Kütüphane: ${kut.kutuphane}`,
    parametreler: paramParcalari.map((p) => ({ etiket: p }))
  }
}

/** Parantez içinde parametre yazılırken etkin fonksiyon/metot/kurucu imzasını ve aktif parametre indeksini bulur. */
export function imzaYardimiBul(baglam: ImzaBaglami): ImzaYardimi | null {
  const { offset } = konumuOffseteCevir(baglam.kod, baglam.satir, baglam.sutun)
  if (imlecDurumu(baglam.kod, offset) !== 'normal') return null

  const temiz = yorumlariTemizle(baglam.kod)
  let derinlik = 0
  let virgulSayisi = 0
  let acilanParantezIndeksi = -1

  for (let i = offset - 1; i >= 0; i--) {
    const c = temiz[i]
    if (c === ')') {
      derinlik++
    } else if (c === '(') {
      if (derinlik > 0) {
        derinlik--
      } else {
        acilanParantezIndeksi = i
        break
      }
    } else if (c === ',' && derinlik === 0) {
      virgulSayisi++
    } else if ((c === ';' || c === '{' || c === '}') && derinlik === 0) {
      return null
    }
  }

  if (acilanParantezIndeksi < 0) return null

  const oncesi = temiz.slice(Math.max(0, acilanParantezIndeksi - 160), acilanParantezIndeksi)
  const belge = belgeSembolleriCikar(baglam.kod)

  // 1) Üye çağrısı: alici.metot( veya alici->metot(
  const uyeCagri = /([A-Za-z_]\w*)\s*(?:\.|->)\s*([A-Za-z_]\w*)\s*$/.exec(oncesi)
  if (uyeCagri) {
    const [, alici, metotAdi] = uyeCagri
    const eslesmeler = nesneSinifUyeEslesmeleriBul(alici, belge, baglam.kutuphaneIndeksi)
    const imzalar: ImzaBilgisi[] = []

    if (eslesmeler.yerlesik) {
      for (const u of eslesmeler.yerlesik.uyeler) {
        if (u.ad === metotAdi) imzalar.push(imzaParametrelerineCevir(u))
      }
    }
    const sirali = [...eslesmeler.kutuphaneUyeleri].sort((a, b) => Number(b.dahil) - Number(a.dahil))
    for (const { kut, uye } of sirali) {
      if (uye.ad === metotAdi) imzalar.push(kutuphaneImzaBilgisineCevir(uye, kut))
    }
    if (imzalar.length === 0) return null
    return { imzalar, aktifImza: 0, aktifParametre: virgulSayisi }
  }

  // 2) Kurucu deklarasyonu: SinifAdi nesne(
  const kurucuDeklarasyon = /(?:^|[\s;{}])([A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*$/.exec(oncesi)
  if (kurucuDeklarasyon) {
    const [, olasiSinif] = kurucuDeklarasyon
    if (!KONTROL_ANAHTARLARI.has(olasiSinif) && !ILKEL_TIPLER.has(olasiSinif)) {
      const imzalar: ImzaBilgisi[] = []
      for (const kut of baglam.kutuphaneIndeksi?.kutuphaneler ?? []) {
        for (const u of kut.uyeler) {
          if (u.sinif === olasiSinif && u.kurucu) {
            imzalar.push(kutuphaneImzaBilgisineCevir(u, kut))
          }
        }
      }
      if (imzalar.length > 0) {
        return { imzalar, aktifImza: 0, aktifParametre: virgulSayisi }
      }
    }
  }

  // 3) Serbest fonksiyon veya doğrudan kurucu / makro çağrısı: ad(
  const fonkCagri = /([A-Za-z_]\w*)\s*$/.exec(oncesi)
  if (!fonkCagri) return null
  const hedefAd = fonkCagri[1]
  if (KONTROL_ANAHTARLARI.has(hedefAd)) return null

  const imzalar: ImzaBilgisi[] = []
  for (const fn of ARDUINO_FONKSIYONLARI) {
    if (fn.ad === hedefAd) imzalar.push(imzaParametrelerineCevir(fn))
  }
  for (const kut of baglam.kutuphaneIndeksi?.kutuphaneler ?? []) {
    for (const u of kut.uyeler) {
      if (u.ad === hedefAd && (!u.sinif || u.kurucu)) {
        imzalar.push(kutuphaneImzaBilgisineCevir(u, kut))
      }
    }
  }
  for (const fn of belge.fonksiyonlar) {
    if (fn.ad === hedefAd) {
      imzalar.push({
        etiket: fn.imza,
        aciklama: `Bu dosyadaki yerel fonksiyon (Satır ${fn.satir}).`,
        parametreler: parametreListesiniBol(fn.parametreler).map((p) => ({ etiket: p }))
      })
    }
  }
  for (const m of belge.makrolar) {
    if (m.ad === hedefAd && m.parametreler !== undefined) {
      imzalar.push({
        etiket: m.imza,
        aciklama: `Bu dosyadaki işlevsel makro (Satır ${m.satir}).`,
        parametreler: parametreListesiniBol(m.parametreler).map((p) => ({ etiket: p }))
      })
    }
  }

  if (imzalar.length === 0) return null
  return { imzalar, aktifImza: 0, aktifParametre: virgulSayisi }
}
