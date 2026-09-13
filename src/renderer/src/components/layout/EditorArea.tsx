import type { ReactElement } from 'react'
import { useAppState } from '../../state/AppStateContext'
import CodeEditor from '../editor/CodeEditor'
import cloudIcon from '../../assets/icon.png'

function ayniDosyaMi(a: string, b: string): boolean {
  return a.trim().replace(/\\/g, '/').toLowerCase() === b.trim().replace(/\\/g, '/').toLowerCase()
}

/**
 * Orta bölge: sketch açıksa Monaco tabanlı sekmeli editörü, açık değilse
 * yeni sketch oluştur/aç kısayollarını içeren bir karşılama ekranı gösterir.
 */
function EditorArea(): ReactElement {
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
              className="h-11 w-11 object-contain drop-shadow-[0_0_20px_rgba(147,165,251,0.35)]"
            />
            <div className="flex items-center ml-1">
              <span className="text-2xl font-bold tracking-tight text-white">Cloud</span>
              <span className="text-2xl font-light tracking-wider text-[#93a5fb] ml-1.5">IDE</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 font-sans">
            Gömülü sistemler için modern AI destekli IDE
          </p>
          <div className="flex gap-2.5">
            <button
              onClick={() => void newSketch()}
              className="rounded-lg border border-panel-border bg-panel-light px-4 py-2 text-xs font-medium text-gray-200 shadow-sm transition-all hover:border-[#93a5fb]/40 hover:bg-panel-border hover:text-white"
            >
              Yeni Sketch (Ctrl+N)
            </button>
            <button
              onClick={() => void openSketchDialog()}
              className="rounded-lg border border-panel-border bg-panel-light px-4 py-2 text-xs font-medium text-gray-200 shadow-sm transition-all hover:border-[#93a5fb]/40 hover:bg-panel-border hover:text-white"
            >
              Sketch Aç (Ctrl+O)
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
                className={sekme.readOnly ? 'italic text-gray-500' : ''}
                title={sekme.readOnly ? 'Salt okunur (sketch dışı dosya)' : undefined}
              >
                {sekme.name}
              </span>
              {sekme.readOnly && <span className="text-[10px] text-gray-600">(salt okunur)</span>}
              {kirli && <span className="text-accent">●</span>}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(sekme.path)
                }}
                title="Kapat (Ctrl+W)"
                className="ml-1 hidden text-gray-500 hover:text-gray-200 group-hover:inline"
              >
                ×
              </button>
            </div>
          )
        })}
        <div className="flex-1" />
        <button
          onClick={closeSketch}
          title="Sketch'i kapat"
          className="mr-2 shrink-0 rounded px-2 py-1 text-[11px] text-gray-500 hover:bg-panel-border hover:text-red-300"
        >
          Sketch'i Kapat
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {aktifSekme?.readOnly && (
          <div className="shrink-0 border-b border-amber-800 bg-amber-950 px-3 py-1 text-[11px] text-amber-200">
            Bu dosya sketch klasörünüzün dışında (kütüphane/çekirdek dosyası) — salt okunur olarak açıldı.
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
            <p>Düzenlemek için sol panelden bir dosya seçin.</p>
          </div>
        )}
      </div>
    </main>
  )
}

export default EditorArea
