import type { BoardOption, PlatformSummary } from './types'

/** İlk kurulum sihirbazında önerilen, sık kullanılan kartlar */
export interface KartOnerisi {
  id: string
  ad: string
  aciklama: string
  /** Kartın geldiği çekirdek (platform) kimliği, ör. esp32:esp32 */
  cekirdek: string
  /** Tam FQBN biliniyorsa; yoksa `adDeseni` ile çekirdeğin kartları arasından bulunur */
  fqbn?: string
  adDeseni?: RegExp
}

export const KART_ONERILERI: readonly KartOnerisi[] = [
  { id: 'uno', ad: 'Arduino Uno', aciklama: 'Başlamak için en yaygın kart', cekirdek: 'arduino:avr', fqbn: 'arduino:avr:uno' },
  { id: 'nano', ad: 'Arduino Nano', aciklama: 'Küçük, breadboard dostu', cekirdek: 'arduino:avr', fqbn: 'arduino:avr:nano' },
  { id: 'mega', ad: 'Arduino Mega 2560', aciklama: 'Çok pinli, büyük projeler', cekirdek: 'arduino:avr', fqbn: 'arduino:avr:mega' },
  { id: 'esp32', ad: 'ESP32 Dev Module', aciklama: 'Wi-Fi ve Bluetooth\'lu', cekirdek: 'esp32:esp32', fqbn: 'esp32:esp32:esp32' },
  { id: 'deneyap-mini-v2', ad: 'Deneyap Mini v2', aciklama: 'TÜBİTAK Deneyap kartı', cekirdek: 'deneyap:esp32', adDeseni: /deneyap\s*mini\s*v2/i }
]

/** Çekirdek (platform) kurulu mu */
export function cekirdekKurulu(platformlar: PlatformSummary[], cekirdek: string): boolean {
  return platformlar.some((p) => p.id === cekirdek && Boolean(p.installedVersion))
}

/** Öneriye karşılık gelen kartı, kurulu platformların kartları arasından bulur; çekirdek kurulu değilse null */
export function kartiBul(oneri: KartOnerisi, platformlar: PlatformSummary[]): BoardOption | null {
  const kartlar = platformlar.filter((p) => p.id === oneri.cekirdek).flatMap((p) => p.boards)
  if (oneri.fqbn) {
    return kartlar.find((k) => k.fqbn === oneri.fqbn) ?? kartlar.find((k) => k.fqbn.startsWith(`${oneri.fqbn}:`)) ?? null
  }
  if (oneri.adDeseni) return kartlar.find((k) => oneri.adDeseni!.test(k.name)) ?? null
  return null
}

/** Bulut sağlayıcılarda API anahtarının alınabileceği sayfalar (bilinenler) */
export const ANAHTAR_SAYFALARI: Partial<Record<string, string>> = {
  gemini: 'https://aistudio.google.com/apikey',
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  deepseek: 'https://platform.deepseek.com/api_keys'
}
