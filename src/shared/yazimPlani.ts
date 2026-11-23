/** Eski ve yeni içerik arasındaki değişen bölgeyi bulur; yazım efekti yalnızca bu bölgeyi oynatır. */
export interface YazimPlani {
  /** Değişmeyen başlangıç kısmının uzunluğu (satır başına hizalı) */
  onekUzunlugu: number
  /** Eski içerikte silinecek orta bölge uzunluğu */
  eskiOrtaUzunlugu: number
  /** Yazılacak yeni orta bölge */
  yeniOrta: string
}

export function yazimPlani(onceki: string, hedef: string): YazimPlani {
  const enKisa = Math.min(onceki.length, hedef.length)
  let on = 0
  while (on < enKisa && onceki[on] === hedef[on]) on++
  // Satır başına hizala: yazım hep yeni bir satırın başından başlasın
  const sonSatirSonu = onceki.lastIndexOf('\n', on - 1)
  const onek = on === enKisa && on === onceki.length && on === hedef.length ? on : sonSatirSonu + 1

  let son = 0
  const kalan = enKisa - onek
  while (son < kalan && onceki[onceki.length - 1 - son] === hedef[hedef.length - 1 - son]) son++
  // Sonek bir satır sonu karakterinden başlasın
  let sonek = 0
  if (son > 0) {
    const bas = onceki.length - son
    const nl = onceki.indexOf('\n', bas)
    sonek = nl === -1 ? 0 : onceki.length - nl
  }

  return {
    onekUzunlugu: onek,
    eskiOrtaUzunlugu: onceki.length - onek - sonek,
    yeniOrta: hedef.slice(onek, hedef.length - sonek)
  }
}

export type TaramaAdimi =
  | { tur: 'gec'; satir: string }
  | { tur: 'degistir'; eski: string; yeni: string }
  | { tur: 'ekle'; yeni: string }
  | { tur: 'sil'; eski: string }

export interface SatirTaramaPlani {
  /** 1-tabanlı başlangıç satırı */
  baslangicSatiri: number
  adimlar: TaramaAdimi[]
  degisenSatirSayisi: number
  eklenenVeyaDegisenKarakter: number
}

const MAX_LCS_HUCRE = 250_000

/** Eski ve yeni kod arasında yukarıdan aşağı optik satır tarama planı üretir. */
export function satirTaramaPlani(onceki: string, hedef: string): SatirTaramaPlani {
  const normOnceki = onceki.replace(/\r\n/g, '\n')
  const normHedef = hedef.replace(/\r\n/g, '\n')
  if (normOnceki === normHedef) {
    return { baslangicSatiri: 1, adimlar: [], degisenSatirSayisi: 0, eklenenVeyaDegisenKarakter: 0 }
  }

  const eski = normOnceki.split('\n')
  const yeni = normHedef.split('\n')

  let on = 0
  while (on < eski.length && on < yeni.length && eski[on] === yeni[on]) on++

  let son = 0
  while (
    son < eski.length - on &&
    son < yeni.length - on &&
    eski[eski.length - 1 - son] === yeni[yeni.length - 1 - son]
  ) {
    son++
  }

  const baslangicSatiri = on + 1
  const eskiOrta = eski.slice(on, eski.length - son)
  const yeniOrta = yeni.slice(on, yeni.length - son)
  const M = eskiOrta.length
  const N = yeniOrta.length

  const adimlar: TaramaAdimi[] = []
  const hunkEkle = (sils: string[], ekles: string[]): void => {
    const ciftSayisi = Math.min(sils.length, ekles.length)
    for (let k = 0; k < ciftSayisi; k++) {
      adimlar.push({ tur: 'degistir', eski: sils[k], yeni: ekles[k] })
    }
    for (let k = ciftSayisi; k < ekles.length; k++) {
      adimlar.push({ tur: 'ekle', yeni: ekles[k] })
    }
    for (let k = ciftSayisi; k < sils.length; k++) {
      adimlar.push({ tur: 'sil', eski: sils[k] })
    }
  }

  if (M * N > MAX_LCS_HUCRE) {
    hunkEkle(eskiOrta, yeniOrta)
  } else {
    const cols = N + 1
    const dp = new Int32Array((M + 1) * cols)
    for (let i = M - 1; i >= 0; i--) {
      const satirOfset = i * cols
      const altSatirOfset = (i + 1) * cols
      for (let j = N - 1; j >= 0; j--) {
        if (eskiOrta[i] === yeniOrta[j]) {
          dp[satirOfset + j] = dp[altSatirOfset + j + 1] + 1
        } else {
          const alt = dp[altSatirOfset + j]
          const sag = dp[satirOfset + j + 1]
          dp[satirOfset + j] = alt >= sag ? alt : sag
        }
      }
    }

    let i = 0
    let j = 0
    let sils: string[] = []
    let ekles: string[] = []
    const hunkBosalt = (): void => {
      if (sils.length > 0 || ekles.length > 0) {
        hunkEkle(sils, ekles)
        sils = []
        ekles = []
      }
    }

    while (i < M && j < N) {
      if (eskiOrta[i] === yeniOrta[j]) {
        hunkBosalt()
        adimlar.push({ tur: 'gec', satir: eskiOrta[i] })
        i++
        j++
      } else if (dp[(i + 1) * cols + j] >= dp[i * cols + j + 1]) {
        sils.push(eskiOrta[i])
        i++
      } else {
        ekles.push(yeniOrta[j])
        j++
      }
    }
    while (i < M) {
      sils.push(eskiOrta[i])
      i++
    }
    while (j < N) {
      ekles.push(yeniOrta[j])
      j++
    }
    hunkBosalt()
  }

  let degisenSatirSayisi = 0
  let eklenenVeyaDegisenKarakter = 0
  for (const adim of adimlar) {
    if (adim.tur !== 'gec') degisenSatirSayisi++
    if (adim.tur === 'degistir' || adim.tur === 'ekle') {
      eklenenVeyaDegisenKarakter += adim.yeni.trimStart().length
    }
  }

  return { baslangicSatiri, adimlar, degisenSatirSayisi, eklenenVeyaDegisenKarakter }
}

/** Satır tarama planını eski metne uygular ve elde edilen sonucu döner (doğrulama ve test için). */
export function taramaPlaniUygula(onceki: string, plan: SatirTaramaPlani): string {
  const satirlar = onceki.replace(/\r\n/g, '\n').split('\n')
  let imlec = plan.baslangicSatiri - 1
  for (const adim of plan.adimlar) {
    switch (adim.tur) {
      case 'gec':
        imlec++
        break
      case 'degistir':
        satirlar[imlec] = adim.yeni
        imlec++
        break
      case 'ekle':
        satirlar.splice(imlec, 0, adim.yeni)
        imlec++
        break
      case 'sil':
        satirlar.splice(imlec, 1)
        break
    }
  }
  return satirlar.join('\n')
}
