/**
 * Sorun bildirme raporu: sistem/kart/derleme bilgisini okunur bir Markdown metnine çevirir ve paylaşmadan
 * önce kişisel bilgileri (kullanıcı adı, API anahtarı, e-posta, IP) temizler. Saf fonksiyonlar; Electron'a bağlı değildir.
 */

export interface SistemBilgisi {
  uygulamaSurumu: string
  kodAdi: string
  electron: string
  chrome: string
  node: string
  isletimSistemi: string
  mimari: string
  ramGb: number
  cliSurumu: string | null
  kartPaketleri: Array<{ id: string; surum: string }>
  kutuphaneler: Array<{ ad: string; surum: string }>
  /** Ana sürecin son uyarı/hata satırları */
  anaGunluk: string[]
}

export interface RaporSecimleri {
  sistem: boolean
  kart: boolean
  paketler: boolean
  derleme: boolean
  gunluk: boolean
  kod: boolean
}

export interface RaporGirdisi {
  sistem: SistemBilgisi
  aciklama: string
  kart?: { fqbn: string; secenekler?: Record<string, string> } | null
  ayarlar?: Record<string, string | number | boolean | null | undefined>
  derleme?: {
    basarili: boolean | null
    hatalar: Array<{ dosya: string; satir: number; tur: string; mesaj: string }>
    cikti: string
  }
  arayuzGunlugu?: string[]
  kod?: { dosya: string; icerik: string } | null
  secimler: RaporSecimleri
  /** ISO tarih; testlerde sabitlenebilsin diye dışarıdan verilir */
  zaman: string
}

export interface TemizlemeBaglami {
  anaDizin?: string
  kullaniciAdi?: string
}

const KOD_SATIR_SINIRI = 250
const CIKTI_SATIR_SINIRI = 80
const UZUN_SATIR_SINIRI = 300
const GITHUB_SORUN_ADRESI = 'https://github.com/efealibozkurt/Cloud-IDE/issues/new'

function regexKacir(m: string): string {
  return m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Kişisel bilgileri (yol, kullanıcı adı, API anahtarı, e-posta, IP, URL içi kimlik) temizler. */
export function metniTemizle(metin: string, ctx: TemizlemeBaglami = {}): string {
  let s = metin
  if (ctx.anaDizin) {
    const duz = ctx.anaDizin.replace(/[\\/]+$/, '')
    if (duz.length > 2) {
      // Hem ters hem düz eğik çizgili yazımları yakala
      // JSON içinde kaçışlı yollar (C:\\Users\\Ali) için birden çok ters eğik çizgiyi de kabul et
      const kalip = duz.split(/[\\/]/).map(regexKacir).join('(?:\\\\+|/)')
      s = s.replace(new RegExp(kalip, 'gi'), '~')
    }
  }
  // C:\Users\<ad>\ (ad boşluk içerebilir: "Ali Veli"), /Users/<ad>/, /home/<ad>/
  s = s.replace(/([A-Za-z]:[\\/]+Users[\\/]+)[^\\/\r\n"']+(?=[\\/])/gi, '$1<kullanici>')
  s = s.replace(/([A-Za-z]:[\\/]+Users[\\/]+)[^\\/\s"']+/gi, '$1<kullanici>')
  s = s.replace(/(\/(?:Users|home)\/)[^/\r\n"']+(?=\/)/g, '$1<kullanici>')
  s = s.replace(/(\/(?:Users|home)\/)[^/\s"']+/g, '$1<kullanici>')
  // UNC yolları: \\BILGISAYAR\paylasim (satır başında ya da boşluk/tırnaktan sonra)
  s = s.replace(/(^|[\s"'(=])(\\\\)[A-Za-z0-9._-]+(?=\\)/gm, '$1$2<sunucu>')
  if (ctx.kullaniciAdi && ctx.kullaniciAdi.length >= 3) {
    // \b ASCII dışı harflerde (çağrı) çalışmaz; Unicode sınırlarını kullan
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{N}])${regexKacir(ctx.kullaniciAdi)}(?![\\p{L}\\p{N}])`, 'giu'), '<kullanici>')
  }
  // API anahtarları ve belirteçler
  s = s.replace(/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}/g, '<api-anahtari>')
  s = s.replace(/\bAIza[0-9A-Za-z_-]{20,}/g, '<api-anahtari>')
  s = s.replace(/\bnvapi-[A-Za-z0-9_-]{16,}/g, '<api-anahtari>')
  s = s.replace(/\bgh[pousr]_[A-Za-z0-9]{20,}/g, '<api-anahtari>')
  s = s.replace(/\bgithub_pat_[A-Za-z0-9_]{22,}/g, '<api-anahtari>')
  s = s.replace(/\bglpat-[A-Za-z0-9_-]{16,}/g, '<api-anahtari>')
  s = s.replace(/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, '<api-anahtari>')
  s = s.replace(/\bsk_(?:live|test)_[A-Za-z0-9]{16,}/g, '<api-anahtari>')
  s = s.replace(/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, '<api-anahtari>')
  s = s.replace(/\bya29\.[A-Za-z0-9_-]{20,}/g, '<api-anahtari>')
  // JWT: üç parçalı, eyJ ile başlayan belirteç
  s = s.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '<jwt>')
  s = s.replace(/\b((?:Bearer|Basic|Token)\s+)[A-Za-z0-9._~+/=-]{16,}/gi, '$1<belirtec>')
  // anahtar: değer çiftleri; JSON ("api_key": "...") ve tırnak içinde boşluklu değerler dahil
  s = s.replace(
    /\b((?:api[_-]?key|token|secret|password|parola|sifre)["']?\s*[:=]\s*)(?:"[^"\r\n]{4,}"|'[^'\r\n]{4,}'|[^\s"',;]{6,})/gi,
    '$1<gizli>'
  )
  // Kod içinde Wi-Fi adı/şifresi ve parola atamaları: const char* WIFI_SIFRE = "..."
  s = s.replace(/\b(\w*(?:sifre|password|pass|psk|ssid|wifi)\w*\s*=\s*)"[^"\r\n]*"/gi, '$1"<gizli>"')
  s = s.replace(/(WiFi\s*\.\s*begin\s*\(\s*)"[^"\r\n]*"(\s*,\s*)"[^"\r\n]*"/g, '$1"<gizli>"$2"<gizli>"')
  // URL içindeki kullanıcı[:parola] (her protokol)
  s = s.replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s@:]+(?::[^/\s@]+)?@/gi, '$1<kimlik>@')
  // E-posta
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<e-posta>')
  // IPv4 (yerel döngü adresi hariç)
  s = s.replace(/\b(?!127\.0\.0\.1\b)(?:\d{1,3}\.){3}\d{1,3}\b/g, (ip) => (ip.split('.').every((p) => Number(p) <= 255) ? '<ip>' : ip))
  // IPv6: yalnızca "::" içerenler ya da tam 8 gruplu olanlar (saat 10:15:32 gibi değerleri bozmasın); ::1 korunur
  s = s.replace(/\b(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b/gi, '<ipv6>')
  s = s.replace(/\b(?:[0-9a-f]{1,4}:){1,6}:(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,5})?(?![0-9a-z:])/gi, '<ipv6>')
  return s
}

/** Derleyicinin çok uzun komut satırlarını ve boş satırları ayıklayıp son N satırı alır. */
export function ciktiyiKisalt(cikti: string, enFazlaSatir = CIKTI_SATIR_SINIRI): string {
  const hataDeseni = /:\d+:\d+:\s+(?:fatal\s+)?(?:error|warning)/i
  const satirlar = cikti
    .split(/\r?\n/)
    .map((s) => s.trimEnd())
    .filter((s) => s.trim() && (s.length <= UZUN_SATIR_SINIRI || hataDeseni.test(s)))
  return satirlar.slice(-enFazlaSatir).join('\n')
}

function kodBlogu(icerik: string): string {
  // İçerikte ``` varsa çit uzunluğunu artır
  const cit = icerik.includes('```') ? '````' : '```'
  return `${cit}\n${icerik}\n${cit}`
}

export function raporuBicimle(g: RaporGirdisi, ctx: TemizlemeBaglami = {}): string {
  const s = g.secimler
  const p: string[] = []
  p.push('# Cloud IDE sorun raporu', '', `Oluşturulma: ${g.zaman}`, '')
  p.push('## Açıklama', '', g.aciklama.trim() || '_(Açıklama girilmedi)_', '')

  if (s.sistem) {
    const si = g.sistem
    p.push(
      '## Sistem',
      '',
      `- Cloud IDE: v${si.uygulamaSurumu} ${si.kodAdi}`,
      `- Electron ${si.electron} · Chrome ${si.chrome} · Node ${si.node}`,
      `- İşletim sistemi: ${si.isletimSistemi} (${si.mimari}), RAM ${si.ramGb} GB`,
      `- arduino-cli: ${si.cliSurumu ?? 'bulunamadı'}`,
      ''
    )
    if (g.ayarlar && Object.keys(g.ayarlar).length > 0) {
      p.push('### Ayarlar', '')
      for (const [k, v] of Object.entries(g.ayarlar)) if (v !== undefined && v !== null && v !== '') p.push(`- ${k}: ${String(v)}`)
      p.push('')
    }
  }

  if (s.kart) {
    p.push('## Kart', '')
    if (g.kart) {
      p.push(`- Kart: \`${g.kart.fqbn}\``)
      const sec = Object.entries(g.kart.secenekler ?? {})
      if (sec.length) p.push(`- Kart ayarları: ${sec.map(([k, v]) => `${k}=${v}`).join(', ')}`)
    } else p.push('- Kart seçilmemiş')
    p.push('')
  }

  if (s.paketler) {
    const si = g.sistem
    p.push(`## Kurulu kart paketleri (${si.kartPaketleri.length})`, '')
    for (const k of si.kartPaketleri) p.push(`- ${k.id} ${k.surum}`)
    if (si.kartPaketleri.length === 0) p.push('- (yok)')
    p.push('', `## Kurulu kütüphaneler (${si.kutuphaneler.length})`, '')
    for (const k of si.kutuphaneler.slice(0, 120)) p.push(`- ${k.ad} ${k.surum}`)
    if (si.kutuphaneler.length > 120) p.push(`- … ve ${si.kutuphaneler.length - 120} kütüphane daha`)
    if (si.kutuphaneler.length === 0) p.push('- (yok)')
    p.push('')
  }

  if (s.derleme && g.derleme) {
    const d = g.derleme
    p.push(`## Son derleme (${d.basarili === null ? 'yapılmadı' : d.basarili ? 'başarılı' : 'başarısız'})`, '')
    if (d.hatalar.length) {
      p.push('### Hatalar', '')
      for (const h of d.hatalar.slice(0, 40)) p.push(`- ${h.dosya.split(/[\\/]/).pop()}:${h.satir} ${h.tur}: ${h.mesaj}`)
      p.push('')
    }
    const cikti = ciktiyiKisalt(d.cikti)
    if (cikti) p.push('### Çıktı (son satırlar)', '', kodBlogu(cikti), '')
  }

  if (s.gunluk) {
    const ana = g.sistem.anaGunluk.slice(-40)
    const arayuz = (g.arayuzGunlugu ?? []).slice(-40)
    if (ana.length || arayuz.length) {
      p.push('## Uygulama günlüğü', '')
      if (ana.length) p.push('### Ana süreç', '', kodBlogu(ana.join('\n')), '')
      if (arayuz.length) p.push('### Arayüz', '', kodBlogu(arayuz.join('\n')), '')
    }
  }

  if (s.kod && g.kod) {
    const satirlar = g.kod.icerik.split(/\r?\n/)
    const kirpildi = satirlar.length > KOD_SATIR_SINIRI
    p.push(`## Kod: ${g.kod.dosya.split(/[\\/]/).pop()}`, '', kodBlogu(satirlar.slice(0, KOD_SATIR_SINIRI).join('\n')))
    if (kirpildi) p.push('', `_(İlk ${KOD_SATIR_SINIRI} satır gösterildi)_`)
    p.push('')
  }

  return metniTemizle(p.join('\n'), ctx)
}

/** GitHub "yeni sorun" adresi: başlık ve (uzunluk sınırına uygun) gövde önceden doldurulur. */
export function sorunAdresi(baslik: string, govde: string, enFazlaGovde = 5500): string {
  let g = govde
  if (g.length > enFazlaGovde) {
    g = `${g.slice(0, enFazlaGovde)}\n\n… (rapor kısaltıldı; tam rapor için dosyayı ekleyin)`
  }
  const b = baslik.trim().slice(0, 120) || 'Sorun bildirimi'
  return `${GITHUB_SORUN_ADRESI}?title=${encodeURIComponent(b)}&body=${encodeURIComponent(g)}`
}

export const SORUN_ADRESI_TABANI = GITHUB_SORUN_ADRESI
