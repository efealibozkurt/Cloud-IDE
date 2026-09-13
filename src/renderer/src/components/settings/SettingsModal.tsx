import { useEffect, useState, type ReactElement } from 'react'
import { AI_PROVIDERS, EDITOR_TEMALARI, ADJUSTABLE_CONTEXT_PRESETS, getModelContextLimit, type AIProviderId } from '@shared/types'
import { useAppState } from '../../state/AppStateContext'

interface SettingsModalProps {
  onClose: () => void
}

const SAGLAYICI_BILGILERI: Record<AIProviderId, { placeholder: string; aciklama?: string }> = {
  gemini: {
    placeholder: 'Google AI Studio API anahtarı (AIzaSy...)',
    aciklama: 'Google Gemini modelleri için API anahtarı.'
  },
  kimi: {
    placeholder: 'Kimi / Moonshot API anahtarı (sk-...)',
    aciklama: 'Kimi AI (Moonshot) modelleri için API anahtarı (platform.moonshot.ai / cn).'
  },
  lmstudio: {
    placeholder: "Yerel sunucu anahtarı veya 'lm-studio'",
    aciklama: 'LM Studio yerel model sunucusunu (varsayılan: http://localhost:1234/v1) kullanır.'
  },
  deepseek: {
    placeholder: 'DeepSeek API anahtarı (sk-...)',
    aciklama: 'DeepSeek akıl yürütme ve kod modelleri için API anahtarı.'
  },
  openai: {
    placeholder: 'OpenAI API anahtarı (sk-...)',
    aciklama: 'OpenAI modelleri için API anahtarı.'
  },
  anthropic: {
    placeholder: 'Anthropic API anahtarı (sk-ant-...)',
    aciklama: 'Anthropic Claude modelleri için API anahtarı.'
  },
  nvidia: {
    placeholder: 'NVIDIA API anahtarı (nvapi-...)',
    aciklama: 'NVIDIA Build (NIM) bulut modelleri için API anahtarı ve otomatik model listeleme.'
  }
}

/**
 * "Uygulama Ayarları" modalı: editör görünümü (font boyutu/tema) ve AI
 * sağlayıcı API anahtarı yönetimi. Editör ayarları seçilir seçilmez
 * uygulanır (diğer seçicilerdeki gibi); API anahtarı yalnızca "Kaydet"e
 * basınca gönderilir. Anahtar kaydedildikten sonra bir daha renderer'a
 * dönmez — yalnızca "ayarlı mı" bilgisi gösterilir (bkz. SecretsService.ts).
 */
function SettingsModal({ onClose }: SettingsModalProps): ReactElement {
  const {
    state,
    setEditorFontSize,
    setEditorTheme,
    setSelectedAiProvider,
    setSelectedAiModel,
    setCustomContextLimit,
    saveApiKey,
    clearApiKey
  } = useAppState()
  const ayarlar = state.settings

  const [secilenSaglayici, setSecilenSaglayici] = useState<AIProviderId>(
    ayarlar?.selectedAiProvider ?? AI_PROVIDERS[0].id
  )
  const [anahtarGirdisi, setAnahtarGirdisi] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [modeller, setModeller] = useState<string[]>([])
  const [modellerYukleniyor, setModellerYukleniyor] = useState(false)

  const aktifModel =
    ayarlar?.selectedModelPerProvider?.[secilenSaglayici] ?? modeller[0] ?? ''

  // Sağlayıcının modellerini dinamik olarak yükle
  const modelleriYukle = async (provider: AIProviderId): Promise<void> => {
    setModellerYukleniyor(true)
    try {
      const liste = await window.api.chat.getProviderModels(provider)
      setModeller(liste)
      // Eğer henüz bir model seçilmemişse veya seçili model listede bulunmuyorsa ilk modeli seç
      const mevcutModel = ayarlar?.selectedModelPerProvider?.[provider]
      if (liste.length > 0 && (!mevcutModel || !liste.includes(mevcutModel))) {
        void setSelectedAiModel(provider, liste[0])
      }
    } catch (err) {
      console.error('Modeller getirilemedi:', err)
    } finally {
      setModellerYukleniyor(false)
    }
  }

  useEffect(() => {
    void modelleriYukle(secilenSaglayici)
  }, [secilenSaglayici])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!ayarlar) {
    return <></>
  }

  const saglayiciAyarliMi = state.configuredAiProviders.includes(secilenSaglayici)
  const guncelBilgi = SAGLAYICI_BILGILERI[secilenSaglayici] ?? {
    placeholder: 'API anahtarını yapıştırın...',
    aciklama: undefined
  }

  const saglayiciDegisti = (id: AIProviderId): void => {
    setSecilenSaglayici(id)
    setSelectedAiProvider(id)
    setAnahtarGirdisi('')
  }

  const anahtarKaydet = async (): Promise<void> => {
    if (!anahtarGirdisi.trim()) return
    setKaydediliyor(true)
    try {
      await saveApiKey(secilenSaglayici, anahtarGirdisi)
      setAnahtarGirdisi('')
      await modelleriYukle(secilenSaglayici)
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-panel-border bg-panel-light shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-panel-border px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-100">Uygulama Ayarları</h2>
          <button
            onClick={onClose}
            title="Kapat (Esc)"
            className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-panel-border hover:text-gray-200"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {/* ── Editör ── */}
          <section className="mb-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Editör</h3>

            <label className="mb-3 block text-xs text-gray-300">
              Font boyutu: <span className="text-gray-100">{ayarlar.editorFontSize}px</span>
              <input
                type="range"
                min={10}
                max={24}
                step={1}
                value={ayarlar.editorFontSize}
                onChange={(e) => setEditorFontSize(Number(e.target.value))}
                className="mt-1.5 block w-full accent-accent"
              />
            </label>

            <label className="block text-xs text-gray-300">
              Tema
              <select
                value={ayarlar.editorTheme}
                onChange={(e) => setEditorTheme(e.target.value as (typeof EDITOR_TEMALARI)[number]['id'])}
                className="mt-1.5 block w-full rounded border border-panel-border bg-panel px-2 py-1.5 text-xs text-gray-200"
              >
                {EDITOR_TEMALARI.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {/* ── Yapay Zekâ ── */}
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Yapay Zekâ</h3>
            <p className="mb-3 text-[11px] leading-relaxed text-gray-500">
              Buraya girilen API anahtarı yalnızca bu bilgisayarda, işletim sistemi düzeyinde şifrelenerek saklanır;
              hiçbir harici sunucuya gönderilmez.
            </p>

            <label className="mb-3 block text-xs text-gray-300">
              Sağlayıcı
              <select
                value={secilenSaglayici}
                onChange={(e) => saglayiciDegisti(e.target.value as AIProviderId)}
                className="mt-1.5 block w-full rounded border border-panel-border bg-panel px-2 py-1.5 text-xs text-gray-200"
              >
                {AI_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {state.configuredAiProviders.includes(p.id) ? ' — anahtar ayarlı' : ''}
                  </option>
                ))}
              </select>
            </label>

            {/* Model Seçici */}
            <label className="mb-3 block text-xs text-gray-300">
              <div className="flex items-center justify-between">
                <span>Model</span>
                {modellerYukleniyor && (
                  <span className="text-[10px] text-[#93a5fb] animate-pulse">Modeller taranıyor...</span>
                )}
              </div>
              <select
                disabled={modellerYukleniyor || modeller.length === 0}
                value={aktifModel}
                onChange={(e) => void setSelectedAiModel(secilenSaglayici, e.target.value)}
                className="mt-1.5 block w-full rounded border border-panel-border bg-panel px-2 py-1.5 text-xs text-gray-200 disabled:opacity-50"
              >
                {modeller.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            {/* Bağlam Boyutu (Context Window) */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-gray-300 mb-1.5">
                <span>Bağlam Sınırı (Context Window)</span>
                {secilenSaglayici === 'nvidia' || secilenSaglayici === 'lmstudio' ? (
                  <span className="text-[10px] text-[#93a5fb]">Özelleştirilebilir</span>
                ) : (
                  <span className="text-[10px] text-emerald-400">Sabit 1M Kapasite</span>
                )}
              </div>
              {secilenSaglayici === 'nvidia' || secilenSaglayici === 'lmstudio' ? (
                <select
                  value={getModelContextLimit(secilenSaglayici, aktifModel, ayarlar?.customContextLimits)}
                  onChange={(e) => void setCustomContextLimit(secilenSaglayici, Number(e.target.value))}
                  className="block w-full rounded border border-panel-border bg-panel px-2 py-1.5 text-xs text-[#93a5fb] font-mono outline-none focus:border-accent"
                >
                  {ADJUSTABLE_CONTEXT_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label} ({p.value.toLocaleString('tr-TR')} Token)
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded border border-panel-border/60 bg-panel/40 px-2.5 py-1.5 text-xs font-mono text-gray-300 flex items-center justify-between">
                  <span>1.000.000 Token (1M)</span>
                  <span className="text-[10px] text-gray-400">Varsayılan</span>
                </div>
              )}
            </div>

            {guncelBilgi.aciklama && (
              <p className="mb-2 text-[11px] text-gray-400">
                {guncelBilgi.aciklama}
              </p>
            )}

            {saglayiciAyarliMi && (
              <div className="mb-2 flex items-center gap-2 rounded border border-emerald-800 bg-emerald-950/50 px-2.5 py-1.5 text-[11px] text-emerald-300">
                <CheckIcon />
                Bu sağlayıcı için bir API anahtarı kayıtlı. Yeni bir anahtar girip kaydederseniz üzerine yazılır.
                <button
                  onClick={() => void clearApiKey(secilenSaglayici)}
                  className="ml-auto shrink-0 rounded px-2 py-0.5 text-red-300 hover:bg-red-950 hover:text-red-200"
                >
                  Kaldır
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="password"
                value={anahtarGirdisi}
                onChange={(e) => setAnahtarGirdisi(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void anahtarKaydet()
                }}
                placeholder={guncelBilgi.placeholder}
                autoComplete="off"
                className="min-w-0 flex-1 rounded border border-panel-border bg-panel px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:border-accent"
              />
              <button
                onClick={() => void anahtarKaydet()}
                disabled={!anahtarGirdisi.trim() || kaydediliyor}
                className="shrink-0 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:enabled:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                Kaydet
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function CloseIcon(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

function CheckIcon(): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default SettingsModal
