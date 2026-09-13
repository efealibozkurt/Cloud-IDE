import type { ReactElement } from 'react'
import { useAppState } from '../../state/AppStateContext'

/** Dosya adını yoldan çıkarır (hem / hem \ ayraçlarını destekler) */
function dosyaAdi(yol: string): string {
  return yol.split(/[\\/]/).pop() ?? yol
}

const TUR_RENGI: Record<string, string> = {
  error: 'text-red-400',
  warning: 'text-amber-400',
  note: 'text-gray-500'
}
const TUR_ETIKETI: Record<string, string> = {
  error: 'Hata',
  warning: 'Uyarı',
  note: 'Not'
}

/**
 * Alt panelin "Problems" sekmesi: son derlemedeki hata/uyarıları listeler.
 * Bir satıra tıklamak, dosyayı (sketch içindeyse) açıp o satıra gider.
 */
function ProblemsPanel(): ReactElement {
  const { state, requestReveal } = useAppState()
  const { errors, currentOperation } = state.build

  if (currentOperation === 'compile') {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-xs text-gray-500">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        Derleniyor...
      </div>
    )
  }

  if (errors.length === 0) {
    return <p className="p-2 text-xs text-gray-500">Sorun bulunamadı. Derlemek için Ctrl+R kullanın.</p>
  }

  return (
    <div className="h-full overflow-y-auto text-xs">
      {errors.map((hata, i) => (
        <button
          key={i}
          onClick={() => void requestReveal(hata.dosya, hata.satir)}
          className="flex w-full items-start gap-2 border-b border-panel-border px-2 py-1.5 text-left hover:bg-panel-border/50"
        >
          <span className={`shrink-0 font-semibold ${TUR_RENGI[hata.tur]}`}>{TUR_ETIKETI[hata.tur]}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-gray-300">{hata.mesaj}</span>
            <span className="block truncate text-gray-600">
              {dosyaAdi(hata.dosya)}:{hata.satir}:{hata.sutun}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}

export default ProblemsPanel
