import { useCallback, useState } from 'react'

const bellek = new Map<string, unknown>()

/**
 * `useState` gibi çalışır ama değeri uygulama açık kaldığı sürece bellekte tutar: bileşen başka bir
 * yere taşınıp yeniden kurulduğunda (örn. seri monitör alttan sağa alınınca) seçimler kaybolmaz.
 */
export function useOturumDurumu<T>(anahtar: string, baslangic: T): [T, (deger: T) => void] {
  const [deger, setDeger] = useState<T>(() => (bellek.has(anahtar) ? (bellek.get(anahtar) as T) : baslangic))
  const ayarla = useCallback(
    (yeni: T) => {
      bellek.set(anahtar, yeni)
      setDeger(yeni)
    },
    [anahtar]
  )
  return [deger, ayarla]
}
