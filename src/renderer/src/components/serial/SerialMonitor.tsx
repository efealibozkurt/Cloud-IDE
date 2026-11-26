import { useEffect, useMemo, useRef, useState, type ReactElement, type UIEvent } from 'react'
import { BOOTLOADER_DESENI, hataSatiriMi } from '@shared/seriTeshis'
import type { LineEnding } from '@shared/types'
import { useAppState } from '../../state/AppStateContext'
import SerialPlotter from './SerialPlotter'
import { YardimDugmesi } from '../common/YardimDugmesi'
import { useOturumDurumu } from '../../hooks/useOturumDurumu'
import { useI18n } from '../../i18n'
import { AiDugmesi } from '../common/AiDugmesi'
import { portAciklamasi } from '@shared/portTanima'

/** Her satır sabit yükseklikte tutulur (sanal liste hesaplarının basit kalması için satırlar kaydırılmaz) */
const SATIR_YUKSEKLIGI = 18
/** Görünür alanın dışında ekstra render edilen satır sayısı (hızlı kaydırmada beyaz an yaşanmasın diye) */
const ASIRI_RENDER = 15
/** Birden çok port açıkken satır öneklerini ayırt etmek için dönüşümlü renkler */
const PORT_RENKLERI = ['text-sky-400', 'text-amber-400', 'text-emerald-400', 'text-pink-400', 'text-orange-400', 'text-teal-400']

export type SeriGorunumKonumu = 'sag' | 'alt' | 'tam'
/** Konum düğmelerinin hedefi; 'cik' tam ekrandan önceki yere döner */
export type SeriHedef = SeriGorunumKonumu | 'cik'

interface Props {
  konum: SeriGorunumKonumu
  onKonum: (hedef: SeriHedef) => void
  /** Verilirse kapatma düğmesi gösterilir (alt panelde panelin kendi düğmesi vardır) */
  onKapat?: () => void
}

/**
 * Seri monitör; sağ panelde, alt panelde ya da tam ekranda gösterilir. Bağlantı, üst çubukta seçilen
 * port/baud üzerinden kurulur. 5000 satırlık tampon AppStateContext'te
 * tutulur (taşarsa baştan atılır). Satır listesi, binlerce satırda bile
 * akıcı kalması için sanallaştırılmış (virtualized) şekilde render edilir:
 * DOM'a yalnızca o an görünen satırlar + küçük bir taşma payı eklenir.
 */
function SerialMonitor({ konum, onKonum, onKapat }: Props): ReactElement {
  const { t, dil } = useI18n()
  const { state, connectSerial, disconnectSerial, writeSerial, clearSerial, askDretAi } = useAppState()
  const [zamanDamgasi, setZamanDamgasi] = useOturumDurumu('seri.zamanDamgasi', false)
  const [otoKaydirma, setOtoKaydirma] = useOturumDurumu('seri.otoKaydirma', true)
  const [satirSonu, setSatirSonu] = useOturumDurumu<LineEnding>('seri.satirSonu', 'nl')
  const [bootloaderGizle, setBootloaderGizle] = useOturumDurumu('seri.bootloaderGizle', false)
  const [mesaj, setMesaj] = useOturumDurumu('seri.mesaj', '')
  const [sekme, setSekme] = useOturumDurumu<string>('seri.sekme', 'hepsi')
  const [gorunum, setGorunum] = useOturumDurumu<'metin' | 'grafik' | 'ikisi'>('seri.gorunum', 'metin')
  // Yan yana görünüm yalnızca tam ekranda sığar
  const etkinGorunum = gorunum === 'ikisi' && konum !== 'tam' ? 'metin' : gorunum
  const gondermeRef = useRef<HTMLInputElement>(null)
  const [portSecimiAcik, setPortSecimiAcik] = useState(false)
  const [secenekAcik, setSecenekAcik] = useState(false)
  const secenekRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerYuksekligi, setContainerYuksekligi] = useState(240)
  const kaydirmaRef = useRef<HTMLDivElement>(null)

  const durum = state.serial.status
  const portlar = durum.portlar
  // Seçili sekmedeki port kapandıysa "tümü" görünümüne dön
  const aktifSekme = sekme !== 'hepsi' && !portlar.some((p) => p.port === sekme) ? 'hepsi' : sekme
  // Veri gönderme ve kesme işlemlerinin hedefi: seçili port; "tümü"nde birincil (en son açılan) port
  const hedefPort = aktifSekme === 'hepsi' ? durum.port : aktifSekme
  const hedefBaud = portlar.find((p) => p.port === hedefPort)?.baud ?? durum.baud
  const kisaAd = (port: string): string => port.replace(/^\/dev\//, '')
  // "Port ekle" için henüz bağlanmamış portlar
  const eklenebilirPortlar = state.arduinoCli.ports.filter((p) => !portlar.some((a) => a.port === p.address))

  const gorunurSatirlar = useMemo(
    () =>
      state.serial.lines.filter(
        (s) => (aktifSekme === 'hepsi' || s.port === aktifSekme) && !(bootloaderGizle && BOOTLOADER_DESENI.test(s.text))
      ),
    [state.serial.lines, bootloaderGizle, aktifSekme]
  )

  const gorunurSatirlarMetin = useMemo(() => gorunurSatirlar.map((s) => s.text), [gorunurSatirlar])

  useEffect(() => {
    const el = kaydirmaRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const yukseklik = entries[0]?.contentRect.height
      if (yukseklik) setContainerYuksekligi(yukseklik)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [etkinGorunum])

  useEffect(() => {
    if (otoKaydirma && kaydirmaRef.current) {
      kaydirmaRef.current.scrollTop = kaydirmaRef.current.scrollHeight
    }
  }, [gorunurSatirlar, otoKaydirma, etkinGorunum])

  // Tam ekrana geçince klavye odağı arkadaki editörde kalmasın
  useEffect(() => {
    if (konum !== 'tam') return
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    gondermeRef.current?.focus()
  }, [konum])

  // Görünüm seçenekleri menüsü dışarı tıklayınca kapanır
  useEffect(() => {
    if (!secenekAcik) return
    const disTik = (e: MouseEvent): void => {
      if (!secenekRef.current?.contains(e.target as Node)) setSecenekAcik(false)
    }
    document.addEventListener('mousedown', disTik)
    return () => document.removeEventListener('mousedown', disTik)
  }, [secenekAcik])

  // Kullanıcı yukarı kaydırınca otomatik kaydırma kendiliğinden kapanır
  const kaydirmaDegisti = (e: UIEvent<HTMLDivElement>): void => {
    const el = e.currentTarget
    setScrollTop(el.scrollTop)
    const enAlttaMi = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    if (!enAlttaMi && otoKaydirma) setOtoKaydirma(false)
  }

  const gonder = (): void => {
    if (!mesaj) return
    void writeSerial(mesaj, satirSonu, hedefPort ?? undefined)
    setMesaj('')
  }

  const sorAiya = (): void => {
    if (gorunurSatirlar.length === 0) return
    const son = gorunurSatirlar.slice(-60)
    const metin = son
      .map((s) => `${portlar.length > 1 ? `[${kisaAd(s.port)}] ` : ''}${s.text}`)
      .join('\n')
    const baglam = [
      hedefPort ? `Port: ${hedefPort}${hedefBaud ? ` @ ${hedefBaud} baud` : ''}` : null,
      state.arduinoCli.selectedFqbn ? `Kart: ${state.arduinoCli.selectedFqbn}` : null
    ]
      .filter(Boolean)
      .join(' · ')
    askDretAi(
      metin,
      `Seri monitördeki bu çıktıyı incele${baglam ? ` (${baglam})` : ''}. Bir çökme, hata, baud uyumsuzluğu veya beklenmeyen davranış varsa nedenini açıkla ve gerekirse kodu düzelt.`
    )
  }

  const toplamYukseklik = gorunurSatirlar.length * SATIR_YUKSEKLIGI
  const baslangicIndex = Math.max(0, Math.floor(scrollTop / SATIR_YUKSEKLIGI) - ASIRI_RENDER)
  const bitisIndex = Math.min(
    gorunurSatirlar.length,
    Math.ceil((scrollTop + containerYuksekligi) / SATIR_YUKSEKLIGI) + ASIRI_RENDER
  )
  const gorunenDilim = gorunurSatirlar.slice(baslangicIndex, bitisIndex)

  const metinAlani = (
    <div ref={kaydirmaRef} onScroll={kaydirmaDegisti} className="min-w-0 flex-1 overflow-auto p-1.5 font-mono">
      {gorunurSatirlar.length === 0 && (
        <p className="text-gray-600">
          {durum.open ? t('Veri bekleniyor...') : t("Bağlanmak için üst çubuktan bir port seçip 'Bağlan'a tıklayın.")}
        </p>
      )}
      {gorunurSatirlar.length > 0 && (
        <div style={{ height: toplamYukseklik, position: 'relative' }}>
          {gorunenDilim.map((satir, i) => {
            const bootloaderMu = BOOTLOADER_DESENI.test(satir.text)
            const hataMi = hataSatiriMi(satir.text)
            return (
              <div
                key={satir.id}
                style={{
                  position: 'absolute',
                  top: (baslangicIndex + i) * SATIR_YUKSEKLIGI,
                  left: 0,
                  right: 0,
                  height: SATIR_YUKSEKLIGI,
                  lineHeight: `${SATIR_YUKSEKLIGI}px`
                }}
                className={`whitespace-nowrap ${hataMi ? 'text-red-400' : bootloaderMu ? 'text-gray-600' : 'text-gray-300'}`}
              >
                {zamanDamgasi && (
                  <span className="mr-2 text-gray-600">
                    {new Date(satir.timestamp).toLocaleTimeString(dil === 'en' ? 'en-US' : 'tr-TR')}
                  </span>
                )}
                {aktifSekme === 'hepsi' && portlar.length > 1 && (
                  <span className={`mr-2 ${PORT_RENKLERI[Math.max(0, portlar.findIndex((p) => p.port === satir.port)) % PORT_RENKLERI.length]}`}>
                    [{kisaAd(satir.port)}]
                  </span>
                )}
                {satir.text}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  const konumDugmeleri = (
    <div className="flex items-center gap-0.5">
      {konum === 'tam' ? (
        <KonumDugmesi ad={t('Tam ekrandan çık (Esc)')} onClick={() => onKonum('cik')} yol="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
      ) : (
        <>
          {konum === 'alt' ? (
            <KonumDugmesi ad={t('Sağ panele taşı')} onClick={() => onKonum('sag')} yol="M3 4h18v16H3zM14 4v16" />
          ) : (
            <KonumDugmesi ad={t('Alt panele taşı')} onClick={() => onKonum('alt')} yol="M3 4h18v16H3zM3 14h18" />
          )}
          <KonumDugmesi ad={t('Tam ekran')} onClick={() => onKonum('tam')} yol="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </>
      )}
      {konum !== 'alt' && <YardimDugmesi konu="seri" />}
      {onKapat && <KonumDugmesi ad={t('Seri monitörü kapat')} onClick={onKapat} yol="M18 6 6 18M6 6l12 12" />}
    </div>
  )

  return (
    <div className="flex h-full flex-col text-xs">
      <div className="flex shrink-0 flex-wrap items-center gap-x-1.5 gap-y-1.5 border-b border-panel-border px-2 py-1.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${durum.open ? 'bg-emerald-500' : 'bg-gray-600'}`} />
          <span className="truncate text-gray-300">
            {durum.open
              ? portlar.length > 1
                ? t('{n} port bağlı', { n: portlar.length })
                : t('Bağlı: {port} @ {baud}', { port: hedefPort ?? '', baud: hedefBaud ?? '' })
              : durum.temporarilyClosedForUpload
                ? t('Yükleme için geçici kapatıldı...')
                : t('Bağlı değil')}
          </span>
        </span>
        {durum.open && (
          <SimgeDugmesi
            ad={t('Port ekle')}
            ipucu={t('Başka bir portu da bağla (diğer bağlantılar açık kalır)')}
            yol="M12 5v14M5 12h14"
            onClick={() => setPortSecimiAcik((a) => !a)}
            disabled={durum.temporarilyClosedForUpload}
            etkin={portSecimiAcik}
          />
        )}
        <div className="flex-1" />
        <button
          onClick={() => (durum.open ? void disconnectSerial(hedefPort ?? undefined) : void connectSerial())}
          disabled={durum.temporarilyClosedForUpload}
          className="h-6 shrink-0 rounded border border-panel-border px-2 text-gray-200 hover:enabled:bg-panel-border disabled:opacity-50"
        >
          {!durum.open ? t('Bağlan') : portlar.length > 1 ? `${kisaAd(hedefPort ?? '')} ${t('kes')}` : t('Bağlantıyı kes')}
        </button>
        {konum === 'sag' && konumDugmeleri}
        {/* Dar sağ panelde ikinci satır; geniş görünümlerde hepsi tek satıra sığar */}
        {konum === 'sag' ? <div className="h-0 basis-full" /> : <span className="mx-0.5 h-4 w-px bg-panel-border" />}
        <div role="tablist" aria-label={t('Görünüm')} className="flex gap-0.5 rounded-[5px] border border-panel-border bg-panel p-0.5">
          {(konum === 'tam' ? (['metin', 'grafik', 'ikisi'] as const) : (['metin', 'grafik'] as const)).map((g) => (
            <button
              key={g}
              role="tab"
              aria-selected={etkinGorunum === g}
              onClick={() => setGorunum(g)}
              title={g === 'grafik' ? t('Gelen sayıları canlı grafik olarak çiz') : g === 'ikisi' ? t('Metin ve grafiği yan yana göster') : t('Satırları metin olarak göster')}
              className={`rounded-[3px] px-2 py-0.5 text-[11px] ${etkinGorunum === g ? 'bg-white/[0.12] text-gray-100' : 'text-gray-500 hover:text-gray-200'}`}
            >
              {g === 'metin' ? t('Metin') : g === 'grafik' ? t('Grafik') : t('İkisi')}
            </button>
          ))}
        </div>
        {konum === 'sag' && <div className="flex-1" />}
        <AiDugmesi onClick={sorAiya} disabled={gorunurSatirlar.length === 0} title={t('Son seri monitör çıktısını Cloud AI ile analiz et')}>
          {t("AI'a Sor")}
        </AiDugmesi>
        <SimgeDugmesi
          ad={t('Temizle')}
          yol="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
          onClick={() => clearSerial(aktifSekme === 'hepsi' ? undefined : aktifSekme)}
        />
        <div ref={secenekRef} className="relative">
          <SimgeDugmesi
            ad={t('Görünüm seçenekleri')}
            yol="M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4"
            onClick={() => setSecenekAcik((a) => !a)}
            etkin={secenekAcik}
          />
          {secenekAcik && (
            <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded border border-panel-border bg-panel-light py-1 shadow-lg">
              {(
                [
                  [t('Otomatik kaydır'), otoKaydirma, setOtoKaydirma],
                  [t('Saati göster'), zamanDamgasi, setZamanDamgasi],
                  [t('Açılış mesajlarını gizle'), bootloaderGizle, setBootloaderGizle]
                ] as const
              ).map(([ad, deger, ayarla]) => (
                <label key={ad} className="flex cursor-pointer items-center gap-2 px-2.5 py-1 text-gray-300 hover:bg-white/[0.06]">
                  <input type="checkbox" checked={deger} onChange={(e) => ayarla(e.target.checked)} />
                  {ad}
                </label>
              ))}
            </div>
          )}
        </div>
        {konum !== 'sag' && (
          <>
            <div className="flex-1" />
            {konumDugmeleri}
          </>
        )}
      </div>

      {portSecimiAcik && durum.open && (
        <div role="group" aria-label={t('Eklenecek port')} className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-panel-border px-2 py-1.5">
          {eklenebilirPortlar.length === 0 ? (
            <span className="text-gray-500">{t('Bağlanacak başka port yok. Kartı takınca burada görünür.')}</span>
          ) : (
            <>
              <span className="text-gray-500">{t('Eklenecek port ({baud} baud):', { baud: state.arduinoCli.selectedBaud })}</span>
              {eklenebilirPortlar.map((p) => (
                <button
                  key={p.address}
                  onClick={() => {
                    setPortSecimiAcik(false)
                    setSekme('hepsi')
                    void connectSerial(p.address)
                  }}
                  className="rounded border border-panel-border bg-panel px-2 py-0.5 text-gray-200 hover:bg-panel-border"
                >
                  {kisaAd(p.address)}
                  <span className="ml-1 text-gray-500">{t(portAciklamasi(p))}</span>
                </button>
              ))}
            </>
          )}
          <button onClick={() => setPortSecimiAcik(false)} className="ml-auto text-gray-500 hover:text-gray-200">
            {t('Vazgeç')}
          </button>
        </div>
      )}

      {portlar.length > 1 && (
        <div role="tablist" aria-label={t('Seri portlar')} className="flex shrink-0 items-center gap-1 border-b border-panel-border px-2 py-1">
          {['hepsi', ...portlar.map((p) => p.port)].map((id) => {
            const secili = id === aktifSekme
            const sira = portlar.findIndex((p) => p.port === id)
            return (
              <button
                key={id}
                role="tab"
                aria-selected={secili}
                onClick={() => setSekme(id)}
                className={`flex h-6 items-center gap-1.5 rounded-[4px] px-2 transition-colors ${
                  secili ? 'bg-white/[0.08] text-gray-100' : 'text-gray-500 hover:text-gray-200'
                }`}
              >
                {id !== 'hepsi' && <span className={`h-1.5 w-1.5 rounded-full bg-current ${PORT_RENKLERI[sira % PORT_RENKLERI.length]}`} aria-hidden="true" />}
                {id === 'hepsi' ? t('Tümü') : `${kisaAd(id)} @ ${portlar[sira].baud}`}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {etkinGorunum !== 'grafik' && metinAlani}
        {etkinGorunum !== 'metin' && (
          <div className={`min-h-0 min-w-0 flex-1 ${etkinGorunum === 'ikisi' ? 'border-l border-panel-border' : ''}`}>
            <SerialPlotter satirlar={gorunurSatirlarMetin} />
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 border-t border-panel-border p-1.5">
        <input
          ref={gondermeRef}
          value={mesaj}
          onChange={(e) => setMesaj(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && gonder()}
          disabled={!durum.open}
          placeholder={durum.open ? t('Gönderilecek veri...') : t('Bağlanmadan veri gönderilemez')}
          className="min-w-0 flex-1 rounded border border-panel-border bg-panel px-2 py-1 text-gray-200 outline-none disabled:opacity-50"
        />
        <select
          value={satirSonu}
          onChange={(e) => setSatirSonu(e.target.value as LineEnding)}
          className="rounded border border-panel-border bg-panel px-1 py-1 text-gray-300"
        >
          <option value="none">{t('Satır sonu yok')}</option>
          <option value="nl">NL</option>
          <option value="cr">CR</option>
          <option value="nlcr">NL+CR</option>
        </select>
        <button
          onClick={gonder}
          disabled={!durum.open}
          className="rounded border border-panel-border bg-panel px-2 py-1 text-gray-300 hover:enabled:bg-panel-border disabled:opacity-50"
        >
          {t('Gönder')}
        </button>
      </div>
    </div>
  )
}

function KonumDugmesi({ ad, yol, onClick }: { ad: string; yol: string; onClick: () => void }): ReactElement {
  return (
    <button onClick={onClick} title={ad} aria-label={ad} className="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-panel-border hover:text-gray-200">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={yol} />
      </svg>
    </button>
  )
}

function SimgeDugmesi({
  ad,
  ipucu,
  yol,
  onClick,
  disabled,
  etkin
}: {
  ad: string
  ipucu?: string
  yol: string
  onClick: () => void
  disabled?: boolean
  etkin?: boolean
}): ReactElement {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={ipucu ?? ad}
      aria-label={ad}
      aria-expanded={etkin}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border border-panel-border text-gray-300 hover:enabled:bg-panel-border disabled:opacity-50 ${etkin ? 'bg-white/[0.12]' : ''}`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={yol} />
      </svg>
    </button>
  )
}

export default SerialMonitor
