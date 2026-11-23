import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useGuncelleme } from '../../hooks/useGuncelleme'
import { Tus } from '../common/Tus'
import { useT } from '../../i18n'

/**
 * Üst çubukta yeni sürüm varsa beliren küçük düğme. Tıklayınca sürüm notlarını gösterir; indirme ve kurulum
 * yalnızca kullanıcı onayıyla yapılır.
 */
function GuncellemeDugmesi(): ReactElement | null {
  const t = useT()
  const g = useGuncelleme()
  const [acik, setAcik] = useState(false)
  const kapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!acik) return
    const disari = (e: MouseEvent): void => {
      if (kapRef.current && !kapRef.current.contains(e.target as Node)) setAcik(false)
    }
    window.addEventListener('mousedown', disari)
    return () => window.removeEventListener('mousedown', disari)
  }, [acik])

  if (g.durum !== 'var' && g.durum !== 'indiriliyor' && g.durum !== 'hazir') return null

  const etiket = g.durum === 'hazir' ? t('Kurmaya hazır') : g.durum === 'indiriliyor' ? t('İndiriliyor %{n}', { n: g.yuzde ?? 0 }) : `${t('Yeni sürüm')} ${g.surum ?? ''}`.trim()

  return (
    <div ref={kapRef} className="relative">
      <button
        onClick={() => setAcik((a) => !a)}
        aria-expanded={acik}
        title={t('Uygulama güncellemesi')}
        className="flex h-7 items-center gap-1.5 rounded border border-accent/60 bg-accent/10 px-2 text-xs text-[#7cc4f0] transition-colors hover:bg-accent/20"
      >
        <span className={`h-1.5 w-1.5 rounded-full bg-[#7cc4f0] ${g.durum === 'var' ? 'animate-pulse' : ''}`} aria-hidden="true" />
        {etiket}
      </button>

      {acik && (
        <div role="dialog" aria-label={t('Güncelleme')} className="absolute right-0 top-full z-50 mt-1.5 w-80 max-w-[calc(100vw-1rem)] rounded-[8px] border border-panel-border bg-panel-light p-3.5 shadow-2xl">
          <p className="font-mono text-[10.5px] tracking-wide text-gray-500">{t('GÜNCELLEME')}</p>
          <h3 className="mt-0.5 text-[13px] font-semibold text-gray-100">Cloud IDE {g.surum}</h3>

          {g.notlar && <p className="mt-2 max-h-44 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-gray-400 [overflow-wrap:anywhere]">{g.notlar}</p>}

          {g.durum === 'indiriliyor' && (
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${g.yuzde ?? 0}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] text-gray-500">{t('İndiriliyor… uygulamayı kullanmaya devam edebilirsiniz.')}</p>
            </div>
          )}

          {g.durum === 'hazir' && <p className="mt-2 text-[11.5px] leading-relaxed text-gray-500">{t('Kaydedilmemiş çalışmanız varsa önce kaydedin. Uygulamayı kapattığınızda da kurulur.')}</p>}

          <div className="mt-3.5 flex justify-end gap-2">
            <Tus onClick={() => setAcik(false)}>{t('Sonra')}</Tus>
            {g.durum === 'var' && (
              <Tus tur="birincil" onClick={() => void (g.elleIndir ? window.api.updater.openReleases() : window.api.updater.download())}>
                {g.elleIndir ? t('Sürümler sayfasını aç') : t('İndir')}
              </Tus>
            )}
            {g.durum === 'hazir' && (
              <Tus tur="birincil" onClick={() => void window.api.updater.install()}>
                {t('Yeniden başlat ve kur')}
              </Tus>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default GuncellemeDugmesi
