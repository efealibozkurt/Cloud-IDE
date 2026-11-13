import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { YardimDugmesi } from '../common/YardimDugmesi'
import {
  AI_PROVIDERS,
  estimateTokens,
  getModelContextLimit,
  type AgentPermissionMode,
  type ReasoningEffort
} from '@shared/types'
import { tumKartlariDuzlestir, useAppState } from '../../state/AppStateContext'
import { useAgent, type EklenenKod } from '../../state/AgentContext'
import { ayniDosyaMi } from '../../utils/paths'
import ContextMeter from './ContextMeter'
import ApprovalCard from './ApprovalCard'
import { CanliGorunum, MesajBaloncugu } from './AgentMessages'
import { ReasoningLevelSwitch } from './ReasoningLevelSwitch'
import { RagSkillsModal } from './RagSkillsModal'
import cloudIcon from '../../assets/icon.png'

const ORNEK_ISTEMLER: Array<{ metin: string; ikon: 'simsek' | 'hata' | 'wifi' }> = [
  { metin: 'Blink LED örneği oluştur', ikon: 'simsek' },
  { metin: 'Bu derleme hatasını açıkla', ikon: 'hata' },
  { metin: 'WiFi ile veri gönderen kod yaz', ikon: 'wifi' }
]

const IZIN_SECENEKLERI: Array<{ id: AgentPermissionMode; ad: string; aciklama: string }> = [
  { id: 'ask', ad: 'Onaylı', aciklama: 'Dosya yazmadan önce farkı gösterir ve onayınızı bekler' },
  { id: 'auto-edit', ad: 'Yarı otomatik', aciklama: 'Dosya yazar; silme, yeniden adlandırma ve kütüphane kurulumunu sorar' },
  { id: 'full-auto', ad: 'Tam otomatik', aciklama: 'Hiçbir işlem için sormaz. Değişiklikler yine geri alınabilir' }
]

function tarih(ts: number): string {
  const d = new Date(ts)
  const bugun = new Date()
  const saat = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === bugun.toDateString()
    ? `Bugün ${saat}`
    : `${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${saat}`
}

interface AgentPanelProps {
  onClose: () => void
}

/** Sağdaki yapay zekâ paneli. Tüm durum AgentContext'te tutulur; panel yalnızca görünümdür. */
function AgentPanel({ onClose }: AgentPanelProps): ReactElement {
  const { state, clearDretAiSeed, openSketchDialog, newSketch, setSelectedAiProvider, setSelectedAiModel, setCustomContextLimit, openFileInTab } =
    useAppState()
  const agent = useAgent()

  const [girdi, setGirdi] = useState('')
  const [ek, setEk] = useState<EklenenKod | null>(null)
  const [gecmisAcik, setGecmisAcik] = useState(false)
  const [modeller, setModeller] = useState<string[]>([])
  const [modellerYukleniyor, setModellerYukleniyor] = useState(false)
  const [beceriModaliAcik, setBeceriModaliAcik] = useState(false)
  const [reasoning, setReasoning] = useState<ReasoningEffort>(state.settings?.selectedReasoningEffort ?? 'medium')
  const [izin, setIzin] = useState<AgentPermissionMode>(state.settings?.agentPermissionMode ?? 'ask')

  const girdiRef = useRef<HTMLTextAreaElement>(null)
  const sonRef = useRef<HTMLDivElement>(null)

  const sketch = state.sketch.info
  const saglayici = state.settings?.selectedAiProvider ?? AI_PROVIDERS[0].id
  const aktifModel = state.settings?.selectedModelPerProvider?.[saglayici] ?? modeller[0] ?? ''
  const kart = tumKartlariDuzlestir(state.arduinoCli.platforms).find((k) => k.fqbn === state.arduinoCli.selectedFqbn)

  // Seçili sağlayıcının modelleri
  useEffect(() => {
    let iptal = false
    setModellerYukleniyor(true)
    window.api.chat
      .getProviderModels(saglayici)
      .then((liste) => {
        if (iptal) return
        setModeller(liste)
        const mevcut = state.settings?.selectedModelPerProvider?.[saglayici]
        if (liste.length > 0 && (!mevcut || !liste.includes(mevcut))) void setSelectedAiModel(saglayici, liste[0])
      })
      .catch((err) => console.error('Modeller getirilemedi:', err))
      .finally(() => {
        if (!iptal) setModellerYukleniyor(false)
      })
    return () => {
      iptal = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saglayici, state.configuredAiProviders])

  // Editörden gelen "bunu AI'a sor" isteği
  useEffect(() => {
    const seed = state.dretAi.seed
    if (!seed) return
    setEk({ kod: seed.kod, aralik: seed.secimAraligi && { filePath: seed.secimAraligi.filePath, startLine: seed.secimAraligi.startLine, endLine: seed.secimAraligi.endLine } })
    setGirdi(seed.istem)
    clearDretAiSeed()
    setGecmisAcik(false)
    requestAnimationFrame(() => girdiRef.current?.focus())
  }, [state.dretAi.seed, clearDretAiSeed])

  // Yeni içerik geldikçe alta kaydır
  useEffect(() => {
    sonRef.current?.scrollIntoView({ block: 'end' })
  }, [agent.mesajlar.length, agent.calisma?.metin, agent.calisma?.adimlar.length, agent.calisma?.onay, gecmisAcik])

  // Seçilen kod, ait olduğu dosya kapanınca geçersiz olur
  useEffect(() => {
    const yol = ek?.aralik?.filePath
    if (yol && !state.sketch.tabs.some((t) => ayniDosyaMi(t.path, yol))) setEk(null)
  }, [state.sketch.tabs, ek])

  const baglam = useMemo(() => {
    const aktifSekme = state.sketch.tabs.find((t) => ayniDosyaMi(t.path, state.sketch.activeTabPath ?? '')) ?? state.sketch.tabs[0]
    const kodTokens = aktifSekme?.content ? estimateTokens(aktifSekme.content.slice(0, 16000)) : 0
    const mesajTokens =
      agent.mesajlar.reduce((t, m) => t + estimateTokens(m.metin), 0) + (agent.calisma ? estimateTokens(agent.calisma.metin) : 0)
    const sistemTokens = 1500
    return {
      sistemTokens,
      kodTokens,
      mesajTokens,
      toplamTokens: sistemTokens + kodTokens + mesajTokens,
      limitTokens: getModelContextLimit(saglayici, aktifModel, state.settings?.customContextLimits),
      mesajSayisi: agent.mesajlar.length,
      aktifDosyaAdi: aktifSekme?.name ?? null,
      ozetlendi: agent.mesajlar.some((m) => m.isCompactedSummary)
    }
  }, [state.sketch.tabs, state.sketch.activeTabPath, agent.mesajlar, agent.calisma, saglayici, aktifModel, state.settings?.customContextLimits])

  const gonder = (): void => {
    if (agent.calisiyor) return
    const metin = girdi
    const eklenen = ek
    setGirdi('')
    setEk(null)
    void agent.gonder(metin, eklenen)
  }

  const izinDegistir = (yeni: AgentPermissionMode): void => {
    setIzin(yeni)
    void window.api.settings.set('agentPermissionMode', yeni)
  }

  const dosyaAc = (yol: string): void => {
    for (const s of state.sketch.workspaceSketches) {
      const f = s.files.find((x) => ayniDosyaMi(x.path, yol))
      if (f) {
        void openFileInTab(f.path, f.name, f.isMainFile, s.folderPath)
        return
      }
    }
  }

  const geriAlinabilir = !agent.calisiyor
  const bos = agent.mesajlar.length === 0 && !agent.calisma

  return (
    <aside className="flex h-full w-[350px] shrink-0 flex-col overflow-hidden border-l border-panel-border bg-panel-light" aria-label="Yapay zekâ asistanı">
      <div className="flex items-center gap-1 border-b border-panel-border px-3 py-2">
        <h2 className="flex min-w-0 flex-1 items-center gap-2 text-[13px] font-medium text-gray-100">
          <img src={cloudIcon} alt="" className="h-5 w-5 shrink-0 object-contain drop-shadow-[0_0_6px_rgba(124,196,240,0.6)]" />
          <span className="truncate">{gecmisAcik ? 'Geçmiş sohbetler' : agent.aktifOturum?.baslik ?? 'Cloud AI'}</span>
          {agent.calisiyor && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#7cc4f0] shadow-[0_0_6px_#7cc4f0]" title="Çalışıyor" />}
        </h2>
        <BaslikButonu baslik="Geçmiş sohbetler" etkin={gecmisAcik} onClick={() => setGecmisAcik((g) => !g)}>
          <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2" />
        </BaslikButonu>
        <BaslikButonu
          baslik="Yeni sohbet"
          onClick={() => {
            agent.yeniSohbet()
            setGecmisAcik(false)
            setGirdi('')
            setEk(null)
            requestAnimationFrame(() => girdiRef.current?.focus())
          }}
        >
          <path d="M12 5v14M5 12h14" />
        </BaslikButonu>
        <YardimDugmesi konu="ai" baslik="Cloud AI nasıl kullanılır?" />
        <BaslikButonu baslik="Paneli kapat" onClick={onClose}>
          <path d="M18 6 6 18M6 6l12 12" />
        </BaslikButonu>
      </div>

      <div className="flex items-center gap-1.5 border-b border-panel-border px-3 py-1.5 text-xs">
        <select
          value={saglayici}
          onChange={(e) => setSelectedAiProvider(e.target.value as typeof saglayici)}
          aria-label="Sağlayıcı"
          className="h-7 min-w-0 flex-1 rounded border border-panel-border bg-panel px-1.5 text-gray-200 outline-none focus:border-accent"
        >
          {AI_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {state.configuredAiProviders.includes(p.id) ? '' : ' (anahtar yok)'}
            </option>
          ))}
        </select>
        <select
          value={aktifModel}
          onChange={(e) => void setSelectedAiModel(saglayici, e.target.value)}
          disabled={modellerYukleniyor || modeller.length === 0}
          aria-label="Model"
          title={modellerYukleniyor ? 'Modeller listeleniyor…' : aktifModel}
          className="h-7 min-w-0 flex-1 rounded border border-panel-border bg-panel px-1.5 text-gray-200 outline-none focus:border-accent disabled:opacity-50"
        >
          {modeller.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-panel-border px-3 py-1.5 text-xs text-gray-400">
        <span className="truncate" title={kart?.fqbn}>
          {kart ? kart.name : state.arduinoCli.selectedFqbn ?? 'Kart seçilmedi'}
        </span>
        <button onClick={() => setBeceriModaliAcik(true)} className="shrink-0 text-gray-400 hover:text-gray-100 hover:underline">
          Donanım ve bilgi tabanı
        </button>
      </div>

      <ContextMeter
        veri={baglam}
        saglayici={saglayici}
        ozetleniyor={agent.ozetleniyor}
        mesgul={agent.calisiyor}
        bildirim={agent.bildirim}
        onOzetle={() => void agent.gecmisiOzetle()}
        onLimitDegistir={(limit) => void setCustomContextLimit(saglayici, limit)}
      />

      {gecmisAcik ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {agent.oturumlar.length === 0 ? (
            <p className="px-4 py-6 text-xs text-gray-500">Bu proje için kayıtlı sohbet yok.</p>
          ) : (
            <ul>
              {agent.oturumlar.map((o) => (
                <li key={o.id} className="group flex items-center border-b border-panel-border/50">
                  <button
                    onClick={() => {
                      void agent.oturumSec(o.id)
                      setGecmisAcik(false)
                    }}
                    className={`min-w-0 flex-1 px-4 py-2 text-left hover:bg-white/[0.04] ${agent.aktifOturum?.id === o.id ? 'bg-white/[0.04]' : ''}`}
                  >
                    <p className="truncate text-[13px] text-gray-200">{o.baslik}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {tarih(o.guncellemeTarihi)} · {o.mesajSayisi} mesaj
                    </p>
                  </button>
                  <button
                    onClick={() => void agent.oturumSil(o.id)}
                    aria-label={`${o.baslik} sohbetini sil`}
                    className="mr-2 hidden rounded px-2 py-1 text-xs text-gray-500 hover:bg-white/10 hover:text-rose-300 group-hover:block"
                  >
                    Sil
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 [overflow-wrap:anywhere]">
          {!sketch ? (
            <div className="flex flex-col gap-3 py-6 text-xs">
              <p className="text-[13px] text-gray-300">Başlamak için bir proje açın</p>
              <p className="text-gray-500">Asistan, açık projenizdeki dosyaları okuyup düzenleyebilir ve derleyebilir.</p>
              <div className="flex gap-2">
                <button onClick={() => void newSketch()} className="rounded bg-accent px-3 py-1.5 font-medium text-white hover:bg-accent-hover">
                  Yeni sketch
                </button>
                <button onClick={() => void openSketchDialog()} className="rounded border border-panel-border px-3 py-1.5 text-gray-300 hover:bg-white/5">
                  Klasör aç
                </button>
              </div>
            </div>
          ) : bos ? (
            <div className="flex flex-col items-center px-1 pt-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1d3a52] to-[#13222f] shadow-lg shadow-sky-500/20 ring-1 ring-white/10">
                <img src={cloudIcon} alt="" className="h-8 w-8 object-contain drop-shadow-[0_0_10px_rgba(124,196,240,0.7)]" />
              </span>
              <p className="mt-3 text-[15px] font-medium text-white">{sketch.name} üzerinde ne yapalım?</p>
              <p className="mt-1 max-w-[260px] text-xs leading-relaxed text-gray-500">
                Dosyalarını okuyabilir, kodu düzenleyebilir, derleyip hataları düzeltebilirim.
              </p>
              <ul className="mt-5 w-full space-y-1.5 text-left">
                {ORNEK_ISTEMLER.map((o) => (
                  <li key={o.metin}>
                    <button
                      onClick={() => {
                        setGirdi(o.metin)
                        requestAnimationFrame(() => girdiRef.current?.focus())
                      }}
                      className="group flex w-full items-center gap-3 rounded-xl border border-panel-border bg-white/[0.02] px-3 py-2.5 text-[12.5px] text-gray-300 transition-colors hover:border-[#2aa8f2]/50 hover:bg-[#2aa8f2]/[0.07] hover:text-white"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#7cc4f0]/10 text-[#7cc4f0] transition-colors group-hover:bg-[#7cc4f0]/20">
                        <OneriIkon tur={o.ikon} />
                      </span>
                      {o.metin}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex min-w-0 flex-col gap-4">
              {agent.mesajlar.map((m) => (
                <MesajBaloncugu key={m.id} mesaj={m} onGeriAl={(id) => void agent.geriAl(id)} geriAlinabilir={geriAlinabilir} />
              ))}
              {agent.calisma && <CanliGorunum calisma={agent.calisma} />}
              {agent.calisma?.onay && <ApprovalCard onay={agent.calisma.onay} onCevap={agent.onayCevapla} onDosyaAc={dosyaAc} />}
              <div ref={sonRef} />
            </div>
          )}
        </div>
      )}

      <div className="shrink-0 px-3 pb-2.5 pt-2">
        {/* Gradient çerçeve: odakta parlar */}
        <div className="rounded-2xl bg-gradient-to-br from-white/15 to-white/[0.04] p-px transition-shadow duration-200 focus-within:from-[#0e7fc4] focus-within:via-[#2aa8f2] focus-within:to-[#0e7fc4] focus-within:shadow-[0_0_26px_rgba(14,127,196,0.3)]">
          <div className="rounded-[15px] bg-panel">
            {/* Bağlam çipleri: asistanın neyi gördüğü */}
            <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2.5">
              {ek && (
                <span className="flex items-center gap-1.5 rounded-md border border-[#2aa8f2]/40 bg-[#2aa8f2]/10 py-0.5 pl-2 pr-1 text-[11px] text-[#8fd0f7]">
                  <span>
                    Seçili kod · {ek.kod.split('\n').length} satır
                  </span>
                  <button onClick={() => setEk(null)} aria-label="Eklenen kodu kaldır" className="rounded px-1 text-[#8fd0f7]/70 hover:bg-white/10 hover:text-white">
                    ✕
                  </button>
                </span>
              )}
              {baglam.aktifDosyaAdi && <BaglamCipi ikon="dosya">{baglam.aktifDosyaAdi}</BaglamCipi>}
              {kart && <BaglamCipi ikon="kart">{kart.name}</BaglamCipi>}
              {!baglam.aktifDosyaAdi && !kart && !ek && <span className="text-[11px] text-gray-600">Açık dosya ve kart burada görünür</span>}
            </div>

            <textarea
              ref={girdiRef}
              value={girdi}
              onChange={(e) => setGirdi(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && agent.calisiyor) {
                  e.preventDefault()
                  agent.durdur()
                } else if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  gonder()
                }
              }}
              rows={3}
              placeholder={!sketch ? 'Ne yapmak istediğini yaz, proje senin için oluşturulsun' : ek ? 'Bu kodla ne yapılsın?' : 'Ne yapmak istiyorsun? Örn. LED’i 500 ms aralıkla yakıp söndür'}
              className="max-h-44 min-h-[68px] w-full resize-none bg-transparent px-3 pb-1 pt-2 text-[13px] leading-relaxed text-gray-100 outline-none placeholder:text-gray-500"
            />

            <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <ReasoningLevelSwitch
                  value={reasoning}
                  onChange={(e) => {
                    setReasoning(e)
                    void window.api.settings.set('selectedReasoningEffort', e)
                  }}
                  disabled={agent.calisiyor}
                />
                <label
                  title={IZIN_SECENEKLERI.find((x) => x.id === izin)?.aciklama}
                  className="flex h-7 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] pl-1.5 pr-0.5 text-gray-400 hover:border-white/20"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
                  </svg>
                  <select
                    value={izin}
                    onChange={(e) => izinDegistir(e.target.value as AgentPermissionMode)}
                    aria-label="Değişiklik izni"
                    className="max-w-[112px] cursor-pointer bg-transparent py-1 text-[11px] text-gray-200 outline-none"
                  >
                    {IZIN_SECENEKLERI.map((x) => (
                      <option key={x.id} value={x.id} className="bg-panel-light">
                        {x.ad}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {agent.calisiyor ? (
                <button
                  onClick={agent.durdur}
                  title="Durdur (Esc)"
                  aria-label="Durdur"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rose-400/40 bg-rose-500/15 text-rose-300 transition-colors hover:bg-rose-500/25"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="5" y="5" width="14" height="14" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={gonder}
                  disabled={!girdi.trim() && !ek}
                  title="Gönder (Enter)"
                  aria-label="Gönder"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0e7fc4] to-[#2aa8f2] text-white shadow-[0_2px_12px_rgba(14,127,196,0.5)] transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:from-white/10 disabled:to-white/10 disabled:text-gray-500 disabled:shadow-none"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
        <p className="mt-1.5 px-1 text-[10.5px] text-gray-600">
          {agent.calisiyor ? 'Esc ile durdurabilirsin' : 'Enter gönderir, Shift+Enter yeni satır açar'}
        </p>
      </div>

      <RagSkillsModal
        isOpen={beceriModaliAcik}
        onClose={() => setBeceriModaliAcik(false)}
        activeBoardContext={
          kart
            ? { name: kart.name, fqbn: kart.fqbn, platformName: kart.platformName }
            : state.arduinoCli.selectedFqbn
            ? { fqbn: state.arduinoCli.selectedFqbn }
            : undefined
        }
      />
    </aside>
  )
}

function BaglamCipi({ ikon, children }: { ikon: 'dosya' | 'kart'; children: string }): ReactElement {
  return (
    <span className="flex max-w-[150px] items-center gap-1.5 rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] text-gray-300" title={children}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-500" aria-hidden="true">
        {ikon === 'dosya' ? (
          <>
            <path d="M14.5 3H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.5L14.5 3Z" />
            <path d="M14 3v5h5" />
          </>
        ) : (
          <>
            <rect x="5" y="5" width="14" height="14" rx="2" />
            <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
          </>
        )}
      </svg>
      <span className="truncate">{children}</span>
    </span>
  )
}

function OneriIkon({ tur }: { tur: 'simsek' | 'hata' | 'wifi' }): ReactElement {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {tur === 'simsek' && <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />}
      {tur === 'hata' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="8" x2="12" y2="12.5" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </>
      )}
      {tur === 'wifi' && (
        <>
          <path d="M5 12.5a10 10 0 0 1 14 0" />
          <path d="M8.5 16a5 5 0 0 1 7 0" />
          <line x1="12" y1="19.5" x2="12.01" y2="19.5" />
        </>
      )}
    </svg>
  )
}

function BaslikButonu({
  baslik,
  onClick,
  etkin,
  children
}: {
  baslik: string
  onClick: () => void
  etkin?: boolean
  children: ReactElement
}): ReactElement {
  return (
    <button
      onClick={onClick}
      title={baslik}
      aria-label={baslik}
      aria-pressed={etkin}
      className={`flex h-6 w-6 items-center justify-center rounded hover:bg-white/10 hover:text-gray-100 ${etkin ? 'bg-white/10 text-gray-100' : 'text-gray-400'}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  )
}

export default AgentPanel
