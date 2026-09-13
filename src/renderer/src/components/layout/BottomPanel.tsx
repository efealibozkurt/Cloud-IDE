import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type MouseEvent as ReactMouseEvent
} from 'react'
import { useAppState } from '../../state/AppStateContext'
import ProblemsPanel from '../build/ProblemsPanel'
import SerialMonitor from '../serial/SerialMonitor'

export type BottomPanelTab = 'cikti' | 'seri' | 'problems'

interface BottomPanelProps {
  activeTab: BottomPanelTab
  onTabChange: (tab: BottomPanelTab) => void
  onClose: () => void
}

const MIN_HEIGHT = 120
const MAX_HEIGHT = 640
const DEFAULT_HEIGHT = 240

/**
 * Alt panel: Çıktı, Seri Monitör ve Problems sekmeleri arasında geçiş
 * sağlar. Üst kenarından fare ile sürüklenerek yüksekliği değiştirilebilir.
 */
function BottomPanel({ activeTab, onTabChange, onClose }: BottomPanelProps): ReactElement {
  const { state } = useAppState()
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const isDragging = useRef(false)
  const dragStartY = useRef(0)
  const dragStartHeight = useRef(0)
  const ciktiRef = useRef<HTMLPreElement>(null)

  const hataSayisi = state.build.errors.filter((h) => h.tur === 'error').length
  const uyariSayisi = state.build.errors.filter((h) => h.tur === 'warning').length

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return
    const delta = dragStartY.current - e.clientY
    const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragStartHeight.current + delta))
    setHeight(next)
  }, [])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
    document.body.style.cursor = ''
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  useEffect(() => {
    if (ciktiRef.current) ciktiRef.current.scrollTop = ciktiRef.current.scrollHeight
  }, [state.build.log])

  const startDrag = (e: ReactMouseEvent): void => {
    isDragging.current = true
    dragStartY.current = e.clientY
    dragStartHeight.current = height
    document.body.style.cursor = 'row-resize'
  }

  const TABS: { id: BottomPanelTab; label: string }[] = [
    { id: 'cikti', label: 'Çıktı' },
    { id: 'seri', label: 'Seri Monitör' },
    {
      id: 'problems',
      label: hataSayisi + uyariSayisi > 0 ? `Problems (${hataSayisi + uyariSayisi})` : 'Problems'
    }
  ]

  return (
    <section
      style={{ height }}
      className="relative flex shrink-0 flex-col border-t border-panel-border bg-panel-light"
    >
      {/* Yükseklik sürükleme tutamacı */}
      <div
        onMouseDown={startDrag}
        title="Sürükleyerek boyutlandır"
        className="absolute -top-1 left-0 right-0 z-10 h-2 cursor-row-resize"
      />

      <nav className="flex items-center border-b border-panel-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`border-b-2 px-3 py-1.5 text-[11px] transition-colors ${
              activeTab === tab.id
                ? 'border-accent text-gray-100'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            } ${tab.id === 'problems' && hataSayisi > 0 ? 'text-red-400' : ''}`}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={onClose}
          title="Alt paneli kapat"
          className="mr-2 flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-panel-border hover:text-gray-200"
        >
          <CloseIcon />
        </button>
      </nav>

      <div className="min-h-0 flex-1">
        {activeTab === 'cikti' && (
          <pre ref={ciktiRef} className="h-full overflow-y-auto whitespace-pre-wrap p-2 font-mono text-xs text-gray-400">
            {state.build.currentOperation && (
              <div className="mb-1 flex items-center gap-1.5 text-accent-hover">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                {state.build.currentOperation === 'compile' ? 'Derleniyor...' : 'Yükleniyor...'}
              </div>
            )}
            {state.build.log || 'Henüz bir derleme/yükleme yapılmadı. (Ctrl+R derle, Ctrl+U yükle)'}
          </pre>
        )}
        {activeTab === 'seri' && <SerialMonitor />}
        {activeTab === 'problems' && <ProblemsPanel />}
      </div>
    </section>
  )
}

function CloseIcon(): ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

export default BottomPanel
