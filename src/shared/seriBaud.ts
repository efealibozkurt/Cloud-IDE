import { BAUD_RATES, type BaudRate } from './types'

/** Yorumları ve metin sabitlerinin içini boşaltır; böylece yorumdaki örnek kod sayılmaz */
function yorumsuz(kod: string): string {
  return kod.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\\n])*"/g, (parca) => (parca.startsWith('"') ? '""' : ' '))
}

/** `#define AD 9600` ve `const long AD = 9600;` biçimindeki sayı sabitleri */
function sabitleriTopla(kod: string): Map<string, number> {
  const sabitler = new Map<string, number>()
  const define = /^\s*#\s*define\s+([A-Za-z_]\w*)\s+\(?\s*(\d+)[uUlL]*\s*\)?\s*$/gm
  const degisken = /\b(?:const|constexpr)\b[\w\s]*?\b([A-Za-z_]\w*)\s*=\s*(\d+)[uUlL]*\s*;/g
  for (const desen of [define, degisken]) {
    for (const m of kod.matchAll(desen)) sabitler.set(m[1], Number(m[2]))
  }
  return sabitler
}

/**
 * Koddaki `Serial.begin(...)` hızını bulur. Yalnızca bilgisayara bağlı `Serial` sayılır
 * (`Serial1`, `Serial2`, `mySerial` gibi başka hatlar değil). Hız desteklenen listede değilse,
 * bulunamıyorsa ya da kodda birbirinden farklı hızlar varsa null döner; tahmin yürütülmez.
 */
export function koddanBaudBul(dosyalar: string[]): BaudRate | null {
  const kod = yorumsuz(dosyalar.join('\n'))
  const sabitler = sabitleriTopla(kod)
  const bulunanlar = new Set<number>()
  for (const m of kod.matchAll(/(?<![\w.])Serial\s*\.\s*begin\s*\(\s*([A-Za-z_]\w*|\d+)[uUlL]*\s*[,)]/g)) {
    const deger = /^\d+$/.test(m[1]) ? Number(m[1]) : sabitler.get(m[1])
    if (deger !== undefined) bulunanlar.add(deger)
  }
  if (bulunanlar.size !== 1) return null
  const [tek] = bulunanlar
  return (BAUD_RATES as readonly number[]).includes(tek) ? (tek as BaudRate) : null
}
