import type { ReactElement } from 'react'

interface Secenek<T extends string> {
  id: T
  ad: string
  sayi?: number
}

interface SegmentKontrolProps<T extends string> {
  secenekler: Secenek<T>[]
  deger: T
  onDegis: (id: T) => void
}

/** İki üç seçenekli, sayı rozetli küçük sekme kontrolü (kart ve kütüphane yöneticilerinde ortak). */
function SegmentKontrol<T extends string>({ secenekler, deger, onDegis }: SegmentKontrolProps<T>): ReactElement {
  return (
    <div role="tablist" className="flex shrink-0 gap-0.5 rounded-[6px] border border-panel-border bg-panel p-0.5">
      {secenekler.map((s) => {
        const secili = s.id === deger
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={secili}
            onClick={() => onDegis(s.id)}
            className={`flex h-6 flex-1 items-center justify-center gap-1.5 rounded-[4px] text-xs transition-colors ${
              secili ? 'bg-panel-light text-gray-100 shadow-[inset_0_-2px_0_var(--tw-shadow-color)] shadow-accent' : 'text-gray-500 hover:text-gray-200'
            }`}
          >
            {s.ad}
            {s.sayi !== undefined && (
              <span
                className={`font-mono text-[10px] tabular-nums ${
                  secili ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                {s.sayi}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default SegmentKontrol
