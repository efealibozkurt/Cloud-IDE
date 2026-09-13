import { useRef, useState, useEffect, type ReactElement, type PointerEvent as ReactPointerEvent } from 'react'
import type { ReasoningEffort } from '@shared/types'

interface ReasoningLevelSwitchProps {
  value: ReasoningEffort
  onChange: (level: ReasoningEffort) => void
  disabled?: boolean
}

interface LevelConfig {
  id: ReasoningEffort
  label: string
  desc: string
  color: string
  activeBg: string
  renderIcon: (className?: string) => ReactElement
}

const LEVELS: LevelConfig[] = [
  {
    id: 'low',
    label: 'Düşük',
    desc: 'Düşük Muhakeme: Hızlı ve doğrudan kod odaklı yanıt.',
    color: 'text-emerald-300',
    activeBg: 'from-emerald-500/25 to-teal-500/20 border-emerald-500/40 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.25)]',
    renderIcon: (className) => <ZapIcon className={className} />
  },
  {
    id: 'medium',
    label: 'Orta',
    desc: 'Orta Muhakeme: Dengeli mimari ve donanım açıklaması.',
    color: 'text-[#93a5fb]',
    activeBg: 'from-[#3b82f6]/25 to-[#8b5cf6]/20 border-[#3b82f6]/40 text-[#c4b5fd] shadow-[0_0_10px_rgba(59,130,246,0.25)]',
    renderIcon: (className) => <BrainIcon className={className} />
  },
  {
    id: 'high',
    label: 'Yüksek',
    desc: 'Yüksek Muhakeme: Derin donanım, register ve bellek analizi.',
    color: 'text-purple-300',
    activeBg: 'from-purple-500/30 to-fuchsia-500/25 border-purple-500/45 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.3)]',
    renderIcon: (className) => <AtomCoreIcon className={className} />
  }
]

export function ReasoningLevelSwitch({ value, onChange, disabled }: ReasoningLevelSwitchProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [buttonRects, setButtonRects] = useState<Array<{ left: number; width: number }>>([])
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

  const activeIndex = LEVELS.findIndex((l) => l.id === value)
  const safeActiveIndex = activeIndex >= 0 ? activeIndex : 1
  const activeItem = LEVELS[safeActiveIndex]

  // Butonların genişlik ve konumlarını ölç (seçili buton metin aldığında boyutu değişir)
  useEffect(() => {
    if (!containerRef.current) return
    const containerLeft = containerRef.current.getBoundingClientRect().left
    const rects = buttonRefs.current.map((btn) => {
      if (!btn) return { left: 0, width: 30 }
      const bRect = btn.getBoundingClientRect()
      return {
        left: bRect.left - containerLeft,
        width: bRect.width
      }
    })
    setButtonRects(rects)
  }, [value])

  const calculateIndexFromPointer = (clientX: number): number => {
    if (!containerRef.current) return safeActiveIndex
    const rect = containerRef.current.getBoundingClientRect()
    const relativeX = clientX - rect.left
    const percent = Math.max(0, Math.min(1, relativeX / rect.width))
    if (percent < 0.33) return 0
    if (percent < 0.67) return 1
    return 2
  }

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (disabled) return
    setIsDragging(true)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!isDragging || disabled) return
    const newIdx = calculateIndexFromPointer(e.clientX)
    if (LEVELS[newIdx].id !== value) {
      onChange(LEVELS[newIdx].id)
    }
  }

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!isDragging || disabled) return
    setIsDragging(false)
    const finalIdx = calculateIndexFromPointer(e.clientX)
    onChange(LEVELS[finalIdx].id)
  }

  useEffect(() => {
    const handleGlobalUp = (): void => {
      if (isDragging) setIsDragging(false)
    }
    window.addEventListener('pointerup', handleGlobalUp)
    return () => window.removeEventListener('pointerup', handleGlobalUp)
  }, [isDragging])

  const currentRect = buttonRects[safeActiveIndex] || { left: safeActiveIndex * 34, width: 34 }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      title={`${activeItem.desc} (Sürükleyin veya tıklayın)`}
      className={`relative inline-flex h-7 shrink-0 cursor-grab items-center rounded-lg border border-panel-border bg-black/45 p-0.5 select-none transition-opacity active:cursor-grabbing ${
        disabled ? 'opacity-40 pointer-events-none' : ''
      }`}
    >
      {/* Kayan Kapsül Gösterge (Sliding Thumb Pill) */}
      <div
        style={{
          transform: `translateX(${currentRect.left}px)`,
          width: `${currentRect.width}px`,
          transition: isDragging ? 'none' : 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1), width 180ms ease'
        }}
        className={`pointer-events-none absolute left-0 top-0.5 h-6 rounded-md border bg-gradient-to-r ${activeItem.activeBg}`}
      />

      {/* 3 Kademe Butonu: Seçili olan ikon+metin, seçili olmayanlar yalnızca ikon */}
      {LEVELS.map((lvl, index) => {
        const isCurrent = lvl.id === value
        return (
          <button
            key={lvl.id}
            ref={(el) => {
              buttonRefs.current[index] = el
            }}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange(lvl.id)
            }}
            title={lvl.desc}
            className={`relative z-10 flex h-6 items-center justify-center gap-1.5 rounded-md px-2 text-[10px] font-medium transition-all ${
              isCurrent ? `font-semibold ${lvl.color}` : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {lvl.renderIcon(isCurrent ? 'h-3.5 w-3.5 shrink-0' : 'h-3.5 w-3.5 shrink-0 opacity-70')}
            {isCurrent && <span className="tracking-tight">{lvl.label}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Şimşek İkonu (Düşük Muhakeme - Hızlı) */
function ZapIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

/** Beyin İkonu (Orta Muhakeme - Dengeli) */
function BrainIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-5.04Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-5.04Z" />
    </svg>
  )
}

/** Atom / Nöron Çekirdek İkonu (Yüksek Muhakeme - Derin) */
function AtomCoreIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
    </svg>
  )
}

export default ReasoningLevelSwitch
