import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { LibraryInfo, LibrarySearchResult } from '@shared/types'
import { useAppState } from '../../state/AppStateContext'
import { useToast } from '../../state/ToastContext'

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

  return (
    <div className="border-b border-panel-border/70 p-2.5 hover:bg-panel/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-gray-100">{lib.name}</div>
          {/* YAZAR BİLGİSİ */}
          {lib.author && (
            <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-[#93a5fb]">
              <UserIcon className="h-3 w-3 shrink-0 opacity-80" />
              <span className="truncate font-medium" title={`Yazar: ${lib.author}`}>
                {temizAuthor(lib.author)}
              </span>
            </div>
          )}
          {lib.sentence && (
            <div className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-gray-400">
              {lib.sentence}
            </div>
          )}
        </div>

        {lib.installed && (
          <span
            title="Bu kütüphane bilgisayarınızda kurulu"
            className="shrink-0 flex items-center gap-1 rounded bg-emerald-950/70 border border-emerald-800/80 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            v{lib.installedVersion}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <select
          value={seciliSurum}
          onChange={(e) => onSurumSec(e.target.value)}
          className="rounded border border-panel-border bg-panel px-1.5 py-0.5 text-[11px] text-gray-300 outline-none"
        >
          {lib.availableVersions.map((v) => (
            <option key={v} value={v}>
              v{v} {v === lib.latestVersion ? '(En Son)' : ''}
            </option>
          ))}
        </select>
        <button
          onClick={() => onKur(lib.name)}
          disabled={kuruluyorAd !== null}
          className="rounded border border-accent bg-accent/20 px-2 py-0.5 text-accent-hover hover:enabled:bg-accent/30 disabled:opacity-50"
        >
          {lib.installed ? 'Güncelle/Kur' : 'Kur'}
        </button>
        {lib.installed && (
          <button
            onClick={() => onKaldir(lib.name)}
            disabled={kuruluyorAd !== null}
            className="rounded border border-panel-border bg-panel px-2 py-0.5 text-red-300 hover:enabled:bg-red-950/40 hover:enabled:border-red-900 disabled:opacity-50"
          >
            Kaldır
          </button>
        )}
      </div>

      {kuruluyorBu && (
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

  return (
    <div className="border-b border-panel-border/70 p-2.5 hover:bg-panel/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-semibold text-gray-100">{lib.name}</span>
            <span className="shrink-0 rounded bg-emerald-950/80 border border-emerald-800 px-1.5 py-0.2 text-[9.5px] font-medium text-emerald-300">
              v{lib.version}
            </span>
          </div>

          {/* YAZAR BİLGİSİ */}
          {yazar ? (
            <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-[#93a5fb]">
              <UserIcon className="h-3 w-3 shrink-0 opacity-80" />
              <span className="truncate font-medium" title={`Yazar: ${yazar}`}>
                {temizAuthor(yazar)}
              </span>
            </div>
          ) : (
            <div className="mt-0.5 text-[10px] text-gray-500 italic">Yazar bilgisi belirtilmemiş</div>
          )}

          {aciklama && (
            <div className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-gray-400">
              {aciklama}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-1.5">
        {/* Sürüm seçici (Eğer katalogda varsa) */}
        {katalogBilgisi && katalogBilgisi.availableVersions.length > 0 ? (
          <div className="flex items-center gap-1">
            <select
              value={seciliSurum}
              onChange={(e) => onSurumSec(e.target.value)}
              className="rounded border border-panel-border bg-panel px-1.5 py-0.5 text-[10.5px] text-gray-300 outline-none"
            >
              {katalogBilgisi.availableVersions.map((v) => (
                <option key={v} value={v}>
                  v{v} {v === katalogBilgisi.latestVersion ? '(En Son)' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={() => onKur(lib.name)}
              disabled={kuruluyorAd !== null}
              className="rounded border border-accent bg-accent/20 px-2 py-0.5 text-[10.5px] text-accent-hover hover:enabled:bg-accent/30 disabled:opacity-50"
            >
              Sürüm Değiştir
            </button>
          </div>
        ) : (
          <span className="text-[10px] text-gray-500 truncate" title={lib.installDir}>
            {lib.installDir ? 'Yerel Kütüphane' : ''}
          </span>
        )}

        <button
          onClick={() => onKaldir(lib.name)}
          disabled={kuruluyorAd !== null}
          className="ml-auto rounded border border-panel-border bg-panel px-2 py-0.5 text-[10.5px] text-red-300 hover:enabled:bg-red-950/40 hover:enabled:border-red-900 disabled:opacity-50"
        >
          Kaldır
        </button>
      </div>

      {kuruluyorBu && (
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
})

// ─────────────────────────────────────────────────────────────────────────────
// Ana Bileşen: LibraryManager
// ─────────────────────────────────────────────────────────────────────────────

function LibraryManager(): ReactElement {
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
      await Promise.all([aramaYap(sorgu), kurululariYukle(true)])
      toastGoster(`${name} kuruldu`, 'basari')
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : `${name} kurulamadı`, 'hata')
    } finally {
      setKuruluyorAd(null)
    }
  }, [secilenSurumler, sorgu, aramaYap, kurululariYukle, toastGoster])

  const kaldir = useCallback(async (name: string): Promise<void> => {
    if (!window.confirm(`${name} kütüphanesi kaldırılsın mı?`)) return
    try {
      await window.api.arduinoCli.uninstallLibrary(name)
      await Promise.all([aramaYap(sorgu), kurululariYukle(true)])
      toastGoster(`${name} kaldırıldı`, 'basari')
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : `${name} kaldırılamadı`, 'hata')
    }
  }, [sorgu, aramaYap, kurululariYukle, toastGoster])

  if (!cliHazir) {
    return <p className="p-3 text-xs text-gray-500">arduino-cli hazır olmadan Kütüphane Yöneticisi kullanılamaz.</p>
  }

  return (
    <div className="flex h-full flex-col text-xs select-none">
      {/* ── Üst Sekme Kontrolü (Tümü / Kurulu Kütüphaneler) ── */}
      <div className="flex border-b border-panel-border bg-panel/50 p-1 shrink-0">
        <button
          onClick={() => {
            setAktifSekme('tumu')
            setGorunenKatalogSayisi(SAYFA_BOYUTU)
          }}
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
            setGorunenKuruluSayisi(SAYFA_BOYUTU)
            void kurululariYukle(false)
          }}
          className={`flex items-center justify-center gap-1.5 flex-1 rounded py-1 text-center font-medium transition-colors ${
            aktifSekme === 'kurulu'
              ? 'bg-panel-border/80 text-emerald-300 shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <span>Kurulu</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
              aktifSekme === 'kurulu'
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-panel-border text-gray-400'
            }`}
          >
            {kuruluKutuphaneler.length}
          </span>
        </button>
      </div>

      {/* ── Arama Çubuğu (0ms Gecikmeli, Debounce Destekli) ── */}
      {aktifSekme === 'tumu' ? (
        <div className="flex shrink-0 gap-1.5 border-b border-panel-border p-2 bg-panel/20">
          <div className="relative flex-1 flex items-center">
            <SearchIcon className="absolute left-2.5 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              value={sorgu}
              onChange={(e) => handleSorguDegisti(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleHemenAra()}
              placeholder="Kütüphane veya yazar ara..."
              className="w-full rounded border border-panel-border bg-panel pl-8 pr-7 py-1 text-gray-200 outline-none focus:ring-1 focus:ring-accent placeholder:text-gray-500 text-xs"
            />
            {sorgu && !yukleniyor && (
              <button
                onClick={handleAramaTemizle}
                title="Aramayı Temizle"
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
            className="rounded border border-panel-border bg-panel px-2.5 py-1 text-gray-300 hover:bg-panel-border disabled:opacity-50 shrink-0 font-medium"
          >
            Ara
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
              placeholder="Kurulu kütüphanelerde süz (isim, yazar)..."
              className="w-full rounded border border-panel-border bg-panel pl-8 pr-7 py-1 text-gray-200 outline-none focus:ring-1 focus:ring-accent placeholder:text-gray-500 text-xs"
            />
            {kuruluArama && (
              <button
                onClick={() => setKuruluArama('')}
                title="Süzgeci Temizle"
                className="absolute right-2 text-gray-400 hover:text-gray-200 p-0.5 rounded"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => void kurululariYukle(true)}
            title="Kurulu kütüphaneleri yeniden tara"
            disabled={kurulularYukleniyor}
            className="rounded border border-panel-border bg-panel p-1 text-gray-400 hover:text-gray-200 disabled:opacity-50 shrink-0"
          >
            <RefreshIcon className={`h-4 w-4 ${kurulularYukleniyor ? 'animate-spin text-accent' : ''}`} />
          </button>
        </div>
      )}

      {/* ── Durum ve Sonuç Sayacı Rozeti ── */}
      {aktifSekme === 'tumu' && sonuclar.length > 0 && (
        <div className="px-2.5 py-1 text-[10.5px] text-gray-400 bg-panel/30 border-b border-panel-border/40 flex justify-between items-center shrink-0">
          <span>
            <strong className="text-gray-200">{sonuclar.length.toLocaleString('tr-TR')}</strong> kütüphane bulundu
          </span>
          {gorunenKatalogSayisi < sonuclar.length && (
            <span className="text-[10px] text-gray-500">
              İlk {Math.min(gorunenKatalogSayisi, sonuclar.length)} gösteriliyor
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
                <span>Katalog taranıyor...</span>
              </div>
            )}
            {!yukleniyor && sonuclar.length === 0 && (
              <p className="p-4 text-center text-gray-500">Sonuç bulunamadı.</p>
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
                  Daha Fazla Göster (+{Math.min(SAYFA_BOYUTU, sonuclar.length - gorunenKatalogSayisi)})
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
                <span>Kurulu kütüphaneler taranıyor...</span>
              </div>
            )}
            {!kurulularYukleniyor && kuruluKutuphaneler.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-xs text-gray-400">Henüz kurulu bir kütüphane bulunamadı.</p>
                <button
                  onClick={() => setAktifSekme('tumu')}
                  className="mt-2 rounded bg-accent/20 px-3 py-1 text-xs text-accent-hover hover:bg-accent/30"
                >
                  Katalogda Kütüphane Ara
                </button>
              </div>
            )}
            {!kurulularYukleniyor && kuruluKutuphaneler.length > 0 && filtrelenmisKurulular.length === 0 && (
              <p className="p-4 text-center text-gray-500">"{kuruluArama}" ile eşleşen kurulu kütüphane bulunamadı.</p>
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
                  Daha Fazla Göster (+{Math.min(SAYFA_BOYUTU, filtrelenmisKurulular.length - gorunenKuruluSayisi)})
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function UserIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
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
