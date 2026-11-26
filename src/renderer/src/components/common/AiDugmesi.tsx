import type { ButtonHTMLAttributes, ReactElement } from 'react'
import cloudIcon from '../../assets/icon.png'

/**
 * Cloud AI'a iş yaptıran düğmelerin ortak görünümü: nötr zemin ve küçük Cloud logosu.
 * Logo, düğmenin yapay zekâ işlemi başlattığını belli eder; ayrıca renkli çerçeve kullanılmaz.
 */
export function AiDugmesi({ children, className = '', ...ozellikler }: ButtonHTMLAttributes<HTMLButtonElement>): ReactElement {
  return (
    <button
      type="button"
      {...ozellikler}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[11px] text-gray-100 transition-colors hover:enabled:border-white/30 hover:enabled:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      <img src={cloudIcon} alt="" aria-hidden="true" className="h-3 w-3 object-contain" />
      {children}
    </button>
  )
}
