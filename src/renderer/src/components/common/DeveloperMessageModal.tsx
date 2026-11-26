import { useEffect, useState, type CSSProperties, type ReactElement } from 'react'
import cloudIcon from '../../assets/icon.png'
import { surumAdiBul } from '@shared/surumAdlari'
import { useT } from '../../i18n'

interface DeveloperMessageModalProps {
  onClose: () => void
}

interface SocialLink {
  id: string
  name: string
  url: string
  label: string
  /** Üzerine gelince kullanılan marka rengi */
  renk: string
  icon: () => ReactElement
}

/**
 * Geliştirici iletişim kanalları.
 * Buradaki bağlantıları ve kullanıcı adlarını dilediğiniz gibi güncelleyebilirsiniz.
 */
const SOSYAL_MEDYA_BAGLANTILARI: SocialLink[] = [
  { id: 'github', name: 'GitHub', url: 'https://github.com/efealibozkurt/Cloud-IDE', label: 'efealibozkurt/Cloud-IDE', renk: '#f0f3f6', icon: GithubIcon },
  { id: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com/in/efealibozkurt', label: 'Efe Ali Bozkurt', renk: '#58a6ff', icon: LinkedinIcon },
  { id: 'twitter', name: 'X', url: 'https://x.com/EfeAliBozkurt_', label: '@EfeAliBozkurt_', renk: '#8ad4ff', icon: XTwitterIcon },
  { id: 'instagram', name: 'Instagram', url: 'https://instagram.com/efealibozkurt', label: '@efealibozkurt', renk: '#ff7ab2', icon: InstagramIcon },
  { id: 'youtube', name: 'YouTube', url: 'https://youtube.com/@efealibozkurt', label: '@efealibozkurt', renk: '#ff6b6b', icon: YoutubeIcon },
  { id: 'website', name: 'Web sitesi', url: 'https://efealibozkurt.com.tr', label: 'efealibozkurt.com.tr', renk: '#8ad4ff', icon: GlobeIcon }
]

export const DEVELOPER_MESSAGE_STORAGE_KEY = 'cloud_ide_hide_developer_modal'

/** Mektup bölümü için okunaklı, sıcak bir serif yazı tipi (ek yazı tipi yüklemeden) */
const MEKTUP_YAZISI: CSSProperties = { fontFamily: "Georgia, 'Palatino Linotype', 'Book Antiqua', Cambria, serif" }

/**
 * Açılışta gösterilen geliştirici notu. Solda kim olduğunu ve ulaşım yollarını,
 * sağda kısa bir mektubu ve sürüm durumunu gösterir.
 */
function DeveloperMessageModal({ onClose }: DeveloperMessageModalProps): ReactElement {
  const t = useT()
  const [birDahaGosterme, setBirDahaGosterme] = useState(false)
  const [surum, setSurum] = useState('0.1.8')
  useEffect(() => {
    window.api.app.getVersion().then(setSurum).catch(() => undefined)
  }, [])

  const kapat = (): void => {
    if (birDahaGosterme) {
      try {
        localStorage.setItem(DEVELOPER_MESSAGE_STORAGE_KEY, 'true')
      } catch {
        // depolama kapalıysa tercih kaydedilemez; pencere yine de kapanır
      }
    }
    onClose()
  }

  // ESC ile kapat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') kapat()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birDahaGosterme])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) kapat()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gelistirici-notu-baslik"
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-panel-border bg-panel-light text-gray-200 shadow-2xl"
      >
        <button
          onClick={kapat}
          title={t('Kapat (Esc)')}
          aria-label={t('Kapat')}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
        >
          <CloseIcon />
        </button>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Sol şerit: kim olduğu ve ulaşım yolları */}
          <aside className="shrink-0 border-b border-white/[0.07] bg-[#0f1117] p-6 sm:w-60 sm:border-b-0 sm:border-r">
            <div className="flex items-center gap-3 sm:block">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-panel-border bg-panel">
                <img src={cloudIcon} alt="Cloud IDE" className="h-10 w-10 object-contain" />
              </span>
              <div className="sm:mt-4">
                <p className="text-[17px] leading-tight text-white" style={MEKTUP_YAZISI}>
                  Efe Ali Bozkurt
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{t('Cloud IDE’nin yapımcısı')}</p>
              </div>
            </div>

            <p
              className="mt-5 inline-block -rotate-2 rounded border border-dashed border-amber-400/50 px-2.5 py-1 font-mono text-[11px] tracking-wide text-amber-300"
              title={t('Uygulamanın şu anki sürümü')}
            >
              v{surum} · {surumAdiBul(surum).ad} · beta
            </p>

            <ul className="mt-6 hidden space-y-0.5 sm:block">
              {SOSYAL_MEDYA_BAGLANTILARI.map((b) => {
                const Ikon = b.icon
                return (
                  <li key={b.id}>
                    <button
                      onClick={() => window.open(b.url, '_blank')}
                      title={`${b.name}: ${b.label}`}
                      style={{ ['--marka' as string]: b.renk }}
                      className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-gray-500 transition-colors hover:bg-white/[0.05] hover:text-[color:var(--marka)]"
                    >
                      <Ikon />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-gray-300 group-hover:text-white">{t(b.name)}</span>
                        <span className="block truncate text-[11px] text-gray-600">{b.label}</span>
                      </span>
                      <ArrowUpRightIcon className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>

          {/* Sağ taraf: mektup ve sürüm durumu */}
          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-7">
            <h2 id="gelistirici-notu-baslik" className="text-[26px] leading-tight text-white" style={MEKTUP_YAZISI}>
              {t('Merhaba,')}
            </h2>

            <div className="mt-4 max-w-[58ch] space-y-4 text-[15px] leading-[1.75] text-gray-300" style={MEKTUP_YAZISI}>
              <p>
                {t('Yapay zekâ sayesinde artık kodlama ve gömülü sistem bilmeyen insanların da aklındaki fiziksel projeleri yapabileceğine inanıyorum. Cloud IDE’yi bu düşünceyle geliştirdim: donanım ve yazılım önündeki teknik engellerin kalkması için.')}
              </p>
              <p>
                {t('Fikir geçen yıldan kalma, ama uygulamanın kendisi son bir ayın yoğun çalışmasıyla çıktı. Bu sürümde kendi içinde gelen derleyici, kartınızı tanıyan bir yapay zekâ asistanı ve kütüphane bilginizi tarayan yerel bir bilgi tabanı var.')}
              </p>
              <blockquote className="border-l-2 border-amber-400/70 py-0.5 pl-4 text-[17px] italic text-gray-100">
                {t('Yapay zekâ ile artık her şeyi yapabilirsiniz, ama en önemli olan şey hâlâ sizin yönlendirmeniz ve özgünlüğünüz.')}
              </blockquote>
              <p>{t('İyi kullanmalar. Geri bildirimleriniz bir sonraki sürümleri şekillendiriyor.')}</p>
            </div>

            <p className="mt-5 text-[22px] italic text-amber-300" style={MEKTUP_YAZISI}>
              — Efe
            </p>

            {/* Sürüm durumu: zaman çizgisi (şimdi → sırada) */}
            <div className="mt-8 border-t border-white/[0.07] pt-5">
              <h3 className="text-xs font-semibold text-gray-400">{t('Sürüm durumu')}</h3>
              <ol className="relative mt-3 space-y-4 pl-6 before:absolute before:bottom-1 before:left-[5px] before:top-1.5 before:w-px before:bg-white/15">
                <li className="relative">
                  <span className="absolute -left-6 top-1 h-[11px] w-[11px] rounded-full border-2 border-emerald-400 bg-[#14161d]" />
                  <p className="text-xs font-semibold text-emerald-300">{t('Şimdi')}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-400">
                    {t('Yerleşik Arduino CLI, çoklu yapay zekâ sağlayıcısı (Gemini, OpenAI, Claude, DeepSeek, Kimi, NVIDIA, Ollama, LM Studio), kod düzenleyip derleyebilen asistan ve yerel bilgi tabanı.')}
                  </p>
                </li>
                <li className="relative">
                  <span className="absolute -left-6 top-1 h-[11px] w-[11px] rounded-full border-2 border-dashed border-gray-500 bg-[#14161d]" />
                  <p className="text-xs font-semibold text-gray-300">{t('Sırada')}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-400">
                    {t('Devre şemasından pin bağlantılarına ve donanım testine kadar uçtan uca yapay zekâ destekli geliştirme modu.')}
                  </p>
                </li>
              </ol>
            </div>

            {/* Dar pencerede sol şerit bağlantıları gizlenir; burada kısa liste gösterilir */}
            <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-xs sm:hidden">
              {SOSYAL_MEDYA_BAGLANTILARI.map((b) => (
                <li key={b.id}>
                  <button onClick={() => window.open(b.url, '_blank')} className="text-gray-400 underline-offset-2 hover:text-white hover:underline">
                    {t(b.name)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/[0.07] bg-[#0f1117] px-6 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-500 hover:text-gray-300">
            <input
              type="checkbox"
              checked={birDahaGosterme}
              onChange={(e) => setBirDahaGosterme(e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer accent-amber-400"
            />
            {t('Açılışta bir daha gösterme')}
          </label>
          <button
            onClick={kapat}
            className="rounded-lg bg-amber-400 px-5 py-2 text-xs font-semibold text-[#1a1405] transition-colors hover:bg-amber-300 active:scale-[0.98]"
          >
            {t('Başlayalım')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ArrowUpRightIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Vektörel İkonlar
// ─────────────────────────────────────────────────────────────────────────────

function CloseIcon(): ReactElement {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function GithubIcon(): ReactElement {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

function LinkedinIcon(): ReactElement {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  )
}

function XTwitterIcon(): ReactElement {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function InstagramIcon(): ReactElement {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

function YoutubeIcon(): ReactElement {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55a3.016 3.016 0 0 0-2.122 2.136C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.55 9.376.55 9.376.55s7.505 0 9.377-.55a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

function GlobeIcon(): ReactElement {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

export default DeveloperMessageModal
