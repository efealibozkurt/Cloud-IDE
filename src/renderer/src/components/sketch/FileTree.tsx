import { useState, type ReactElement, type KeyboardEvent } from 'react'
import { useAppState } from '../../state/AppStateContext'

function ayniDosyaMi(a: string, b: string): boolean {
  return a.trim().replace(/\\/g, '/').toLowerCase() === b.trim().replace(/\\/g, '/').toLowerCase()
}

/**
 * Sol panelin "Dosyalar" sekmesi: açık sketch'in .ino/.h/.cpp/.c dosyalarını
 * listeler. Dosya ekleme/yeniden adlandırma satır içi (inline) bir metin
 * kutusuyla yapılır; silme işlemi native onay penceresiyle sorulur.
 */
function FileTree(): ReactElement {
  const { state, openFileInTab, addFile, deleteFile, renameFile, closeSketch } = useAppState()
  const [ekleniyor, setEkleniyor] = useState(false)
  const [yeniDosyaAdi, setYeniDosyaAdi] = useState('')
  const [yenidenAdlandirilanYol, setYenidenAdlandirilanYol] = useState<string | null>(null)
  const [yeniAd, setYeniAd] = useState('')

  const { info, tabs, activeTabPath } = state.sketch

  if (!info) {
    return (
      <p className="p-3 text-xs text-gray-500">
        Henüz açık bir sketch yok. Yeni bir sketch oluşturun veya mevcut birini açın.
      </p>
    )
  }

  const eklemeyiOnayla = (): void => {
    const ad = yeniDosyaAdi.trim()
    setEkleniyor(false)
    setYeniDosyaAdi('')
    if (ad) void addFile(ad)
  }

  const yenidenAdlandirmayiOnayla = (eskiYol: string): void => {
    const ad = yeniAd.trim()
    setYenidenAdlandirilanYol(null)
    setYeniAd('')
    if (ad) void renameFile(eskiYol, ad)
  }

  const handleSil = (yol: string, ad: string): void => {
    const dirty = tabs.find((t) => t.path === yol)?.content !== tabs.find((t) => t.path === yol)?.savedContent
    if (dirty && !window.confirm(`"${ad}" içinde kaydedilmemiş değişiklikler var. Yine de silinsin mi?`)) return
    if (!dirty && !window.confirm(`"${ad}" silinsin mi?`)) return
    void deleteFile(yol)
  }

  const enterVeyaEscape = (e: KeyboardEvent<HTMLInputElement>, onay: () => void, iptal: () => void): void => {
    if (e.key === 'Enter') onay()
    if (e.key === 'Escape') iptal()
  }

  return (
    <div className="flex flex-col gap-0.5 p-2 text-xs">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="truncate font-semibold text-gray-300" title={info.folderPath}>
          {info.name}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={() => setEkleniyor(true)}
            title="Dosya ekle (.ino, .h, .cpp, .c)"
            className="rounded px-1.5 py-0.5 text-gray-400 hover:bg-panel-border hover:text-gray-200"
          >
            +
          </button>
          <button
            onClick={closeSketch}
            title="Sketch'i kapat"
            className="rounded px-1.5 py-0.5 text-gray-400 hover:bg-panel-border hover:text-red-300"
          >
            ×
          </button>
        </div>
      </div>

      {info.files.map((dosya) => (
        <div
          key={dosya.path}
          className={`group flex items-center justify-between rounded px-2 py-1 ${
            activeTabPath && ayniDosyaMi(activeTabPath, dosya.path) ? 'bg-accent/20 text-gray-100' : 'text-gray-400 hover:bg-panel-border'
          }`}
        >
          {yenidenAdlandirilanYol === dosya.path ? (
            <input
              autoFocus
              value={yeniAd}
              onChange={(e) => setYeniAd(e.target.value)}
              onBlur={() => yenidenAdlandirmayiOnayla(dosya.path)}
              onKeyDown={(e) =>
                enterVeyaEscape(
                  e,
                  () => yenidenAdlandirmayiOnayla(dosya.path),
                  () => setYenidenAdlandirilanYol(null)
                )
              }
              className="w-full rounded bg-panel px-1 py-0.5 text-gray-100 outline-none ring-1 ring-accent"
            />
          ) : (
            <>
              <button
                onClick={() => void openFileInTab(dosya.path, dosya.name, dosya.isMainFile)}
                className="flex-1 truncate text-left"
                title={dosya.path}
              >
                {dosya.name}
                {tabs.find((t) => t.path === dosya.path && t.content !== t.savedContent) && (
                  <span className="ml-1 text-accent">●</span>
                )}
              </button>
              {!dosya.isMainFile && (
                <span className="hidden gap-1 group-hover:flex">
                  <button
                    title="Yeniden adlandır"
                    onClick={() => {
                      setYenidenAdlandirilanYol(dosya.path)
                      setYeniAd(dosya.name)
                    }}
                    className="px-1 text-gray-500 hover:text-gray-200"
                  >
                    ✎
                  </button>
                  <button
                    title="Sil"
                    onClick={() => handleSil(dosya.path, dosya.name)}
                    className="px-1 text-gray-500 hover:text-red-400"
                  >
                    ×
                  </button>
                </span>
              )}
            </>
          )}
        </div>
      ))}

      {ekleniyor && (
        <input
          autoFocus
          value={yeniDosyaAdi}
          placeholder="ad.h / ad.cpp / ad.c"
          onChange={(e) => setYeniDosyaAdi(e.target.value)}
          onBlur={eklemeyiOnayla}
          onKeyDown={(e) => enterVeyaEscape(e, eklemeyiOnayla, () => setEkleniyor(false))}
          className="mt-0.5 w-full rounded bg-panel px-2 py-1 text-gray-100 outline-none ring-1 ring-accent"
        />
      )}
    </div>
  )
}

export default FileTree
