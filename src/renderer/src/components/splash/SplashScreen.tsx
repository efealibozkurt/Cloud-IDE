import { useEffect, useState, type ReactElement } from 'react'
import '@fontsource/bricolage-grotesque/600.css'
import beyazCloudIde from '../../assets/beyaz_cloud_ide.png'

/** Fade-in/fade-out geçiş süresi (ms) — aşağıdaki `duration-[700ms]` sınıfıyla birebir eşleşmeli */
const GECIS_SURESI_MS = 700

interface SplashScreenProps {
  /** true olunca fade-out başlar; geçiş bitince onTamamlandi çağrılır */
  hazir: boolean
  onTamamlandi: () => void
}

/** Dekoratif, sabit konumlu küçük "yıldız" noktaları (bkz. içe aktarılan tasarım) */
const YILDIZLAR = [
  { top: '14%', left: '18%', size: 3, opacity: 0.7, glow: true },
  { top: '22%', left: '78%', size: 2, opacity: 0.5, glow: false },
  { top: '32%', left: '8%', size: 2, opacity: 0.6, glow: false },
  { top: '12%', left: '52%', size: 2, opacity: 0.4, glow: false },
  { top: '68%', left: '15%', size: 3, opacity: 0.6, glow: true },
  { top: '76%', left: '85%', size: 2, opacity: 0.5, glow: false },
  { top: '60%', left: '92%', size: 2, opacity: 0.4, glow: false },
  { top: '85%', left: '40%', size: 2, opacity: 0.35, glow: false },
  { top: '8%', left: '32%', size: 2, opacity: 0.45, glow: false },
  { top: '45%', left: '5%', size: 2, opacity: 0.4, glow: false },
  { top: '38%', left: '95%', size: 3, opacity: 0.55, glow: true },
  { top: '90%', left: '70%', size: 2, opacity: 0.4, glow: false }
] as const

/**
 * Açılış (splash) ekranı — uygulama ilk açıldığında `AppShell` üzerinde
 * kaplar, arka planda gerçek arayüz zaten yükleniyor/hazırlanıyor olur.
 * `hazir` prop'u (AppStateContext'teki `state.ready` + asgari görünme
 * süresinin ikisi birden sağlanınca) true olunca fade-out başlar; geçiş
 * bitince `onTamamlandi` ile üst bileşen bu bileşeni DOM'dan kaldırır.
 * Görsel tasarım claude.ai/design'dan içe aktarılan mockup'a sadık kalır
 * (Satürn halkası benzeri çift-yarım elips efekti, yıldızlar, nokta ızgara).
 */
function SplashScreen({ hazir, onTamamlandi }: SplashScreenProps): ReactElement {
  const [gorunur, setGorunur] = useState(false)

  // Mount olduğunda: önce gizli (opacity-0) boyanır, ardından görünür hâle
  // geçilir ki tarayıcı fade-in'i gerçekten animasyonlasın (bkz. AIModeScreen'deki
  // aynı çift-rAF deseni).
  useEffect(() => {
    const ilkKare = requestAnimationFrame(() => {
      const ikinciKare = requestAnimationFrame(() => setGorunur(true))
      return () => cancelAnimationFrame(ikinciKare)
    })
    return () => cancelAnimationFrame(ilkKare)
  }, [])

  useEffect(() => {
    if (!hazir) return
    setGorunur(false)
    const zamanlayici = setTimeout(onTamamlandi, GECIS_SURESI_MS)
    return () => clearTimeout(zamanlayici)
  }, [hazir, onTamamlandi])

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-[#05050a] transition-opacity duration-[700ms] ease-in-out ${
        gorunur ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Nokta ızgara arka plan */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
          maskImage: 'radial-gradient(ellipse 55% 45% at 50% 45%, black 0%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 55% 45% at 50% 45%, black 0%, transparent 75%)'
        }}
      />

      {/* Dekoratif yıldızlar */}
      {YILDIZLAR.map((y, i) => (
        <div
          key={i}
          className="pointer-events-none absolute rounded-full bg-white"
          style={{
            top: y.top,
            left: y.left,
            width: y.size,
            height: y.size,
            opacity: y.opacity,
            boxShadow: y.glow ? '0 0 4px rgba(255,255,255,0.6)' : undefined
          }}
        />
      ))}

      <div className="relative flex flex-col items-center justify-center">
        {/* Arkadaki yarım halka (üst yarı, metnin ARKASINDAN geçiyor) */}
        <svg
          width="640"
          height="220"
          viewBox="0 0 640 220"
          style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-52%) rotate(-8deg)', overflow: 'visible' }}
          className="pointer-events-none z-0"
        >
          <defs>
            <linearGradient id="ringGradBack" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(180,150,255,0.05)" />
              <stop offset="50%" stopColor="rgba(210,190,255,0.4)" />
              <stop offset="100%" stopColor="rgba(180,150,255,0.05)" />
            </linearGradient>
            <clipPath id="ringClipBack">
              <rect x="0" y="0" width="640" height="112" />
            </clipPath>
          </defs>
          <ellipse cx="320" cy="110" rx="300" ry="92" fill="none" stroke="url(#ringGradBack)" strokeWidth="4" clipPath="url(#ringClipBack)" />
        </svg>

        <div className="relative z-[1] flex items-center justify-center py-2">
          <img
            src={beyazCloudIde}
            alt="Cloud IDE"
            className="h-[clamp(56px,8vw,88px)] w-auto object-contain drop-shadow-[0_4px_24px_rgba(147,165,251,0.4)] select-none"
          />
        </div>

        {/* Öndeki yarım halka (alt yarı, metnin ÖNÜNDEN geçiyor) */}
        <svg
          width="640"
          height="220"
          viewBox="0 0 640 220"
          style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-52%) rotate(-8deg)', overflow: 'visible' }}
          className="pointer-events-none z-[2]"
        >
          <defs>
            <linearGradient id="ringGradFront" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(180,150,255,0.15)" />
              <stop offset="50%" stopColor="rgba(240,230,255,0.9)" />
              <stop offset="100%" stopColor="rgba(180,150,255,0.15)" />
            </linearGradient>
            <clipPath id="ringClipFront">
              <rect x="0" y="108" width="640" height="112" />
            </clipPath>
          </defs>
          <ellipse cx="320" cy="110" rx="300" ry="92" fill="none" stroke="url(#ringGradFront)" strokeWidth="4" clipPath="url(#ringClipFront)" />
        </svg>

        <div className="relative z-[1] mt-5 h-px w-10 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      </div>

      <div className="absolute bottom-8 z-[1] flex items-center gap-2 font-sans text-[12px] tracking-wide text-white/40">
        <span>Geliştirici Efe Ali Bozkurt</span>
        <span className="h-1 w-1 rounded-full bg-white/20" />
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300/80 uppercase">
          BETA v0.1.0
        </span>
      </div>
    </div>
  )
}

export default SplashScreen
