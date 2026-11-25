import type { ReactElement, RefObject } from 'react'
import cloudIcon from '../../assets/icon.png'
import { useT } from '../../i18n'

export type AiYazimOverlayDurum = 'bosta' | 'yaziyor' | 'tamam'

interface AiYazimOverlayProps {
  durum: AiYazimOverlayDurum
  toplamDegisen: number
  hudGoster: boolean
  onAtla: () => void
  viewportRef: RefObject<HTMLDivElement>
  beamRef: RefObject<HTMLDivElement>
  caretRef: RefObject<HTMLDivElement>
  progressFillRef: RefObject<HTMLDivElement>
  sayacRef: RefObject<HTMLSpanElement>
}

/**
 * Editör üzerinde GPU hızlandırmalı optik tarama ışını, parlayan imleç ucu,
 * üst ilerleme şeridi ve canlı yazım cam HUD kapsülünü gösterir.
 */
function AiYazimOverlay({
  durum,
  toplamDegisen,
  hudGoster,
  onAtla,
  viewportRef,
  beamRef,
  caretRef,
  progressFillRef,
  sayacRef
}: AiYazimOverlayProps): ReactElement | null {
  const t = useT()
  if (durum === 'bosta') return null

  return (
    <>
      {durum === 'yaziyor' && (
        <>
          <div className="ai-stream-progress-track" aria-hidden="true">
            <div ref={progressFillRef} className="ai-stream-progress-fill" />
          </div>
          <div className="ai-stream-edge-sheen" aria-hidden="true" />
          <div
            ref={viewportRef}
            className="pointer-events-none absolute top-0 bottom-0 z-20 overflow-hidden"
            aria-hidden="true"
          >
            <div ref={beamRef} className="ai-scan-beam" />
            <div ref={caretRef} className="ai-scan-caret" />
          </div>
        </>
      )}

      {hudGoster && (
        <div
          data-durum={durum}
          role="status"
          aria-live="polite"
          className="ai-stream-hud absolute right-6 top-3 z-30 flex items-center gap-2 rounded px-2.5 py-1 select-none"
        >
          {durum === 'yaziyor' ? (
            <>
              <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-sm">
                <span className="ai-stream-hud-ring absolute inset-0 rounded-sm" aria-hidden="true" />
                <img src={cloudIcon} alt="" className="h-3.5 w-3.5 object-contain" />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-[11.5px] font-medium">{t('Cloud AI yazıyor')}</span>
                <span ref={sayacRef} className="ai-stream-hud-muted text-[10px] tabular-nums">
                  0 / {toplamDegisen} {t('satır')}
                </span>
              </div>
              <button
                type="button"
                onClick={onAtla}
                title={t('Yazım animasyonunu atla (Esc)')}
                className="ai-stream-hud-btn ml-1 flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors"
              >
                <span>{t('Atla')}</span>
                <kbd className="ai-stream-hud-muted rounded bg-black/15 px-1 text-[9px] font-mono">Esc</kbd>
              </button>
            </>
          ) : (
            <>
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-emerald-400">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span className="text-[11.5px] font-medium">
                {toplamDegisen > 0 ? t('{n} satır güncellendi', { n: toplamDegisen }) : t('Kod güncellendi')}
              </span>
            </>
          )}
        </div>
      )}
    </>
  )
}

export default AiYazimOverlay
