/**
 * Arayüzün son uyarı/hata satırlarını bellekte tutar (en fazla 200). Sorun raporuna eklenir.
 * console.warn/error ve yakalanmamış hataları yalnızca dinler; davranışlarını değiştirmez, diske yazmaz.
 */
const SATIR_SINIRI = 200
const SATIR_UZUNLUGU = 500
const tampon: string[] = []
let kuruldu = false

function ekle(seviye: string, parcalar: unknown[]): void {
  try {
    const metin = parcalar
      .map((p) => (p instanceof Error ? `${p.name}: ${p.message}` : typeof p === 'string' ? p : JSON.stringify(p)))
      .join(' ')
      .replace(/\s+/g, ' ')
    const satir = `[${new Date().toISOString().slice(11, 19)}] ${seviye} ${metin}`
    tampon.push(satir.length > SATIR_UZUNLUGU ? `${satir.slice(0, SATIR_UZUNLUGU)}…` : satir)
    if (tampon.length > SATIR_SINIRI) tampon.splice(0, tampon.length - SATIR_SINIRI)
  } catch {
    // günlük tutma asla arayüzü bozmamalı
  }
}

export function arayuzGunluguKur(): void {
  if (kuruldu) return
  kuruldu = true
  for (const seviye of ['warn', 'error'] as const) {
    const asil = console[seviye].bind(console)
    console[seviye] = (...args: unknown[]): void => {
      ekle(seviye, args)
      asil(...args)
    }
  }
  window.addEventListener('error', (e) => ekle('hata', [e.message, e.filename ? `(${e.filename.split(/[\\/]/).pop()}:${e.lineno})` : '']))
  window.addEventListener('unhandledrejection', (e) => ekle('söz-reddi', [e.reason instanceof Error ? e.reason : String(e.reason)]))
}

export function arayuzGunluguAl(): string[] {
  return [...tampon]
}
