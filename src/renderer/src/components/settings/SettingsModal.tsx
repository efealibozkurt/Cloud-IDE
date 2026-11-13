import { useEffect, useState, type ReactElement } from 'react'
import {
  ADJUSTABLE_CONTEXT_PRESETS,
  AI_PROVIDERS,
  EDITOR_TEMALARI,
  getModelContextLimit,
  isLocalProvider,
  type AIProviderId,
  type LocalToolMode
} from '@shared/types'
import { surumAdiBul } from '@shared/surumAdlari'
import { useAppState } from '../../state/AppStateContext'
import { useToast } from '../../state/ToastContext'
import { useYardim } from '../../state/HelpContext'
import { useGuncelleme } from '../../hooks/useGuncelleme'
import { AyarBolumu, AyarSatiri, Anahtar, BIRINCIL_DUGME, GIRIS, KUCUK_DUGME, SECICI } from './AyarBilesenleri'

interface SettingsModalProps {
  onClose: () => void
}

type Sekme = 'genel' | 'ai' | 'gecmis' | 'guncelleme' | 'hakkinda'

const SEKMELER: Array<{ id: Sekme; ad: string; ozet: string }> = [
  { id: 'genel', ad: 'Genel', ozet: 'Editör görünümü' },
  { id: 'ai', ad: 'Yapay zekâ', ozet: 'Sağlayıcı, model, anahtar' },
  { id: 'gecmis', ad: 'Sürüm geçmişi', ozet: 'Otomatik kayıtlar' },
  { id: 'guncelleme', ad: 'Güncelleme', ozet: 'Yeni sürüm denetimi' },
  { id: 'hakkinda', ad: 'Hakkında', ozet: 'Sürüm, yardım, bağlantılar' }
]

const SEKME_ANAHTARI = 'cloud_ide_ayar_sekmesi'

const SAGLAYICI_BILGILERI: Record<AIProviderId, { placeholder: string; aciklama?: string }> = {
  gemini: { placeholder: 'Google AI Studio API anahtarı (AIzaSy...)', aciklama: 'Google Gemini modelleri için API anahtarı.' },
  kimi: { placeholder: 'Kimi / Moonshot API anahtarı (sk-...)', aciklama: 'Kimi AI (Moonshot) modelleri için API anahtarı (platform.moonshot.ai / cn).' },
  lmstudio: { placeholder: "Yerel sunucu anahtarı veya 'lm-studio'", aciklama: 'LM Studio yerel model sunucusunu kullanır.' },
  deepseek: { placeholder: 'DeepSeek API anahtarı (sk-...)', aciklama: 'DeepSeek akıl yürütme ve kod modelleri için API anahtarı.' },
  openai: { placeholder: 'OpenAI API anahtarı (sk-...)', aciklama: 'OpenAI modelleri için API anahtarı.' },
  anthropic: { placeholder: 'Anthropic API anahtarı (sk-ant-...)', aciklama: 'Anthropic Claude modelleri için API anahtarı.' },
  nvidia: { placeholder: 'NVIDIA API anahtarı (nvapi-...)', aciklama: 'NVIDIA Build (NIM) bulut modelleri için API anahtarı ve otomatik model listeleme.' },
  ollama: { placeholder: 'Anahtar gerekmez (isteğe bağlı)', aciklama: 'Yerel Ollama sunucusunu kullanır.' }
}

const VARSAYILAN_ADRES: Partial<Record<AIProviderId, string>> = {
  ollama: 'http://localhost:11434',
  lmstudio: 'http://localhost:1234/v1'
}

const ARAC_MODU_ADLARI: Record<LocalToolMode, string> = {
  auto: 'Otomatik (önerilen)',
  native: 'Yerel araç çağırma',
  text: 'Metin protokolü'
}

function ilkSekme(): Sekme {
  try {
    const s = localStorage.getItem(SEKME_ANAHTARI)
    if (s && SEKMELER.some((x) => x.id === s)) return s as Sekme
  } catch {
    // depolama kullanılamıyorsa ilk sekme açılır
  }
  return 'genel'
}

/**
 * "Uygulama Ayarları": solda konu sekmeleri, sağda seçili konunun ayarları. Editör ayarları seçilir seçilmez
 * uygulanır; API anahtarı yalnızca "Kaydet"e basınca gönderilir ve bir daha renderer'a dönmez
 * (bkz. SecretsService.ts) — yalnızca "ayarlı mı" bilgisi gösterilir.
 */
function SettingsModal({ onClose }: SettingsModalProps): ReactElement {
  const { state, setEditorFontSize, setEditorTheme, setSelectedAiProvider, setSelectedAiModel, setCustomContextLimit, saveApiKey, clearApiKey } = useAppState()
  const { toastGoster } = useToast()
  const { yardimAc, turuBaslat, sorunBildirAc } = useYardim()
  const ayarlar = state.settings
  const guncelleme = useGuncelleme()

  const [sekme, setSekme] = useState<Sekme>(ilkSekme)
  const [surum, setSurum] = useState('')

  const [gecmisOtomatik, setGecmisOtomatik] = useState(ayarlar?.historyAutoSnapshot ?? true)
  const [gecmisLimit, setGecmisLimit] = useState(ayarlar?.historyMaxAuto ?? 50)
  const [guncellemeDenetimi, setGuncellemeDenetimi] = useState(ayarlar?.autoUpdateCheck ?? true)
  const [otoDerleme, setOtoDerleme] = useState(ayarlar?.agentAutoCompile ?? true)
  const [aracModu, setAracModu] = useState<LocalToolMode>(ayarlar?.localToolMode ?? 'auto')
  const [adresler, setAdresler] = useState<Partial<Record<AIProviderId, string>>>(ayarlar?.aiBaseUrls ?? {})

  const [secilenSaglayici, setSecilenSaglayici] = useState<AIProviderId>(ayarlar?.selectedAiProvider ?? AI_PROVIDERS[0].id)
  const [anahtarGirdisi, setAnahtarGirdisi] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [modeller, setModeller] = useState<string[]>([])
  const [modellerYukleniyor, setModellerYukleniyor] = useState(false)

  const aktifModel = ayarlar?.selectedModelPerProvider?.[secilenSaglayici] ?? modeller[0] ?? ''

  useEffect(() => {
    window.api.app.getVersion().then(setSurum).catch(() => undefined)
  }, [])

  const sekmeSec = (s: Sekme): void => {
    setSekme(s)
    try {
      localStorage.setItem(SEKME_ANAHTARI, s)
    } catch {
      // yalnızca bu oturumda geçerli olur
    }
  }

  // Sağlayıcının modellerini dinamik olarak yükle
  const modelleriYukle = async (provider: AIProviderId): Promise<void> => {
    setModellerYukleniyor(true)
    try {
      const liste = await window.api.chat.getProviderModels(provider)
      setModeller(liste)
      const mevcutModel = ayarlar?.selectedModelPerProvider?.[provider]
      if (liste.length > 0 && (!mevcutModel || !liste.includes(mevcutModel))) void setSelectedAiModel(provider, liste[0])
    } catch (err) {
      console.error('Modeller getirilemedi:', err)
    } finally {
      setModellerYukleniyor(false)
    }
  }

  useEffect(() => {
    void modelleriYukle(secilenSaglayici)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secilenSaglayici])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!ayarlar) return <></>

  const saglayiciAyarliMi = state.configuredAiProviders.includes(secilenSaglayici)
  const bilgi = SAGLAYICI_BILGILERI[secilenSaglayici]
  const yerel = isLocalProvider(secilenSaglayici)
  const baglamOzellestirilebilir = secilenSaglayici === 'nvidia' || secilenSaglayici === 'lmstudio'

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

  const adresKaydet = async (): Promise<void> => {
    const deger = (adresler[secilenSaglayici] ?? '').trim()
    try {
      // Diğer sağlayıcıların kayıtlı adreslerini ezmemek için güncel ayarlardan başla
      const guncel = (await window.api.settings.get()).aiBaseUrls ?? {}
      const yeni = { ...guncel }
      if (deger) yeni[secilenSaglayici] = deger
      else delete yeni[secilenSaglayici]
      await window.api.settings.set('aiBaseUrls', yeni)
      toastGoster('Sunucu adresi kaydedildi', 'basari')
      await modelleriYukle(secilenSaglayici)
    } catch {
      toastGoster('Geçersiz adres: http:// ya da https:// ile başlamalı', 'hata')
    }
  }

  const ayarYaz = <K extends 'historyAutoSnapshot' | 'historyMaxAuto' | 'autoUpdateCheck' | 'agentAutoCompile' | 'localToolMode'>(
    anahtar: K,
    deger: NonNullable<typeof ayarlar[K]>
  ): void => {
    void window.api.settings.set(anahtar, deger).catch(() => toastGoster('Ayar kaydedilemedi', 'hata'))
  }

  const guncellemeMetni =
    guncelleme.durum === 'denetleniyor'
      ? 'Denetleniyor…'
      : guncelleme.durum === 'guncel'
        ? 'Cloud IDE güncel.'
        : guncelleme.durum === 'var'
          ? `Yeni sürüm var: ${guncelleme.surum} (üst çubuktan kurabilirsiniz)`
          : guncelleme.durum === 'indiriliyor'
            ? `İndiriliyor %${guncelleme.yuzde ?? 0}`
            : guncelleme.durum === 'hazir'
              ? 'Güncelleme kurulmaya hazır.'
              : guncelleme.mesaj ?? ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Uygulama ayarları" className="flex h-[min(620px,90vh)] w-full max-w-3xl overflow-hidden rounded-lg border border-panel-border bg-panel-light shadow-2xl">
        <nav role="tablist" aria-label="Ayar konuları" aria-orientation="vertical" className="flex w-52 shrink-0 flex-col border-r border-panel-border bg-panel">
          <div className="px-4 pb-2 pt-4 text-sm font-semibold text-gray-100">Ayarlar</div>
          <div className="flex-1 overflow-y-auto py-1">
            {SEKMELER.map((s) => {
              const secili = s.id === sekme
              return (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={secili}
                  onClick={() => sekmeSec(s.id)}
                  className={`relative block w-full px-4 py-2 text-left transition-colors ${secili ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'}`}
                >
                  {secili && <span className="absolute inset-y-1.5 left-0 w-0.5 bg-accent" />}
                  <span className={`block text-[13px] ${secili ? 'font-medium text-gray-100' : 'text-gray-300'}`}>{s.ad}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">{s.ozet}</span>
                </button>
              )
            })}
          </div>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-panel-border px-5">
            <h2 className="text-sm font-semibold text-gray-100">{SEKMELER.find((s) => s.id === sekme)?.ad}</h2>
            <button onClick={onClose} title="Kapat (Esc)" aria-label="Kapat" className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-panel-border hover:text-gray-200">
              <CloseIcon />
            </button>
          </div>

          <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {sekme === 'genel' && (
              <AyarBolumu baslik="Editör" aciklama="Değişiklikler hemen uygulanır.">
                <AyarSatiri baslik="Yazı boyutu" aciklama="Kod editöründeki yazı boyutu.">
                  <div className="flex items-center gap-3">
                    <input type="range" min={10} max={24} step={1} value={ayarlar.editorFontSize} onChange={(e) => setEditorFontSize(Number(e.target.value))} aria-label="Yazı boyutu" className="w-36 accent-accent" />
                    <span className="w-10 text-right font-mono text-xs text-gray-300">{ayarlar.editorFontSize}px</span>
                  </div>
                </AyarSatiri>
                <AyarSatiri baslik="Tema" aciklama="Editörün renk düzeni.">
                  <select value={ayarlar.editorTheme} onChange={(e) => setEditorTheme(e.target.value as (typeof EDITOR_TEMALARI)[number]['id'])} aria-label="Tema" className={`${SECICI} w-44`}>
                    {EDITOR_TEMALARI.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </AyarSatiri>
              </AyarBolumu>
            )}

            {sekme === 'ai' && (
              <>
                <AyarBolumu baslik="Sağlayıcı ve model" aciklama="Cloud AI’ın kullanacağı yapay zekâ servisi.">
                  <AyarSatiri baslik="Sağlayıcı">
                    <select value={secilenSaglayici} onChange={(e) => saglayiciDegisti(e.target.value as AIProviderId)} aria-label="Sağlayıcı" className={`${SECICI} w-56`}>
                      {AI_PROVIDERS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {state.configuredAiProviders.includes(p.id) ? ' ✓' : ''}
                        </option>
                      ))}
                    </select>
                  </AyarSatiri>
                  <AyarSatiri baslik="Model" aciklama={modellerYukleniyor ? 'Modeller listeleniyor…' : modeller.length === 0 ? 'Model listesi alınamadı. Anahtarı ya da sunucu adresini kontrol edin.' : undefined}>
                    <select disabled={modellerYukleniyor || modeller.length === 0} value={aktifModel} onChange={(e) => void setSelectedAiModel(secilenSaglayici, e.target.value)} aria-label="Model" className={`${SECICI} w-56`}>
                      {modeller.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </AyarSatiri>
                  <AyarSatiri
                    baslik="Bağlam sınırı"
                    aciklama={baglamOzellestirilebilir ? 'Modelin aynı anda hatırlayabildiği miktar. Sunucudaki ayarla uyumlu seçin.' : 'Seçili model için bilinen değer.'}
                  >
                    {baglamOzellestirilebilir ? (
                      <select
                        value={getModelContextLimit(secilenSaglayici, aktifModel, ayarlar.customContextLimits)}
                        onChange={(e) => void setCustomContextLimit(secilenSaglayici, Number(e.target.value))}
                        aria-label="Bağlam sınırı"
                        className={`${SECICI} w-56 font-mono`}
                      >
                        {ADJUSTABLE_CONTEXT_PRESETS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label} ({p.value.toLocaleString('tr-TR')})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-mono text-xs text-gray-300">{getModelContextLimit(secilenSaglayici, aktifModel, ayarlar.customContextLimits).toLocaleString('tr-TR')} token</span>
                    )}
                  </AyarSatiri>
                </AyarBolumu>

                <AyarBolumu baslik="API anahtarı" aciklama="Anahtar yalnızca bu bilgisayarda, işletim sistemi düzeyinde şifrelenerek saklanır; hiçbir harici sunucuya gönderilmez.">
                  <AyarSatiri
                    baslik={saglayiciAyarliMi ? 'Anahtar kayıtlı' : 'Anahtar girilmedi'}
                    aciklama={bilgi?.aciklama}
                    alt={
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={anahtarGirdisi}
                          onChange={(e) => setAnahtarGirdisi(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void anahtarKaydet()
                          }}
                          placeholder={saglayiciAyarliMi ? 'Yeni anahtar girerseniz üzerine yazılır' : bilgi?.placeholder}
                          autoComplete="off"
                          aria-label="API anahtarı"
                          className={`${GIRIS} min-w-0 flex-1`}
                        />
                        <button onClick={() => void anahtarKaydet()} disabled={!anahtarGirdisi.trim() || kaydediliyor} className={BIRINCIL_DUGME}>
                          Kaydet
                        </button>
                        {saglayiciAyarliMi && (
                          <button onClick={() => void clearApiKey(secilenSaglayici)} className={`${KUCUK_DUGME} text-red-300 hover:enabled:bg-red-950/60`}>
                            Kaldır
                          </button>
                        )}
                      </div>
                    }
                  >
                    {saglayiciAyarliMi && (
                      <span className="flex items-center gap-1.5 text-[11.5px] text-emerald-400">
                        <CheckIcon /> kayıtlı
                      </span>
                    )}
                  </AyarSatiri>
                </AyarBolumu>

                {yerel && (
                  <AyarBolumu baslik="Yerel sunucu" aciklama="Ollama ya da LM Studio başka bir bilgisayarda ya da farklı portta çalışıyorsa adresi girin.">
                    <AyarSatiri
                      baslik="Sunucu adresi"
                      aciklama={`Boş bırakırsanız ${VARSAYILAN_ADRES[secilenSaglayici]} kullanılır.`}
                      alt={
                        <div className="flex gap-2">
                          <input
                            value={adresler[secilenSaglayici] ?? ''}
                            onChange={(e) => setAdresler((a) => ({ ...a, [secilenSaglayici]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void adresKaydet()
                            }}
                            placeholder={VARSAYILAN_ADRES[secilenSaglayici]}
                            aria-label="Sunucu adresi"
                            className={`${GIRIS} min-w-0 flex-1 font-mono`}
                          />
                          <button onClick={() => void adresKaydet()} className={BIRINCIL_DUGME}>
                            Kaydet
                          </button>
                        </div>
                      }
                    />
                    <AyarSatiri baslik="Araç çağırma biçimi" aciklama="Yerel modellerin dosya okuma/yazma gibi araçları nasıl kullanacağı. Emin değilseniz Otomatik’te bırakın.">
                      <select
                        value={aracModu}
                        onChange={(e) => {
                          const m = e.target.value as LocalToolMode
                          setAracModu(m)
                          ayarYaz('localToolMode', m)
                        }}
                        aria-label="Araç çağırma biçimi"
                        className={`${SECICI} w-48`}
                      >
                        {(Object.keys(ARAC_MODU_ADLARI) as LocalToolMode[]).map((m) => (
                          <option key={m} value={m}>
                            {ARAC_MODU_ADLARI[m]}
                          </option>
                        ))}
                      </select>
                    </AyarSatiri>
                  </AyarBolumu>
                )}

                <AyarBolumu baslik="Davranış">
                  <AyarSatiri baslik="Değişiklikten sonra otomatik derle" aciklama="Cloud AI dosya değiştirince derler, hata çıkarsa kendisi düzeltmeyi dener.">
                    <Anahtar
                      acik={otoDerleme}
                      etiket="Otomatik derle"
                      onDegis={(v) => {
                        setOtoDerleme(v)
                        ayarYaz('agentAutoCompile', v)
                      }}
                    />
                  </AyarSatiri>
                </AyarBolumu>
              </>
            )}

            {sekme === 'gecmis' && (
              <AyarBolumu baslik="Otomatik anlık görüntüler" aciklama="Projenin eski hallerine dönebilmek için kendiliğinden alınan kayıtlar. Elle kaydettikleriniz ve etiketledikleriniz hiçbir zaman silinmez.">
                <AyarSatiri baslik="Otomatik anlık görüntü al" aciklama="Kaydetmeden önce ve yapay zekâ dosyalara dokunmadan önce projenin mevcut hali saklanır.">
                  <Anahtar
                    acik={gecmisOtomatik}
                    etiket="Otomatik anlık görüntü"
                    onDegis={(v) => {
                      setGecmisOtomatik(v)
                      ayarYaz('historyAutoSnapshot', v)
                    }}
                  />
                </AyarSatiri>
                <AyarSatiri baslik="Saklanacak otomatik kayıt sayısı" aciklama="Sınır aşılınca en eski otomatik kayıtlar silinir.">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={10}
                      max={200}
                      step={10}
                      value={gecmisLimit}
                      onChange={(e) => setGecmisLimit(Number(e.target.value))}
                      onMouseUp={() => ayarYaz('historyMaxAuto', gecmisLimit)}
                      onKeyUp={() => ayarYaz('historyMaxAuto', gecmisLimit)}
                      aria-label="Saklanacak otomatik kayıt sayısı"
                      className="w-36 accent-accent"
                    />
                    <span className="w-8 text-right font-mono text-xs text-gray-300">{gecmisLimit}</span>
                  </div>
                </AyarSatiri>
              </AyarBolumu>
            )}

            {sekme === 'guncelleme' && (
              <AyarBolumu baslik="Uygulama güncellemesi" aciklama="Yalnızca GitHub’daki sürümler sayfasına bakılır; hiçbir kullanım verisi gönderilmez. Güncelleme, siz onaylamadan indirilmez ya da kurulmaz.">
                <AyarSatiri baslik="Yeni sürümü arka planda denetle" aciklama="Açılışta ve sonra altı saatte bir.">
                  <Anahtar
                    acik={guncellemeDenetimi}
                    etiket="Güncelleme denetimi"
                    onDegis={(v) => {
                      setGuncellemeDenetimi(v)
                      ayarYaz('autoUpdateCheck', v)
                    }}
                  />
                </AyarSatiri>
                <AyarSatiri baslik="Şimdi denetle" aciklama={guncellemeMetni || undefined}>
                  <button
                    onClick={() => void window.api.updater.check()}
                    disabled={guncelleme.durum === 'denetleniyor' || guncelleme.durum === 'indiriliyor' || guncelleme.durum === 'desteklenmiyor'}
                    className={KUCUK_DUGME}
                  >
                    Denetle
                  </button>
                </AyarSatiri>
              </AyarBolumu>
            )}

            {sekme === 'hakkinda' && (
              <>
                <AyarBolumu baslik="Cloud IDE">
                  <AyarSatiri baslik="Sürüm" aciklama={surum ? `Kod adı: ${surumAdiBul(surum).ad} · beta` : undefined}>
                    <span className="font-mono text-xs text-gray-200">{surum ? `v${surum}` : '…'}</span>
                  </AyarSatiri>
                  <AyarSatiri baslik="Lisans" aciklama="Açık kaynak; kaynak koduna GitHub’dan ulaşabilirsiniz.">
                    <span className="font-mono text-xs text-gray-200">GPL-3.0</span>
                  </AyarSatiri>
                  <AyarSatiri baslik="Geliştirici" aciklama="Efe Ali Bozkurt" />
                </AyarBolumu>
                <AyarBolumu baslik="Yardım">
                  <AyarSatiri baslik="Yardım ve rehber" aciklama="Kullanım kılavuzu, kısayollar ve sorun giderme (F1).">
                    <button onClick={() => yardimAc()} className={KUCUK_DUGME}>
                      Aç
                    </button>
                  </AyarSatiri>
                  <AyarSatiri baslik="Sorun bildir" aciklama="Sistem ve derleme bilgisinden, kişisel bilgiler temizlenmiş bir rapor hazırlar. Göndermeden önce siz gözden geçirirsiniz.">
                    <button
                      onClick={() => {
                        onClose()
                        sorunBildirAc()
                      }}
                      className={KUCUK_DUGME}
                    >
                      Rapor hazırla
                    </button>
                  </AyarSatiri>
                  <AyarSatiri baslik="Başlangıç turu" aciklama="Önemli yerleri adım adım gösteren kısa tur.">
                    <button
                      onClick={() => {
                        onClose()
                        turuBaslat()
                      }}
                      className={KUCUK_DUGME}
                    >
                      Turu izle
                    </button>
                  </AyarSatiri>
                </AyarBolumu>
              </>
            )}
          </div>
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
