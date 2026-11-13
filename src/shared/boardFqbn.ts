/**
 * FQBN yardımcıları. Bir kartın tam adı `vendor:arch:board` biçimindedir; kart seçenekleri
 * (ör. Nano için işlemci, ESP32 için bölüm şeması) dördüncü parça olarak eklenir:
 * `arduino:avr:nano:cpu=atmega328old`. Uygulama seçili kartı temel FQBN olarak saklar,
 * seçenekleri ayrı tutar ve yalnızca derleme/yükleme sırasında birleştirir.
 */

const PARCA = /^[A-Za-z0-9_.-]+$/

/** `vendor:arch:board:seçenekler` → `vendor:arch:board` */
export function temelFqbn(fqbn: string): string {
  return fqbn.split(':').slice(0, 3).join(':')
}

/** Temel FQBN'ye seçenekleri ekler. Geçersiz ad/değerler sessizce atlanır; seçenek yoksa temel FQBN döner. */
export function fqbnSecenekleriyle(temel: string, secenekler: Record<string, string> | undefined): string {
  const t = temelFqbn(temel)
  const parcalar = Object.entries(secenekler ?? {})
    .filter(([ad, deger]) => PARCA.test(ad) && PARCA.test(deger))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ad, deger]) => `${ad}=${deger}`)
  return parcalar.length ? `${t}:${parcalar.join(',')}` : t
}

/** `vendor:arch:board:a=1,b=2` içindeki seçenekleri çıkarır. */
export function fqbnSecenekleriniAyir(fqbn: string): Record<string, string> {
  const sonuc: Record<string, string> = {}
  const dorduncu = fqbn.split(':').slice(3).join(':')
  for (const cift of dorduncu.split(',')) {
    const [ad, ...gerisi] = cift.split('=')
    const deger = gerisi.join('=')
    if (ad && deger && PARCA.test(ad) && PARCA.test(deger)) sonuc[ad] = deger
  }
  return sonuc
}
