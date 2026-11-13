import { useEffect, useState, type ReactElement, type KeyboardEvent, type MouseEvent } from 'react'
import { useAppState } from '../../state/AppStateContext'
import SablonSihirbazi from './SablonSihirbazi'
import type { SketchInfo } from '@shared/types'
import { ayniDosyaMi } from '../../utils/paths'

interface BaglamMenusu {
  x: number
  y: number
  tur: 'proje' | 'dosya'
  folderPath: string
  dosyaYolu?: string
  dosyaAdi?: string
  anaDosya?: boolean
}

/**
 * Sol panelin "Gezgin" sekmesi: çalışma alanındaki sketch projelerini
 * VS Code Gezgini gibi düz bir ağaç olarak listeler. Proje satırı chevron +
 * klasör adı, dosyalar bir seviye girintili satırlardır. Aktif derleme hedefi
 * sol kenardaki ince çizgiyle gösterilir; aksiyonlar hover'da ya da sağ tık
 * menüsünde çıkar.
 */
function FileTree(): ReactElement {
  const {
    state,
    openFileInTab,
    addFile,
    deleteFile,
    renameFile,
    closeSketch,
    removeSketchFromWorkspace,
    setActiveSketch,
    openInNewWindow,
    addSketchToWorkspaceDialog,
    addSketchToWorkspace,
    saveAllTabs,
    newSketch,
    openSketchDialog
  } = useAppState()

  const [ekleniyorKlasor, setEkleniyorKlasor] = useState<string | null>(null)
  const [yeniDosyaAdi, setYeniDosyaAdi] = useState('')
  const [yenidenAdlandirilanYol, setYenidenAdlandirilanYol] = useState<string | null>(null)
  const [yeniAd, setYeniAd] = useState('')
  const [daraltilmislar, setDaraltilmislar] = useState<Record<string, boolean>>({})
  const [menu, setMenu] = useState<BaglamMenusu | null>(null)
  const [sablonAcik, setSablonAcik] = useState(false)

  const { info, tabs, activeTabPath, workspaceSketches, activeSketchPath } = state.sketch

  // Çalışma alanındaki projeler: workspaceSketches varsa onlar, yoksa mevcut info
  const projeler: SketchInfo[] = workspaceSketches.length > 0 ? workspaceSketches : info ? [info] : []
  const aktifYol = activeSketchPath || info?.folderPath || null

  // Menü dışına tıklayınca / Esc ile kapat
  useEffect(() => {
    if (!menu) return
    const kapat = (): void => setMenu(null)
    const tus = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') setMenu(null)
    }
    window.addEventListener('click', kapat)
    window.addEventListener('keydown', tus)
    return () => {
      window.removeEventListener('click', kapat)
      window.removeEventListener('keydown', tus)
    }
  }, [menu])

  if (projeler.length === 0) {
    return (
      <div className="flex flex-col gap-3 px-4 py-6">
        <p className="text-[13px] text-gray-300">Açık proje yok</p>
        <p className="text-xs leading-relaxed text-gray-500">
          Yeni bir sketch oluşturun veya diskteki bir Arduino klasörünü açın.
        </p>
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => void newSketch()}
            className="rounded bg-accent px-3 py-1.5 text-left text-xs font-medium text-white hover:bg-accent-hover"
          >
            Yeni sketch
          </button>
          <button
            onClick={() => setSablonAcik(true)}
            data-tur="sablon"
            className="rounded border border-panel-border px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/5"
          >
            Şablondan proje…
          </button>
          <button
            onClick={() => void openSketchDialog()}
            className="rounded border border-panel-border px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/5"
          >
            Klasör aç…
          </button>
        </div>
        {sablonAcik && <SablonSihirbazi onKapat={() => setSablonAcik(false)} />}
      </div>
    )
  }

  const toggleDaralt = (folderPath: string): void =>
    setDaraltilmislar((prev) => ({ ...prev, [folderPath]: !prev[folderPath] }))

  const dosyaEklemeyiBaslat = (folderPath: string): void => {
    setEkleniyorKlasor(folderPath)
    setDaraltilmislar((prev) => ({ ...prev, [folderPath]: false }))
  }

  const eklemeyiOnayla = (folderPath: string): void => {
    const ad = yeniDosyaAdi.trim()
    setEkleniyorKlasor(null)
    setYeniDosyaAdi('')
    if (ad) void addFile(ad, folderPath)
  }

  const yenidenAdlandirmayiBaslat = (yol: string, ad: string): void => {
    setYenidenAdlandirilanYol(yol)
    setYeniAd(ad)
  }

  const yenidenAdlandirmayiOnayla = (eskiYol: string): void => {
    const ad = yeniAd.trim()
    setYenidenAdlandirilanYol(null)
    setYeniAd('')
    if (ad) void renameFile(eskiYol, ad)
  }

  const handleSil = (yol: string, ad: string, folderPath: string): void => {
    const sekme = tabs.find((t) => ayniDosyaMi(t.path, yol))
    const kirli = sekme ? sekme.content !== sekme.savedContent : false
    const mesaj = kirli
      ? `"${ad}" içinde kaydedilmemiş değişiklikler var. Yine de silinsin mi?`
      : `"${ad}" silinsin mi?`
    if (!window.confirm(mesaj)) return
    void deleteFile(yol, folderPath)
  }

  const projeyiKapat = (folderPath: string): void => {
    if (projeler.length > 1) removeSketchFromWorkspace(folderPath)
    else closeSketch()
  }

  const enterVeyaEscape = (e: KeyboardEvent<HTMLInputElement>, onay: () => void, iptal: () => void): void => {
    if (e.key === 'Enter') onay()
    if (e.key === 'Escape') iptal()
  }

  const menuAc = (e: MouseEvent, m: Omit<BaglamMenusu, 'x' | 'y'>): void => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ ...m, x: e.clientX, y: e.clientY })
  }

  return (
    <div className="flex h-full select-none flex-col text-[13px]">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs font-medium text-gray-400">Projeler</span>
        <div className="flex items-center">
          <IkonButon
            baslik="Çalışma alanına proje ekle"
            onClick={() => void addSketchToWorkspaceDialog()}
          >
            <FolderPlusIcon />
          </IkonButon>
          <span data-tur="sablon" className="flex">
            <IkonButon baslik="Şablondan proje (hazır, çalışan örnekler)" onClick={() => setSablonAcik(true)}>
              <TemplateIcon />
            </IkonButon>
          </span>
          <IkonButon baslik="Yeni sketch" onClick={() => void newSketch()}>
            <PlusIcon />
          </IkonButon>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-2">
        {projeler.map((proje) => {
          const aktif = aktifYol ? ayniDosyaMi(aktifYol, proje.folderPath) : false
          const daraltilmis = Boolean(daraltilmislar[proje.folderPath])

          return (
            <div key={proje.folderPath}>
              <div
                onClick={() => setActiveSketch(proje.folderPath)}
                onContextMenu={(e) => menuAc(e, { tur: 'proje', folderPath: proje.folderPath })}
                title={`${proje.folderPath}\nDerleme hedefi olarak seçmek için tıklayın`}
                className={`group relative flex h-6 cursor-pointer items-center gap-1 pl-1 pr-2 hover:bg-white/[0.05] ${
                  aktif ? 'bg-white/[0.04]' : ''
                }`}
              >
                {aktif && <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" />}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleDaralt(proje.folderPath)
                  }}
                  aria-label={daraltilmis ? 'Genişlet' : 'Daralt'}
                  className="flex h-4 w-4 shrink-0 items-center justify-center text-gray-500 hover:text-gray-200"
                >
                  <ChevronIcon className={daraltilmis ? '-rotate-90' : ''} />
                </button>
                <span className={`truncate ${aktif ? 'font-semibold text-gray-100' : 'text-gray-300'}`}>
                  {proje.name}
                </span>
                <div className="ml-auto flex shrink-0 items-center opacity-0 group-hover:opacity-100">
                  <IkonButon baslik="Dosya ekle (.h, .cpp, .c)" onClick={() => dosyaEklemeyiBaslat(proje.folderPath)}>
                    <PlusIcon />
                  </IkonButon>
                  <IkonButon
                    baslik={projeler.length > 1 ? 'Çalışma alanından kaldır' : 'Sketch’i kapat'}
                    onClick={() => projeyiKapat(proje.folderPath)}
                  >
                    <CloseIcon />
                  </IkonButon>
                </div>
              </div>

              {!daraltilmis && (
                <div>
                  {proje.files.map((dosya) => {
                    const sekmeAktif = activeTabPath ? ayniDosyaMi(activeTabPath, dosya.path) : false
                    const kirli = tabs.some((t) => ayniDosyaMi(t.path, dosya.path) && t.content !== t.savedContent)
                    const adlandiriliyor = yenidenAdlandirilanYol === dosya.path

                    return (
                      <div
                        key={dosya.path}
                        onContextMenu={(e) =>
                          menuAc(e, {
                            tur: 'dosya',
                            folderPath: proje.folderPath,
                            dosyaYolu: dosya.path,
                            dosyaAdi: dosya.name,
                            anaDosya: dosya.isMainFile
                          })
                        }
                        className={`group flex h-6 items-center pl-7 pr-2 ${
                          sekmeAktif ? 'bg-accent/20 text-gray-50' : 'text-gray-400 hover:bg-white/[0.05] hover:text-gray-200'
                        }`}
                      >
                        {adlandiriliyor ? (
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
                            className="w-full rounded-sm bg-panel px-1 text-[13px] text-gray-100 outline-none ring-1 ring-accent"
                          />
                        ) : (
                          <>
                            <button
                              onClick={() => void openFileInTab(dosya.path, dosya.name, dosya.isMainFile, proje.folderPath)}
                              onKeyDown={(e) => {
                                if (e.key === 'F2' && !dosya.isMainFile) yenidenAdlandirmayiBaslat(dosya.path, dosya.name)
                                if (e.key === 'Delete' && !dosya.isMainFile) handleSil(dosya.path, dosya.name, proje.folderPath)
                              }}
                              title={dosya.path}
                              className="flex min-w-0 flex-1 items-center gap-1.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-accent"
                            >
                              <FileIcon />
                              <span className="truncate">{dosya.name}</span>
                            </button>
                            {kirli && <span className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" title="Kaydedilmedi" />}
                          </>
                        )}
                      </div>
                    )
                  })}

                  {ekleniyorKlasor === proje.folderPath && (
                    <div className="pl-7 pr-2 py-0.5">
                      <input
                        autoFocus
                        value={yeniDosyaAdi}
                        placeholder="dosya.h, dosya.cpp veya dosya.c"
                        onChange={(e) => setYeniDosyaAdi(e.target.value)}
                        onBlur={() => eklemeyiOnayla(proje.folderPath)}
                        onKeyDown={(e) =>
                          enterVeyaEscape(
                            e,
                            () => eklemeyiOnayla(proje.folderPath),
                            () => {
                              setEkleniyorKlasor(null)
                              setYeniDosyaAdi('')
                            }
                          )
                        }
                        className="w-full rounded-sm bg-panel px-1 py-0.5 text-[13px] text-gray-100 outline-none ring-1 ring-accent placeholder:text-gray-600"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {sablonAcik && <SablonSihirbazi onKapat={() => setSablonAcik(false)} />}

      {menu && (
        <div
          role="menu"
          style={{ left: Math.max(4, Math.min(menu.x, window.innerWidth - 210)), top: Math.max(4, Math.min(menu.y, window.innerHeight - 230)) }}
          className="fixed z-50 min-w-[190px] rounded border border-panel-border bg-panel-light py-1 text-xs text-gray-200 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {menu.tur === 'proje' ? (
            <>
              <MenuOgesi onClick={() => { dosyaEklemeyiBaslat(menu.folderPath); setMenu(null) }}>Yeni dosya</MenuOgesi>
              <MenuOgesi onClick={() => { setActiveSketch(menu.folderPath); setMenu(null) }}>Derleme hedefi yap</MenuOgesi>
              <MenuOgesi onClick={() => { void openInNewWindow(menu.folderPath); setMenu(null) }}>Yeni pencerede aç</MenuOgesi>
              <MenuOgesi
                onClick={() => {
                  const klasor = menu.folderPath
                  setMenu(null)
                  void (async () => {
                    try {
                      await saveAllTabs()
                      const bilgi = await window.api.sketch.saveAsDialog(klasor)
                      if (bilgi) await addSketchToWorkspace(bilgi)
                    } catch {
                      // iletişim kutusu iptal edildi ya da kopyalanamadı; çalışma alanı olduğu gibi kalır
                    }
                  })()
                }}
              >
                Farklı kaydet (kopya oluştur)…
              </MenuOgesi>
              <MenuOgesi onClick={() => { projeyiKapat(menu.folderPath); setMenu(null) }}>
                {projeler.length > 1 ? 'Çalışma alanından kaldır' : 'Kapat'}
              </MenuOgesi>
            </>
          ) : (
            <>
              <MenuOgesi
                devreDisi={menu.anaDosya}
                onClick={() => { if (menu.dosyaYolu && menu.dosyaAdi) yenidenAdlandirmayiBaslat(menu.dosyaYolu, menu.dosyaAdi); setMenu(null) }}
              >
                Yeniden adlandır
              </MenuOgesi>
              <MenuOgesi
                devreDisi={menu.anaDosya}
                onClick={() => { if (menu.dosyaYolu && menu.dosyaAdi) handleSil(menu.dosyaYolu, menu.dosyaAdi, menu.folderPath); setMenu(null) }}
              >
                Sil
              </MenuOgesi>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MenuOgesi({
  children,
  onClick,
  devreDisi
}: {
  children: string
  onClick: () => void
  devreDisi?: boolean
}): ReactElement {
  return (
    <button
      role="menuitem"
      disabled={devreDisi}
      onClick={onClick}
      className="block w-full px-3 py-1 text-left hover:bg-accent/30 disabled:cursor-default disabled:text-gray-600 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

function IkonButon({
  baslik,
  onClick,
  children
}: {
  baslik: string
  onClick: () => void
  children: ReactElement
}): ReactElement {
  return (
    <button
      title={baslik}
      aria-label={baslik}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-white/10 hover:text-gray-100"
    >
      {children}
    </button>
  )
}

const svgOrtak = {
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
}

function ChevronIcon({ className = '' }: { className?: string }): ReactElement {
  return (
    <svg {...svgOrtak} width={12} height={12} className={`transition-transform ${className}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function FileIcon(): ReactElement {
  return (
    <svg {...svgOrtak} width={13} height={13} className="shrink-0 text-gray-500">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <polyline points="14 3 14 8 19 8" />
    </svg>
  )
}

function TemplateIcon(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M17.5 14v7M14 17.5h7" />
    </svg>
  )
}

function PlusIcon(): ReactElement {
  return (
    <svg {...svgOrtak}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function FolderPlusIcon(): ReactElement {
  return (
    <svg {...svgOrtak}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  )
}

function CloseIcon(): ReactElement {
  return (
    <svg {...svgOrtak}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export default FileTree
