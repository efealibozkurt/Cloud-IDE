import deneyap1a from '../assets/boards/deneyap-1a.jpg'
import deneyap1aV2 from '../assets/boards/deneyap-1a-v2.jpg'
import deneyapG from '../assets/boards/deneyap-g.jpg'
import deneyapKart from '../assets/boards/deneyap-kart.jpg'
import deneyapKartV2 from '../assets/boards/deneyap-kart-v2.jpg'
import deneyapMini from '../assets/boards/deneyap-mini.jpg'
import deneyapMiniV2 from '../assets/boards/deneyap-mini-v2.jpg'
import bluepill from '../assets/boards/bluepill.jpg'
import d1mini from '../assets/boards/d1mini.jpg'
import due from '../assets/boards/due.jpg'
import esp32 from '../assets/boards/esp32.jpg'
import leonardo from '../assets/boards/leonardo.jpg'
import mega from '../assets/boards/mega.jpg'
import micro from '../assets/boards/micro.jpg'
import nano from '../assets/boards/nano.jpg'
import nodemcu from '../assets/boards/nodemcu.jpg'
import pico from '../assets/boards/pico.jpg'
import promini from '../assets/boards/promini.jpg'
import uno from '../assets/boards/uno.jpg'

/**
 * Kart fotoğrafları (Wikimedia Commons, CC lisansları; kaynaklar için
 * assets/boards/CREDITS.md). Yalnızca fotoğrafı gerçekten o karta ait olan
 * eşleşmeler yapılır; emin olunmayan kartlarda görsel gösterilmez.
 */
const KURALLAR: Array<{ desen: RegExp; gorsel: string }> = [
  // Deneyap (görseller resmi deneyapkart-arduino-core deposundan; bkz. assets/boards/CREDITS.md)
  { desen: /deneyap\s*kart\s*1a\s*v2/i, gorsel: deneyap1aV2 },
  { desen: /deneyap\s*kart\s*1a/i, gorsel: deneyap1a },
  { desen: /deneyap\s*mini\s*v2/i, gorsel: deneyapMiniV2 },
  { desen: /deneyap\s*mini/i, gorsel: deneyapMini },
  { desen: /deneyap\s*kart\s*g\b/i, gorsel: deneyapG },
  { desen: /deneyap\s*kart\s*v2/i, gorsel: deneyapKartV2 },
  { desen: /deneyap\s*kart\b/i, gorsel: deneyapKart },
  { desen: /arduino:avr:uno(:|$)|^arduino uno$/i, gorsel: uno },
  { desen: /arduino:avr:nano(:|$)|^arduino nano$/i, gorsel: nano },
  { desen: /arduino:avr:mega|^arduino mega/i, gorsel: mega },
  { desen: /arduino:avr:leonardo(:|$)|^arduino leonardo$/i, gorsel: leonardo },
  { desen: /arduino:avr:micro(:|$)|^arduino micro$/i, gorsel: micro },
  { desen: /arduino:avr:pro(:|$)|pro mini/i, gorsel: promini },
  { desen: /arduino:sam:arduino_due|^arduino due/i, gorsel: due },
  {
    desen: /esp32:esp32:(esp32|esp32doit-devkit-v1|nodemcu-32s|esp32wrover|esp32da|d32)(:|$)|^esp32 dev module$|doit esp32 devkit|nodemcu-32s/i,
    gorsel: esp32
  },
  { desen: /esp8266:esp8266:d1_mini|wemos\)? d1 mini|wemos d1 mini/i, gorsel: d1mini },
  { desen: /esp8266:esp8266:nodemcu|^nodemcu \d/i, gorsel: nodemcu },
  { desen: /rp2040:rp2040:(rpipico|rpipicow)(:|$)|^raspberry pi pico( w)?$/i, gorsel: pico },
  { desen: /bluepill|blue pill|f103c8|generic stm32f103c/i, gorsel: bluepill }
]

/** Platform kimliğine göre o platformu temsil eden kart fotoğrafı */
const PLATFORM_GORSELLERI: Record<string, string> = {
  'arduino:avr': uno,
  'arduino:sam': due,
  'esp32:esp32': esp32,
  'esp8266:esp8266': nodemcu,
  'rp2040:rp2040': pico,
  'deneyap:esp32': deneyapKartV2
}

export interface KartBilgisi {
  fqbn?: string
  name?: string
}

/** Aynı ailedeki kartlar birbirine benzediği için, tam eşleşme yoksa ailenin temsilci fotoğrafı kullanılır */
const AILE_GORSELLERI: Array<{ desen: RegExp; gorsel: string }> = [
  { desen: /^arduino:avr:/i, gorsel: uno },
  { desen: /^arduino:sam:/i, gorsel: due },
  { desen: /^arduino:megaavr:|^arduino:samd:|^arduino:renesas|^arduino:mbed|nano/i, gorsel: nano },
  { desen: /^esp32:esp32:|^arduino:esp32:/i, gorsel: esp32 },
  { desen: /^esp8266:esp8266:/i, gorsel: nodemcu },
  { desen: /^rp2040:rp2040:|rp2040/i, gorsel: pico },
  { desen: /^STMicroelectronics:stm32:|stm32/i, gorsel: bluepill }
]

export type KartRengi = 'yesil' | 'kirmizi' | 'mavi' | 'gri'

/** Fotoğrafı olmayan kartlarda çizilen PCB'nin rengi (kart ailesine göre) */
export function kartRengi(kart: KartBilgisi | null | undefined): KartRengi {
  const m = `${kart?.fqbn ?? ''} ${kart?.name ?? ''}`.toLowerCase()
  if (m.includes('deneyap')) return 'kirmizi'
  if (m.includes('esp') || m.includes('arduino') || m.includes('stm32')) return 'mavi'
  if (m.includes('rp2040') || m.includes('pico') || m.includes('adafruit') || m.includes('sparkfun')) return 'yesil'
  return 'gri'
}

/** Karta ait fotoğraf; tam eşleşme yoksa ailenin benzer kartı, o da yoksa null */
export function kartGorseli(kart: KartBilgisi | null | undefined, yalnizTam = false): string | null {
  if (!kart) return null
  const metin = `${kart.fqbn ?? ''} ${kart.name ?? ''}`
  const adSade = (kart.name ?? '').trim()
  for (const { desen, gorsel } of KURALLAR) {
    if (desen.test(kart.fqbn ?? '') || desen.test(adSade) || desen.test(metin)) return gorsel
  }
  if (yalnizTam) return null
  // Deneyap'a ait bir fotoğraf yok; benzer bir kart göstermek yanıltıcı olur
  if (metin.toLowerCase().includes('deneyap')) return null
  for (const { desen, gorsel } of AILE_GORSELLERI) {
    if (desen.test(kart.fqbn ?? '') || desen.test(adSade)) return gorsel
  }
  return null
}

/** Platformu temsil eden fotoğraf: önce bilinen platform, sonra içindeki ilk eşleşen kart */
export function platformGorseli(platformId: string, kartlar: KartBilgisi[]): string | null {
  const dogrudan = PLATFORM_GORSELLERI[platformId]
  if (dogrudan) return dogrudan
  for (const k of kartlar) {
    const g = kartGorseli(k)
    if (g) return g
  }
  return null
}
