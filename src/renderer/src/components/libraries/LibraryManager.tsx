import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { LibraryInfo, LibrarySearchResult } from '@shared/types'
import { useAppState } from '../../state/AppStateContext'
import { useToast } from '../../state/ToastContext'
import { useT } from '../../i18n'
import { useKutuphaneGuncellemeleri } from '../../hooks/useKutuphaneGuncellemeleri'
import { kutuphaneSembolleriniYenile } from '../editor/arduinoIntelliSense'
import SegmentKontrol from '../common/SegmentKontrol'
import { EylemSatiri, KurulumGunlugu, Led, SECICI_SINIFI, Tus } from '../common/Tus'

type SekmeTuru = 'tumu' | 'kurulu'
const SAYFA_BOYUTU = 40

/** E-posta ve parantez içi gürültüleri ayıklayarak yazar adını sadeleştirir */
function temizAuthor(author?: string): string {
  if (!author) return ''
  return author.replace(/<[^>]+>/g, '').replace(/\([^)]+\)/g, '').trim() || author
}

// ─────────────────────────────────────────────────────────────────────────────
// Alt Bileşenler (React.memo ile ayrıştırılarak ana girdi akıcılığı korunur)
// ─────────────────────────────────────────────────────────────────────────────

interface LibraryCardProps {
  lib: LibrarySearchResult
  seciliSurum: string
  onSurumSec: (surum: string) => void
  onKur: (name: string) => void
  onKaldir: (name: string) => void
  kuruluyorAd: string | null
  kurulumLogu: string
}

/** "N kütüphane güncellenebilir" bandı: ayrıntıyı açar, tek tek ya da toplu güncelleme yapar. */
function GuncellemeBandi({ onBitti, etkin }: { onBitti: () => void; etkin: boolean }): ReactElement | null {
  const { guncellemeler, yenile } = useKutuphaneGuncellemeleri(etkin)
  const t = useT()
  const { toastGoster } = useToast()
  const [acik, setAcik] = useState(false)
  const [calisan, setCalisan] = useState<string | null>(null)

  if (guncellemeler.length === 0) return null

  const guncelle = async (liste: typeof guncellemeler): Promise<void> => {
    let basarili = 0
    for (const g of liste) {
      setCalisan(g.name)
      try {
        await window.api.arduinoCli.installLibrary(g.name, g.latest, crypto.randomUUID())
        basarili++
      } catch (hata) {
        toastGoster(hata instanceof Error ? hata.message : t('“{name}” güncellenemedi', { name: g.name }), 'hata')
      }
    }
    setCalisan(null)
    if (basarili > 0) toastGoster(t('{n} kütüphane güncellendi', { n: basarili }), 'basari')
    await yenile()
    onBitti()
  }

  return (
    <div className="shrink-0 border-b border-panel-border bg-accent/[0.07] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setAcik((a) => !a)} className="flex min-w-0 items-center gap-1.5 text-left text-gray-200" aria-expanded={acik}>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
          <span className="truncate">{t('{n} kütüphane güncellenebilir', { n: guncellemeler.length })}</span>
          <span className="text-gray-500">{acik ? '▴' : '▾'}</span>
        </button>
        <Tus tur="birincil" onClick={() => void guncelle(guncellemeler)} disabled={calisan !== null}>
          {calisan ? t('Güncelleniyor…') : t('Tümünü güncelle')}
        </Tus>
      </div>
      {acik && (
        <ul className="mt-2 space-y-1">
          {guncellemeler.map((g) => (
            <li key={g.name} className="flex items-center justify-between gap-2 text-[11.5px]">
              <span className="min-w-0 truncate text-gray-300" title={g.name}>
                {g.name}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-[10.5px] text-gray-500">
                  {g.installed} → {g.latest}
                </span>
                <Tus onClick={() => void guncelle([g])} disabled={calisan !== null}>
                  {calisan === g.name ? '…' : t('Güncelle')}
                </Tus>
              </span>
            </li>
          ))}
        </ul>
      )}
      {acik && <p className="mt-2 text-[10.5px] leading-snug text-gray-600">{t('Güncelleme kütüphanenin yeni sürümünü kurar; kodunuzda kullandığınız işlevler değişmiş olabilir, güncellemeden sonra derleyip deneyin.')}</p>}
    </div>
  )
}

const LibraryCard = memo(function LibraryCard({
  lib,
  seciliSurum,
  onSurumSec,
  onKur,
  onKaldir,
  kuruluyorAd,
  kurulumLogu
}: LibraryCardProps): ReactElement {
  const kuruluyorBu = kuruluyorAd === lib.name
  const t = useT()

  return (
    <div className="border-b border-panel-border/70 px-3 py-3 transition-colors hover:bg-white/[0.03]">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 truncate text-[13px] font-medium text-gray-100" title={lib.name}>
          {lib.name}
        </div>
        {lib.installed && <Led metin={`v${lib.installedVersion}`} baslik={t('Bu kütüphane bilgisayarınızda kurulu')} />}
      </div>
      {lib.author && (
        <div className="mt-0.5 truncate text-[11px] text-gray-500" title={`Yazar: ${lib.author}`}>
          {temizAuthor(lib.author)}
        </div>
      )}
      {lib.sentence && <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-gray-400">{lib.sentence}</p>}

      <EylemSatiri>
        <select value={seciliSurum} onChange={(e) => onSurumSec(e.target.value)} className={SECICI_SINIFI}>
          {lib.availableVersions.map((v) => (
            <option key={v} value={v}>
              v{v} {v === lib.latestVersion ? t('(en son)') : ''}
            </option>
          ))}
        </select>
        <Tus tur="birincil" onClick={() => onKur(lib.name)} disabled={kuruluyorAd !== null}>
          {lib.installed ? t('Güncelle') : t('Kur')}
        </Tus>
        {lib.installed && (
          <Tus tur="tehlike" onClick={() => onKaldir(lib.name)} disabled={kuruluyorAd !== null}>
            {t('Kaldır')}
          </Tus>
        )}
      </EylemSatiri>

      {kuruluyorBu && <KurulumGunlugu baslik={t('Kuruluyor…')} gunluk={kurulumLogu} />}
    </div>
  )
})

interface InstalledLibraryCardProps {
  lib: LibraryInfo
  katalogBilgisi?: LibrarySearchResult
  seciliSurum: string
  onSurumSec: (surum: string) => void
  onKur: (name: string) => void
  onKaldir: (name: string) => void
  kuruluyorAd: string | null
  kurulumLogu: string
}

const InstalledLibraryCard = memo(function InstalledLibraryCard({
  lib,
  katalogBilgisi,
  seciliSurum,
  onSurumSec,
  onKur,
  onKaldir,
  kuruluyorAd,
  kurulumLogu
}: InstalledLibraryCardProps): ReactElement {
  const yazar = lib.author || katalogBilgisi?.author
  const aciklama = lib.sentence || katalogBilgisi?.sentence
  const kuruluyorBu = kuruluyorAd === lib.name
  const t = useT()

  return (
    <div className="border-b border-panel-border/70 px-3 py-3 transition-colors hover:bg-white/[0.03]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[13px] font-medium text-gray-100" title={lib.name}>
          {lib.name}
        </span>
        <Led metin={`v${lib.version}`} />
      </div>
      <div className="mt-0.5 truncate text-[11px] text-gray-500" title={yazar ? `${t('Yazar')}: ${yazar}` : undefined}>
        {yazar ? temizAuthor(yazar) : t('Yazar belirtilmemiş')}
      </div>
      {aciklama && <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-gray-400">{aciklama}</p>}

      <EylemSatiri>
        {katalogBilgisi && katalogBilgisi.availableVersions.length > 0 ? (
          <>
            <select value={seciliSurum} onChange={(e) => onSurumSec(e.target.value)} className={SECICI_SINIFI}>
              {katalogBilgisi.availableVersions.map((v) => (
                <option key={v} value={v}>
                  v{v} {v === katalogBilgisi.latestVersion ? t('(en son)') : ''}
                </option>
              ))}
            </select>
            <Tus tur="ikincil" title={t('Seçili sürüme geç')} onClick={() => onKur(lib.name)} disabled={kuruluyorAd !== null}>
              {t('Değiştir')}
            </Tus>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-[11px] text-gray-500" title={lib.installDir}>
            {lib.installDir ? t('Yerel kütüphane') : ''}
          </span>
        )}
        <Tus tur="tehlike" onClick={() => onKaldir(lib.name)} disabled={kuruluyorAd !== null}>
          {t('Kaldır')}
        </Tus>
      </EylemSatiri>

      {kuruluyorBu && <KurulumGunlugu baslik={t('İşlem yapılıyor…')} gunluk={kurulumLogu} />}
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Ana Bileşen: LibraryManager
// ─────────────────────────────────────────────────────────────────────────────

function LibraryManager(): ReactElement {
  const t = useT()
  const { state } = useAppState()
  const { toastGoster } = useToast()

  const [aktifSekme, setAktifSekme] = useState<SekmeTuru>('tumu')
  const [sorgu, setSorgu] = useState('')
  const [sonuclar, setSonuclar] = useState<LibrarySearchResult[]>([])
  const [kuruluKutuphaneler, setKuruluKutuphaneler] = useState<LibraryInfo[]>([])
  const [kuruluArama, setKuruluArama] = useState('')
  const deferKuruluArama = useDeferredValue(kuruluArama)

  const [gorunenKatalogSayisi, setGorunenKatalogSayisi] = useState(SAYFA_BOYUTU)
  const [gorunenKuruluSayisi, setGorunenKuruluSayisi] = useState(SAYFA_BOYUTU)

  const [yukleniyor, setYukleniyor] = useState(false)
  const [kurulularYukleniyor, setKurulularYukleniyor] = useState(false)
  const [secilenSurumler, setSecilenSurumler] = useState<Record<string, string>>({})
  const [kuruluyorAd, setKuruluyorAd] = useState<string | null>(null)
  const [kurulumLogu, setKurulumLogu] = useState('')

  const operationIdRef = useRef<string | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aramaIstegiRef = useRef<string>('')

  const cliHazir = state.arduinoCli.status?.found ?? false

  // Kurulu kütüphaneleri çeker
  const kurululariYukle = useCallback(async (force = false) => {
    if (!cliHazir) return
    setKurulularYukleniyor(true)
    try {
      const liste = await window.api.arduinoCli.listLibraries(force)
      setKuruluKutuphaneler(liste)
    } catch (err) {
      console.error('Kurulu kütüphaneler yüklenemedi:', err)
      setKuruluKutuphaneler([])
    } finally {
      setKurulularYukleniyor(false)
    }
  }, [cliHazir])

  // Katalogda arama yapar
  const aramaYap = useCallback(async (q: string) => {
    aramaIstegiRef.current = q
    setYukleniyor(true)
    try {
      const sonuc = await window.api.arduinoCli.searchLibraries(q)
      // Yarış durumunu (race condition) önle: yalnızca son sorgunun sonucunu kabul et
      if (aramaIstegiRef.current === q) {
        setSonuclar(sonuc)
        setGorunenKatalogSayisi(SAYFA_BOYUTU)
      }
    } catch {
      if (aramaIstegiRef.current === q) {
        setSonuclar([])
      }
    } finally {
      if (aramaIstegiRef.current === q) {
        setYukleniyor(false)
      }
    }
  }, [])

  // İlk yüklemede kataloğu ve kurulu kütüphaneleri çek
  useEffect(() => {
    if (cliHazir) {
      void aramaYap('')
      void kurululariYukle(false)
    }
  }, [cliHazir, aramaYap, kurululariYukle])

  // arduino-cli işlem loglarını dinle
  useEffect(() => {
    return window.api.arduinoCli.onOperationEvent((olay) => {
      if (olay.kind !== 'installLibrary' || olay.operationId !== operationIdRef.current) return
      if (olay.phase === 'log' && olay.message) setKurulumLogu((onceki) => onceki + olay.message + '\n')
    })
  }, [])

  // Temizleme: bileşen unmount olduğunda debounce sayacını temizle
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  // Kullanıcı arama kutusuna yazdığında anında state güncellenir, 350ms sonra otomatik arar
  const handleSorguDegisti = (yeniMetin: string): void => {
    setSorgu(yeniMetin)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      void aramaYap(yeniMetin)
    }, 350)
  }

  // Anında arama (Enter tuşu veya Ara butonu)
  const handleHemenAra = (): void => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    void aramaYap(sorgu)
  }

  // Arama metnini temizle
  const handleAramaTemizle = (): void => {
    setSorgu('')
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    void aramaYap('')
  }

  // Katalog eşleme haritası
  const katalogHaritasi = useMemo(() => {
    return new Map(sonuclar.map((s) => [s.name, s]))
  }, [sonuclar])

  // Kurulu kütüphaneler için anlık arama/süzme (deferred value ile gecikmesiz)
  const filtrelenmisKurulular = useMemo(() => {
    const q = deferKuruluArama.trim().toLowerCase()
    if (!q) return kuruluKutuphaneler
    return kuruluKutuphaneler.filter(
      (lib) =>
        lib.name.toLowerCase().includes(q) ||
        (lib.author && lib.author.toLowerCase().includes(q)) ||
        (lib.sentence && lib.sentence.toLowerCase().includes(q))
    )
  }, [kuruluKutuphaneler, deferKuruluArama])

  // Sonsuz kaydırma: Kullanıcı pencerenin altına yaklaştıkça daha fazla kart ekle
  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 280) {
      if (aktifSekme === 'tumu') {
        setGorunenKatalogSayisi((onceki) => (onceki < sonuclar.length ? onceki + SAYFA_BOYUTU : onceki))
      } else {
        setGorunenKuruluSayisi((onceki) => (onceki < filtrelenmisKurulular.length ? onceki + SAYFA_BOYUTU : onceki))
      }
    }
  }

  // Ekrana basılacak dilimlenmiş kütüphaneler (DOM'u 250.000 düğüm yerine ~600 düğümde tutar)
  const goruntulenenSonuclar = useMemo(() => {
    return sonuclar.slice(0, gorunenKatalogSayisi)
  }, [sonuclar, gorunenKatalogSayisi])

  const goruntulenenKurulular = useMemo(() => {
    return filtrelenmisKurulular.slice(0, gorunenKuruluSayisi)
  }, [filtrelenmisKurulular, gorunenKuruluSayisi])

  const handleSurumSec = useCallback((name: string, surum: string) => {
    setSecilenSurumler((onceki) => ({ ...onceki, [name]: surum }))
  }, [])

  const kur = useCallback(async (name: string): Promise<void> => {
    const surum = secilenSurumler[name]
    const operationId = crypto.randomUUID()
    operationIdRef.current = operationId
    setKuruluyorAd(name)
    setKurulumLogu('')
    try {
      await window.api.arduinoCli.installLibrary(name, surum, operationId)
      void kutuphaneSembolleriniYenile(true)
      await Promise.all([aramaYap(sorgu), kurululariYukle(true)])
      toastGoster(t('{name} kuruldu', { name }), 'basari')
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : t('{name} kurulamadı', { name }), 'hata')
    } finally {
      setKuruluyorAd(null)
    }
  }, [secilenSurumler, sorgu, aramaYap, kurululariYukle, toastGoster, t])

  const kaldir = useCallback(async (name: string): Promise<void> => {
    if (!window.confirm(t('{name} kütüphanesi kaldırılsın mı?', { name }))) return
    try {
      await window.api.arduinoCli.uninstallLibrary(name)
      void kutuphaneSembolleriniYenile(true)
      await Promise.all([aramaYap(sorgu), kurululariYukle(true)])
      toastGoster(t('{name} kaldırıldı', { name }), 'basari')
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : t('{name} kaldırılamadı', { name }), 'hata')
    }
  }, [sorgu, aramaYap, kurululariYukle, toastGoster, t])

  if (!cliHazir) {
    return <p className="p-3 text-xs text-gray-500">{t('arduino-cli hazır olmadan Kütüphane Yöneticisi kullanılamaz.')}</p>
  }

  return (
    <div className="flex h-full flex-col text-xs select-none">
      <div className="shrink-0 border-b border-white/[0.06] p-2">
        <SegmentKontrol
          secenekler={[
            { id: 'tumu', ad: t('Katalog') },
            { id: 'kurulu', ad: t('Kurulu'), sayi: kuruluKutuphaneler.length }
          ]}
          deger={aktifSekme}
          onDegis={(id) => {
            setAktifSekme(id)
            if (id === 'tumu') {
              setGorunenKatalogSayisi(SAYFA_BOYUTU)
            } else {
              setGorunenKuruluSayisi(SAYFA_BOYUTU)
              void kurululariYukle(false)
            }
          }}
        />
      </div>

      <GuncellemeBandi onBitti={() => void kurululariYukle(true)} etkin={cliHazir} />

      {/* ── Arama Çubuğu (0ms Gecikmeli, Debounce Destekli) ── */}
      {aktifSekme === 'tumu' ? (
        <div className="flex shrink-0 gap-1.5 border-b border-panel-border p-2 bg-panel/20">
          <div className="relative flex-1 flex items-center">
            <SearchIcon className="absolute left-2.5 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              value={sorgu}
              onChange={(e) => handleSorguDegisti(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleHemenAra()}
              placeholder={t('Kütüphane veya yazar ara...')}
              className="h-7 w-full rounded-[5px] border border-panel-border bg-panel pl-8 pr-7 text-xs text-gray-200 outline-none placeholder:text-gray-600 focus:border-accent"
            />
            {sorgu && !yukleniyor && (
              <button
                onClick={handleAramaTemizle}
                title={t('Aramayı Temizle')}
                className="absolute right-2 text-gray-400 hover:text-gray-200 p-0.5 rounded"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
            {yukleniyor && (
              <div className="absolute right-2 text-accent">
                <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
              </div>
            )}
          </div>
          <button
            onClick={handleHemenAra}
            disabled={yukleniyor}
            className="h-7 rounded-[5px] border border-panel-border px-3 text-gray-200 hover:bg-white/[0.06] disabled:opacity-50 shrink-0 font-medium"
          >
            {t('Ara')}
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center justify-between gap-1.5 border-b border-panel-border p-2 bg-panel/20">
          <div className="relative flex-1 flex items-center">
            <SearchIcon className="absolute left-2.5 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              value={kuruluArama}
              onChange={(e) => {
                setKuruluArama(e.target.value)
                setGorunenKuruluSayisi(SAYFA_BOYUTU)
              }}
              placeholder={t('Kurulu kütüphanelerde süz (isim, yazar)...')}
              className="h-7 w-full rounded-[5px] border border-panel-border bg-panel pl-8 pr-7 text-xs text-gray-200 outline-none placeholder:text-gray-600 focus:border-accent"
            />
            {kuruluArama && (
              <button
                onClick={() => setKuruluArama('')}
                title={t('Süzgeci Temizle')}
                className="absolute right-2 text-gray-400 hover:text-gray-200 p-0.5 rounded"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => void kurululariYukle(true)}
            title={t('Kurulu kütüphaneleri yeniden tara')}
            disabled={kurulularYukleniyor}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] border border-panel-border text-gray-400 hover:bg-white/[0.06] hover:text-gray-100 disabled:opacity-50 shrink-0"
          >
            <RefreshIcon className={`h-4 w-4 ${kurulularYukleniyor ? 'animate-spin text-accent' : ''}`} />
          </button>
        </div>
      )}

      {/* ── Durum ve Sonuç Sayacı Rozeti ── */}
      {aktifSekme === 'tumu' && sonuclar.length > 0 && (
        <div className="px-2.5 py-1 text-[10.5px] text-gray-400 bg-panel/30 border-b border-panel-border/40 flex justify-between items-center shrink-0">
          <span>
            <strong className="text-gray-200">{sonuclar.length.toLocaleString('tr-TR')}</strong> {t('kütüphane bulundu')}
          </span>
          {gorunenKatalogSayisi < sonuclar.length && (
            <span className="text-[10px] text-gray-500">
              {t('İlk {n} gösteriliyor', { n: Math.min(gorunenKatalogSayisi, sonuclar.length) })}
            </span>
          )}
        </div>
      )}

      {/* ── Liste Alanı (Kademeli & Sonsuz Kaydırma) ── */}
      <div onScroll={handleScroll} className="flex-1 overflow-y-auto min-h-0 select-text">
        {aktifSekme === 'tumu' ? (
          /* ──── TÜM KATALOG LİSTESİ ──── */
          <>
            {yukleniyor && sonuclar.length === 0 && (
              <div className="p-4 flex items-center justify-center gap-2 text-gray-400">
                <SpinnerIcon className="h-4 w-4 animate-spin text-accent" />
                <span>{t('Katalog taranıyor...')}</span>
              </div>
            )}
            {!yukleniyor && sonuclar.length === 0 && (
              <p className="p-4 text-center text-gray-500">{t('Sonuç bulunamadı.')}</p>
            )}

            {goruntulenenSonuclar.map((lib) => (
              <LibraryCard
                key={lib.name}
                lib={lib}
                seciliSurum={secilenSurumler[lib.name] ?? lib.latestVersion}
                onSurumSec={(surum) => handleSurumSec(lib.name, surum)}
                onKur={kur}
                onKaldir={kaldir}
                kuruluyorAd={kuruluyorAd}
                kurulumLogu={kurulumLogu}
              />
            ))}

            {/* Daha Fazla Göster Butonu / Kalan Bildirimi */}
            {gorunenKatalogSayisi < sonuclar.length && (
              <div className="p-3 text-center border-t border-panel-border/40">
                <button
                  onClick={() =>
                    setGorunenKatalogSayisi((onceki) =>
                      Math.min(onceki + SAYFA_BOYUTU, sonuclar.length)
                    )
                  }
                  className="rounded border border-panel-border bg-panel px-3 py-1 text-[11px] text-accent-hover hover:bg-panel-border/80 transition-colors"
                >
                  {t('Daha Fazla Göster')} (+{Math.min(SAYFA_BOYUTU, sonuclar.length - gorunenKatalogSayisi)})
                </button>
              </div>
            )}
          </>
        ) : (
          /* ──── KURULU KÜTÜPHANELER LİSTESİ ──── */
          <>
            {kurulularYukleniyor && kuruluKutuphaneler.length === 0 && (
              <div className="p-4 flex items-center justify-center gap-2 text-gray-400">
                <SpinnerIcon className="h-4 w-4 animate-spin text-emerald-400" />
                <span>{t('Kurulu kütüphaneler taranıyor...')}</span>
              </div>
            )}
            {!kurulularYukleniyor && kuruluKutuphaneler.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-xs text-gray-400">{t('Henüz kurulu bir kütüphane bulunamadı.')}</p>
                <button
                  onClick={() => setAktifSekme('tumu')}
                  className="mt-2 rounded bg-accent/20 px-3 py-1 text-xs text-accent-hover hover:bg-accent/30"
                >
                  {t('Katalogda Kütüphane Ara')}
                </button>
              </div>
            )}
            {!kurulularYukleniyor && kuruluKutuphaneler.length > 0 && filtrelenmisKurulular.length === 0 && (
              <p className="p-4 text-center text-gray-500">{t('"{q}" ile eşleşen kurulu kütüphane bulunamadı.', { q: kuruluArama })}</p>
            )}

            {goruntulenenKurulular.map((lib) => {
              const katalogBilgisi = katalogHaritasi.get(lib.name)
              return (
                <InstalledLibraryCard
                  key={lib.name}
                  lib={lib}
                  katalogBilgisi={katalogBilgisi}
                  seciliSurum={secilenSurumler[lib.name] ?? lib.version}
                  onSurumSec={(surum) => handleSurumSec(lib.name, surum)}
                  onKur={kur}
                  onKaldir={kaldir}
                  kuruluyorAd={kuruluyorAd}
                  kurulumLogu={kurulumLogu}
                />
              )
            })}

            {gorunenKuruluSayisi < filtrelenmisKurulular.length && (
              <div className="p-3 text-center border-t border-panel-border/40">
                <button
                  onClick={() =>
                    setGorunenKuruluSayisi((onceki) =>
                      Math.min(onceki + SAYFA_BOYUTU, filtrelenmisKurulular.length)
                    )
                  }
                  className="rounded border border-panel-border bg-panel px-3 py-1 text-[11px] text-accent-hover hover:bg-panel-border/80 transition-colors"
                >
                  {t('Daha Fazla Göster')} (+{Math.min(SAYFA_BOYUTU, filtrelenmisKurulular.length - gorunenKuruluSayisi)})
                </button>
              </div>
            )}
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

function SearchIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function SpinnerIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

export default LibraryManager
