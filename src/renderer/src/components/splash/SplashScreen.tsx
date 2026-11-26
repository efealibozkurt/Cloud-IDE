import { useEffect, useState, type ReactElement } from 'react'
import { surumAdiBul } from '@shared/surumAdlari'
import cloudIcon from '../../assets/icon.png'
import { useT } from '../../i18n'

/** Kapanış geçişi (ms) — aşağıdaki `duration-500` sınıfıyla eşleşmeli */
const KAPANIS_SURESI_MS = 500
/** LED yandıktan sonra, kapanış başlamadan önceki kısa bekleme */
const SON_BEKLEME_MS = 420
const PIN_ARALIGI_MS = 170

/** Çipin on pini: bacağın yeri ve ondan çıkan kablo yolu. LED, `LED_PINI` numaralı pine bağlıdır. */
const PINLER: Array<{ x: number; y: number; yol: string; uc?: [number, number] }> = [
  { x: 248, y: 108, yol: 'M248 108 H190 L160 78 H90', uc: [90, 78] },
  { x: 248, y: 129, yol: 'M248 129 H120', uc: [120, 129] },
  { x: 248, y: 150, yol: 'M248 150 H100', uc: [100, 150] },
  { x: 248, y: 171, yol: 'M248 171 H130 L105 196 H70', uc: [70, 196] },
  { x: 248, y: 192, yol: 'M248 192 H196 L166 222 H110', uc: [110, 222] },
  { x: 392, y: 108, yol: 'M392 108 H450 L480 78 H550', uc: [550, 78] },
  { x: 392, y: 129, yol: 'M392 129 H520', uc: [520, 129] },
  { x: 392, y: 150, yol: 'M392 150 H531' },
  { x: 392, y: 171, yol: 'M392 171 H500 L525 196 H570', uc: [570, 196] },
  { x: 392, y: 192, yol: 'M392 192 H444 L474 222 H530', uc: [530, 222] }
]
const LED_PINI = 7
/** Pinlerin yanma sırası; LED'in pini en sona kalır */
const YANMA_SIRASI = [0, 1, 2, 3, 4, 9, 8, 6, 5, LED_PINI]

const DURUMLAR = ['Derleyici hazırlanıyor', 'Kartlar ve portlar taranıyor', 'Ayarlar ve proje geçmişi yükleniyor', 'Arayüz başlatılıyor']

interface SplashScreenProps {
  /** true olunca kalan pinler tamamlanır ve ekran kapanmaya başlar */
  hazir: boolean
  onTamamlandi: () => void
  surum?: string
}

/**
 * Açılış ekranı. Uygulama penceresi açıldığı anda tam opak olarak görünür (arkadaki arayüz
 * hiçbir zaman görünmez). Ortadaki çipin pinleri sırayla yanıp kablolara akım verir; yükleme
 * bitince son kablo D13 LED'ini yakar ve ekran kısa bir geçişle kapanır.
 */
function SplashScreen({ hazir, onTamamlandi, surum }: SplashScreenProps): ReactElement {
  const t = useT()
  const [yanan, setYanan] = useState(0)
  const [basladi, setBasladi] = useState(false)
  const [kapaniyor, setKapaniyor] = useState(false)
  const tamam = yanan >= YANMA_SIRASI.length

  // İlk kareden sonra logo belirsin
  useEffect(() => {
    const kare = requestAnimationFrame(() => setBasladi(true))
    return () => cancelAnimationFrame(kare)
  }, [])

  // Pinler sırayla yanar. Son pin (LED) yükleme bitmeden yanmaz; erken bittiyse kalanlar hızlanır
  useEffect(() => {
    if (tamam || (!hazir && yanan >= YANMA_SIRASI.length - 1)) return
    const zamanlayici = setTimeout(() => setYanan((y) => y + 1), hazir ? 70 : PIN_ARALIGI_MS)
    return () => clearTimeout(zamanlayici)
  }, [yanan, hazir, tamam])

  useEffect(() => {
    if (!tamam) return
    const baslat = setTimeout(() => setKapaniyor(true), SON_BEKLEME_MS)
    return () => clearTimeout(baslat)
  }, [tamam])

  useEffect(() => {
    if (!kapaniyor) return
    const bitir = setTimeout(onTamamlandi, KAPANIS_SURESI_MS)
    return () => clearTimeout(bitir)
  }, [kapaniyor, onTamamlandi])

  const yananPinler = new Set(YANMA_SIRASI.slice(0, yanan))
  const durum = tamam ? 'Hazır' : DURUMLAR[Math.min(DURUMLAR.length - 1, Math.floor((yanan / YANMA_SIRASI.length) * DURUMLAR.length))]

  return (
    <div
      role="status"
      aria-label={t('Cloud IDE başlatılıyor')}
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-panel transition-opacity duration-500 ease-out ${
        kapaniyor ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <svg viewBox="40 55 560 190" className="w-[560px] max-w-[92vw] select-none" aria-hidden="true">
        {PINLER.map((p, i) => (
          <g key={p.yol} fill="none" strokeWidth="2">
            <path d={p.yol} stroke="#333337" />
            {p.uc && <circle cx={p.uc[0]} cy={p.uc[1]} r="3" fill={yananPinler.has(i) ? '#4fb3f0' : '#333337'} className="transition-colors delay-300" />}
            {/* Akım: kablo boyunca dolan çizgi */}
            <path
              d={p.yol}
              stroke="#4fb3f0"
              pathLength={100}
              strokeDasharray={100}
              strokeDashoffset={yananPinler.has(i) ? 0 : 100}
              className="transition-[stroke-dashoffset] duration-300 ease-linear motion-reduce:transition-none"
            />
          </g>
        ))}
        {PINLER.map((p, i) => (
          <rect key={`pin-${p.y}-${p.x}`} x={p.x} y={p.y - 4} width="12" height="8" rx="2" fill={yananPinler.has(i) ? '#4fb3f0' : '#55555c'} />
        ))}

        <rect x="260" y="90" width="120" height="120" rx="10" fill="#2a2a2d" stroke="#4a4a52" />
        <circle cx="272" cy="102" r="3" fill="#55555c" />
        <image
          href={cloudIcon}
          x="285"
          y="115"
          width="70"
          height="70"
          className={`transition-opacity duration-700 motion-reduce:transition-none ${basladi ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* D13 LED'i: her Arduino kullanıcısının ilk projesi */}
        <circle cx="540" cy="150" r="16" fill="#3ddc84" className={`transition-opacity duration-300 delay-300 ${tamam ? 'opacity-20' : 'opacity-0'}`} />
        <circle cx="540" cy="150" r="9" fill={tamam ? '#3ddc84' : '#333337'} className="transition-colors delay-300" />
        <text x="540" y="178" fill="#6f6f76" fontSize="11" textAnchor="middle" className="font-mono">
          D13
        </text>
      </svg>

      <p className="mt-6 select-none text-2xl">
        <span className="font-bold tracking-tight text-white">Cloud</span>
        <span className="ml-1.5 font-light tracking-wider text-[#7cc4f0]">IDE</span>
      </p>
      <p className="mt-3 h-4 font-mono text-[12px] text-gray-400" aria-live="polite">
        {t(durum)}
      </p>

      <p className="absolute bottom-7 text-[11.5px] text-gray-600">
        {t('Efe Ali Bozkurt tarafından geliştirildi')}
        {surum ? `, v${surum} ${surumAdiBul(surum).ad} (beta)` : ''}
      </p>
    </div>
  )
}

export default SplashScreen
