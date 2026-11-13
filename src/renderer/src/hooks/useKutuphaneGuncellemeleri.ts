import { useCallback, useEffect, useState } from 'react'
import type { LibraryUpdateInfo } from '@shared/types'

/**
 * Güncellenebilir kütüphane listesi. Sidebar rozeti ile Kütüphane yöneticisi aynı veriyi paylaşsın diye
 * önbellek modül düzeyindedir; liste değişince tüm kullanıcılar bilgilendirilir.
 */
let liste: LibraryUpdateInfo[] = []
let yuklendi = false
let sonIstek: Promise<void> | null = null
const dinleyiciler = new Set<(l: LibraryUpdateInfo[]) => void>()

function yayinla(): void {
  for (const d of dinleyiciler) d(liste)
}

export function kutuphaneGuncellemeleriniYenile(force = false): Promise<void> {
  if (sonIstek && !force) return sonIstek
  sonIstek = window.api.arduinoCli
    .listUpdatableLibraries(force)
    .then((l) => {
      liste = l
      yuklendi = true
      yayinla()
    })
    .catch(() => undefined)
    .finally(() => {
      sonIstek = null
    })
  return sonIstek
}

/** `etkin` false iken (ör. arduino-cli hazır değil) ağa çıkmaz. */
export function useKutuphaneGuncellemeleri(etkin: boolean): { guncellemeler: LibraryUpdateInfo[]; yenile: () => Promise<void> } {
  const [l, setL] = useState(liste)

  useEffect(() => {
    dinleyiciler.add(setL)
    return () => {
      dinleyiciler.delete(setL)
    }
  }, [])

  useEffect(() => {
    if (!etkin) return
    // Açılışı yavaşlatmamak için kısa bir gecikmeyle; sonra yarım saatte bir
    const ilk = yuklendi ? null : setTimeout(() => void kutuphaneGuncellemeleriniYenile(), 4000)
    const aralik = setInterval(() => void kutuphaneGuncellemeleriniYenile(true), 30 * 60_000)
    return () => {
      if (ilk) clearTimeout(ilk)
      clearInterval(aralik)
    }
  }, [etkin])

  const yenile = useCallback(() => kutuphaneGuncellemeleriniYenile(true), [])
  return { guncellemeler: l, yenile }
}
