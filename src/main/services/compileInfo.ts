import type { BuildSize, BuildSizeItem, DerlemeHatasi } from '../../shared/types'

/**
 * arduino-cli `compile --verbose` çıktısından bellek kullanımını, kullanılan kütüphaneleri ve
 * kart çekirdeği sürümünü ayıklar. Çıktı İngilizcedir; alınamayan alanlar boş bırakılır.
 */

function sayi(m: string): number {
  return Number(m.replace(/[.,\s]/g, ''))
}

export function boyutuAyikla(log: string): BuildSize | undefined {
  const flash = /Sketch uses (\d[\d.,]*) bytes \((\d+)%\) of program storage space\. Maximum is (\d[\d.,]*) bytes/i.exec(log)
  const ram = /Global variables use (\d[\d.,]*) bytes \((\d+)%\) of dynamic memory[^.]*\. Maximum is (\d[\d.,]*) bytes/i.exec(log)
  if (!flash && !ram) return undefined
  const oge = (m: RegExpExecArray | null): BuildSizeItem | undefined => (m ? { kullanilan: sayi(m[1]), azami: sayi(m[3]) } : undefined)
  return { flash: oge(flash), ram: oge(ram) }
}

/** "Using library X at version Y in folder: ..." satırlarından kütüphane → sürüm haritası */
export function kutuphaneleriAyikla(log: string): Record<string, string> {
  const sonuc: Record<string, string> = {}
  const desen = /^Using library (.+?) at version (\S+) in folder:/gim
  let m: RegExpExecArray | null
  while ((m = desen.exec(log))) sonuc[m[1]] = m[2]
  return sonuc
}

/** "Using core 'esp32' from platform in folder: .../esp32/2.0.14" satırından çekirdek adı ve sürümü */
export function cekirdegiAyikla(log: string): { ad: string; surum: string } | undefined {
  const m = /^Using core '([^']+)' from platform in folder:\s*(.+)$/im.exec(log)
  if (!m) return undefined
  const surum = m[2].trim().split(/[\\/]/).filter(Boolean).pop() ?? ''
  return /^\d+(\.\d+)*/.test(surum) ? { ad: m[1], surum } : { ad: m[1], surum: '' }
}

/**
 * gcc'nin klasik "dosya:satır:sütun: tür: mesaj" biçimli tek bir çıktı satırını yakalar.
 * "fatal error:" (ör. eksik başlık dosyası) da "error" sayılır; derlemeyi durduran en yaygın hata budur.
 */
export const GCC_HATA_DESENI = /^(.+?):(\d+):(\d+):\s+(?:fatal\s+)?(error|warning|note):\s+(.+)$/

/**
 * builder_result.diagnostics JSON'da yoksa (ör. daha eski bir arduino-cli
 * sürümü ya da beklenmeyen bir çıktı) devreye giren YEDEK yol: ham
 * derleyici çıktısını (stderr) doğrudan regex ile ayrıştırır. "In file
 * included from ..." gibi gürültü satırları ana listeye karışmaz; bir
 * sonraki hatanın 'baglam' dizisine eklenir.
 */
export function stderrdenHatalariCikar(stderrMetni: string): DerlemeHatasi[] {
  const satirlar = stderrMetni.split(/\r?\n/)
  const hatalar: DerlemeHatasi[] = []
  let baglamBirikimi: string[] = []

  for (const satir of satirlar) {
    const eslesme = GCC_HATA_DESENI.exec(satir)
    if (eslesme) {
      const [, dosya, satirNoMetni, sutunNoMetni, tur, mesaj] = eslesme
      hatalar.push({
        dosya,
        satir: parseInt(satirNoMetni, 10),
        sutun: parseInt(sutunNoMetni, 10),
        tur: tur as 'error' | 'warning' | 'note',
        mesaj,
        hamMetin: satir,
        baglam: baglamBirikimi.length > 0 ? baglamBirikimi : undefined
      })
      baglamBirikimi = []
    } else if (satir.trim().length > 0) {
      baglamBirikimi.push(satir.trim())
    }
  }
  return hatalar
}
