import { useT } from '../../i18n'
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react'

type TusTuru = 'birincil' | 'ikincil' | 'tehlike'

interface TusProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  tur?: TusTuru
  children: ReactNode
}

const STILLER: Record<TusTuru, string> = {
  // Fiziksel tuş gibi: düz vurgu rengi, altta kalın kenar, basınca çöker
  birincil:
    'bg-accent text-white hover:enabled:bg-accent-hover',
  ikincil: 'border border-panel-border text-gray-200 hover:enabled:bg-white/[0.06]',
  // Düşük vurgu: yalnızca metin, üzerine gelince kızarır
  tehlike: 'text-gray-400 hover:enabled:bg-rose-500/10 hover:enabled:text-rose-300'
}

/** Yan paneldeki yönetici ekranlarında ortak kullanılan, satıra bölünmeyen küçük düğme. */
export function Tus({ tur = 'ikincil', children, type = 'button', ...diger }: TusProps): ReactElement {
  return (
    <button
      type={type}
      {...diger}
      className={`h-[26px] whitespace-nowrap rounded-[5px] px-2.5 text-[11px] font-medium transition-[background-color,transform,box-shadow] duration-100 disabled:cursor-not-allowed disabled:opacity-50 ${STILLER[tur]}`}
    >
      {children}
    </button>
  )
}

/** Kurulu durumunu gösteren küçük LED + sürüm yazısı (rozet yerine). */
export function Led({ metin, baslik }: { metin: string; baslik?: string }): ReactElement {
  return (
    <span title={baslik ?? 'Kurulu'} className="flex shrink-0 items-center gap-1.5 font-mono text-[10.5px] text-gray-400">
      <span className="h-1.5 w-1.5 rounded-full bg-[#3ddc84]" aria-hidden="true" />
      {metin}
    </span>
  )
}

/** arduino-cli işlemi sürerken gösterilen kısa günlük kutusu. */
export function KurulumGunlugu({ baslik, gunluk }: { baslik: string; gunluk: string }): ReactElement {
  const t = useT()
  return (
    <div className="mt-2.5 rounded-[5px] border border-panel-border bg-panel p-2">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] text-gray-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        {baslik}
      </div>
      <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] text-gray-500">
        {gunluk || t('arduino-cli işleminin bitmesi bekleniyor…')}
      </pre>
    </div>
  )
}

/** Eylem satırı: sürüm seçici esner, düğmeler sabit genişlikte kalır; hiçbir şey alt satıra kaymaz. */
export function EylemSatiri({ children }: { children: ReactNode }): ReactElement {
  return <div className="mt-2.5 flex items-center gap-1.5 [&>select]:min-w-0 [&>select]:flex-1">{children}</div>
}

export const SECICI_SINIFI =
  'h-[26px] rounded-[5px] border border-panel-border bg-panel px-1.5 text-[11px] text-gray-200 outline-none focus:border-accent'
