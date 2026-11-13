import { useMemo, type ReactElement } from 'react'
import { OZELLIK_ADI, pinHaritasi, type HaritaPini, type PinOzellik } from '@shared/pinHaritasi'
import { useAppState } from '../../state/AppStateContext'
import type { PinDenetimSonucu } from '../../hooks/usePinSorunlari'

const TUR_RENGI = { error: 'text-red-400', warning: 'text-amber-400', note: 'text-sky-400' } as const
const TUR_ETIKETI = { error: 'Hata', warning: 'Uyarı', note: 'Not' } as const

/** Özellik rengi (aynı renkler lejantta da kullanılır). Mor kullanılmaz. */
const OZELLIK_RENGI: Record<PinOzellik, string> = {
  pwm: '#4fb3f0',
  adc: '#f0a24f',
  dac: '#e0794f',
  kesme: '#e86a8a',
  i2c: '#4fd1c5',
  spi: '#c9b24f',
  uart: '#a3b1c2',
  dokunmatik: '#5fd68a',
  'sadece-giris': '#8a94a3',
  flash: '#e5484d',
  strapping: '#f0a24f'
}
/** Lejantta gösterilecek, çip üzerinde nokta olarak çizilen özellikler */
const NOKTA_OZELLIKLERI: PinOzellik[] = ['pwm', 'adc', 'dac', 'kesme', 'i2c', 'spi', 'uart', 'dokunmatik']

function PinCipi({ pin, kullanim }: { pin: HaritaPini; kullanim?: string[] }): ReactElement {
  const flash = pin.ozellikler.includes('flash')
  const kullanildi = Boolean(kullanim)
  const ozet = [
    ...pin.ozellikler.map((o) => OZELLIK_ADI[o]),
    ...(pin.not ? [pin.not] : []),
    ...(kullanim ? [`Kodda: ${kullanim.join(', ')}`] : [])
  ].join(' · ')
  return (
    <div
      title={`${pin.etiket}${ozet ? ` — ${ozet}` : ''}`}
      className={`flex min-w-[46px] flex-col items-center rounded-[5px] border px-1.5 py-1 ${
        flash ? 'border-red-500/30 bg-red-500/[0.06] opacity-60' : kullanildi ? 'border-accent bg-accent/[0.14]' : 'border-panel-border bg-panel-light'
      }`}
    >
      <span className={`font-mono text-[10.5px] leading-tight ${flash ? 'text-red-300 line-through' : kullanildi ? 'text-white' : 'text-gray-300'}`}>{pin.etiket}</span>
      <span className="mt-1 flex h-1.5 items-center gap-[3px]">
        {NOKTA_OZELLIKLERI.filter((o) => pin.ozellikler.includes(o)).map((o) => (
          <span key={o} className="h-1.5 w-1.5 rounded-full" style={{ background: OZELLIK_RENGI[o] }} />
        ))}
        {pin.ozellikler.includes('sadece-giris') && <span className="font-mono text-[8px] leading-none text-gray-500">G</span>}
        {pin.ozellikler.includes('strapping') && <span className="text-[8px] leading-none text-amber-400">!</span>}
      </span>
    </div>
  )
}

function dosyaAdi(yol: string): string {
  return yol.split(/[\\/]/).pop() ?? yol
}

/**
 * Alt panelin "Pin denetimi" sekmesi: kodda kullanılan pinlerin özeti ve seçili karta göre bulunan sorunlar.
 * Sorun olmasa bile durum görünür, böylece denetimin çalıştığı anlaşılır.
 */
function PinPanel({ sonuc }: { sonuc: PinDenetimSonucu }): ReactElement {
  const { state, requestReveal } = useAppState()
  const fqbn = state.arduinoCli.selectedFqbn
  const { sorunlar, ozet, hazir, dosyaSayisi } = sonuc
  const harita = useMemo(() => pinHaritasi(fqbn), [fqbn])
  const kullanimHaritasi = useMemo(() => new Map(ozet.kullanimlar.map((k) => [k.pin, k.roller])), [ozet.kullanimlar])

  if (!state.sketch.info && state.sketch.workspaceSketches.length === 0) {
    return <p className="p-3 text-xs text-gray-500">Pin denetimi için önce bir proje açın.</p>
  }
  if (!hazir) return <p className="p-3 text-xs text-gray-500">Denetleniyor...</p>

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden text-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-panel-border px-3 py-2 text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${sorunlar.some((s) => s.tur === 'error') ? 'bg-red-400' : sorunlar.length ? 'bg-amber-400' : 'bg-[#3ddc84]'}`} aria-hidden="true" />
          {sorunlar.length === 0 ? 'Sorun bulunamadı' : `${sorunlar.length} bulgu`}
        </span>
        <span>{dosyaSayisi} dosya tarandı</span>
        <span>
          Kart:{' '}
          <span className="text-gray-200">
            {fqbn ? (ozet.kartAdi ?? `${fqbn} (özel kural yok, yalnızca genel kontroller)`) : 'seçilmedi'}
          </span>
        </span>
      </div>

      {!fqbn && (
        <p className="border-b border-panel-border px-3 py-2 text-amber-300/90">
          Kart seçilmediği için kartın pin kuralları uygulanamıyor. Üst çubuktan bir kart seçin; Uno/Nano/Mega, ESP32 ve ESP8266 için ayrıntılı denetim yapılır.
        </p>
      )}

      {sorunlar.map((s, i) => (
        <button
          key={i}
          onClick={() => void requestReveal(s.dosya, s.satir)}
          className="flex w-full items-start gap-2 border-b border-panel-border px-3 py-1.5 text-left hover:bg-panel-border/50"
        >
          <span className={`w-9 shrink-0 font-semibold ${TUR_RENGI[s.tur]}`}>{TUR_ETIKETI[s.tur]}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-gray-300 [overflow-wrap:anywhere]">{s.mesaj}</span>
            <span className="block truncate text-gray-500">
              {dosyaAdi(s.dosya)}:{s.satir}
            </span>
          </span>
        </button>
      ))}

      <div className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-gray-500">
        Kart pin haritası{harita ? ` · ${harita.kartAdi}` : ''}
      </div>
      {harita ? (
        <div className="px-3 pb-3">
          {harita.gruplar.map((g) => (
            <div key={g.ad} className="mb-2">
              {harita.gruplar.length > 1 && <div className="mb-1 text-[11px] text-gray-500">{g.ad}</div>}
              <div className="flex flex-wrap gap-1">
                {g.pinler.map((p) => (
                  <PinCipi key={p.numara} pin={p} kullanim={kullanimHaritasi.get(p.numara)} />
                ))}
              </div>
            </div>
          ))}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-gray-500">
            {NOKTA_OZELLIKLERI.filter((o) => harita.gruplar.some((g) => g.pinler.some((p) => p.ozellikler.includes(o)))).map((o) => (
              <span key={o} className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: OZELLIK_RENGI[o] }} />
                {OZELLIK_ADI[o]}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="font-mono text-[9px]">G</span> yalnızca giriş
            </span>
            <span className="flex items-center gap-1">
              <span className="text-[10px] text-amber-400">!</span> önyükleme pini
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-[3px] border border-accent bg-accent/[0.14]" /> kodda kullanılıyor
            </span>
          </div>
          <p className="mt-1.5 text-[10.5px] text-gray-600">Ayrıntı için bir pinin üzerine gelin.</p>
        </div>
      ) : (
        <p className="px-3 pb-3 text-gray-500">
          {fqbn
            ? 'Bu kart için pin haritası henüz yok. Haritalar Arduino Uno/Nano/Mega, ESP32 ve ESP8266 için hazır.'
            : 'Pin haritasını görmek için üst çubuktan bir kart seçin.'}
        </p>
      )}

      <div className="px-3 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">Kodda kullanılan pinler</div>
      {ozet.kullanimlar.length === 0 ? (
        <p className="px-3 pb-3 text-gray-500">
          Sayıya çözülebilen pin kullanımı bulunamadı (pinMode, digitalWrite, analogRead, Servo.attach vb.). Pin numarası değişkenle
          hesaplanıyorsa denetlenemez.
        </p>
      ) : (
        <table className="mb-3 w-full table-fixed">
          <tbody>
            {ozet.kullanimlar.map((k) => (
              <tr key={k.pin} className="cursor-pointer hover:bg-panel-border/50" onClick={() => void requestReveal(k.dosya, k.satir)}>
                <td className="w-16 px-3 py-1 font-mono text-gray-200 [overflow-wrap:anywhere]">{k.pin}</td>
                <td className="py-1 text-gray-400 [overflow-wrap:anywhere]">{k.roller.join(', ')}</td>
                <td className="w-32 px-3 py-1 text-right font-mono text-[10.5px] text-gray-500 [overflow-wrap:anywhere]">
                  {dosyaAdi(k.dosya)}:{k.satir}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default PinPanel
