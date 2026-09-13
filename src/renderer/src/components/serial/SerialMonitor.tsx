import { useEffect, useMemo, useRef, useState, type ReactElement, type UIEvent } from 'react'
import type { LineEnding } from '@shared/types'
import { useAppState } from '../../state/AppStateContext'

/** ESP32/ESP8266 önyükleyici (bootloader) çıktısına ait yaygın satır kalıpları (en iyi çaba, kesin değil) */
const BOOTLOADER_DESENI = /^(rst:|ets |load:|entry |ho \d|configsip:|clk_drv:|mode:|invalid header|waiting for download)/i

/** Her satır sabit yükseklikte tutulur (sanal liste hesaplarının basit kalması için satırlar kaydırılmaz) */
const SATIR_YUKSEKLIGI = 18
/** Görünür alanın dışında ekstra render edilen satır sayısı (hızlı kaydırmada beyaz an yaşanmasın diye) */
const ASIRI_RENDER = 15

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
  const [scrollTop, setScrollTop] = useState(0)
  const [containerYuksekligi, setContainerYuksekligi] = useState(240)
  const kaydirmaRef = useRef<HTMLDivElement>(null)

  const durum = state.serial.status

  const gorunurSatirlar = useMemo(
    () => state.serial.lines.filter((s) => !(bootloaderGizle && BOOTLOADER_DESENI.test(s.text))),
    [state.serial.lines, bootloaderGizle]
  )

  useEffect(() => {
    const el = kaydirmaRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const yukseklik = entries[0]?.contentRect.height
      if (yukseklik) setContainerYuksekligi(yukseklik)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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
    void writeSerial(mesaj, satirSonu)
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
              ? `Bağlı: ${durum.port} @ ${durum.baud}`
              : durum.temporarilyClosedForUpload
                ? 'Yükleme için geçici kapatıldı...'
                : 'Bağlı değil'}
          </span>
        </span>
        <div className="flex-1" />
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
          onClick={clearSerial}
          className="rounded border border-panel-border px-2 py-0.5 text-gray-400 hover:bg-panel-border"
        >
          Temizle
        </button>
        <button
          onClick={() => (durum.open ? void disconnectSerial() : void connectSerial())}
          disabled={durum.temporarilyClosedForUpload}
          className={`rounded border px-2 py-0.5 disabled:opacity-50 ${
            durum.open
              ? 'border-red-700 text-red-300 hover:enabled:bg-red-950'
              : 'border-accent text-accent-hover hover:enabled:bg-accent/20'
          }`}
        >
          {durum.open ? 'Kes' : 'Bağlan'}
        </button>
      </div>

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
                  {satir.text}
                </div>
              )
            })}
          </div>
        )}
      </div>

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
