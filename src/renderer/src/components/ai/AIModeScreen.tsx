import { useEffect, useState, type ReactElement } from 'react'
import '@fontsource/bricolage-grotesque/600.css'
import { useToast } from '../../state/ToastContext'

/** Kapanış animasyonunun süresiyle (ms) birebir eşleşmeli — bkz. aşağıdaki `duration-[600ms]` sınıfları */
const GECIS_SURESI_MS = 600

export interface AIModeOrigin {
  x: number
  y: number
}

interface AIModeScreenProps {
  /** Ekranın "doğduğu" nokta (TopBar'daki düğmenin merkezi) — açılış/kapanış animasyonunun transform-origin'i */
  origin: AIModeOrigin | null
  onClose: () => void
}

type YanitModu = 'hizli' | 'kaliteli'

interface Oneri {
  metin: string
  icon: ReactElement
}

/** Arduino/gömülü sistem bağlamına uygun örnek istemler (Deneyap/ESP32 odaklı) */
const ONERILER: Oneri[] = [
  { metin: 'Blink LED örneği oluştur', icon: <BoltIcon /> },
  { metin: 'Bu derleme hatasını açıkla', icon: <BugIcon /> },
  { metin: 'DHT11 sensöründen sıcaklık oku', icon: <ThermometerIcon /> },
  { metin: 'WiFi ile veri gönderen kod yaz', icon: <WifiIcon /> },
  { metin: 'Servo motoru açıyla kontrol et', icon: <ServoIcon /> },
  { metin: 'OLED ekrana metin yazdır', icon: <DisplayIcon /> }
]
/** Kusursuz döngü için içerik iki kez art arda dizilir (bkz. .ai-suggestions-marquee) */
const ONERILER_DONGU = [...ONERILER, ...ONERILER]

/**
 * Tam ekran "AI ile Geliştir" modu. v0.2 için tasarlanan AI agent
 * katmanının önizleme arayüzüdür (bkz. CONTEXT.md). "Gönder"e basmak
 * sahte bir yanıt üretmez; dürüstçe özelliğin henüz gelmediğini bildirir.
 * Görsel tasarım claude.ai/design'dan içe aktarılan mockup'a sadık kalır.
 * Açılış/kapanış, TopBar'daki düğmenin konumundan büyüyüp/küçülen bir
 * `transform: scale()` geçişiyle canlandırılır (bkz. `visible` state'i).
 */
function AIModeScreen({ origin, onClose }: AIModeScreenProps): ReactElement {
  const { toastGoster } = useToast()
  const [mod, setMod] = useState<YanitModu>('kaliteli')
  const [prompt, setPrompt] = useState('')
  const [visible, setVisible] = useState(false)

  // Girişte: önce gizli/küçük halde bir kare boyanır, ardından görünür hâle
  // geçilir ki tarayıcı geçişi gerçekten animasyonlasın (tek rAF'ta stil
  // hemen uygulanıp geçiş atlanabiliyor, bu yüzden iç içe iki rAF kullanılır).
  useEffect(() => {
    const ilkKare = requestAnimationFrame(() => {
      const ikinciKare = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(ikinciKare)
    })
    return () => cancelAnimationFrame(ilkKare)
  }, [])

  const kapat = (): void => {
    setVisible(false)
    setTimeout(onClose, GECIS_SURESI_MS)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') kapat()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const gonder = (): void => {
    if (!prompt.trim()) return
    toastGoster('AI ile geliştirme yakında geliyor. Bu ekran bir önizlemedir.', 'bilgi')
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#08090a] transition-all duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        visible ? 'scale-100 opacity-100' : 'scale-[0.06] opacity-0'
      }`}
      style={{ transformOrigin: origin ? `${origin.x}px ${origin.y}px` : '50% 50%' }}
    >
      {/* Nokta ızgara arka plan */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 38%, black 0%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 38%, black 0%, transparent 75%)'
        }}
      />

      {/* Köşe çerçeve süslemeleri */}
      <div className="pointer-events-none absolute left-[30px] top-[30px] h-[22px] w-[22px] border-l border-t border-white/[0.16]" />
      <div className="pointer-events-none absolute right-[30px] top-[30px] h-[22px] w-[22px] border-r border-t border-white/[0.16]" />
      <div className="pointer-events-none absolute bottom-[30px] left-[30px] h-[22px] w-[22px] border-b border-l border-white/[0.16]" />
      <div className="pointer-events-none absolute bottom-[30px] right-[30px] h-[22px] w-[22px] border-b border-r border-white/[0.16]" />

      {/* Dev, soluk dekoratif ikon */}
      <div className="pointer-events-none absolute right-[-90px] top-1/2 h-[460px] w-[460px] -translate-y-1/2 opacity-[0.07]">
        <QualityGlyph stroke="oklch(0.7 0.16 255)" strokeWidth="0.15" />
      </div>

      {/* Işık efektleri */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-20%] h-[600px] w-[900px] -translate-x-1/2 blur-[60px]"
        style={{ background: 'radial-gradient(circle, oklch(0.55 0.15 255 / 0.35) 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute bottom-[-25%] right-[-10%] h-[700px] w-[700px] blur-[80px]"
        style={{ background: 'radial-gradient(circle, oklch(0.4 0.06 20 / 0.21) 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, transparent 0%, #08090a 75%)' }}
      />

      <button
        onClick={kapat}
        title="Kapat (Esc)"
        className="absolute right-6 top-6 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 backdrop-blur-xl transition-colors hover:bg-white/10 hover:text-white"
      >
        <CloseIcon />
      </button>

      <div className="relative z-[1] flex w-full flex-col items-center gap-6 px-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-300 backdrop-blur-md">
            Full AI Modu · Gelecek Vizyonu
          </span>
          <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 uppercase">
            BETA ÖNİZLEME
          </span>
        </div>

        <h1
          style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
          className="max-w-3xl bg-gradient-to-b from-white to-white/70 bg-clip-text text-center text-[clamp(40px,5.5vw,76px)] font-semibold leading-[1.08] tracking-tight text-transparent"
        >
          Hayalindekini yaz.
        </h1>

        <div className="flex h-[66px] w-[min(680px,90vw)] items-center rounded-full border border-white/10 bg-white/[0.06] px-2 shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          <div className="flex items-center gap-1 pl-1.5">
            <ModToggleButton aktif={mod === 'hizli'} etiket="Hızlı" onClick={() => setMod('hizli')}>
              <BoltIcon />
            </ModToggleButton>
            <ModToggleButton aktif={mod === 'kaliteli'} etiket="Kaliteli" onClick={() => setMod('kaliteli')}>
              <QualityGlyph stroke="currentColor" strokeWidth="1.5" width="19" height="19" />
            </ModToggleButton>
          </div>

          <div className="mx-2.5 h-6 w-px bg-white/10" />

          <input
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') gonder()
            }}
            placeholder="Bir şeyler yaz..."
            className="h-full flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-white/35"
          />

          <button
            onClick={gonder}
            title="Gönder"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-white to-[#d8d8dc] shadow-[0_4px_20px_rgba(255,255,255,0.15)] transition-[filter] hover:brightness-95"
          >
            <ArrowUpIcon />
          </button>
        </div>

        <div
          className="relative w-full max-w-[860px]"
          style={{
            maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)'
          }}
        >
          <div className="ai-suggestions-marquee flex w-max gap-3">
            {ONERILER_DONGU.map(({ metin, icon }, i) => (
              <button
                key={`${metin}-${i}`}
                onClick={() => setPrompt(metin)}
                className="group flex w-[228px] shrink-0 flex-col gap-3.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-white/[0.065] hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#3b82f6]/25 to-[#8b5cf6]/25 text-[#b4c2fb]">
                    {icon}
                  </span>
                  <span className="opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <ArrowUpRightIcon />
                  </span>
                </div>
                <span className="text-[13.5px] leading-snug text-white/80">{metin}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface ModToggleButtonProps {
  aktif: boolean
  etiket: string
  onClick: () => void
  children: ReactElement
}

/** Etkin mod yalnızca ikonla dar bir beyaz kapsül; pasif mod ikon+etiketle geniş, saydam bir kapsül gösterir */
function ModToggleButton({ aktif, etiket, onClick, children }: ModToggleButtonProps): ReactElement {
  return (
    <button
      title={etiket}
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-full text-[13px] font-medium transition-colors ${
        aktif
          ? 'bg-white p-[9px] text-[#0a0a0c]'
          : 'px-3.5 py-[9px] text-white/55 hover:bg-white/10 hover:text-white/85'
      }`}
    >
      {children}
      {!aktif && <span>{etiket}</span>}
    </button>
  )
}

function CloseIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

function BoltIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function BugIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="8" width="10" height="11" rx="5" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2M4 12h3M17 12h3M5 17l2.5-1.5M19 17l-2.5-1.5M5 8l2.5 1.7M19 8l-2.5 1.7" />
    </svg>
  )
}

function ThermometerIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 14.5V5a2 2 0 1 0-4 0v9.5a4 4 0 1 0 4 0Z" />
    </svg>
  )
}

function WifiIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5a11 11 0 0 1 14 0" />
      <path d="M8 16a6.5 6.5 0 0 1 8 0" />
      <path d="M11.5 19.5h1" />
    </svg>
  )
}

function ServoIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 16a8 8 0 0 1 16 0" />
      <path d="M12 16V8" />
      <circle cx="12" cy="16" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

function DisplayIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M7 9h6M7 12.5h10" />
    </svg>
  )
}

function ArrowUpIcon(): ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0a0c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}

function ArrowUpRightIcon(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7M17 7H8M17 7V16" />
    </svg>
  )
}

interface QualityGlyphProps {
  stroke: string
  strokeWidth: string
  width?: string
  height?: string
}

/** "Kaliteli" modun simgesi (bkz. içe aktarılan tasarım); ekranın arka planındaki dev süs ikonu için de kullanılır */
function QualityGlyph({ stroke, strokeWidth, width = '100%', height = '100%' }: QualityGlyphProps): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={width} height={height}>
      <path d="M9.5 3.75a2.75 2.75 0 0 0-2.7 3.25A3 3 0 0 0 5 9.75a3 3 0 0 0 1.15 2.36A2.75 2.75 0 0 0 9 15.75a2.75 2.75 0 0 0 2.75-2.75v-6.5A2.75 2.75 0 0 0 9.5 3.75Z" />
      <path d="M14.5 3.75a2.75 2.75 0 0 1 2.7 3.25A3 3 0 0 1 19 9.75a3 3 0 0 1-1.15 2.36 2.75 2.75 0 0 1-2.85 3.64 2.75 2.75 0 0 1-2.75-2.75v-6.5a2.75 2.75 0 0 1 2.75-2.75Z" />
      <path d="M12 6.5v9" />
    </svg>
  )
}

export default AIModeScreen
