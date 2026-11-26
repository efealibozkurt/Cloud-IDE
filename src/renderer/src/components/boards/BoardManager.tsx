import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { PlatformSearchResult } from '@shared/types'
import { useAppState } from '../../state/AppStateContext'
import { useToast } from '../../state/ToastContext'
import { useT } from '../../i18n'
import { kartRengi, platformGorseli } from '../../utils/boardImages'
import BoardThumb from '../common/BoardThumb'
import SegmentKontrol from '../common/SegmentKontrol'
import { EylemSatiri, KurulumGunlugu, Led, SECICI_SINIFI, Tus } from '../common/Tus'

type SekmeTuru = 'tumu' | 'kurulu'

/**
 * Sol panelin "Kart Yöneticisi" sekmesi:
 * - Tümü: Tüm çekirdek (core) kataloğunda arama, kurulum ve ek board manager URL yönetimi
 * - Kurulu: Yalnızca bilgisayarda kurulu kart çekirdeklerini ve modellerini listeleme, güncelleme ve kaldırma
 */
function BoardManager(): ReactElement {
  const t = useT()
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
      toastGoster(t('İndeks güncellendi'), 'basari')
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : t('İndeks güncellenemedi'), 'hata')
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
      toastGoster(t('{id} kuruldu', { id }), 'basari')
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : t('{id} kurulamadı', { id }), 'hata')
    } finally {
      setKuruluyorId(null)
    }
  }

  const kaldir = async (id: string): Promise<void> => {
    if (!window.confirm(t('{id} platformu kaldırılsın mı?', { id }))) return
    try {
      await window.api.arduinoCli.uninstallCore(id)
      await Promise.all([aramaYap(sorgu), refreshPlatforms()])
      toastGoster(t('{id} kaldırıldı', { id }), 'basari')
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : t('{id} kaldırılamadı', { id }), 'hata')
    }
  }

  const urlEkle = async (): Promise<void> => {
    const url = yeniUrl.trim()
    if (!url) return
    try {
      await window.api.arduinoCli.addBoardManagerUrl(url)
      setYeniUrl('')
      toastGoster(t('URL eklendi; İndeksi Güncelle ile yeni kartları çekebilirsiniz'), 'basari')
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : t('URL eklenemedi'), 'hata')
    }
  }

  const urlSil = async (url: string): Promise<void> => {
    try {
      await window.api.arduinoCli.removeBoardManagerUrl(url)
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : t('URL kaldırılamadı'), 'hata')
    }
  }

  const toggleKartlar = (id: string): void => {
    setGenisletilenKartlar((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  if (!cliHazir) {
    return <p className="p-3 text-xs text-gray-500">{t('arduino-cli hazır olmadan Kart Yöneticisi kullanılamaz.')}</p>
  }

  return (
    <div className="flex h-full flex-col text-xs">
      <div className="shrink-0 border-b border-white/[0.06] p-2">
        <SegmentKontrol
          secenekler={[
            { id: 'tumu', ad: 'Katalog' },
            { id: 'kurulu', ad: 'Kurulu', sayi: state.arduinoCli.platforms.length }
          ]}
          deger={aktifSekme}
          onDegis={(id) => {
            setAktifSekme(id)
            if (id === 'kurulu') void refreshPlatforms()
          }}
        />
      </div>

      {/* ── Kontrol Çubuğu ── */}
      {aktifSekme === 'tumu' ? (
        <div className="flex shrink-0 flex-col gap-1.5 border-b border-panel-border p-2">
          <div className="flex gap-1.5">
            <input
              value={sorgu}
              onChange={(e) => setSorgu(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void aramaYap(sorgu)}
              placeholder={t('Kart veya çekirdek ara (Uno, ESP32...)')}
              className="h-7 flex-1 rounded-[5px] border border-panel-border bg-panel px-2.5 text-gray-200 outline-none placeholder:text-gray-600 focus:border-accent"
            />
            <button
              onClick={() => void aramaYap(sorgu)}
              className="h-7 rounded-[5px] border border-panel-border px-3 text-gray-200 hover:bg-white/[0.06]"
            >
              Ara
            </button>
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={() => void indeksiGuncelle()}
              disabled={indeksGuncelleniyor}
              className="h-7 rounded-[5px] border border-panel-border px-3 text-gray-100 whitespace-nowrap hover:enabled:bg-white/10 disabled:opacity-50"
            >
              {indeksGuncelleniyor ? t('İndeks güncelleniyor...') : t('İndeksi Güncelle')}
            </button>
            <button onClick={() => setUrlPaneliAcik((a) => !a)} className="text-gray-400 hover:text-gray-200">
              {t("Ek URL'ler")} {urlPaneliAcik ? '▲' : '▼'}
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
            placeholder={t('Kurulu kart/model süz (Uno, ESP32, Deneyap)...')}
            className="h-7 flex-1 rounded-[5px] border border-panel-border bg-panel px-2.5 text-gray-200 outline-none placeholder:text-gray-600 focus:border-accent"
          />
          <button
            onClick={() => void refreshPlatforms()}
            title={t('Kurulu kartları yenile')}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] border border-panel-border text-gray-400 hover:bg-white/[0.06] hover:text-gray-100"
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
            {yukleniyor && <p className="p-3 text-gray-500">{t('Kart kataloğu taranıyor...')}</p>}
            {!yukleniyor && gorunenListe.length === 0 && <p className="p-3 text-gray-500">{t('Sonuç bulunamadı.')}</p>}
            {gorunenListe.map((p) => (
              <div key={p.id} className="border-b border-panel-border/70 px-3 py-3 transition-colors hover:bg-white/[0.03]">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0 truncate text-[13px] font-medium text-gray-100" title={p.name}>
                    {p.name}
                  </div>
                  {p.installed && <Led metin={`v${p.installedVersion}`} baslik={t('Bu kart platformu bilgisayarınızda kurulu')} />}
                </div>
                <div className="mt-0.5 truncate font-mono text-[10.5px] text-gray-500" title={p.id}>
                  {p.id}
                  {p.maintainer ? ` · ${p.maintainer}` : ''}
                </div>
                <EylemSatiri>
                  <select
                    value={secilenSurumler[p.id] ?? p.latestVersion}
                    onChange={(e) => setSecilenSurumler((onceki) => ({ ...onceki, [p.id]: e.target.value }))}
                    className={SECICI_SINIFI}
                  >
                    {p.availableVersions.map((v) => (
                      <option key={v} value={v}>
                        v{v} {v === p.latestVersion ? t('(en son)') : ''}
                      </option>
                    ))}
                  </select>
                  <Tus tur="birincil" onClick={() => void kur(p.id)} disabled={kuruluyorId !== null}>
                    {p.installed ? t('Güncelle') : t('Kur')}
                  </Tus>
                  {p.installed && (
                    <Tus tur="tehlike" onClick={() => void kaldir(p.id)} disabled={kuruluyorId !== null}>
                      {t('Kaldır')}
                    </Tus>
                  )}
                </EylemSatiri>
                {kuruluyorId === p.id && <KurulumGunlugu baslik="Kuruluyor…" gunluk={kurulumLogu} />}
              </div>
            ))}
          </>
        ) : (
          /* ──── KURULU KARTLAR LİSTESİ ──── */
          <>
            {state.arduinoCli.platforms.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-xs text-gray-400">{t('Henüz kurulu bir kart platformu bulunamadı.')}</p>
                <button
                  onClick={() => setAktifSekme('tumu')}
                  className="mt-2 rounded bg-white/[0.08] px-3 py-1 text-xs text-gray-200 hover:bg-white/[0.14]"
                >
                  Katalogda Kart Ara
                </button>
              </div>
            )}
            {state.arduinoCli.platforms.length > 0 && filtrelenmisKuruluPlatformlar.length === 0 && (
              <p className="p-3 text-gray-500">{t('"{q}" ile eşleşen kurulu kart bulunamadı.', { q: kuruluArama })}</p>
            )}
            {filtrelenmisKuruluPlatformlar.map((platform) => {
              const katalogEslesmesi = katalogMap.get(platform.id)
              const secilenSurum = secilenSurumler[platform.id] ?? platform.installedVersion ?? ''
              const kartlar = platform.boards ?? []
              const genisletilmis = Boolean(genisletilenKartlar[platform.id])
              const goruntulenecekKartlar = genisletilmis ? kartlar : kartlar.slice(0, 4)

              return (
                <div key={platform.id} className="border-b border-panel-border/70 px-3 py-3 transition-colors hover:bg-white/[0.03]">
                  <div className="flex items-start gap-3">
                    <BoardThumb
                      src={platformGorseli(platform.id, kartlar)}
                      renk={kartRengi({ name: platform.name, fqbn: platform.id })}
                      genislik={56}
                      alt={platform.name}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-[13px] font-medium text-gray-100" title={platform.name}>
                          {platform.name}
                        </span>
                        <Led metin={`v${platform.installedVersion}`} />
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[10.5px] text-gray-500" title={platform.id}>
                        {platform.id}
                      </div>
                      {platform.maintainer && (
                        <div className="mt-0.5 truncate text-[11px] text-gray-500" title={platform.maintainer}>
                          {platform.maintainer}
                        </div>
                      )}
                    </div>
                  </div>

                  {kartlar.length > 0 && (
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span>{kartlar.length} kart</span>
                        {kartlar.length > 4 && (
                          <button onClick={() => toggleKartlar(platform.id)} className="text-gray-400 hover:text-gray-100 hover:underline">
                            {genisletilmis ? t('Daha az göster') : t('+{n} kart daha', { n: kartlar.length - 4 })}
                          </button>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {goruntulenecekKartlar.map((b) => (
                          <span key={b.fqbn || b.name} title={b.fqbn} className="rounded-[4px] bg-white/[0.06] px-1.5 py-0.5 text-[10.5px] text-gray-300">
                            {b.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <EylemSatiri>
                    {katalogEslesmesi && katalogEslesmesi.availableVersions.length > 0 ? (
                      <>
                        <select
                          value={secilenSurum}
                          onChange={(e) => setSecilenSurumler((onceki) => ({ ...onceki, [platform.id]: e.target.value }))}
                          className={SECICI_SINIFI}
                        >
                          {katalogEslesmesi.availableVersions.map((v) => (
                            <option key={v} value={v}>
                              v{v} {v === katalogEslesmesi.latestVersion ? t('(en son)') : ''}
                            </option>
                          ))}
                        </select>
                        <Tus tur="ikincil" title={t('Seçili sürüme geç')} onClick={() => void kur(platform.id)} disabled={kuruluyorId !== null}>
                          {t('Değiştir')}
                        </Tus>
                      </>
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-[11px] text-gray-500">{t('Yerel platform')}</span>
                    )}
                    <Tus tur="tehlike" onClick={() => void kaldir(platform.id)} disabled={kuruluyorId !== null}>
                      {t('Kaldır')}
                    </Tus>
                  </EylemSatiri>

                  {kuruluyorId === platform.id && <KurulumGunlugu baslik={t('İşlem yapılıyor…')} gunluk={kurulumLogu} />}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
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
