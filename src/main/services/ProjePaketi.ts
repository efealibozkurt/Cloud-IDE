import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { basename, extname, join, resolve, sep } from 'path'
import { deflateRawSync, inflateRawSync } from 'zlib'

/**
 * Proje paketi: bir sketch klasörünü (kaynak dosyalar + `.history` sürüm geçmişi) tek bir .zip'e
 * yazar ve geri açar. Ek bağımlılık yoktur; yalnızca zlib ile ZIP'in gereken alt kümesini
 * (store/deflate, şifresiz, ZIP64 yok) uygular. Açarken sınırlar ve yol doğrulaması uygulanır.
 */

export interface ZipGirdisi {
  ad: string
  veri: Buffer
}

const KAYNAK_UZANTILARI = new Set(['.ino', '.h', '.hpp', '.cpp', '.c'])
/** Kaynak olmayan ama pakete giren tek dosya: proje notları */
const NOTLAR_DOSYASI = 'NOTLAR.md'

function paketlenebilirMi(ad: string): boolean {
  return ad === NOTLAR_DOSYASI || KAYNAK_UZANTILARI.has(extname(ad).toLowerCase())
}
const MAKS_GIRDI = 5000
const MAKS_DOSYA_BAYT = 16 * 1024 * 1024
const MAKS_TOPLAM_BAYT = 128 * 1024 * 1024

// ───────── CRC32 ─────────

const CRC_TABLOSU = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(veri: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < veri.length; i++) c = CRC_TABLOSU[(c ^ veri[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ───────── yazma ─────────

function dosVakti(d: Date): { saat: number; tarih: number } {
  return {
    saat: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    tarih: (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  }
}

export function zipYaz(girdiler: ZipGirdisi[]): Buffer {
  const parcalar: Buffer[] = []
  const merkez: Buffer[] = []
  let konum = 0
  const { saat, tarih } = dosVakti(new Date())
  for (const g of girdiler) {
    const ad = Buffer.from(g.ad, 'utf8')
    const sikisik = deflateRawSync(g.veri)
    const kullan = sikisik.length < g.veri.length
    const veri = kullan ? sikisik : g.veri
    const yontem = kullan ? 8 : 0
    const crc = crc32(g.veri)

    const yerel = Buffer.alloc(30)
    yerel.writeUInt32LE(0x04034b50, 0)
    yerel.writeUInt16LE(20, 4)
    yerel.writeUInt16LE(0x0800, 6) // UTF-8 dosya adı
    yerel.writeUInt16LE(yontem, 8)
    yerel.writeUInt16LE(saat, 10)
    yerel.writeUInt16LE(tarih, 12)
    yerel.writeUInt32LE(crc, 14)
    yerel.writeUInt32LE(veri.length, 18)
    yerel.writeUInt32LE(g.veri.length, 22)
    yerel.writeUInt16LE(ad.length, 26)
    yerel.writeUInt16LE(0, 28)
    parcalar.push(yerel, ad, veri)

    const m = Buffer.alloc(46)
    m.writeUInt32LE(0x02014b50, 0)
    m.writeUInt16LE(20, 4)
    m.writeUInt16LE(20, 6)
    m.writeUInt16LE(0x0800, 8)
    m.writeUInt16LE(yontem, 10)
    m.writeUInt16LE(saat, 12)
    m.writeUInt16LE(tarih, 14)
    m.writeUInt32LE(crc, 16)
    m.writeUInt32LE(veri.length, 20)
    m.writeUInt32LE(g.veri.length, 24)
    m.writeUInt16LE(ad.length, 28)
    m.writeUInt32LE(konum, 42)
    merkez.push(m, ad)
    konum += 30 + ad.length + veri.length
  }
  const merkezBoyut = merkez.reduce((t, b) => t + b.length, 0)
  const son = Buffer.alloc(22)
  son.writeUInt32LE(0x06054b50, 0)
  son.writeUInt16LE(girdiler.length, 8)
  son.writeUInt16LE(girdiler.length, 10)
  son.writeUInt32LE(merkezBoyut, 12)
  son.writeUInt32LE(konum, 16)
  return Buffer.concat([...parcalar, ...merkez, son])
}

// ───────── okuma ─────────

/** ZIP içindeki bir yol adını güvenli, göreli ve '/' ayraçlı hale getirir; güvensizse null. */
export function guvenliYol(ham: string): string | null {
  const ad = ham.replace(/\\/g, '/')
  if (!ad || ad.startsWith('/') || /^[A-Za-z]:/.test(ad) || ad.includes('\0')) return null
  const parcalar = ad.split('/').filter((p) => p !== '' && p !== '.')
  if (parcalar.length === 0 || parcalar.some((p) => p === '..')) return null
  return parcalar.join('/')
}

export function zipOku(tampon: Buffer): ZipGirdisi[] {
  // Merkez dizin sonu kaydını sondan ara (en fazla 64 KB yorum payı)
  let eocd = -1
  for (let i = tampon.length - 22; i >= Math.max(0, tampon.length - 22 - 65535); i--) {
    if (tampon.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('Geçerli bir ZIP dosyası değil')
  const sayi = tampon.readUInt16LE(eocd + 10)
  let konum = tampon.readUInt32LE(eocd + 16)
  if (sayi === 0xffff || konum === 0xffffffff) throw new Error('ZIP64 desteklenmiyor')
  if (sayi > MAKS_GIRDI) throw new Error('ZIP içinde çok fazla dosya var')

  const sonuc: ZipGirdisi[] = []
  let toplam = 0
  for (let n = 0; n < sayi; n++) {
    if (konum + 46 > tampon.length || tampon.readUInt32LE(konum) !== 0x02014b50) throw new Error('ZIP dizini bozuk')
    const bayrak = tampon.readUInt16LE(konum + 8)
    const yontem = tampon.readUInt16LE(konum + 10)
    const crc = tampon.readUInt32LE(konum + 16)
    const sikisikBoyut = tampon.readUInt32LE(konum + 20)
    const boyut = tampon.readUInt32LE(konum + 24)
    const adUzunluk = tampon.readUInt16LE(konum + 28)
    const ekUzunluk = tampon.readUInt16LE(konum + 30)
    const yorumUzunluk = tampon.readUInt16LE(konum + 32)
    const yerelKonum = tampon.readUInt32LE(konum + 42)
    const ad = tampon.toString('utf8', konum + 46, konum + 46 + adUzunluk)
    konum += 46 + adUzunluk + ekUzunluk + yorumUzunluk

    if (ad.endsWith('/')) continue // klasör girdisi
    if (bayrak & 1) throw new Error('Şifreli ZIP desteklenmiyor')
    if (boyut > MAKS_DOSYA_BAYT) throw new Error(`Dosya çok büyük: ${ad}`)
    toplam += boyut
    if (toplam > MAKS_TOPLAM_BAYT) throw new Error('Paket çok büyük')

    if (yerelKonum + 30 > tampon.length || tampon.readUInt32LE(yerelKonum) !== 0x04034b50) throw new Error('ZIP dizini bozuk')
    const yerelAd = tampon.readUInt16LE(yerelKonum + 26)
    const yerelEk = tampon.readUInt16LE(yerelKonum + 28)
    const baslangic = yerelKonum + 30 + yerelAd + yerelEk
    const ham = tampon.subarray(baslangic, baslangic + sikisikBoyut)
    if (ham.length !== sikisikBoyut) throw new Error('ZIP verisi eksik')
    let veri: Buffer
    if (yontem === 0) veri = Buffer.from(ham)
    else if (yontem === 8) veri = inflateRawSync(ham, { maxOutputLength: MAKS_DOSYA_BAYT })
    else throw new Error('Desteklenmeyen sıkıştırma yöntemi')
    if (veri.length !== boyut || crc32(veri) !== crc) throw new Error(`Dosya bozuk: ${ad}`)
    sonuc.push({ ad, veri })
  }
  return sonuc
}

// ───────── proje paketi ─────────

const NESNE_AD = /^[a-f0-9]{64}$/
const KAYIT_AD = /^[a-z0-9]{8,40}\.json$/

/** Proje klasörünü (kaynak dosyalar + .history) ZIP olarak paketler. Girdi adları `<proje>/…` ile başlar. */
export function projeyiPaketle(projeKlasoru: string): Buffer {
  const kok = resolve(projeKlasoru)
  const ad = basename(kok)
  const girdiler: ZipGirdisi[] = []
  for (const g of readdirSync(kok, { withFileTypes: true })) {
    if (g.isFile() && paketlenebilirMi(g.name)) {
      girdiler.push({ ad: `${ad}/${g.name}`, veri: readFileSync(join(kok, g.name)) })
    }
  }
  const gecmis = join(kok, '.history')
  if (existsSync(gecmis)) {
    if (existsSync(join(gecmis, 'refs.json'))) girdiler.push({ ad: `${ad}/.history/refs.json`, veri: readFileSync(join(gecmis, 'refs.json')) })
    for (const [alt, desen] of [
      ['objects', NESNE_AD],
      ['commits', KAYIT_AD]
    ] as const) {
      const klasor = join(gecmis, alt)
      if (!existsSync(klasor)) continue
      for (const dosya of readdirSync(klasor)) {
        if (desen.test(dosya) && statSync(join(klasor, dosya)).isFile()) {
          girdiler.push({ ad: `${ad}/.history/${alt}/${dosya}`, veri: readFileSync(join(klasor, dosya)) })
        }
      }
    }
  }
  if (!girdiler.some((g) => g.ad.toLowerCase().endsWith('.ino'))) throw new Error('Pakete eklenecek bir .ino dosyası bulunamadı')
  return zipYaz(girdiler)
}

function benzersizKlasor(ust: string, ad: string): string {
  let aday = join(ust, ad)
  for (let i = 2; existsSync(aday); i++) aday = join(ust, `${ad}_${i}`)
  return aday
}

/**
 * Paketi `hedefUst` altında yeni bir proje klasörüne açar (mevcut klasörlerin üzerine yazmaz) ve yolunu
 * döndürür. Yalnızca kaynak dosyalar ile geçmiş deposunun bilinen dosya adlarına izin verilir.
 */
export function projePaketiniAc(tampon: Buffer, hedefUst: string): string {
  const girdiler = zipOku(tampon)
  const temiz: Array<{ parcalar: string[]; veri: Buffer }> = []
  for (const g of girdiler) {
    const yol = guvenliYol(g.ad)
    if (!yol) throw new Error(`Güvensiz dosya yolu: ${g.ad}`)
    temiz.push({ parcalar: yol.split('/'), veri: g.veri })
  }
  const kokler = new Set(temiz.map((t) => t.parcalar[0]))
  if (kokler.size !== 1 || temiz.some((t) => t.parcalar.length < 2)) throw new Error('Paket tek bir proje klasörü içermeli')
  const projeAdi = [...kokler][0]
  if (!/^[\p{L}\p{N}._ -]{1,80}$/u.test(projeAdi) || projeAdi.startsWith('.')) throw new Error('Geçersiz proje adı')

  const izinli = temiz.filter((t) => {
    const [, a, b, c] = t.parcalar
    if (t.parcalar.length === 2) return paketlenebilirMi(a) && !a.startsWith('.')
    if (a !== '.history') return false
    if (t.parcalar.length === 3) return b === 'refs.json'
    if (t.parcalar.length === 4) return (b === 'objects' && NESNE_AD.test(c)) || (b === 'commits' && KAYIT_AD.test(c))
    return false
  })
  if (!izinli.some((t) => t.parcalar.length === 2 && t.parcalar[1].toLowerCase().endsWith('.ino'))) {
    throw new Error('Pakette .ino dosyası yok')
  }

  mkdirSync(hedefUst, { recursive: true })
  const hedef = benzersizKlasor(hedefUst, projeAdi)
  const hedefTam = resolve(hedef)
  // Klasör adı değiştiyse (aynı adlı proje vardı) ana .ino da klasörle aynı adı almalı; geçmiş kayıtları buna uyarlanır
  const hedefAdi = basename(hedefTam)
  const anaEski = `${projeAdi}.ino`.toLowerCase()
  const yeniAd = (ad: string): string => (hedefAdi !== projeAdi && ad.toLowerCase() === anaEski ? `${hedefAdi}.ino` : ad)
  for (const t of izinli) {
    const goreli = t.parcalar.slice(1)
    let veri = t.veri
    if (goreli.length === 1) {
      goreli[0] = yeniAd(goreli[0])
    } else if (goreli[1] === 'commits' && hedefAdi !== projeAdi) {
      const kayit = JSON.parse(veri.toString('utf8')) as { dosyalar?: Record<string, string> }
      if (kayit.dosyalar) {
        kayit.dosyalar = Object.fromEntries(Object.entries(kayit.dosyalar).map(([ad, sha]) => [yeniAd(ad), sha]))
        veri = Buffer.from(JSON.stringify(kayit))
      }
    }
    const dosya = resolve(hedefTam, ...goreli)
    if (!dosya.startsWith(hedefTam + sep)) throw new Error('Güvensiz dosya yolu')
    mkdirSync(resolve(dosya, '..'), { recursive: true })
    writeFileSync(dosya, veri)
  }
  return hedefTam
}
