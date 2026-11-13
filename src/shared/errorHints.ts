/**
 * Derleme hatası metinlerinden kullanıcıya yardımcı olacak bilgi çıkarır.
 */

/** "fatal error: Servo.h: No such file or directory" türü hatalardan eksik başlık adını çıkarır. */
export function eksikBaslikBul(...metinler: Array<string | undefined>): string | null {
  for (const metin of metinler) {
    if (!metin) continue
    const m = /([A-Za-z0-9_+./-]+\.(?:h|hpp|hh))\s*:\s*No such file or directory/i.exec(metin)
    if (m) return m[1].split('/').pop() ?? m[1]
  }
  return null
}
