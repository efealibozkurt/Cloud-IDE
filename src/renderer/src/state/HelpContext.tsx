import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react'
import HelpModal from '../components/help/HelpModal'
import TurRehberi, { TUR_GORULDU_ANAHTARI } from '../components/help/TurRehberi'
import SorunBildirModal from '../components/help/SorunBildirModal'
import type { YardimKonuId } from '../components/help/yardimKonulari'

interface YardimBaglami {
  /** Yardım penceresini açar; konu verilirse doğrudan o konuya gider */
  yardimAc: (konu?: YardimKonuId) => void
  /** İlk açılış turunu başlatır (yardım penceresi açıksa kapatır) */
  turuBaslat: () => void
  /** "Sorun bildir" penceresini açar (rapor hazırlar; hiçbir şey kendiliğinden gönderilmez) */
  sorunBildirAc: () => void
}

const Baglam = createContext<YardimBaglami | null>(null)

/** Uygulama genelinde "Yardım ve rehber" penceresini açmayı sağlar (F1 ve "?" düğmeleri). */
export function YardimProvider({ children, surum }: { children: ReactNode; surum: string }): ReactElement {
  const [acik, setAcik] = useState(false)
  const [konu, setKonu] = useState<YardimKonuId | undefined>(undefined)
  const [turAcik, setTurAcik] = useState(false)
  const [sorunAcik, setSorunAcik] = useState(false)

  const yardimAc = useCallback((k?: YardimKonuId) => {
    setKonu(k)
    setAcik(true)
  }, [])

  useEffect(() => {
    const tus = (e: KeyboardEvent): void => {
      if (e.key === 'F1') {
        e.preventDefault()
        setKonu(undefined)
        setAcik((a) => !a)
      }
    }
    window.addEventListener('keydown', tus)
    return () => window.removeEventListener('keydown', tus)
  }, [])

  const turuBaslat = useCallback(() => {
    setAcik(false)
    setTurAcik(true)
  }, [])

  const sorunBildirAc = useCallback(() => setSorunAcik(true), [])

  const deger = useMemo(() => ({ yardimAc, turuBaslat, sorunBildirAc }), [yardimAc, turuBaslat, sorunBildirAc])

  return (
    <Baglam.Provider value={deger}>
      {children}
      {acik && <HelpModal baslangicKonusu={konu} surum={surum} onClose={() => setAcik(false)} />}
      {turAcik && <TurRehberi onBitti={() => setTurAcik(false)} />}
      {sorunAcik && <SorunBildirModal onClose={() => setSorunAcik(false)} />}
    </Baglam.Provider>
  )
}

export function useYardim(): YardimBaglami {
  const b = useContext(Baglam)
  if (!b) throw new Error('useYardim, YardimProvider içinde kullanılmalıdır')
  return b
}

/** Turu hiç görmemiş kullanıcılar için, uygulama hazır olunca (açılış ekranı ve karşılama notu kapandıktan sonra) turu bir kez başlatır. */
export function TurOtomatikBaslat({ hazir }: { hazir: boolean }): null {
  const { turuBaslat } = useYardim()
  useEffect(() => {
    if (!hazir) return
    let goruldu = false
    try {
      goruldu = localStorage.getItem(TUR_GORULDU_ANAHTARI) === '1'
    } catch {
      goruldu = true // depolama yoksa her açılışta rahatsız etme
    }
    if (goruldu) return
    const z = setTimeout(turuBaslat, 700)
    return () => clearTimeout(z)
  }, [hazir, turuBaslat])
  return null
}
