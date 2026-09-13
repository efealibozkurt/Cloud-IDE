import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { PlatformSearchResult } from '@shared/types'
import { useAppState } from '../../state/AppStateContext'
import { useToast } from '../../state/ToastContext'

type SekmeTuru = 'tumu' | 'kurulu'

/**
 * Sol panelin "Kart Yöneticisi" sekmesi:
 * - Tümü: Tüm çekirdek (core) kataloğunda arama, kurulum ve ek board manager URL yönetimi
 * - Kurulu: Yalnızca bilgisayarda kurulu kart çekirdeklerini ve modellerini listeleme, güncelleme ve kaldırma
 */
function BoardManager(): ReactElement {
  const { state, refreshPlatforms } = useAppState()
  const { toastGoster } = useToast()

  const [aktifSekme, setAktifSekme] = useState<SekmeTuru>('tumu')
  const [sorgu, setSorgu] = useState('')
  const [kuruluArama, setKuruluArama] = useState('')
  const [katalog, setKatalog] = useState<PlatformSearchResult[]>([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [indeksGuncelleniyor, setIndeksGuncelleniyor] = useState(false)
  const [secilenSurumler, setSecilenSurumler] = useState<Record<string, string>>({})
  const [kuruluyorId, setKuruluyorId] = useState<string | null>(null)
  const [kurulumLogu, setKurulumLogu] = useState('')
  const [urlPaneliAcik, setUrlPaneliAcik] = useState(false)
  const [yeniUrl, setYeniUrl] = useState('')
  const [genisletilenKartlar, setGenisletilenKartlar] = useState<Record<string, boolean>>({})
  const operationIdRef = useRef<string | null>(null)

  const cliHazir = state.arduinoCli.status?.found ?? false

  const aramaYap = useCallback(async (q: string) => {
    setYukleniyor(true)
    try {
      const sonuc = await window.api.arduinoCli.searchCores(q)
      setKatalog(sonuc)
    } catch {
      setKatalog([])
    } finally {
      setYukleniyor(false)
    }
  }, [])

  useEffect(() => {
    if (cliHazir) void aramaYap('')
  }, [cliHazir, aramaYap])

  useEffect(() => {
    return window.api.arduinoCli.onOperationEvent((olay) => {
      if (olay.kind !== 'installCore' || olay.operationId !== operationIdRef.current) return
      if (olay.phase === 'log' && olay.message) setKurulumLogu((onceki) => onceki + olay.message + '\n')
    })
  }, [])

  // Otorite kaynak listCores() (Aşama 2'de main'den yüklenir); arama
  // sonuçlarını bu listeyle çaprazlayıp gerçek kurulu sürümü gösteriyoruz
  const kuruluMap = useMemo(
    () => new Map(state.arduinoCli.platforms.map((p) => [p.id, p])),
    [state.arduinoCli.platforms]
  )

  const gorunenListe = useMemo(
    () =>
      katalog.map((p) => {
        const kurulu = kuruluMap.get(p.id)
        return {
          ...p,
          installed: Boolean(kurulu),
          installedVersion: kurulu?.installedVersion ?? p.installedVersion
        }
      }),
    [katalog, kuruluMap]
  )

  // Katalog eşleme haritası (kurulu kartlarda sürüm seçebilmek için)
  const katalogMap = useMemo(
    () => new Map(katalog.map((k) => [k.id, k])),
    [katalog]
  )

  // Kurulu kartlar için anlık arama/süzme (platform adı, sağlayıcı veya desteklenen kart isimleri)
  const filtrelenmisKuruluPlatformlar = useMemo(() => {
    const q = kuruluArama.trim().toLowerCase()
    if (!q) return state.arduinoCli.platforms

    return state.arduinoCli.platforms.filter((p) => {
      const adEslesir = p.name.toLowerCase().includes(q)
      const idEslesir = p.id.toLowerCase().includes(q)
      const saglayiciEslesir = p.maintainer && p.maintainer.toLowerCase().includes(q)
      const kartEslesir = p.boards?.some((b) => b.name.toLowerCase().includes(q))
      return adEslesir || idEslesir || saglayiciEslesir || kartEslesir
    })
  }, [state.arduinoCli.platforms, kuruluArama])

  const indeksiGuncelle = async (): Promise<void> => {
    setIndeksGuncelleniyor(true)
    try {
      await window.api.arduinoCli.updateIndex()
      await Promise.all([aramaYap(sorgu), refreshPlatforms()])
      toastGoster('İndeks güncellendi', 'basari')
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : 'İndeks güncellenemedi', 'hata')
    } finally {
      setIndeksGuncelleniyor(false)
    }
  }

  const kur = async (id: string): Promise<void> => {
    const surum = secilenSurumler[id]
    const hedef = surum ? `${id}@${surum}` : id
    const operationId = crypto.randomUUID()
    operationIdRef.current = operationId
    setKuruluyorId(id)
    setKurulumLogu('')
    try {
      await window.api.arduinoCli.installCore(hedef, operationId)
      await Promise.all([aramaYap(sorgu), refreshPlatforms()])
      toastGoster(`${id} kuruldu`, 'basari')
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : `${id} kurulamadı`, 'hata')
    } finally {
      setKuruluyorId(null)
    }
  }

  const kaldir = async (id: string): Promise<void> => {
    if (!window.confirm(`${id} platformu kaldırılsın mı?`)) return
    try {
      await window.api.arduinoCli.uninstallCore(id)
      await Promise.all([aramaYap(sorgu), refreshPlatforms()])
      toastGoster(`${id} kaldırıldı`, 'basari')
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : `${id} kaldırılamadı`, 'hata')
    }
  }

  const urlEkle = async (): Promise<void> => {
    const url = yeniUrl.trim()
    if (!url) return
    try {
      await window.api.arduinoCli.addBoardManagerUrl(url)
      setYeniUrl('')
      toastGoster('URL eklendi; İndeksi Güncelle ile yeni kartları çekebilirsiniz', 'basari')
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : 'URL eklenemedi', 'hata')
    }
  }

  const urlSil = async (url: string): Promise<void> => {
    try {
      await window.api.arduinoCli.removeBoardManagerUrl(url)
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : 'URL kaldırılamadı', 'hata')
    }
  }

  const toggleKartlar = (id: string): void => {
    setGenisletilenKartlar((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  if (!cliHazir) {
    return <p className="p-3 text-xs text-gray-500">arduino-cli hazır olmadan Kart Yöneticisi kullanılamaz.</p>
  }

  return (
    <div className="flex h-full flex-col text-xs">
      {/* ── Üst Sekme Kontrolü (Tümü / Kurulu Kartlar) ── */}
      <div className="flex border-b border-panel-border bg-panel/50 p-1">
        <button
          onClick={() => setAktifSekme('tumu')}
          className={`flex-1 rounded py-1 text-center font-medium transition-colors ${
            aktifSekme === 'tumu'
              ? 'bg-panel-border/80 text-gray-100 shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Katalog (Tümü)
        </button>
        <button
          onClick={() => {
            setAktifSekme('kurulu')
            void refreshPlatforms()
          }}
          className={`flex items-center justify-center gap-1.5 flex-1 rounded py-1 text-center font-medium transition-colors ${
            aktifSekme === 'kurulu'
              ? 'bg-panel-border/80 text-emerald-300 shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <span>Kurulu Kartlar</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
              aktifSekme === 'kurulu'
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-panel-border text-gray-400'
            }`}
          >
            {state.arduinoCli.platforms.length}
          </span>
        </button>
      </div>

      {/* ── Kontrol Çubuğu ── */}
      {aktifSekme === 'tumu' ? (
        <div className="flex shrink-0 flex-col gap-1.5 border-b border-panel-border p-2">
          <div className="flex gap-1.5">
            <input
              value={sorgu}
              onChange={(e) => setSorgu(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void aramaYap(sorgu)}
              placeholder="Kart veya çekirdek ara (Uno, ESP32...)"
              className="flex-1 rounded border border-panel-border bg-panel px-2 py-1 text-gray-200 outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              onClick={() => void aramaYap(sorgu)}
              className="rounded border border-panel-border bg-panel px-2.5 py-1 text-gray-300 hover:bg-panel-border"
            >
              Ara
            </button>
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={() => void indeksiGuncelle()}
              disabled={indeksGuncelleniyor}
              className="rounded border border-panel-border bg-panel px-2 py-1 text-gray-300 hover:enabled:bg-panel-border disabled:opacity-50"
            >
              {indeksGuncelleniyor ? 'İndeks güncelleniyor...' : 'İndeksi Güncelle'}
            </button>
            <button onClick={() => setUrlPaneliAcik((a) => !a)} className="text-gray-400 hover:text-gray-200">
              Ek URL'ler {urlPaneliAcik ? '▲' : '▼'}
            </button>
          </div>

          {urlPaneliAcik && (
            <div className="flex flex-col gap-1 rounded border border-panel-border bg-panel p-1.5">
              {(state.settings?.boardManagerUrls ?? []).map((url) => (
                <div key={url} className="flex items-center justify-between gap-1">
                  <span className="truncate text-gray-400" title={url}>
                    {url}
                  </span>
                  <button onClick={() => void urlSil(url)} className="shrink-0 px-1 text-gray-500 hover:text-red-400">
                    ×
                  </button>
                </div>
              ))}
              <div className="flex gap-1 pt-1">
                <input
                  value={yeniUrl}
                  onChange={(e) => setYeniUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void urlEkle()}
                  placeholder="https://.../package_index.json"
                  className="flex-1 rounded border border-panel-border bg-panel-light px-1.5 py-1 text-gray-200 outline-none"
                />
                <button
                  onClick={() => void urlEkle()}
                  className="rounded border border-panel-border bg-panel-light px-2 text-gray-300 hover:bg-panel-border"
                >
                  Ekle
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex shrink-0 items-center justify-between gap-1.5 border-b border-panel-border p-2">
          <input
            value={kuruluArama}
            onChange={(e) => setKuruluArama(e.target.value)}
            placeholder="Kurulu kart/model süz (Uno, ESP32, Deneyap)..."
            className="flex-1 rounded border border-panel-border bg-panel px-2 py-1 text-gray-200 outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={() => void refreshPlatforms()}
            title="Kurulu kartları yenile"
            className="rounded border border-panel-border bg-panel p-1 text-gray-400 hover:text-gray-200"
          >
            <RefreshIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Liste Alanı ── */}
      <div className="flex-1 overflow-y-auto">
        {aktifSekme === 'tumu' ? (
          /* ──── TÜM KART KATALOĞU ──── */
          <>
            {yukleniyor && <p className="p-3 text-gray-500">Kart kataloğu taranıyor...</p>}
            {!yukleniyor && gorunenListe.length === 0 && <p className="p-3 text-gray-500">Sonuç bulunamadı.</p>}
            {gorunenListe.map((p) => (
              <div key={p.id} className="border-b border-panel-border/70 p-2.5 hover:bg-panel/20 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-gray-100">{p.name}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-400">
                      <span className="font-mono text-gray-500">{p.id}</span>
                      {p.maintainer && (
                        <>
                          <span>·</span>
                          <span className="text-[#93a5fb] font-medium">{p.maintainer}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {p.installed && (
                    <span
                      title="Bu kart platformu bilgisayarınızda kurulu"
                      className="shrink-0 flex items-center gap-1 rounded bg-emerald-950/70 border border-emerald-800/80 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      v{p.installedVersion}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-1.5">
                  <select
                    value={secilenSurumler[p.id] ?? p.latestVersion}
                    onChange={(e) => setSecilenSurumler((onceki) => ({ ...onceki, [p.id]: e.target.value }))}
                    className="rounded border border-panel-border bg-panel px-1.5 py-0.5 text-[11px] text-gray-300 outline-none"
                  >
                    {p.availableVersions.map((v) => (
                      <option key={v} value={v}>
                        v{v} {v === p.latestVersion ? '(En Son)' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => void kur(p.id)}
                    disabled={kuruluyorId !== null}
                    className="rounded border border-accent bg-accent/20 px-2 py-0.5 text-accent-hover hover:enabled:bg-accent/30 disabled:opacity-50"
                  >
                    {p.installed ? 'Güncelle/Kur' : 'Kur'}
                  </button>
                  {p.installed && (
                    <button
                      onClick={() => void kaldir(p.id)}
                      disabled={kuruluyorId !== null}
                      className="rounded border border-panel-border bg-panel px-2 py-0.5 text-red-300 hover:enabled:bg-red-950/40 hover:enabled:border-red-900 disabled:opacity-50"
                    >
                      Kaldır
                    </button>
                  )}
                </div>

                {kuruluyorId === p.id && (
                  <div className="mt-2 rounded border border-panel-border bg-panel p-2">
                    <div className="mb-1 flex items-center gap-1.5 text-accent-hover font-medium">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                      Kuruluyor...
                    </div>
                    <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] text-gray-500">
                      {kurulumLogu || 'arduino-cli işlemi tamamlanana kadar bekleniyor...'}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </>
        ) : (
          /* ──── KURULU KARTLAR LİSTESİ ──── */
          <>
            {state.arduinoCli.platforms.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-xs text-gray-400">Henüz kurulu bir kart platformu bulunamadı.</p>
                <button
                  onClick={() => setAktifSekme('tumu')}
                  className="mt-2 rounded bg-accent/20 px-3 py-1 text-xs text-accent-hover hover:bg-accent/30"
                >
                  Katalogda Kart Ara
                </button>
              </div>
            )}
            {state.arduinoCli.platforms.length > 0 && filtrelenmisKuruluPlatformlar.length === 0 && (
              <p className="p-3 text-gray-500">"{kuruluArama}" ile eşleşen kurulu kart bulunamadı.</p>
            )}
            {filtrelenmisKuruluPlatformlar.map((platform) => {
              const katalogEslesmesi = katalogMap.get(platform.id)
              const secilenSurum = secilenSurumler[platform.id] ?? platform.installedVersion ?? ''
              const kartlar = platform.boards ?? []
              const genisletilmis = Boolean(genisletilenKartlar[platform.id])
              const goruntulenecekKartlar = genisletilmis ? kartlar : kartlar.slice(0, 4)

              return (
                <div
                  key={platform.id}
                  className="border-b border-panel-border/70 p-2.5 hover:bg-panel/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <CpuIcon className="h-3.5 w-3.5 shrink-0 text-[#93a5fb]" />
                        <span className="truncate text-xs font-semibold text-gray-100">{platform.name}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-400">
                        <span className="font-mono text-gray-500">{platform.id}</span>
                        {platform.maintainer && (
                          <>
                            <span>·</span>
                            <span className="text-[#93a5fb] font-medium">{platform.maintainer}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <span className="shrink-0 flex items-center gap-1 rounded bg-emerald-950/80 border border-emerald-800 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      v{platform.installedVersion}
                    </span>
                  </div>

                  {/* Desteklenen Kart Modelleri */}
                  {kartlar.length > 0 && (
                    <div className="mt-2 rounded bg-panel/60 border border-panel-border/50 p-1.5">
                      <div className="mb-1 flex items-center justify-between text-[10px] text-gray-400">
                        <span>İçerdiği Kartlar ({kartlar.length}):</span>
                        {kartlar.length > 4 && (
                          <button
                            onClick={() => toggleKartlar(platform.id)}
                            className="text-[#93a5fb] hover:underline"
                          >
                            {genisletilmis ? 'Daha az göster ▲' : `+${kartlar.length - 4} diğer kart ▼`}
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {goruntulenecekKartlar.map((b) => (
                          <span
                            key={b.fqbn || b.name}
                            title={b.fqbn}
                            className="rounded bg-panel-border/60 px-1.5 py-0.2 text-[9.5px] text-gray-300 font-mono"
                          >
                            {b.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sürüm İşlemleri & Kaldırma */}
                  <div className="mt-2.5 flex items-center justify-between gap-1.5">
                    {katalogEslesmesi && katalogEslesmesi.availableVersions.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={secilenSurum}
                          onChange={(e) =>
                            setSecilenSurumler((onceki) => ({ ...onceki, [platform.id]: e.target.value }))
                          }
                          className="rounded border border-panel-border bg-panel px-1.5 py-0.5 text-[10.5px] text-gray-300 outline-none"
                        >
                          {katalogEslesmesi.availableVersions.map((v) => (
                            <option key={v} value={v}>
                              v{v} {v === katalogEslesmesi.latestVersion ? '(En Son)' : ''}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => void kur(platform.id)}
                          disabled={kuruluyorId !== null}
                          className="rounded border border-accent bg-accent/20 px-2 py-0.5 text-[10.5px] text-accent-hover hover:enabled:bg-accent/30 disabled:opacity-50"
                        >
                          Sürüm Değiştir
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-500">Yerel Platform</span>
                    )}

                    <button
                      onClick={() => void kaldir(platform.id)}
                      disabled={kuruluyorId !== null}
                      className="ml-auto rounded border border-panel-border bg-panel px-2 py-0.5 text-[10.5px] text-red-300 hover:enabled:bg-red-950/40 hover:enabled:border-red-900 disabled:opacity-50"
                    >
                      Kaldır
                    </button>
                  </div>

                  {kuruluyorId === platform.id && (
                    <div className="mt-2 rounded border border-panel-border bg-panel p-2">
                      <div className="mb-1 flex items-center gap-1.5 text-accent-hover font-medium">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                        İşlem yapılıyor...
                      </div>
                      <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] text-gray-500">
                        {kurulumLogu || 'arduino-cli işlemi tamamlanana kadar bekleniyor...'}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

function CpuIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
    </svg>
  )
}

function RefreshIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  )
}

export default BoardManager
