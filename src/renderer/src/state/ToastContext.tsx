import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

export type ToastTuru = 'basari' | 'hata' | 'bilgi'

interface ToastGirdisi {
  id: number
  tur: ToastTuru
  mesaj: string
}

interface ToastBaglami {
  /** Kısa, anlaşılır Türkçe bir bildirim gösterir; teknik detay Çıktı paneline gitmelidir */
  toastGoster: (mesaj: string, tur?: ToastTuru) => void
}

const ToastContext = createContext<ToastBaglami | null>(null)

const TUR_STILI: Record<ToastTuru, string> = {
  basari: 'border-emerald-600 bg-emerald-950 text-emerald-200',
  hata: 'border-red-600 bg-red-950 text-red-200',
  bilgi: 'border-accent bg-panel-light text-gray-200'
}

/**
 * Uygulama genelinde kısa ömürlü bildirimler (toast) göstermek için
 * context + sağlayıcı. Hata durumlarında kullanıcıya burada anlaşılır bir
 * özet gösterilir; ham teknik metin Çıktı paneline yazılır.
 */
export function ToastProvider({ children }: { children: ReactNode }): ReactElement {
  const [toastlar, setToastlar] = useState<ToastGirdisi[]>([])
  const sayacRef = useRef(0)

  const toastGoster = useCallback((mesaj: string, tur: ToastTuru = 'bilgi') => {
    const id = ++sayacRef.current
    setToastlar((onceki) => [...onceki, { id, tur, mesaj }])
    setTimeout(() => {
      setToastlar((onceki) => onceki.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  return (
    <ToastContext.Provider value={{ toastGoster }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toastlar.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded border px-3 py-2 text-xs shadow-lg ${TUR_STILI[t.tur]}`}
          >
            {t.mesaj}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastBaglami {
  const baglam = useContext(ToastContext)
  if (!baglam) throw new Error('useToast, ToastProvider içinde kullanılmalıdır')
  return baglam
}
