import { format } from 'util'

/**
 * Ana sürecin son uyarı ve hata satırlarını bellekte tutar (en fazla 200 satır). Sorun raporuna eklenir.
 * `console.warn/error` çağrılarını yalnızca dinler; davranışlarını değiştirmez ve diske yazmaz.
 */
const SATIR_SINIRI = 200
const SATIR_UZUNLUGU = 500
const tampon: string[] = []
let kuruldu = false

export function logTamponuKur(): void {
  if (kuruldu) return
  kuruldu = true
  for (const seviye of ['warn', 'error'] as const) {
    const asil = console[seviye].bind(console)
    console[seviye] = (...args: unknown[]): void => {
      try {
        const satir = `[${new Date().toISOString().slice(11, 19)}] ${seviye} ${format(...args)}`.replace(/\s+/g, ' ')
        tampon.push(satir.length > SATIR_UZUNLUGU ? `${satir.slice(0, SATIR_UZUNLUGU)}…` : satir)
        if (tampon.length > SATIR_SINIRI) tampon.splice(0, tampon.length - SATIR_SINIRI)
      } catch {
        // günlük tutma asla uygulamayı bozmamalı
      }
      asil(...args)
    }
  }
}

export function logSatirlari(): string[] {
  return [...tampon]
}
