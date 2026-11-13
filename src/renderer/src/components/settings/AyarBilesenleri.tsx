import type { ReactElement, ReactNode } from 'react'

/** Ayarlar penceresindeki bir bölüm: başlık, isteğe bağlı açıklama ve satırlar. */
export function AyarBolumu({ baslik, aciklama, children }: { baslik: string; aciklama?: string; children: ReactNode }): ReactElement {
  return (
    <section className="mb-7 last:mb-0">
      <h3 className="text-[13px] font-semibold text-gray-100">{baslik}</h3>
      {aciklama && <p className="mt-0.5 text-[11.5px] leading-relaxed text-gray-500">{aciklama}</p>}
      <div className="mt-2.5 divide-y divide-panel-border/70 rounded-[8px] border border-panel-border bg-panel/40">{children}</div>
    </section>
  )
}

/** Sol tarafta ad ve açıklama, sağ tarafta denetim (anahtar, seçici, düğme) olan tek bir ayar satırı. */
export function AyarSatiri({
  baslik,
  aciklama,
  children,
  alt
}: {
  baslik: string
  aciklama?: string
  children?: ReactNode
  /** Satırın altında tam genişlikte gösterilecek içerik (uzun giriş, uyarı vb.) */
  alt?: ReactNode
}): ReactElement {
  return (
    <div className="px-3.5 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-medium text-gray-200">{baslik}</div>
          {aciklama && <div className="mt-0.5 text-[11.5px] leading-relaxed text-gray-500">{aciklama}</div>}
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
      {alt && <div className="mt-2.5">{alt}</div>}
    </div>
  )
}

/** Açık/kapalı anahtarı (checkbox yerine). */
export function Anahtar({ acik, onDegis, etiket }: { acik: boolean; onDegis: (yeni: boolean) => void; etiket: string }): ReactElement {
  return (
    <button
      role="switch"
      aria-checked={acik}
      aria-label={etiket}
      onClick={() => onDegis(!acik)}
      className={`relative h-5 w-9 rounded-full transition-colors ${acik ? 'bg-accent' : 'bg-white/15'}`}
    >
      <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${acik ? 'translate-x-4' : ''}`} />
    </button>
  )
}

export const SECICI = 'h-7 rounded-[5px] border border-panel-border bg-panel px-2 text-xs text-gray-200 outline-none focus:border-accent disabled:opacity-50'
export const GIRIS = 'h-7 rounded-[5px] border border-panel-border bg-panel px-2.5 text-xs text-gray-200 outline-none focus:border-accent'
export const KUCUK_DUGME =
  'h-7 rounded-[5px] border border-panel-border px-3 text-xs text-gray-200 transition-colors hover:enabled:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50'
export const BIRINCIL_DUGME =
  'h-7 rounded-[5px] bg-accent px-3 text-xs font-medium text-white transition-colors hover:enabled:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40'
