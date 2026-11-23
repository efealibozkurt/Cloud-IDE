import { DiffEditor } from '@monaco-editor/react'
import { useEffect, useState, type ReactElement } from 'react'
import { useAppState } from '../../state/AppStateContext'
import { useT } from '../../i18n'
import { DEFAULT_EDITOR_THEME, type HistoryDiffFile } from '@shared/types'

interface HistoryDiffModalProps {
  baslik: string
  dosyalar: HistoryDiffFile[]
  onKapat: () => void
}

const DURUM_ETIKETI: Record<HistoryDiffFile['durum'], string> = {
  eklendi: 'yeni',
  silindi: 'silindi',
  degisti: 'değişti'
}

function dilAl(ad: string): string {
  return /\.(ino|cpp|c|h|hpp)$/i.test(ad) ? 'cpp' : 'plaintext'
}

/** İki sürüm (ya da sürüm ile çalışma kopyası) arasındaki farkı yan yana gösterir. Salt okunur. */
function HistoryDiffModal({ baslik, dosyalar, onKapat }: HistoryDiffModalProps): ReactElement {
  const t = useT()
  const { state } = useAppState()
  const [secili, setSecili] = useState(dosyalar[0]?.ad ?? '')
  const dosya = dosyalar.find((d) => d.ad === secili) ?? dosyalar[0]
  const tema = state.settings?.editorTheme ?? DEFAULT_EDITOR_THEME

  useEffect(() => {
    const tus = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onKapat()
    }
    window.addEventListener('keydown', tus)
    return () => window.removeEventListener('keydown', tus)
  }, [onKapat])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onKapat()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={t('Sürüm karşılaştırma')} className="flex h-full max-h-[720px] w-full max-w-5xl flex-col overflow-hidden rounded-[8px] border border-panel-border bg-panel shadow-2xl">
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-panel-border px-3">
          <h2 className="truncate text-[13px] font-medium text-gray-100">{baslik}</h2>
          <button onClick={onKapat} aria-label={t('Kapat')} className="flex h-6 w-6 items-center justify-center rounded-[4px] text-gray-500 hover:bg-white/[0.08] hover:text-gray-200">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        {dosyalar.length === 0 || !dosya ? (
          <div className="flex flex-1 items-center justify-center text-xs text-gray-500">{t('Fark yok: dosyalar aynı.')}</div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <ul className="w-48 shrink-0 overflow-y-auto border-r border-panel-border py-1">
              {dosyalar.map((d) => (
                <li key={d.ad}>
                  <button
                    onClick={() => setSecili(d.ad)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                      d.ad === dosya.ad ? 'bg-white/[0.07] text-gray-100' : 'text-gray-400 hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="truncate font-mono">{d.ad}</span>
                    <span className="shrink-0 text-[10px] text-gray-500">{t(DURUM_ETIKETI[d.durum])}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="min-w-0 flex-1">
              <DiffEditor
                original={dosya.eski}
                modified={dosya.yeni}
                language={dilAl(dosya.ad)}
                theme={tema}
                options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, automaticLayout: true }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HistoryDiffModal
