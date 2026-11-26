import { useEffect, useRef, useState, type ReactElement, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react'
import { useT } from '../../i18n'

export type SagSekme = 'seri' | 'ai'

const GENISLIK_ANAHTARI = 'cloud_ide_seri_genislik'
const AI_GENISLIGI = 350
const MIN_GENISLIK = 300
const MAKS_GENISLIK = 900
const VARSAYILAN_GENISLIK = 420
/** Kenar çubuğu ve editör için her zaman bırakılan yer */
const DIGERLERI_ICIN = 600

function kayitliGenislik(): number {
  try {
    const n = Number(localStorage.getItem(GENISLIK_ANAHTARI))
    return n >= MIN_GENISLIK && n <= MAKS_GENISLIK ? n : VARSAYILAN_GENISLIK
  } catch {
    return VARSAYILAN_GENISLIK
  }
}

interface Props {
  /** Sağa yerleştirilmiş seri monitör; kapalıysa ya da başka yerdeyse null */
  seri: ReactNode
  /** Cloud AI paneli; kapalıysa null */
  ai: ReactNode
  aktif: SagSekme
  onSekme: (sekme: SagSekme) => void
}

/**
 * Editörün sağındaki alan. Seri monitör ve Cloud AI aynı yeri paylaşır; ikisi birden açıksa sekmeyle
 * geçilir. Görünmeyen panel bağlı kalır (yazılan metin ve sohbet durumu kaybolmaz).
 */
function SagPanel({ seri, ai, aktif, onSekme }: Props): ReactElement {
  const t = useT()
  const [genislik, setGenislik] = useState(kayitliGenislik)
  const surukleme = useRef<{ x: number; genislik: number } | null>(null)

  useEffect(() => {
    const tasi = (e: MouseEvent): void => {
      const bas = surukleme.current
      if (!bas) return
      const ust = Math.max(MIN_GENISLIK, Math.min(MAKS_GENISLIK, window.innerWidth - DIGERLERI_ICIN))
      setGenislik(Math.min(ust, Math.max(MIN_GENISLIK, bas.genislik + bas.x - e.clientX)))
    }
    const birak = (): void => {
      if (!surukleme.current) return
      surukleme.current = null
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', tasi)
    window.addEventListener('mouseup', birak)
    return () => {
      window.removeEventListener('mousemove', tasi)
      window.removeEventListener('mouseup', birak)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(GENISLIK_ANAHTARI, String(genislik))
    } catch {
      // yalnızca bu oturumda geçerli olur
    }
  }, [genislik])

  const basla = (e: ReactMouseEvent): void => {
    e.preventDefault()
    surukleme.current = { x: e.clientX, genislik: e.currentTarget.parentElement?.offsetWidth ?? genislik }
    document.body.style.cursor = 'col-resize'
  }

  return (
    <div
      className="relative flex shrink-0 flex-col border-l border-panel-border bg-panel-light"
      style={seri ? { width: genislik, minWidth: MIN_GENISLIK, maxWidth: `max(${MIN_GENISLIK}px, calc(100vw - ${DIGERLERI_ICIN}px))` } : { width: `clamp(${MIN_GENISLIK}px, 33vw, ${AI_GENISLIGI}px)` }}
    >
      {seri && <div onMouseDown={basla} title={t('Genişliği sürükleyerek ayarlayın')} className="absolute -left-1 bottom-0 top-0 z-10 w-2 cursor-col-resize" />}
      {seri && ai && (
        <div role="tablist" aria-label={t('Sağ panel')} className="flex shrink-0 items-center border-b border-panel-border">
          {(['seri', 'ai'] as const).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={aktif === s}
              onClick={() => onSekme(s)}
              className={`border-b-2 px-3 py-1.5 text-[11px] transition-colors ${aktif === s ? 'border-accent text-gray-100' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              {s === 'seri' ? t('Seri Monitör') : 'Cloud AI'}
            </button>
          ))}
        </div>
      )}
      {seri && <div className={`min-h-0 flex-1 ${aktif === 'seri' ? '' : 'hidden'}`}>{seri}</div>}
      {ai && <div className={`min-h-0 flex-1 ${aktif === 'ai' ? '' : 'hidden'}`}>{ai}</div>}
    </div>
  )
}

export default SagPanel
