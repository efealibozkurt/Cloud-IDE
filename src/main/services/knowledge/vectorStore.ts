/** Vektörleri tek bir Float32 ikili dosyada saklamak için paketleme yardımcıları. */

export function vektorleriPaketle(vektorler: Float32Array[], boyut: number): Buffer {
  const tampon = Buffer.alloc(vektorler.length * boyut * 4)
  vektorler.forEach((v, i) => {
    if (v.length !== boyut) throw new Error(`Vektör boyutu uyuşmuyor: ${v.length} != ${boyut}`)
    for (let j = 0; j < boyut; j++) tampon.writeFloatLE(v[j], (i * boyut + j) * 4)
  })
  return tampon
}

export function vektorleriAc(tampon: Buffer, boyut: number): Float32Array[] {
  if (boyut <= 0 || tampon.length % (boyut * 4) !== 0) throw new Error('Vektör dosyası bozuk')
  const adet = tampon.length / (boyut * 4)
  const sonuc: Float32Array[] = []
  for (let i = 0; i < adet; i++) {
    const v = new Float32Array(boyut)
    for (let j = 0; j < boyut; j++) v[j] = tampon.readFloatLE((i * boyut + j) * 4)
    sonuc.push(v)
  }
  return sonuc
}

/** Normalize edilmiş iki vektörün iç çarpımı (= kosinüs benzerliği). Boyut farkında 0 döner. */
export function icCarpim(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) return 0
  let t = 0
  for (let i = 0; i < a.length; i++) t += a[i] * b[i]
  return t
}
