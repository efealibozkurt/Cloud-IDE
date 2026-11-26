import { useEffect, useRef, useState, type ReactElement } from 'react'
import { AI_PROVIDERS, isCustomProvider, isLocalProvider, type AIProviderId, type ProviderTestResult } from '@shared/types'
import { ANAHTAR_SAYFALARI, KART_ONERILERI, cekirdekKurulu, kartiBul, type KartOnerisi } from '@shared/ilkKurulum'
import { useAppState } from '../../state/AppStateContext'
import { kartGorseli, kartRengi } from '../../utils/boardImages'
import BoardThumb from '../common/BoardThumb'
import { Tus } from '../common/Tus'
import { useT } from '../../i18n'

/** Sihirbaz tamamlandı ya da atlandı: bir daha kendiliğinden açılmaz (Yardım'dan yeniden açılabilir) */
export const KURULUM_TAMAM_ANAHTARI = 'cloud_ide_kurulum_tamam'

type YapayZekaModu = 'bulut' | 'yerel' | 'atla'

const ADIMLAR = ['Kartınız', 'Yapay zekâ', 'Hazır'] as const

const BULUT_SAGLAYICILAR = AI_PROVIDERS.filter((p) => !isLocalProvider(p.id))
const YEREL_SAGLAYICILAR = AI_PROVIDERS.filter((p) => isLocalProvider(p.id))

interface Props {
  /** `turuBaslat`: sihirbaz bittiğinde uygulama turu başlatılsın mı */
  onBitti: (turuBaslat: boolean) => void
  /** İlk açılışta kendiliğinden mi açıldı (bitince tura geçilir), Yardım'dan mı */
  ilkAcilis: boolean
}

/**
 * İlk kurulum sihirbazı: kart seçimi (gerekirse çekirdek kurulumu) ve yapay zekâ bağlantısı
 * (bulut anahtarı ya da yerel model) birkaç adımda ayarlanır. Her adım atlanabilir.
 */
function IlkKurulumSihirbazi({ onBitti, ilkAcilis }: Props): ReactElement {
  const t = useT()
  const { state, selectFqbn, refreshPlatforms, setSelectedAiProvider, setSelectedAiModel, saveApiKey } = useAppState()
  const [adim, setAdim] = useState(0)
  const canli = useRef(true)

  // Kart adımı
  const [kuruluyor, setKuruluyor] = useState<string | null>(null)
  const [kurulumSatiri, setKurulumSatiri] = useState('')
  const [kartHatasi, setKartHatasi] = useState('')
  const [secilenKartAdi, setSecilenKartAdi] = useState<string | null>(null)
  const operasyonRef = useRef<string | null>(null)
  /** Süren kurulumun geçen süresi (sn): satır gelmese de işlemin sürdüğü belli olsun */
  const [gecenSure, setGecenSure] = useState(0)
  const iptalRef = useRef(false)

  // Yapay zekâ adımı
  const baslangicSaglayici = state.settings?.selectedAiProvider
  const [mod, setMod] = useState<YapayZekaModu>(
    baslangicSaglayici ? (isLocalProvider(baslangicSaglayici) ? 'yerel' : 'bulut') : 'bulut'
  )
  const [bulutSaglayici, setBulutSaglayici] = useState<AIProviderId>(
    baslangicSaglayici && !isLocalProvider(baslangicSaglayici) && !isCustomProvider(baslangicSaglayici) ? baslangicSaglayici : 'gemini'
  )
  const [yerelSaglayici, setYerelSaglayici] = useState<AIProviderId>(
    baslangicSaglayici && isLocalProvider(baslangicSaglayici) ? baslangicSaglayici : 'ollama'
  )
  const [anahtar, setAnahtar] = useState('')
  const [deniyor, setDeniyor] = useState(false)
  const [sonuc, setSonuc] = useState<ProviderTestResult | null>(null)
  const [baglananSaglayici, setBaglananSaglayici] = useState<AIProviderId | null>(null)

  useEffect(() => {
    canli.current = true
    return () => {
      canli.current = false
    }
  }, [])

  // Çekirdek kurulumunun son günlük satırını göster
  useEffect(() => {
    return window.api.arduinoCli.onOperationEvent((olay) => {
      if (olay.kind !== 'installCore' || olay.operationId !== operasyonRef.current || olay.phase !== 'log' || !olay.message) return
      setKurulumSatiri(olay.message.trim().slice(0, 120))
    })
  }, [])

  useEffect(() => {
    if (!kuruluyor) return
    const bas = Date.now()
    setGecenSure(0)
    const sayac = setInterval(() => setGecenSure(Math.floor((Date.now() - bas) / 1000)), 1000)
    return () => clearInterval(sayac)
  }, [kuruluyor])

  const kurulumuIptalEt = (): void => {
    if (!operasyonRef.current) return
    iptalRef.current = true
    void window.api.arduinoCli.cancelOperation(operasyonRef.current)
  }

  const kapat = (turuBaslat: boolean): void => {
    try {
      localStorage.setItem(KURULUM_TAMAM_ANAHTARI, '1')
    } catch {
      // depolama yoksa sihirbaz bir sonraki açılışta yeniden çıkabilir
    }
    onBitti(turuBaslat)
  }

  useEffect(() => {
    const tus = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !kuruluyor && !deniyor) kapat(ilkAcilis)
    }
    window.addEventListener('keydown', tus)
    return () => window.removeEventListener('keydown', tus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kuruluyor, deniyor])

  const kartiSec = async (oneri: KartOnerisi): Promise<void> => {
    setKartHatasi('')
    let platformlar = state.arduinoCli.platforms
    if (!cekirdekKurulu(platformlar, oneri.cekirdek)) {
      const operationId = crypto.randomUUID()
      operasyonRef.current = operationId
      setKuruluyor(oneri.id)
      setKurulumSatiri('')
      iptalRef.current = false
      try {
        await window.api.arduinoCli.installCore(oneri.cekirdek, operationId)
        platformlar = await window.api.arduinoCli.listCores()
        await refreshPlatforms()
      } catch (hata) {
        if (canli.current)
          setKartHatasi(
            iptalRef.current
              ? t('Kurulum iptal edildi.')
              : hata instanceof Error
                ? hata.message
                : t('Kart paketi kurulamadı. İnternet bağlantınızı kontrol edin.')
          )
        return
      } finally {
        if (canli.current) setKuruluyor(null)
      }
    }
    const kart = kartiBul(oneri, platformlar)
    if (!kart) {
      if (canli.current) setKartHatasi(t('Kart paketi kuruldu ama bu kart listede bulunamadı. Kart yöneticisinden seçebilirsiniz.'))
      return
    }
    selectFqbn(kart.fqbn)
    if (canli.current) setSecilenKartAdi(kart.name)
  }

  const yapayZekayiBagla = async (): Promise<void> => {
    const saglayici = mod === 'bulut' ? bulutSaglayici : yerelSaglayici
    setDeniyor(true)
    setSonuc(null)
    try {
      if (mod === 'bulut') {
        if (!anahtar.trim() && !state.configuredAiProviders.includes(saglayici)) {
          setSonuc({ ok: false, message: t('Önce API anahtarını yapıştırın.'), details: [] })
          return
        }
        if (anahtar.trim()) await saveApiKey(saglayici, anahtar.trim())
      }
      // Gemini'de eski modeller yeni kullanıcılara kapalı olabiliyor: modeli önce listeden seç,
      // böylece denenen model ile sonra kullanılacak model aynı olur
      let denenecekModel: string | undefined
      if (saglayici === 'gemini') {
        const liste = await window.api.chat.getProviderModels(saglayici).catch(() => [] as string[])
        const mevcut = state.settings?.selectedModelPerProvider?.[saglayici]
        denenecekModel = mevcut && liste.includes(mevcut) ? mevcut : liste[0]
      }
      const test = await window.api.agent.testProvider(saglayici, denenecekModel)
      if (!canli.current) return
      setSonuc(test)
      if (test.ok) {
        // Aktif sağlayıcı yalnızca bağlantı çalıştığında değişir (başarısız denemede eskisi korunur)
        setSelectedAiProvider(saglayici)
        setAnahtar('')
        setBaglananSaglayici(saglayici)
        // Model seçilmemişse listedeki ilkini seç
        try {
          const modeller = await window.api.chat.getProviderModels(saglayici)
          const mevcut = state.settings?.selectedModelPerProvider?.[saglayici]
          if (modeller.length > 0 && (!mevcut || !modeller.includes(mevcut))) await setSelectedAiModel(saglayici, modeller[0])
        } catch {
          // Model listesi alınamazsa Ayarlar'dan seçilebilir
        }
      }
    } catch (hata) {
      if (canli.current) setSonuc({ ok: false, message: hata instanceof Error ? hata.message : t('Bağlantı denenemedi'), details: [] })
    } finally {
      if (canli.current) setDeniyor(false)
    }
  }

  const secili = state.arduinoCli.selectedFqbn
  const secilenKart = secilenKartAdi ?? (secili ? state.arduinoCli.platforms.flatMap((p) => p.boards).find((b) => b.fqbn === secili)?.name ?? secili : null)
  const meşgul = Boolean(kuruluyor) || deniyor
  const sonAdim = adim === ADIMLAR.length - 1
  const aiAdi = baglananSaglayici ? AI_PROVIDERS.find((p) => p.id === baglananSaglayici)?.name : null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-5">
      <div role="dialog" aria-modal="true" aria-label={t('İlk kurulum')} className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-[8px] border border-panel-border bg-panel-light shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-panel-border px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-100">{t('Cloud IDE’ye hoş geldiniz')}</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">{t('İki kısa ayar: kartınız ve yapay zekâ. İstediğiniz adımı atlayabilirsiniz.')}</p>
          </div>
          <button onClick={() => !meşgul && kapat(ilkAcilis)} disabled={meşgul} aria-label={t('Sihirbazı kapat')} className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-white/[0.08] hover:text-gray-200 disabled:opacity-40">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <ol className="flex shrink-0 items-center gap-2 border-b border-panel-border px-5 py-2 text-[11px]" aria-label={t('Adımlar')}>
          {ADIMLAR.map((ad, i) => (
            <li key={ad} aria-current={i === adim ? 'step' : undefined} className={`flex items-center gap-1.5 ${i === adim ? 'font-medium text-gray-100' : i < adim ? 'text-gray-400' : 'text-gray-600'}`}>
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${i === adim ? 'bg-accent text-white' : i < adim ? 'bg-[#3ddc84]/20 text-[#3ddc84]' : 'bg-white/[0.06]'}`}>{i < adim ? '✓' : i + 1}</span>
              {t(ad)}
              {i < ADIMLAR.length - 1 && <span className="mx-1 text-gray-700">›</span>}
            </li>
          ))}
        </ol>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-xs [overflow-wrap:anywhere]">
          {adim === 0 && (
            <div>
              <p className="text-[13px] font-medium text-gray-100">{t('Hangi kartla çalışıyorsunuz?')}</p>
              <p className="mt-1 leading-relaxed text-gray-400">{t('Seçtiğiniz kart, derleme ve pin denetimi için kullanılır. Kart paketi kurulu değilse indirilir (birkaç dakika sürebilir).')}</p>
              <p className="mt-2 rounded-[5px] border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2 leading-relaxed text-amber-200">
                {t('İlk kurulumda Arduino Uno önerilir: paketi küçüktür, hızlı kurulur (Nano ve Mega da aynı paketi kullanır). ESP32, Deneyap gibi kartların paketleri büyüktür; internet hızınıza göre kurulum uzun sürebilir.')}
              </p>
              {kuruluyor && (
                <div className="sticky top-0 z-10 mt-2 rounded-[6px] border border-accent/60 bg-panel px-3 py-2 text-gray-300" role="status">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 animate-spin rounded-full border border-gray-400 border-t-transparent" />
                    <span className="min-w-0 flex-1 text-gray-100">
                      {t('{kart} için paket indiriliyor ve kuruluyor…', { kart: KART_ONERILERI.find((o) => o.id === kuruluyor)?.ad ?? '' })}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-gray-400">
                      {String(Math.floor(gecenSure / 60)).padStart(2, '0')}:{String(gecenSure % 60).padStart(2, '0')}
                    </span>
                    <Tus onClick={kurulumuIptalEt}>{t('İptal')}</Tus>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                    <div className="h-full w-1/3 animate-[kurulum-kayan_1.4s_ease-in-out_infinite] rounded-full bg-accent" />
                  </div>
                  <p className="mt-1.5 truncate font-mono text-[10.5px] text-gray-500">{kurulumSatiri || t('Paket listesi hazırlanıyor…')}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">{t('Bitene kadar bu pencere açık kalsın.')}</p>
                </div>
              )}
              <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {KART_ONERILERI.map((o) => {
                  const kurulu = cekirdekKurulu(state.arduinoCli.platforms, o.cekirdek)
                  const buKart = kartiBul(o, state.arduinoCli.platforms)
                  const aktif = Boolean(buKart && buKart.fqbn === secili)
                  const bu = kuruluyor === o.id
                  const gorsel = kartGorseli({ fqbn: o.fqbn, name: o.ad }, true)
                  return (
                    <li key={o.id}>
                      <button
                        onClick={() => void kartiSec(o)}
                        disabled={meşgul}
                        aria-pressed={aktif}
                        className={`flex w-full items-center gap-3 rounded-[6px] border px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed ${aktif ? 'border-white/40 bg-white/[0.08]' : 'border-panel-border hover:bg-white/[0.04]'} ${meşgul && !bu ? 'opacity-50' : ''}`}
                      >
                        <BoardThumb src={gorsel} genislik={54} renk={kartRengi({ fqbn: o.fqbn, name: o.ad })} alt="" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] text-gray-100">
                            {o.ad}
                            {o.id === 'uno' && <span className="ml-1.5 rounded-[3px] border border-amber-400/40 px-1 text-[10px] text-amber-200">{t('Önerilen')}</span>}
                          </span>
                          <span className="block text-[11px] text-gray-500">
                            {bu ? t('Kuruluyor…') : aktif ? t('Seçili') : kurulu ? t(o.aciklama) : `${t(o.aciklama)} · ${t('indirme gerekir')}`}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {kartHatasi && <p className="mt-3 rounded-[5px] border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-rose-300" role="alert">{kartHatasi}</p>}
              {secilenKart && !kuruluyor && <p className="mt-3 text-gray-300">{t('Seçili kart')}: <span className="font-medium text-gray-100">{secilenKart}</span></p>}
              <p className="mt-3 text-[11px] text-gray-500">{t('Listede yoksa üst çubuktaki kart seçiciden ya da Kart Yöneticisi’nden başka bir kart seçebilirsiniz.')}</p>
            </div>
          )}

          {adim === 1 && (
            <div>
              <p className="text-[13px] font-medium text-gray-100">{t('Yapay zekâ asistanını nasıl kullanmak istersiniz?')}</p>
              <p className="mt-1 leading-relaxed text-gray-400">{t('Cloud AI kod yazar, derler ve hataları düzeltmeyi dener. Değişiklikleri sizin onayınızla uygular.')}</p>

              <div role="radiogroup" aria-label={t('Yapay zekâ türü')} className="mt-3 grid grid-cols-3 gap-2">
                {(
                  [
                    ['bulut', 'Bulut', 'API anahtarıyla'],
                    ['yerel', 'Bu bilgisayar', 'Ollama / LM Studio'],
                    ['atla', 'Şimdilik değil', 'Sonra Ayarlar\'dan']
                  ] as const
                ).map(([id, baslik, alt]) => (
                  <button
                    key={id}
                    role="radio"
                    aria-checked={mod === id}
                    onClick={() => {
                      setMod(id)
                      setSonuc(null)
                    }}
                    disabled={deniyor}
                    className={`rounded-[6px] border px-2.5 py-2 text-left transition-colors ${mod === id ? 'border-white/40 bg-white/[0.08]' : 'border-panel-border hover:bg-white/[0.04]'}`}
                  >
                    <span className="block text-[12.5px] text-gray-100">{t(baslik)}</span>
                    <span className="block text-[11px] text-gray-500">{t(alt)}</span>
                  </button>
                ))}
              </div>

              {mod === 'bulut' && (
                <div className="mt-3 space-y-2.5">
                  <label className="block text-gray-300">
                    {t('Sağlayıcı')}
                    <select value={bulutSaglayici} onChange={(e) => { setBulutSaglayici(e.target.value as AIProviderId); setSonuc(null); setAnahtar('') }} disabled={deniyor} className="mt-1 block h-8 w-full rounded-[5px] border border-panel-border bg-panel px-2 text-gray-100 outline-none focus:border-accent">
                      {BULUT_SAGLAYICILAR.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {state.configuredAiProviders.includes(p.id) ? ' ✓' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-gray-300">
                    {t('API anahtarı')}
                    <input
                      type="password"
                      value={anahtar}
                      onChange={(e) => setAnahtar(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !deniyor) void yapayZekayiBagla()
                      }}
                      disabled={deniyor}
                      placeholder={state.configuredAiProviders.includes(bulutSaglayici) ? t('Kayıtlı anahtar var; yenisini girerseniz üzerine yazılır') : t('Anahtarı buraya yapıştırın')}
                      autoComplete="off"
                      spellCheck={false}
                      className="mt-1 block h-8 w-full rounded-[5px] border border-panel-border bg-panel px-2 font-mono text-gray-100 outline-none placeholder:font-sans placeholder:text-gray-600 focus:border-accent"
                    />
                  </label>
                  <p className="text-[11px] leading-relaxed text-gray-500">
                    {t('Anahtar yalnızca bu bilgisayarda, işletim sistemi düzeyinde şifrelenerek saklanır.')}
                    {ANAHTAR_SAYFALARI[bulutSaglayici] && (
                      <>
                        {' '}
                        {t('Anahtar almak için:')}{' '}
                        <a href={ANAHTAR_SAYFALARI[bulutSaglayici]} target="_blank" rel="noopener noreferrer" className="text-[#7cc4f0] underline hover:text-[#8fd0f7]">
                          {ANAHTAR_SAYFALARI[bulutSaglayici]!.replace('https://', '')}
                        </a>
                      </>
                    )}
                  </p>
                </div>
              )}

              {mod === 'yerel' && (
                <div className="mt-3 space-y-2.5">
                  <label className="block text-gray-300">
                    {t('Yerel sunucu')}
                    <select value={yerelSaglayici} onChange={(e) => { setYerelSaglayici(e.target.value as AIProviderId); setSonuc(null) }} disabled={deniyor} className="mt-1 block h-8 w-full rounded-[5px] border border-panel-border bg-panel px-2 text-gray-100 outline-none focus:border-accent">
                      {YEREL_SAGLAYICILAR.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-[11px] leading-relaxed text-gray-500">
                    {t('Model bilgisayarınızda çalışır, hiçbir şey internete çıkmaz. Önce Ollama (ollama.com) ya da LM Studio’yu kurup bir model indirin ve sunucuyu başlatın, sonra “Bağlantıyı dene”ye basın.')}
                  </p>
                </div>
              )}

              {mod === 'atla' && <p className="mt-3 text-[11px] leading-relaxed text-gray-500">{t('Yapay zekâ olmadan da derleme, yükleme, pin denetimi, seri monitör ve sürüm geçmişi çalışır. Sağlayıcıyı sonra Ayarlar › Yapay zekâ bölümünden ekleyebilirsiniz.')}</p>}

              {mod !== 'atla' && (
                <div className="mt-3 flex items-center gap-2">
                  <Tus tur="birincil" onClick={() => void yapayZekayiBagla()} disabled={deniyor}>
                    {deniyor ? t('Deneniyor…') : mod === 'bulut' ? t('Kaydet ve dene') : t('Bağlantıyı dene')}
                  </Tus>
                </div>
              )}
              {sonuc && (
                <p role="status" className={`mt-3 rounded-[5px] border px-3 py-2 ${sonuc.ok ? 'border-[#3ddc84]/40 bg-[#3ddc84]/[0.06] text-[#8be9b1]' : 'border-rose-500/40 bg-rose-500/5 text-rose-300'}`}>
                  {sonuc.ok ? '✓ ' : ''}
                  {sonuc.message}
                </p>
              )}
            </div>
          )}

          {adim === 2 && (
            <div>
              <p className="text-[13px] font-medium text-gray-100">{t('Hazırsınız')}</p>
              <ul className="mt-3 space-y-2 text-gray-300">
                <li className="flex items-start gap-2">
                  <span className={secilenKart ? 'text-[#3ddc84]' : 'text-gray-600'}>{secilenKart ? '✓' : '○'}</span>
                  <span>{secilenKart ? <>{t('Kart')}: <span className="text-gray-100">{secilenKart}</span></> : t('Kart seçilmedi. Üst çubuktaki kart seçiciden sonra seçebilirsiniz.')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className={aiAdi ? 'text-[#3ddc84]' : 'text-gray-600'}>{aiAdi ? '✓' : '○'}</span>
                  <span>{aiAdi ? <>{t('Yapay zekâ')}: <span className="text-gray-100">{aiAdi}</span></> : t('Yapay zekâ bağlanmadı. Ayarlar › Yapay zekâ bölümünden ekleyebilirsiniz.')}</span>
                </li>
              </ul>
              <p className="mt-4 leading-relaxed text-gray-400">
                {ilkAcilis ? `${t('Şimdi kısa bir tur arayüzü tanıtacak.')} ` : ''}{t('Takıldığınız yerde')} <kbd className="font-mono text-gray-300">F1</kbd> {t('ile yardımı açabilirsiniz; bir sorun olursa Yardım › Sorun bildir ile rapor hazırlayabilirsiniz.')}
              </p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-panel-border px-5 py-3">
          <Tus onClick={() => kapat(ilkAcilis)} disabled={meşgul}>
            {t('Sihirbazı kapat')}
          </Tus>
          <div className="flex items-center gap-2">
            {adim > 0 && (
              <Tus onClick={() => setAdim((a) => a - 1)} disabled={meşgul}>
                {t('Geri')}
              </Tus>
            )}
            {sonAdim ? (
              <Tus tur="birincil" onClick={() => kapat(ilkAcilis)}>
                {ilkAcilis ? t('Turu başlat') : t('Bitir')}
              </Tus>
            ) : (
              <Tus tur="birincil" onClick={() => setAdim((a) => a + 1)} disabled={meşgul}>
                {(adim === 0 && !secilenKart) || (adim === 1 && !baglananSaglayici) ? t('Atla') : t('İleri')}
              </Tus>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default IlkKurulumSihirbazi
