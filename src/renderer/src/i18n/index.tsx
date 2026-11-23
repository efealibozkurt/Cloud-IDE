import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { EN } from './en'

export type Dil = 'tr' | 'en'

export const DILLER: ReadonlyArray<{ id: Dil; ad: string }> = [
  { id: 'tr', ad: 'Türkçe' },
  { id: 'en', ad: 'English' }
]

const ANAHTAR = 'cloud_ide_dil'

function kayitliDil(): Dil {
  try {
    const d = localStorage.getItem(ANAHTAR)
    if (d === 'tr' || d === 'en') return d
  } catch {
    // depolama kullanılamıyorsa varsayılan dil kullanılır
  }
  return 'tr'
}

/** Kullanıcı daha önce bir dil seçtiyse true (ilk açılışta dil sorulur) */
export function dilSecilmisMi(): boolean {
  try {
    const d = localStorage.getItem(ANAHTAR)
    return d === 'tr' || d === 'en'
  } catch {
    return true // depolama yoksa her açılışta sormayalım
  }
}

let gecerliDil: Dil = kayitliDil()

/**
 * Türkçe özgün metni geçerli dile çevirir. Çeviri yoksa metin aynen döner.
 * `{ad}` biçimindeki yer tutucular `degerler` ile doldurulur.
 * React dışındaki kodda doğrudan, bileşenlerde dil değişince yeniden çizim için `useT()` ile kullanın.
 */
export function cevir(metin: string, degerler?: Record<string, string | number>, dil: Dil = gecerliDil): string {
  const sonuc = dil === 'en' ? (EN[metin] ?? metin) : metin
  if (!degerler) return sonuc
  return sonuc.replace(/\{(\w+)\}/g, (tam, ad: string) => (ad in degerler ? String(degerler[ad]) : tam))
}

export type TFonksiyonu = (metin: string, degerler?: Record<string, string | number>) => string

interface DilBaglami {
  dil: Dil
  setDil: (dil: Dil) => void
  t: TFonksiyonu
}

const Baglam = createContext<DilBaglami>({ dil: 'tr', setDil: () => undefined, t: (m, d) => cevir(m, d, 'tr') })

export function LanguageProvider({ children }: { children: ReactNode }): ReactElement {
  const [dil, setDilDurumu] = useState<Dil>(gecerliDil)

  useEffect(() => {
    gecerliDil = dil
    document.documentElement.lang = dil
  }, [dil])

  const setDil = useCallback((yeni: Dil): void => {
    gecerliDil = yeni
    setDilDurumu(yeni)
    try {
      localStorage.setItem(ANAHTAR, yeni)
    } catch {
      // tercih yalnızca bu oturumda geçerli olur
    }
  }, [])

  const t = useCallback<TFonksiyonu>((metin, degerler) => cevir(metin, degerler, dil), [dil])
  const deger = useMemo(() => ({ dil, setDil, t }), [dil, setDil, t])
  return <Baglam.Provider value={deger}>{children}</Baglam.Provider>
}

export function useI18n(): DilBaglami {
  return useContext(Baglam)
}

export function useT(): TFonksiyonu {
  return useContext(Baglam).t
}
