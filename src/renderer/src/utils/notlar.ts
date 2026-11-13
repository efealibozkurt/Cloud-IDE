/**
 * Proje notları (NOTLAR.md): çok basit bir Markdown alt kümesi — başlıklar, madde işaretleri, onay kutuları.
 * Onay kutuları ön izlemede tıklanarak işaretlenir.
 */

export const NOTLAR_DOSYA_ADI = 'NOTLAR.md'

export const NOTLAR_SABLONU = `# Proje notları

## Kullanılan parçalar
-

## Bağlantılar
-

## Yapılacaklar
- [ ]
`

export type NotSatiri =
  | { tur: 'baslik1' | 'baslik2'; metin: string }
  | { tur: 'kutu'; metin: string; isaretli: boolean; satir: number }
  | { tur: 'madde' | 'metin'; metin: string }
  | { tur: 'bos' }

const KUTU = /^\s*[-*]\s+\[( |x|X)\]\s?(.*)$/

/** Metni satır türlerine ayırır; `kutu` satırları, metindeki satır numarasını (0 tabanlı) taşır. */
export function notSatirlariniAyir(metin: string): NotSatiri[] {
  return metin.split(/\r?\n/).map((s, i): NotSatiri => {
    if (!s.trim()) return { tur: 'bos' }
    const kutu = KUTU.exec(s)
    if (kutu) return { tur: 'kutu', metin: kutu[2], isaretli: kutu[1].toLowerCase() === 'x', satir: i }
    if (s.startsWith('## ')) return { tur: 'baslik2', metin: s.slice(3) }
    if (s.startsWith('# ')) return { tur: 'baslik1', metin: s.slice(2) }
    const madde = /^\s*[-*]\s+(.*)$/.exec(s)
    if (madde) return { tur: 'madde', metin: madde[1] }
    return { tur: 'metin', metin: s }
  })
}

/** Verilen satırdaki onay kutusunu tersler; satır bir onay kutusu değilse metni değiştirmez. */
export function kutuyuDegistir(metin: string, satirNo: number): string {
  const satirlar = metin.split('\n')
  const s = satirlar[satirNo]
  if (s === undefined || !KUTU.test(s.replace(/\r$/, ''))) return metin
  satirlar[satirNo] = /\[( )\]/.test(s) ? s.replace('[ ]', '[x]') : s.replace(/\[[xX]\]/, '[ ]')
  return satirlar.join('\n')
}

/** Tamamlanan / toplam onay kutusu sayısı */
export function kutuIlerlemesi(metin: string): { yapilan: number; toplam: number } {
  let yapilan = 0
  let toplam = 0
  for (const s of notSatirlariniAyir(metin)) {
    if (s.tur === 'kutu') {
      toplam++
      if (s.isaretli) yapilan++
    }
  }
  return { yapilan, toplam }
}

/** Kart paketiyle gelen, ayrıca kütüphane sayılmayan yaygın başlıklar */
const GOMULU_BASLIKLAR = new Set(['Arduino.h', 'Wire.h', 'SPI.h', 'EEPROM.h', 'SoftwareSerial.h', 'Stepper.h', 'SD.h', 'WiFi.h', 'WiFiClient.h', 'WebServer.h', 'HTTPClient.h', 'ESP8266WiFi.h', 'ESP8266WebServer.h', 'Preferences.h', 'BluetoothSerial.h', 'BLEDevice.h', 'Ethernet.h'])

/** Kaynak kodlardaki `#include <X.h>` satırlarından (gömülü olmayan) kütüphane başlıkları, tekrarsız ve sıralı. */
export function kutuphaneBaslikliklariniBul(kodlar: string[]): string[] {
  const bulunan = new Set<string>()
  for (const kod of kodlar) {
    for (const m of kod.matchAll(/^\s*#\s*include\s*<\s*([A-Za-z0-9_+./-]+\.(?:h|hpp))\s*>/gm)) {
      const ad = m[1].split('/').pop() ?? m[1]
      if (!GOMULU_BASLIKLAR.has(ad)) bulunan.add(ad)
    }
  }
  return [...bulunan].sort((a, b) => a.localeCompare(b))
}

/** Koddan çıkarılan kütüphane ve pin bilgisini notlara eklenecek bir Markdown bloğu olarak yazar. */
export function koddanOzetBlogu(
  kutuphaneler: string[],
  pinler: Array<{ pin: number; roller: string[] }>,
  kart: string | null,
  tarih = new Date()
): string {
  const satirlar = [`## Koddan çıkarıldı (${tarih.toLocaleDateString('tr-TR')})`]
  if (kart) satirlar.push(`- Kart: ${kart}`)
  if (kutuphaneler.length) satirlar.push(`- Kütüphaneler: ${kutuphaneler.join(', ')}`)
  if (pinler.length) {
    satirlar.push('- Pinler:')
    for (const p of pinler) satirlar.push(`  - ${p.pin}: ${p.roller.join(', ')}`)
  }
  if (satirlar.length === 1) satirlar.push('- Kodda sayıya çözülebilen pin ya da kütüphane bulunamadı.')
  return satirlar.join('\n')
}
