/** ESP32/ESP8266 önyükleyici (bootloader) çıktısına ait yaygın satır kalıpları */
export const BOOTLOADER_DESENI =
  /^(rst:|ets |load:|entry |ho \d|configsip:|clk_drv:|mode:|invalid header|waiting for download)/i

const HATA_DESENLERI = [
  /Guru Meditation Error/i,
  /Core\s+\d+\s+panic/i,
  /Backtrace:/i,
  /Brownout detector/i,
  /Task watchdog/i,
  /Interrupt wdt/i,
  /Stack canary/i,
  /\bASSERT\b/,
  /rst:0x[0-9a-f]+.*WDT/i,
  /Abort\(\) was called/i,
  /LoadProhibited|StoreProhibited|InstrFetchProhibited/i
]

/** Bir seri monitör satırının belirgin donanım çökmesi veya kritik hata içerip içermediğini belirler. */
export function hataSatiriMi(satir: string): boolean {
  if (!satir) return false
  return HATA_DESENLERI.some((desen) => desen.test(satir))
}

const PANIC_DESENI = /Guru Meditation|Core\s+\d+\s+panic|LoadProhibited|StoreProhibited|InstrFetchProhibited|Stack canary|Abort\(\) was called/i
const BROWNOUT_DESENI = /Brownout detector/i
const WDT_DESENI = /Task watchdog|Interrupt wdt|rst:0x[0-9a-f]+.*WDT/i

/** Seri port çıktısındaki yaygın donanım çökme ve baud uyuşmazlığı belirtilerini otomatik teşhis ipuçlarına çevirir. */
export function seriCiktiAnalizEt(satirlar: string[]): string[] {
  if (satirlar.length === 0) return []
  const metin = satirlar.join('\n')
  const ipuclari: string[] = []

  if (PANIC_DESENI.test(metin)) {
    ipuclari.push(
      'ESP32 çökmesi (Guru Meditation / Panic): bellek erişim hatası, null pointer, dizi taşması veya kesme (ISR) içinde IRAM_ATTR/delay() kullanımı olabilir.'
    )
  }

  if (BROWNOUT_DESENI.test(metin)) {
    ipuclari.push(
      'Güç düşümü (Brownout detector): USB kablosu veya güç kaynağı yetersiz kalıyor; özellikle Wi-Fi açılışında ya da servo/motor sürerken harici besleme gerekebilir.'
    )
  }

  if (WDT_DESENI.test(metin)) {
    ipuclari.push(
      'Watchdog sıfırlaması (WDT): loop() veya uzun bir while döngüsü işlemciyi blokluyor olabilir; döngü içine kısa delay(1) veya yield() ekleyin.'
    )
  }

  let toplamKarakter = 0
  let bozukKarakter = 0
  for (const satir of satirlar) {
    for (let i = 0; i < satir.length; i++) {
      toplamKarakter++
      const kod = satir.charCodeAt(i)
      if (kod === 0xfffd || (kod < 32 && kod !== 9) || kod === 127) {
        bozukKarakter++
      }
    }
  }

  if (toplamKarakter >= 12 && bozukKarakter / toplamKarakter > 0.2) {
    ipuclari.push(
      'Bozuk/okunaksız karakter oranı yüksek: koddaki Serial.begin(...) hızı ile Seri Monitör baud hızı eşleşmiyor olabilir.'
    )
  }

  return ipuclari
}
