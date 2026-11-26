import { useEffect, useRef, useState, type ReactElement } from 'react'
import { providerList, type AIProviderId, type CustomAIProvider, type ReasoningEffort } from '@shared/types'
import { useT } from '../../i18n'

const MUHAKEME_SECENEKLERI: Array<{ id: ReasoningEffort; ad: string; aciklama: string }> = [
  { id: 'low', ad: 'Hızlı', aciklama: 'Düşük Muhakeme: Hızlı ve doğrudan kod odaklı yanıt.' },
  { id: 'medium', ad: 'Dengeli', aciklama: 'Orta Muhakeme: Dengeli mimari ve donanım açıklaması.' },
  { id: 'high', ad: 'Derin', aciklama: 'Yüksek Muhakeme: Derin donanım, register ve bellek analizi.' }
]

const SECICI =
  'mt-1 h-7 w-full rounded border border-panel-border bg-panel px-1.5 text-gray-200 outline-none focus:border-accent disabled:opacity-50'

interface Props {
  saglayici: AIProviderId
  ozelSaglayicilar?: CustomAIProvider[]
  model: string
  modeller: string[]
  yukleniyor: boolean
  /** Seçili sağlayıcının API anahtarı var mı (yerel sağlayıcılarda gerekmez) */
  anahtarVar: boolean
  anahtarliSaglayicilar: AIProviderId[]
  muhakeme: ReasoningEffort
  /** Asistan çalışırken seçim değiştirilemez */
  disabled: boolean
  onSaglayici: (id: AIProviderId) => void
  onModel: (model: string) => void
  onMuhakeme: (duzey: ReasoningEffort) => void
}

/**
 * Sohbet kutusunun altında yalnızca "model adı + düşünme düzeyi" yazar; tıklanınca
 * sağlayıcı, model ve düşünme düzeyi seçilen küçük bir pencere açılır.
 */
function ModelSecici(p: Props): ReactElement {
  const t = useT()
  const [acik, setAcik] = useState(false)
  const kapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!acik) return
    const disTik = (e: MouseEvent): void => {
      if (!kapRef.current?.contains(e.target as Node)) setAcik(false)
    }
    const tus = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setAcik(false)
    }
    document.addEventListener('mousedown', disTik)
    document.addEventListener('keydown', tus)
    return () => {
      document.removeEventListener('mousedown', disTik)
      document.removeEventListener('keydown', tus)
    }
  }, [acik])

  const saglayicilar = providerList(p.ozelSaglayicilar)
  const saglayiciAdi = saglayicilar.find((s) => s.id === p.saglayici)?.name ?? p.saglayici
  const modelSecenekleri = p.model && !p.modeller.includes(p.model) ? [p.model, ...p.modeller] : p.modeller
  const duzey = MUHAKEME_SECENEKLERI.find((x) => x.id === p.muhakeme) ?? MUHAKEME_SECENEKLERI[1]
  // "moonshotai/kimi-k3" gibi adlarda yalnızca son parça gösterilir
  const kisaModel = p.model ? p.model.slice(p.model.lastIndexOf('/') + 1) : t('Model seçin')

  return (
    // Açılır pencere sohbet kutusuna göre konumlansın diye burada "relative" yok
    <div ref={kapRef} className="flex min-w-0">
      <button
        type="button"
        onClick={() => setAcik((a) => !a)}
        aria-expanded={acik}
        aria-label={t('Model ve düşünme düzeyi')}
        title={`${saglayiciAdi} · ${p.model || t('Model seçin')}`}
        className="flex h-6 min-w-0 items-center gap-1.5 rounded px-1.5 text-[11.5px] hover:bg-white/[0.06]"
      >
        <span className="truncate text-gray-200">{kisaModel}</span>
        {p.anahtarVar ? (
          <span className="shrink-0 text-gray-500">{t(duzey.ad)}</span>
        ) : (
          <span className="shrink-0 text-amber-300">{t('anahtar yok')}</span>
        )}
      </button>

      {acik && (
        <div className="absolute inset-x-0 bottom-full z-40 mb-2 rounded border border-panel-border bg-panel-light p-3 text-xs text-gray-400 shadow-lg">
          <label className="block">
            {t('Sağlayıcı')}
            <select value={p.saglayici} onChange={(e) => p.onSaglayici(e.target.value as AIProviderId)} disabled={p.disabled} aria-label={t('Sağlayıcı')} className={SECICI}>
              {saglayicilar.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {p.anahtarliSaglayicilar.includes(s.id) ? '' : ` (${t('anahtar yok')})`}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-2 block">
            {t('Model')}
            <select value={p.model} onChange={(e) => p.onModel(e.target.value)} disabled={p.disabled || p.yukleniyor || modelSecenekleri.length === 0} aria-label={t('Model')} className={SECICI}>
              {modelSecenekleri.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          {p.yukleniyor && <p className="mt-1 text-gray-500">{t('Modeller listeleniyor…')}</p>}
          {!p.anahtarVar && <p className="mt-2 leading-relaxed text-amber-300">{t('API anahtarı yok. Ayarlar › Yapay zekâ bölümünden ekleyin.')}</p>}

          <p className="mt-2.5">{t('Düşünme düzeyi')}</p>
          <div role="radiogroup" aria-label={t('Düşünme düzeyi')} className="mt-1 grid grid-cols-3 gap-0.5 rounded border border-panel-border bg-panel p-0.5">
            {MUHAKEME_SECENEKLERI.map((x) => (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={p.muhakeme === x.id}
                onClick={() => p.onMuhakeme(x.id)}
                disabled={p.disabled}
                title={t(x.aciklama)}
                className={`rounded-[3px] py-0.5 disabled:opacity-50 ${p.muhakeme === x.id ? 'bg-white/[0.12] text-gray-100' : 'text-gray-500 hover:text-gray-200'}`}
              >
                {t(x.ad)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ModelSecici
