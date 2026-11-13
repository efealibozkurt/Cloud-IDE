import { useEffect, useMemo, useRef, useState, type ReactElement, type UIEvent } from 'react'
import type { LineEnding } from '@shared/types'
import { useAppState } from '../../state/AppStateContext'
import SerialPlotter from './SerialPlotter'

/** ESP32/ESP8266 önyükleyici (bootloader) çıktısına ait yaygın satır kalıpları (en iyi çaba, kesin değil) */
const BOOTLOADER_DESENI = /^(rst:|ets |load:|entry |ho \d|configsip:|clk_drv:|mode:|invalid header|waiting for download)/i

/** Her satır sabit yükseklikte tutulur (sanal liste hesaplarının basit kalması için satırlar kaydırılmaz) */
const SATIR_YUKSEKLIGI = 18
/** Görünür alanın dışında ekstra render edilen satır sayısı (hızlı kaydırmada beyaz an yaşanmasın diye) */
const ASIRI_RENDER = 15
/** Birden çok port açıkken satır öneklerini ayırt etmek için dönüşümlü renkler */
const PORT_RENKLERI = ['text-sky-400', 'text-amber-400', 'text-emerald-400', 'text-pink-400', 'text-orange-400', 'text-teal-400']

/**
 * Alt panelin "Seri Monitör" sekmesi. Bağlantı, üst çubukta seçilen
 * port/baud üzerinden kurulur. 5000 satırlık tampon AppStateContext'te
 * tutulur (taşarsa baştan atılır). Satır listesi, binlerce satırda bile
 * akıcı kalması için sanallaştırılmış (virtualized) şekilde render edilir:
 * DOM'a yalnızca o an görünen satırlar + küçük bir taşma payı eklenir.
 */
function SerialMonitor(): ReactElement {
  const { state, connectSerial, disconnectSerial, writeSerial, clearSerial } = useAppState()
  const [zamanDamgasi, setZamanDamgasi] = useState(false)
  const [otoKaydirma, setOtoKaydirma] = useState(true)
  const [satirSonu, setSatirSonu] = useState<LineEnding>('nl')
  const [bootloaderGizle, setBootloaderGizle] = useState(false)
  const [mesaj, setMesaj] = useState('')
  const [sekme, setSekme] = useState<string>('hepsi')
  const [gorunum, setGorunum] = useState<'metin' | 'grafik'>('metin')
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
  }, [gorunum])

  useEffect(() => {
    if (otoKaydirma && kaydirmaRef.current) {
      kaydirmaRef.current.scrollTop = kaydirmaRef.current.scrollHeight
    }
  }, [gorunurSatirlar, otoKaydirma])

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

  const toplamYukseklik = gorunurSatirlar.length * SATIR_YUKSEKLIGI
  const baslangicIndex = Math.max(0, Math.floor(scrollTop / SATIR_YUKSEKLIGI) - ASIRI_RENDER)
  const bitisIndex = Math.min(
    gorunurSatirlar.length,
    Math.ceil((scrollTop + containerYuksekligi) / SATIR_YUKSEKLIGI) + ASIRI_RENDER
  )
  const gorunenDilim = gorunurSatirlar.slice(baslangicIndex, bitisIndex)

  return (
    <div className="flex h-full flex-col text-xs">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-panel-border px-2 py-1.5">
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${durum.open ? 'bg-emerald-500' : 'bg-gray-600'}`} />
          <span className="text-gray-400">
            {durum.open
              ? portlar.length > 1
                ? `${portlar.length} port bağlı`
                : `Bağlı: ${hedefPort} @ ${hedefBaud}`
              : durum.temporarilyClosedForUpload
                ? 'Yükleme için geçici kapatıldı...'
                : 'Bağlı değil'}
          </span>
        </span>
        <div className="flex-1" />
        <div role="tablist" aria-label="Görünüm" className="flex gap-0.5 rounded-[5px] border border-panel-border bg-panel p-0.5">
          {(['metin', 'grafik'] as const).map((g) => (
            <button
              key={g}
              role="tab"
              aria-selected={gorunum === g}
              onClick={() => setGorunum(g)}
              title={g === 'grafik' ? 'Gelen sayıları canlı grafik olarak çiz' : 'Satırları metin olarak göster'}
              className={`rounded-[3px] px-2 py-0.5 text-[11px] ${gorunum === g ? 'bg-panel-light text-gray-100' : 'text-gray-500 hover:text-gray-200'}`}
            >
              {g === 'metin' ? 'Metin' : 'Grafik'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-gray-500">
          <input type="checkbox" checked={zamanDamgasi} onChange={(e) => setZamanDamgasi(e.target.checked)} />
          Zaman damgası
        </label>
        <label className="flex items-center gap-1 text-gray-500">
          <input type="checkbox" checked={otoKaydirma} onChange={(e) => setOtoKaydirma(e.target.checked)} />
          Oto kaydır
        </label>
        <label className="flex items-center gap-1 text-gray-500">
          <input type="checkbox" checked={bootloaderGizle} onChange={(e) => setBootloaderGizle(e.target.checked)} />
          Bootloader gizle
        </label>
        <button
          onClick={() => clearSerial(aktifSekme === 'hepsi' ? undefined : aktifSekme)}
          className="rounded border border-panel-border px-2 py-0.5 text-gray-400 hover:bg-panel-border"
        >
          Temizle
        </button>
        {durum.open && (
          <button
            onClick={() => void disconnectSerial(hedefPort ?? undefined)}
            disabled={durum.temporarilyClosedForUpload}
            className="rounded border border-red-700 px-2 py-0.5 text-red-300 hover:enabled:bg-red-950 disabled:opacity-50"
          >
            {portlar.length > 1 ? `${kisaAd(hedefPort ?? '')} kes` : 'Kes'}
          </button>
        )}
        <button
          onClick={() => void connectSerial()}
          disabled={durum.temporarilyClosedForUpload}
          title={durum.open ? 'Üst çubukta seçili portu da bağla (diğer bağlantılar açık kalır)' : undefined}
          className="rounded border border-accent px-2 py-0.5 text-accent-hover hover:enabled:bg-accent/20 disabled:opacity-50"
        >
          {durum.open ? 'Port ekle' : 'Bağlan'}
        </button>
      </div>

      {portlar.length > 1 && (
        <div role="tablist" aria-label="Seri portlar" className="flex shrink-0 items-center gap-1 border-b border-panel-border px-2 py-1">
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
                {id === 'hepsi' ? 'Tümü' : `${kisaAd(id)} @ ${portlar[sira].baud}`}
              </button>
            )
          })}
        </div>
      )}

      {gorunum === 'grafik' ? (
        <div className="min-h-0 flex-1">
          <SerialPlotter satirlar={gorunurSatirlarMetin} />
        </div>
      ) : (
      <div ref={kaydirmaRef} onScroll={kaydirmaDegisti} className="flex-1 overflow-auto p-1.5 font-mono">
        {gorunurSatirlar.length === 0 && (
          <p className="text-gray-600">
            {durum.open ? 'Veri bekleniyor...' : "Bağlanmak için üst çubuktan bir port seçip 'Bağlan'a tıklayın."}
          </p>
        )}
        {gorunurSatirlar.length > 0 && (
          <div style={{ height: toplamYukseklik, position: 'relative' }}>
            {gorunenDilim.map((satir, i) => {
              const bootloaderMu = BOOTLOADER_DESENI.test(satir.text)
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
                  className={`whitespace-nowrap ${bootloaderMu ? 'text-gray-600' : 'text-gray-300'}`}
                >
                  {zamanDamgasi && (
                    <span className="mr-2 text-gray-600">
                      {new Date(satir.timestamp).toLocaleTimeString('tr-TR')}
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
      )}

      <div className="flex shrink-0 items-center gap-1.5 border-t border-panel-border p-1.5">
        <input
          value={mesaj}
          onChange={(e) => setMesaj(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && gonder()}
          disabled={!durum.open}
          placeholder={durum.open ? 'Gönderilecek veri...' : 'Bağlanmadan veri gönderilemez'}
          className="flex-1 rounded border border-panel-border bg-panel px-2 py-1 text-gray-200 outline-none disabled:opacity-50"
        />
        <select
          value={satirSonu}
          onChange={(e) => setSatirSonu(e.target.value as LineEnding)}
          className="rounded border border-panel-border bg-panel px-1 py-1 text-gray-300"
        >
          <option value="none">Satır sonu yok</option>
          <option value="nl">NL</option>
          <option value="cr">CR</option>
          <option value="nlcr">NL+CR</option>
        </select>
        <button
          onClick={gonder}
          disabled={!durum.open}
          className="rounded border border-panel-border bg-panel px-2 py-1 text-gray-300 hover:enabled:bg-panel-border disabled:opacity-50"
        >
          Gönder
        </button>
      </div>
    </div>
  )
}

export default SerialMonitor
