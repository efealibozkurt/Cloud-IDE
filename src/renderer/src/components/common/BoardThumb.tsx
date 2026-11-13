import { type ReactElement } from 'react'
import type { KartRengi } from '../../utils/boardImages'

interface BoardThumbProps {
  /** Kart fotoğrafı; yoksa kart ailesine göre renklendirilmiş bir PCB çizimi gösterilir */
  src: string | null
  alt?: string
  /** Piksel cinsinden genişlik; yükseklik 3:2 oranında hesaplanır */
  genislik?: number
  renk?: KartRengi
  className?: string
}

const RENKLER: Record<KartRengi, { pcb: string; kenar: string; ic: string }> = {
  yesil: { pcb: '#1f7a4a', kenar: '#2fb36d', ic: '#d8f5e4' },
  kirmizi: { pcb: '#b42332', kenar: '#ef4b5d', ic: '#ffe1e4' },
  mavi: { pcb: '#1d4f91', kenar: '#4c8fe0', ic: '#dbe9ff' },
  gri: { pcb: '#4b5160', kenar: '#7b8396', ic: '#e6e9ef' }
}

/** Fotoğrafı olmayan kartlar için küçük, renkli bir geliştirme kartı çizimi */
function PcbCizimi({ renk, genislik }: { renk: KartRengi; genislik: number }): ReactElement {
  const r = RENKLER[renk]
  const yukseklik = Math.round((genislik * 2) / 3)
  return (
    <svg width={genislik} height={yukseklik} viewBox="0 0 60 40" aria-hidden="true">
      <rect width="60" height="40" fill="#101218" />
      <rect x="5" y="5" width="50" height="30" rx="3" fill={r.pcb} stroke={r.kenar} strokeWidth="1" />
      {/* USB girişi */}
      <rect x="1.5" y="15" width="8" height="10" rx="1" fill="#c9ced8" />
      {/* Ana yonga */}
      <rect x="24" y="13" width="14" height="14" rx="1.5" fill="#151821" />
      <circle cx="27" cy="16" r="1" fill={r.ic} opacity="0.8" />
      {/* Anten/modül */}
      <rect x="41" y="12" width="11" height="16" rx="1" fill="#1d2230" stroke={r.kenar} strokeWidth="0.6" />
      {/* Pin dizileri */}
      {Array.from({ length: 9 }).map((_, i) => (
        <g key={i}>
          <rect x={13 + i * 4.4} y="6.2" width="2" height="2.4" fill={r.ic} opacity="0.9" />
          <rect x={13 + i * 4.4} y="31.4" width="2" height="2.4" fill={r.ic} opacity="0.9" />
        </g>
      ))}
      <circle cx="14" cy="20" r="1.3" fill="#ffd66b" />
    </svg>
  )
}

/** Küçük kart görseli. Fotoğraflar açık zeminli olduğu için kutusu açık renkli tutulur. */
function BoardThumb({ src, alt = '', genislik = 36, renk = 'gri', className = '' }: BoardThumbProps): ReactElement {
  const yukseklik = Math.round((genislik * 2) / 3)
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 shadow-sm ${
        src ? 'bg-[#eceef1]' : 'bg-[#101218]'
      } ${className}`}
      style={{ width: genislik, height: yukseklik }}
    >
      {src ? (
        <img src={src} alt={alt} loading="lazy" draggable={false} className="h-full w-full object-contain" />
      ) : (
        <PcbCizimi renk={renk} genislik={genislik} />
      )}
    </span>
  )
}

export default BoardThumb
