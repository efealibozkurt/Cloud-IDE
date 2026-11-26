import type { DetectedPort } from './types'
import { usbCipiBul } from './usbCipleri'

/**
 * Bir seri portun ne olduğu. Bilgisayarlarda kart takılı olmasa da portlar görünür
 * (dahili COM1, Bluetooth eşleşmeleri); yeni başlayanlar hangisinin kart olduğunu ayırt edemez.
 */
export type PortTuru = 'kart' | 'bluetooth' | 'diger'

export function portTuru(p: Pick<DetectedPort, 'address' | 'protocol' | 'matchingBoards' | 'vendorId' | 'pnpId'>): PortTuru {
  // Kart paketi kartı tanıdıysa ya da ağ üzerinden bulunduysa kesin karttır
  if (p.protocol === 'network' || p.matchingBoards.some((k) => k.fqbn)) return 'kart'
  // Windows: BTHENUM; macOS/Linux: aygıt adında bluetooth / rfcomm geçer
  if (/^BTH/i.test(p.pnpId ?? '') || /bluetooth|rfcomm/i.test(p.address)) return 'bluetooth'
  // USB kimliği olan her seri aygıt kart adayıdır (dahili portlarda bu kimlik yoktur)
  if (p.vendorId || /ttyUSB|ttyACM|(cu|tty)\.(usb|wchusb|SLAB)/i.test(p.address)) return 'kart'
  return 'diger'
}

/** Port adının yanında gösterilecek kısa açıklama (çeviri anahtarı olarak da kullanılır) */
export function portAciklamasi(p: DetectedPort): string {
  const tur = portTuru(p)
  if (tur === 'bluetooth') return 'Bluetooth, kart değil'
  if (tur === 'diger') return 'Bilgisayarın kendi portu'
  const kart = p.matchingBoards.find((k) => k.fqbn)?.name
  if (kart) return kart
  const cip = usbCipiBul(p.vendorId, p.productId)?.ad.replace(' USB-seri çevirici', '')
  return cip ?? 'USB kart'
}

/** Kart portları başa gelir; kendi içlerinde sıra korunur */
export function portlariSirala(portlar: DetectedPort[]): DetectedPort[] {
  const agirlik = (p: DetectedPort): number => (portTuru(p) === 'kart' ? 0 : 1)
  return [...portlar].sort((a, b) => agirlik(a) - agirlik(b))
}
