import type { ReactElement } from 'react'
import { useYardim } from '../../state/HelpContext'
import type { YardimKonuId } from '../help/yardimKonulari'

/** Bölüm başlıklarının yanına konan küçük "?" düğmesi: ilgili yardım konusunu açar. */
export function YardimDugmesi({ konu, baslik = 'Bu bölüm nasıl kullanılır?' }: { konu: YardimKonuId; baslik?: string }): ReactElement {
  const { yardimAc } = useYardim()
  return (
    <button
      onClick={() => yardimAc(konu)}
      aria-label={baslik}
      title={baslik}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] text-gray-500 transition-colors hover:bg-white/[0.08] hover:text-gray-200"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.6M12 17h.01" />
      </svg>
    </button>
  )
}
