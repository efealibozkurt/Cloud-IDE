import { useEffect, useState, type ReactElement } from 'react'
import cloudIcon from '../../assets/icon.png'

interface DeveloperMessageModalProps {
  onClose: () => void
}

interface SocialLink {
  id: string
  name: string
  url: string
  label: string
  color: string
  borderHover: string
  bgHover: string
  badge?: string
  icon: () => ReactElement
}

/**
 * Geliştirici Sosyal Medya & İletişim Kanalları
 * Buradaki bağlantıları ve kullanıcı adlarını dilediğiniz gibi güncelleyebilirsiniz.
 */
const SOSYAL_MEDYA_BAGLANTILARI: SocialLink[] = [
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://github.com/efealibozkurt/dret-ide',
    label: '@efealibozkurt',
    badge: 'Açık Kaynak',
    color: '#ffffff',
    borderHover: 'hover:border-white/40',
    bgHover: 'hover:bg-white/[0.08]',
    icon: GithubIcon
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/in/efealibozkurt',
    label: 'Efe Ali Bozkurt',
    color: '#0a66c2',
    borderHover: 'hover:border-[#0a66c2]/50',
    bgHover: 'hover:bg-[#0a66c2]/10',
    icon: LinkedinIcon
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    url: 'https://x.com/EfeAliBozkurt_',
    label: '@EfeAliBozkurt_',
    color: '#38bdf8',
    borderHover: 'hover:border-[#38bdf8]/50',
    bgHover: 'hover:bg-[#38bdf8]/10',
    icon: XTwitterIcon
  },
  {
    id: 'instagram',
    name: 'Instagram',
    url: 'https://instagram.com/efealibozkurt',
    label: '@efealibozkurt',
    color: '#e1306c',
    borderHover: 'hover:border-[#e1306c]/50',
    bgHover: 'hover:bg-[#e1306c]/10',
    icon: InstagramIcon
  },
  {
    id: 'youtube',
    name: 'YouTube',
    url: 'https://youtube.com/@efealibozkurt',
    label: '@efealibozkurt',
    color: '#ff0000',
    borderHover: 'hover:border-[#ff0000]/50',
    bgHover: 'hover:bg-[#ff0000]/10',
    icon: YoutubeIcon
  },
  {
    id: 'website',
    name: 'Web Sitesi',
    url: 'https://efealibozkurt.com.tr',
    label: 'efealibozkurt.com.tr',
    color: '#a855f7',
    borderHover: 'hover:border-[#a855f7]/50',
    bgHover: 'hover:bg-[#a855f7]/10',
    icon: GlobeIcon
  }
]

export const DEVELOPER_MESSAGE_STORAGE_KEY = 'cloud_ide_hide_developer_modal'

/**
 * Uygulama açılışında geliştirici notunu, vizyonunu ve sosyal medya
 * bağlantılarını gösteren modern, cam efektli (glassmorphism) karşılama modalı.
 */
function DeveloperMessageModal({ onClose }: DeveloperMessageModalProps): ReactElement {
  const [birDahaGosterme, setBirDahaGosterme] = useState(false)

  // ESC tuşuna basınca modalı kapat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        kapat()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [birDahaGosterme])

  const kapat = (): void => {
    if (birDahaGosterme) {
      localStorage.setItem(DEVELOPER_MESSAGE_STORAGE_KEY, 'true')
    }
    onClose()
  }

  const disBaglantiAc = (url: string): void => {
    window.open(url, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* ── Modal Kartı ── */}
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d0f17]/95 text-gray-200 shadow-[0_0_60px_rgba(0,0,0,0.9),0_0_40px_rgba(99,102,241,0.2)]">
        
        {/* Arka plan siber aurası ve ışıma küreleri */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-[#3b82f6]/25 to-[#8b5cf6]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-gradient-to-tl from-[#ec4899]/20 to-[#8b5cf6]/20 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        />

        {/* ── Üst Başlık Şeridi ── */}
        <div className="relative flex shrink-0 items-start justify-between border-b border-white/10 bg-white/[0.02] p-5 sm:p-6">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-[#1e2235] to-[#121420] p-2 shadow-xl shadow-indigo-500/10">
              <img
                src={cloudIcon}
                alt="Cloud IDE"
                className="h-8 w-8 shrink-0 object-contain drop-shadow-[0_0_8px_rgba(147,165,251,0.6)]"
              />
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-[#0d0f17]">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-indigo-400/30 bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-indigo-300 uppercase">
                  Geliştirici Notu
                </span>
                <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-300 uppercase">
                  BETA
                </span>
                <span className="text-[11px] font-mono text-gray-400">v0.1.0-BETA</span>
              </div>
              <h2 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-white">
                Geliştiriciden Mesaj & Beta Vizyonu
              </h2>
              <p className="text-xs text-gray-400">
                Efe Ali Bozkurt · <span className="text-gray-300 font-medium">Cloud IDE Yaratıcısı</span>
              </p>
            </div>
          </div>

          <button
            onClick={kapat}
            title="Kapat (Esc)"
            className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-gray-400 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <CloseIcon />
          </button>
        </div>

        {/* ── Kaydırılabilir İçerik Alanı ── */}
        <div className="relative flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs sm:text-[13px] leading-relaxed text-gray-300">
          
          {/* Geliştirici Samimi Karşılama & Vizyon Metni */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4 sm:p-5 shadow-inner backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-100 text-sm sm:text-[14.5px]">
                Merhaba! 👋 Ben <span className="font-semibold text-white underline decoration-indigo-400 decoration-2 underline-offset-4">Efe Ali Bozkurt</span>.
              </p>
              <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-300 uppercase">
                BETA SÜRÜMÜ
              </span>
            </div>

            <p className="text-gray-300 leading-relaxed">
              Yapay zekânın geldiği bu yeni çağda artık <strong>AI ile her şeyin yapılabileceğine</strong> inanıyorum. Kodlama ve gömülü sistemler bilmeyen insanların dahi aklındaki fiziksel projeleri üretebilmesi, donanım ve yazılım geliştirme önündeki teknik sınırların tamamen kalkması gerektiği düşüncesiyle yola çıktım ve <strong>Cloud IDE</strong>&apos;yi bu vizyonla geliştirdim.
            </p>

            <p className="text-gray-300 leading-relaxed">
              Fikir temelleri geçen seneye ait olan bu proje, son <strong>1 aydır</strong> aralıksız ve yoğun bir geliştirme sürecinin ürünüdür. İlk aşamada akıllı <strong>AI destekli</strong> kodlama asistanı, sıfır kurulumlu yerleşik derleme motoru ve donanıma özel RAG yapısıyla sizlerle buluştu. İlerleyen aşamada ise <strong>proje devresinin çiziminden donanımın fiziksel testine kadar uçtan uca Full AI destekli</strong> bağımsız bir mod sisteme dahil edilecektir.
            </p>

            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-indigo-200">
              <div className="flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400 shrink-0 mt-0.5">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                </svg>
                <p className="font-medium text-[12px] sm:text-[12.5px] leading-snug">
                  <em>&ldquo;Unutmayın; AI ile artık her şeyi yapabilirsiniz, ancak en önemli ve vazgeçilmez olan şey daima insanın yaptığı müdahale, yönlendirme ve özgünlüktür.&rdquo;</em>
                </p>
              </div>
            </div>

            <p className="text-gray-300 leading-relaxed">
              İyi kullanmalar dilerim! Destekleriniz ve geri bildirimlerinizle çok daha fazla ve farklı yenilikçi projeler sizlerle olmaya devam edecek.
            </p>
          </div>

          {/* Sürüm Notu & Beta Durumu Kartı */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Sürüm Notu & Yol Haritası (v0.1.0 BETA)
                </h3>
              </div>
              <span className="text-[11px] font-mono text-indigo-300">Açık Beta</span>
            </div>

            <div className="space-y-2.5 text-[11.5px] sm:text-xs leading-relaxed text-gray-300">
              <div className="flex items-start gap-2.5">
                <span className="mt-1 flex h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                <div>
                  <strong className="text-white">1. Aşama (Şu Anki Durum):</strong> Sıfır kurulumlu bağımsız gömülü Arduino CLI çekirdeği, Cloud AI çoklu yapay zekâ sağlayıcı entegrasyonu (Google Gemini, OpenAI, Anthropic Claude, DeepSeek, Kimi AI, NVIDIA Build, LM Studio), çift uç nokta esnekliği, akıllı kod düzeltme ve yerel INT8 RAG motoru.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="mt-1 flex h-2 w-2 shrink-0 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.9)]" />
                <div>
                  <strong className="text-white">2. Aşama (Gelecek Vizyonu):</strong> Devre şeması üretiminden pin bağlantılarına, simülasyondan donanım testine kadar baştan sona <strong>Full AI destekli otonom geliştirme modu</strong>.
                </div>
              </div>
            </div>
          </div>

          {/* Öne Çıkan Özellik Rozetleri */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <BoltIcon />
              </div>
              <div className="min-w-0">
                <div className="text-[11.5px] font-semibold text-white">Gömülü CLI</div>
                <div className="text-[10px] text-gray-400 truncate">Sıfır kurulum gerektirir</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                <SparkleIcon />
              </div>
              <div className="min-w-0">
                <div className="text-[11.5px] font-semibold text-white">Cloud AI & RAG</div>
                <div className="text-[10px] text-gray-400 truncate">Donanıma özel kod zekâsı</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <HeartIcon />
              </div>
              <div className="min-w-0">
                <div className="text-[11.5px] font-semibold text-white">Açık İletişim</div>
                <div className="text-[10px] text-gray-400 truncate">Geri bildirimlerinize açık</div>
              </div>
            </div>
          </div>

          {/* Sosyal Medya ve İletişim Bağlantıları Başlığı */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <LinkIcon />
                <span>Sosyal Medya & İletişim Kanalları</span>
              </h3>
              <span className="text-[10.5px] text-gray-500">Tarayıcıda açmak için tıklayın</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SOSYAL_MEDYA_BAGLANTILARI.map((baglanti) => {
                const IconComponent = baglanti.icon
                return (
                  <button
                    key={baglanti.id}
                    onClick={() => disBaglantiAc(baglanti.url)}
                    title={`${baglanti.name} profilini tarayıcıda aç`}
                    className={`group flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-2.5 text-left transition-all duration-200 ${baglanti.borderHover} ${baglanti.bgHover} hover:scale-[1.01] shadow-sm`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-gray-200 transition-colors group-hover:text-white"
                        style={{ color: baglanti.color }}
                      >
                        <IconComponent />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-white">{baglanti.name}</span>
                          {baglanti.badge && (
                            <span className="rounded bg-indigo-500/20 px-1.5 py-0.2 text-[9px] font-medium text-indigo-300 border border-indigo-500/30">
                              {baglanti.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400 truncate">{baglanti.label}</div>
                      </div>
                    </div>

                    <ArrowUpRightIcon className="h-4 w-4 text-gray-500 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gray-300 shrink-0 ml-2" />
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Alt Çubuk: Bir Daha Gösterme & Aksiyon Butonu ── */}
        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10 bg-white/[0.02] px-5 py-4">
          <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-gray-400 hover:text-gray-200 transition-colors">
            <input
              type="checkbox"
              checked={birDahaGosterme}
              onChange={(e) => setBirDahaGosterme(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-0 focus:ring-offset-0 transition-colors cursor-pointer accent-indigo-500"
            />
            <span>Açılışta bir daha gösterme</span>
          </label>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={kapat}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-[#8b5cf6] to-indigo-600 hover:from-indigo-400 hover:to-[#8b5cf6] px-6 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Geliştirmeye Başla</span>
              <ArrowRightIcon />
            </button>
          </div>
        </div>

      </div>
    </div>
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

function BoltIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function SparkleIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.5c.35 3.32 1.1 5.63 2.25 6.9 1.15 1.28 3.3 2.1 6.25 2.6-2.95.5-5.1 1.32-6.25 2.6-1.15 1.27-1.9 3.58-2.25 6.9-.35-3.32-1.1-5.63-2.25-6.9-1.15-1.28-3.3-2.1-6.25-2.6 2.95-.5 5.1-1.32 6.25-2.6 1.15-1.27 1.9-3.58 2.25-6.9Z" />
    </svg>
  )
}

function HeartIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}

function LinkIcon(): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

function ArrowUpRightIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  )
}

function ArrowRightIcon(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

export default DeveloperMessageModal
