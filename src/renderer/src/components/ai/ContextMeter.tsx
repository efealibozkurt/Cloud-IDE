import { useEffect, useRef, useState, type ReactElement } from 'react'
import { ADJUSTABLE_CONTEXT_PRESETS, type AIProviderId } from '@shared/types'
import { useT } from '../../i18n'

export interface ContextMeterVerisi {
  /** Sistem istemi + kart profili için tahmini token */
  sistemTokens: number
  /** Açık dosyaların token sayısı */
  kodTokens: number
  /** Sohbet geçmişinin (varsa özetlenmiş haliyle) token sayısı */
  mesajTokens: number
  toplamTokens: number
  limitTokens: number
  mesajSayisi: number
  aktifDosyaAdi: string | null
  /** Eski mesajların özetlenip özetlenmediği */
  ozetlendi: boolean
}

interface ContextMeterProps {
  veri: ContextMeterVerisi
  saglayici: AIProviderId
  /** Tahmini değil, sağlayıcıdan gelen gerçek değer mi? */
  gercekKullanim?: boolean
  ozetleniyor: boolean
  mesgul: boolean
  bildirim: string | null
  onOzetle: () => void
  onLimitDegistir: (limit: number) => void
}

const UYARI_ESIGI = 70

export function formatToken(sayi: number): string {
  if (sayi >= 1_000_000) return `${(sayi / 1_000_000).toFixed(sayi % 1_000_000 === 0 ? 0 : 1)}M`
  if (sayi >= 1000) return `${(sayi / 1000).toFixed(sayi >= 100_000 ? 0 : 1)}K`
  return String(Math.round(sayi))
}

/**
 * Bağlam kullanımı göstergesi. Kapalıyken yalnızca ince bir çizgi ve
 * "12,4K / 128K" metni gösterir; tıklanınca nelerin bağlamı doldurduğunu
 * üç satırda listeler. Renk yalnızca eşik aşıldığında değişir.
 */
function ContextMeter({
  veri,
  saglayici,
  gercekKullanim = false,
  ozetleniyor,
  mesgul,
  bildirim,
  onOzetle,
  onLimitDegistir
}: ContextMeterProps): ReactElement {
  const t = useT()
  const [acik, setAcik] = useState(false)
  const kapsayiciRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!acik) return
    const disTik = (e: MouseEvent): void => {
      if (kapsayiciRef.current && !kapsayiciRef.current.contains(e.target as Node)) setAcik(false)
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

  const yuzde = Math.min(100, Math.max(0, (veri.toplamTokens / Math.max(1, veri.limitTokens)) * 100))
  const uyari = yuzde >= UYARI_ESIGI
  const cizgiRenk = uyari ? 'bg-amber-400' : 'bg-gray-400'
  const limitDuzenlenebilir = saglayici === 'nvidia' || saglayici === 'lmstudio' || saglayici === 'ollama'
  const onek = gercekKullanim ? '' : '~'

  const satirlar: Array<{ ad: string; ayrinti?: string; token: number }> = [
    { ad: t('Sohbet geçmişi'), ayrinti: `${t('{n} mesaj', { n: veri.mesajSayisi })}${veri.ozetlendi ? `, ${t('eskiler özetlendi')}` : ''}`, token: veri.mesajTokens },
    { ad: t('Açık dosyalar'), ayrinti: veri.aktifDosyaAdi ?? t('Dosya açık değil'), token: veri.kodTokens },
    { ad: t('Sistem ve kart bilgisi'), token: veri.sistemTokens }
  ]

  return (
    <div ref={kapsayiciRef} className="relative border-b border-panel-border/60">
      <button
        type="button"
        onClick={() => setAcik((a) => !a)}
        aria-expanded={acik}
        title={t('Bağlam kullanımı')}
        className="block w-full px-3 pb-1.5 pt-1 text-left hover:bg-white/[0.03]"
      >
        <div className="flex items-baseline justify-between text-[11px] text-gray-400">
          <span>{t('Bağlam')}</span>
          <span className={uyari ? 'text-amber-300' : ''}>
            {onek}
            {formatToken(veri.toplamTokens)} / {formatToken(veri.limitTokens)}
          </span>
        </div>
        <div className="mt-1 h-0.5 w-full bg-white/10">
          <div className={`h-full ${cizgiRenk} transition-[width] duration-300`} style={{ width: `${Math.max(1, yuzde)}%` }} />
        </div>
      </button>

      {acik && (
        <div className="absolute inset-x-2 top-full z-40 mt-1 rounded border border-panel-border bg-panel-light p-3 text-xs shadow-lg">
          <ul className="flex flex-col gap-1.5">
            {satirlar.map((s) => (
              <li key={s.ad} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-gray-300">
                  {s.ad}
                  {s.ayrinti && <span className="ml-1.5 truncate text-gray-500">{s.ayrinti}</span>}
                </span>
                <span className="shrink-0 tabular-nums text-gray-400">
                  {onek}
                  {formatToken(s.token)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex items-baseline justify-between border-t border-panel-border pt-2 text-gray-400">
            <span>
              {t('Model penceresi')}
              {limitDuzenlenebilir && (
                <select
                  value={veri.limitTokens}
                  onChange={(e) => onLimitDegistir(Number(e.target.value))}
                  className="ml-2 rounded border border-panel-border bg-panel px-1 py-0.5 text-xs text-gray-200 outline-none focus:border-accent"
                >
                  {ADJUSTABLE_CONTEXT_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              )}
            </span>
            {!limitDuzenlenebilir && <span className="tabular-nums">{formatToken(veri.limitTokens)}</span>}
          </div>

          <p className="mt-2 leading-relaxed text-gray-500">
            {t('Doluluk %{n} değerini geçince eski mesajlar kısa bir özetle değiştirilir.', { n: UYARI_ESIGI })}
          </p>

          {bildirim && <p className="mt-2 text-gray-300">{bildirim}</p>}

          <button
            type="button"
            onClick={onOzetle}
            disabled={ozetleniyor || mesgul || veri.mesajSayisi <= 4}
            title={veri.mesajSayisi <= 4 ? t('Sohbet henüz kısa') : undefined}
            className="mt-2 w-full rounded border border-panel-border px-3 py-1.5 text-gray-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:text-gray-600 disabled:hover:bg-transparent"
          >
            {ozetleniyor ? t('Özetleniyor…') : t('Geçmişi özetle')}
          </button>
        </div>
      )}
    </div>
  )
}

export default ContextMeter
