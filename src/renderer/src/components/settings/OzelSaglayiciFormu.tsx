import { useState, type ReactElement } from 'react'
import {
  CUSTOM_PROVIDER_TEMPLATES,
  isLoopbackUrl,
  isValidCustomProviderUrl,
  newCustomProviderId,
  providersLosingKey,
  type CustomAIProvider,
  type ProviderTestResult
} from '@shared/types'
import { useAppState } from '../../state/AppStateContext'
import { useT } from '../../i18n'
import { BIRINCIL_DUGME, GIRIS, KUCUK_DUGME, SECICI } from './AyarBilesenleri'

interface Props {
  /** Verilirse var olan sağlayıcı düzenlenir */
  mevcut?: CustomAIProvider
  /** Sağlayıcı kaydedildiğinde (sınama sürerken de form açık kalır) */
  onKaydedildi: (saglayici: CustomAIProvider) => void
  onKapat: () => void
}

/** Kullanıcının OpenAI uyumlu bir servisi eklediği ya da düzenlediği form */
function OzelSaglayiciFormu({ mevcut, onKaydedildi, onKapat }: Props): ReactElement {
  const t = useT()
  const { state, saveCustomProvider, saveApiKey, setSelectedAiModel, setSelectedAiProvider } = useAppState()
  // Yeni sağlayıcının kimliği form açıkken sabit kalır; ikinci kayıt kopya oluşturmasın
  const [kimlik] = useState(() => mevcut?.id ?? newCustomProviderId())
  const [ad, setAd] = useState(mevcut?.name ?? '')
  const [adres, setAdres] = useState(mevcut?.baseUrl ?? '')
  const [anahtar, setAnahtar] = useState('')
  const [model, setModel] = useState(state.settings?.selectedModelPerProvider?.[kimlik] ?? '')
  const [modeller, setModeller] = useState<string[]>([])
  const [calisiyor, setCalisiyor] = useState(false)
  const [hata, setHata] = useState('')
  const [sonuc, setSonuc] = useState<ProviderTestResult | null>(null)

  const kayitli = (state.settings?.customAiProviders ?? []).find((s) => s.id === kimlik)
  const yeniSunucu = Boolean(kayitli) && providersLosingKey([kayitli!], [{ ...kayitli!, baseUrl: adres.trim() }]).length > 0
  const anahtarKayitli = state.configuredAiProviders.includes(kimlik) && !yeniSunucu
  const anahtarGerekli = !anahtarKayitli && !isLoopbackUrl(adres.trim())

  const sablonSec = (secilen: string): void => {
    const sablon = CUSTOM_PROVIDER_TEMPLATES.find((s) => s.name === secilen)
    if (!sablon) return
    setAd(sablon.name)
    setAdres(sablon.baseUrl)
    setSonuc(null)
  }

  const kaydetVeSina = async (): Promise<void> => {
    const tanim: CustomAIProvider = { id: kimlik, name: ad.trim(), baseUrl: adres.trim() }
    setSonuc(null)
    if (!tanim.name) return setHata(t('Sağlayıcıya bir ad verin.'))
    if (!isValidCustomProviderUrl(tanim.baseUrl)) {
      return setHata(t('Adres https:// ile başlamalı. http:// yalnızca bu bilgisayardaki (localhost) sunucular için kullanılabilir.'))
    }
    if (anahtarGerekli && !anahtar.trim()) return setHata(t('API anahtarını girin.'))
    setHata('')
    setCalisiyor(true)
    try {
      if (!(await saveCustomProvider(tanim))) return
      if (anahtar.trim()) {
        await saveApiKey(kimlik, anahtar)
        setAnahtar('')
      }
      setSelectedAiProvider(kimlik)
      onKaydedildi(tanim)

      const liste = await window.api.chat.getProviderModels(kimlik)
      setModeller(liste)
      const secilen = model.trim() || liste[0] || ''
      if (!secilen) return setHata(t('Model listesi alınamadı. Model adını elle yazıp yeniden deneyin.'))
      setModel(secilen)
      await setSelectedAiModel(kimlik, secilen)
      setSonuc(await window.api.agent.testProvider(kimlik, secilen))
    } catch (e) {
      setHata(e instanceof Error ? e.message : t('Bağlantı sınanamadı.'))
    } finally {
      setCalisiyor(false)
    }
  }

  const alan = (etiket: string, icerik: ReactElement): ReactElement => (
    <label className="grid grid-cols-[110px_1fr] items-center gap-2">
      <span className="text-[12px] text-gray-400">{etiket}</span>
      {icerik}
    </label>
  )

  return (
    <form
      aria-label={t('Özel sağlayıcı')}
      className="space-y-2 bg-panel px-3.5 py-3"
      onSubmit={(e) => {
        e.preventDefault()
        void kaydetVeSina()
      }}
    >
      <p className="text-[11.5px] leading-relaxed text-gray-500">{t('OpenAI uyumlu bir servis ekleyin. Sunucu adresini ve anahtarı servisin kendi sayfasından alabilirsiniz.')}</p>
      {!mevcut &&
        alan(
          t('Hazır şablon'),
          <select value={CUSTOM_PROVIDER_TEMPLATES.find((s) => s.baseUrl === adres)?.name ?? ''} onChange={(e) => sablonSec(e.target.value)} className={`${SECICI} w-full`}>
            <option value="">{t('Diğer')}</option>
            {CUSTOM_PROVIDER_TEMPLATES.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      {alan(t('Ad'), <input value={ad} onChange={(e) => setAd(e.target.value)} maxLength={40} placeholder={t('Örn. OpenRouter')} className={`${GIRIS} w-full`} />)}
      {alan(
        t('Sunucu adresi'),
        <input value={adres} onChange={(e) => setAdres(e.target.value)} placeholder="https://ornek.com/v1" spellCheck={false} className={`${GIRIS} w-full font-mono`} />
      )}
      {alan(
        t('API anahtarı'),
        <input
          type="password"
          value={anahtar}
          onChange={(e) => setAnahtar(e.target.value)}
          autoComplete="off"
          placeholder={anahtarKayitli ? t('Kayıtlı. Değiştirmeyecekseniz boş bırakın') : anahtarGerekli ? '' : t('Bu bilgisayardaki sunucularda isteğe bağlı')}
          className={`${GIRIS} w-full`}
        />
      )}
      {yeniSunucu && <p className="text-[11.5px] text-amber-300">{t('Sunucu değiştiği için anahtarı yeniden girmeniz gerekiyor.')}</p>}
      {alan(
        t('Model'),
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          list="ozel-modeller"
          maxLength={200}
          spellCheck={false}
          placeholder={t('Boş bırakırsanız listeden seçilir')}
          className={`${GIRIS} w-full font-mono`}
        />
      )}
      <datalist id="ozel-modeller">
        {modeller.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      {hata && (
        <p role="alert" className="text-[12px] text-red-300">
          {hata}
        </p>
      )}
      {sonuc && (
        <div role="status" className={`text-[12px] ${sonuc.ok ? 'text-emerald-400' : 'text-red-300'}`}>
          <p>{sonuc.message}</p>
          {!sonuc.ok && <p className="mt-0.5 text-[11px] text-gray-500">{t('Sağlayıcı kaydedildi; bilgileri düzeltip yeniden sınayabilirsiniz.')}</p>}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onKapat} className={KUCUK_DUGME}>
          {sonuc ? t('Kapat') : t('Vazgeç')}
        </button>
        <button type="submit" disabled={calisiyor} className={BIRINCIL_DUGME}>
          {calisiyor ? t('Sınanıyor…') : t('Kaydet ve sına')}
        </button>
      </div>
    </form>
  )
}

export default OzelSaglayiciFormu
