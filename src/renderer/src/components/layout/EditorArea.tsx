import type { ReactElement } from 'react'
import { useAppState } from '../../state/AppStateContext'
import CodeEditor from '../editor/CodeEditor'
import cloudIcon from '../../assets/icon.png'
import { ayniDosyaMi } from '../../utils/paths'
import { useT } from '../../i18n'

/**
 * Orta bölge: sketch açıksa Monaco tabanlı sekmeli editörü, açık değilse
 * yeni sketch oluştur/aç kısayollarını içeren bir karşılama ekranı gösterir.
 */
function EditorArea(): ReactElement {
  const t = useT()
  const { state, setActiveTab, updateTabContent, closeTab, newSketch, openSketchDialog, closeSketch, clearReveal } =
    useAppState()
  const { tabs, activeTabPath } = state.sketch
  const aktifSekme = tabs.find((t) => ayniDosyaMi(t.path, activeTabPath || '')) || tabs[0]

  if (!state.sketch.info) {
    return (
      <main className="flex flex-1 flex-col overflow-hidden bg-panel">
        <div className="flex h-9 shrink-0 items-center border-b border-panel-border bg-panel-light" />
        <div className="flex flex-1 flex-col items-center justify-center gap-5 select-none">
          <div className="flex items-center gap-1.5 opacity-90 transition-opacity hover:opacity-100">
            <img
              src={cloudIcon}
              alt="Cloud IDE"
              className="h-11 w-11 object-contain"
            />
            <div className="flex items-center ml-1">
              <span className="text-2xl font-bold tracking-tight text-white">Cloud</span>
              <span className="text-2xl font-light tracking-wider text-[#7cc4f0] ml-1.5">IDE</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 font-sans">
            {t('Gömülü sistemler için modern AI destekli IDE')}
          </p>
          <div className="flex gap-2.5">
            <button
              onClick={() => void newSketch()}
              className="rounded border border-panel-border bg-panel-light px-3 py-1.5 text-xs text-gray-200 transition-colors hover:border-accent hover:bg-panel-border hover:text-white"
            >
              {t('Yeni Sketch (Ctrl+N)')}
            </button>
            <button
              onClick={() => void openSketchDialog()}
              className="rounded border border-panel-border bg-panel-light px-3 py-1.5 text-xs text-gray-200 transition-colors hover:border-accent hover:bg-panel-border hover:text-white"
            >
              {t('Sketch Aç (Ctrl+O)')}
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-panel">
      <div className="flex h-9 shrink-0 items-center overflow-x-auto border-b border-panel-border bg-panel-light">
        {tabs.map((sekme) => {
          const kirli = sekme.content !== sekme.savedContent
          const aktif = activeTabPath ? ayniDosyaMi(sekme.path, activeTabPath) : aktifSekme?.path ? ayniDosyaMi(sekme.path, aktifSekme.path) : false
          return (
            <div
              key={sekme.path}
              onClick={() => setActiveTab(sekme.path)}
              className={`group flex h-full shrink-0 cursor-pointer items-center gap-1.5 border-r border-panel-border px-3 text-xs ${
                aktif ? 'bg-panel text-gray-100' : 'text-gray-500 hover:bg-panel-border/50'
              }`}
            >
              <span
                className={`max-w-[180px] truncate ${sekme.readOnly ? 'italic text-gray-500' : ''}`}
                title={sekme.readOnly ? `${sekme.name} · ${t('salt okunur (sketch dışı dosya)')}` : sekme.name}
              >
                {sekme.name}
              </span>
              {sekme.readOnly && <span className="text-[10px] text-gray-600">({t('salt okunur')})</span>}
              {kirli && <span className="text-accent">●</span>}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(sekme.path)
                }}
                title={t('Kapat (Ctrl+W)')}
                className="ml-1 text-gray-500 opacity-0 hover:text-gray-200 focus:opacity-100 group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          )
        })}
        <div className="flex-1" />
        <button
          onClick={closeSketch}
          title={t("Sketch'i kapat")}
          className="mr-2 shrink-0 rounded px-2 py-1 text-[11px] text-gray-500 hover:bg-panel-border hover:text-red-300"
        >
          {t("Sketch'i Kapat")}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {aktifSekme?.readOnly && (
          <div className="shrink-0 border-b border-amber-800 bg-amber-950 px-3 py-1 text-[11px] text-amber-200">
            {t('Bu dosya sketch klasörünüzün dışında (kütüphane/çekirdek dosyası) — salt okunur olarak açıldı.')}
          </div>
        )}
        {aktifSekme ? (
          <div className="min-h-0 flex-1">
            <CodeEditor
              key={aktifSekme.path}
              filePath={aktifSekme.path}
              value={aktifSekme.content}
              onChange={(icerik) => updateTabContent(aktifSekme.path, icerik)}
              errors={state.build.errors}
              revealLine={
                state.build.revealTarget?.path === aktifSekme.path ? state.build.revealTarget.line : undefined
              }
              onRevealed={clearReveal}
              readOnly={aktifSekme.readOnly}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-gray-600">
            <p>{t('Düzenlemek için sol panelden bir dosya seçin.')}</p>
          </div>
        )}
      </div>
    </main>
  )
}

export default EditorArea
