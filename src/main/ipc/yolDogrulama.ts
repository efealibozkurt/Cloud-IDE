import { basename, extname, isAbsolute } from 'path'

/**
 * IPC parametreleri için ortak doğrulayıcılar. Renderer güvenilir sayılmaz: yol, komut satırı
 * bağımsız değişkeni ve adres değerleri main tarafında doğrulanır (savunma derinliği).
 */

/** Okunabilen dosya uzantıları (kaynak + kütüphane başlık/kaynakları + not/metin dosyaları) */
const OKUNABILIR = new Set(['.ino', '.h', '.hpp', '.cpp', '.c', '.cc', '.hh', '.tpp', '.ipp', '.inc', '.s', '.md', '.txt'])
/** Yazılabilen/silinebilen dosya uzantıları */
const YAZILABILIR = new Set(['.ino', '.h', '.hpp', '.cpp', '.c'])
/** Proje notları: sketch klasöründe tutulan kaynak-dışı dosya */
const NOT_DOSYASI = 'NOTLAR.md'
/** Bağlantı kılavuzu: sketch klasöründe tutulan etkileşimli kablolama verisi */
const BAGLANTI_DOSYASI = 'BAGLANTI.json'

export function mutlakYol(v: unknown, ad = 'Yol'): string {
  if (typeof v !== 'string' || v.length === 0 || v.length > 1024 || v.includes('\0') || !isAbsolute(v)) {
    throw new Error(`${ad} geçersiz`)
  }
  return v
}

export function okunabilirDosya(v: unknown): string {
  const yol = mutlakYol(v, 'Dosya yolu')
  if (basename(yol) === BAGLANTI_DOSYASI) return yol
  if (!OKUNABILIR.has(extname(yol).toLowerCase())) throw new Error('Bu dosya türü okunamaz')
  return yol
}

export function yazilabilirDosya(v: unknown): string {
  const yol = mutlakYol(v, 'Dosya yolu')
  const ad = basename(yol)
  if (ad === NOT_DOSYASI || ad === BAGLANTI_DOSYASI) return yol
  if (!YAZILABILIR.has(extname(yol).toLowerCase())) throw new Error('Yalnızca .ino, .h, .hpp, .cpp ve .c dosyaları değiştirilebilir')
  return yol
}

/**
 * arduino-cli'ye bağımsız değişken olarak giden metinler (kart kimliği, port, paket adı, arama…).
 * `-` ile başlayan değer bayrak enjeksiyonu olurdu; satır sonu/NUL de reddedilir. Boş metne izin verilir.
 */
export function bayraksizMetin(v: unknown, ad = 'Değer', enFazla = 500): string {
  if (typeof v !== 'string' || v.length > enFazla || /[\0\r\n]/.test(v) || v.trimStart().startsWith('-')) {
    throw new Error(`${ad} geçersiz`)
  }
  return v
}

export function istegeBagliBayraksiz(v: unknown, ad: string): string | undefined {
  return v === undefined || v === null ? undefined : bayraksizMetin(v, ad)
}

/** Yalnızca http(s) adresleri (kart yöneticisi adresleri gibi) */
export function httpAdresi(v: unknown, ad = 'Adres'): string {
  if (typeof v !== 'string' || v.length > 2000) throw new Error(`${ad} geçersiz`)
  let u: URL
  try {
    u = new URL(v)
  } catch {
    throw new Error(`${ad} geçersiz`)
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error(`${ad} http veya https olmalı`)
  return v
}

/** Sistem tarayıcısında açılmasına izin verilen adresler */
export function disAdresMi(v: string): boolean {
  try {
    const p = new URL(v).protocol
    return p === 'https:' || p === 'http:' || p === 'mailto:'
  } catch {
    return false
  }
}
