/** Karşılaştırma için yol biçimini sadeleştirir (ayraç yönü, baştaki "/" ve büyük/küçük harf farkını yok sayar). */
export function normalizeYol(yol: string): string {
  return yol.trim().replace(/\\/g, '/').replace(/^\//, '').toLowerCase()
}

/** İki dosya/klasör yolunun aynı yeri gösterip göstermediğini (Windows uyumlu) söyler. */
export function ayniDosyaMi(a: string, b: string): boolean {
  return normalizeYol(a) === normalizeYol(b)
}

/** Kısa, çakışma ihtimali düşük mesaj/öğe kimliği üretir. */
export function yeniKimlik(onek = 'id'): string {
  return `${onek}_${crypto.randomUUID()}`
}
