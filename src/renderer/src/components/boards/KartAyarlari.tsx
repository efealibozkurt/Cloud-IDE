import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { BoardConfigOption } from '@shared/types'
import { temelFqbn } from '@shared/boardFqbn'
import { useAppState } from '../../state/AppStateContext'
import { useT } from '../../i18n'

/** Bilinen seçenekler için kısa ipuçları (anahtar: küçük harfli seçenek adı) */
const IPUCLARI: Record<string, string> = {
  cpu: 'Nano klonunda yükleme "not in sync" hatası veriyorsa "Old Bootloader" seçeneğini deneyin.',
  uploadspeed: 'Yükleme yarıda kesiliyorsa hızı düşürün (ör. 115200).',
  partitionscheme: 'Program kartın belleğine sığmıyorsa daha büyük uygulama alanı olan bir şema (Huge APP gibi) seçin.',
  cpufreq: 'Düşük hız daha az güç harcar; Wi-Fi/Bluetooth için genellikle 80 MHz ve üstü gerekir.',
  flashsize: 'Kartınızın gerçek flash boyutuyla aynı olmalıdır.'
}

/**
 * Seçili kartın ayarlanabilir seçenekleri (Arduino IDE'deki Araçlar menüsü karşılığı): işlemci, bölüm şeması,
 * yükleme hızı vb. Yalnızca seçeneği olan kartlarda görünür. Seçenekler karta özel saklanır ve
 * derleme/yükleme sırasında kart adına eklenir.
 */
function KartAyarlari(): ReactElement | null {
  const t = useT()
  const { state, setBoardOption } = useAppState()
  const fqbn = state.arduinoCli.selectedFqbn
  const temel = fqbn ? temelFqbn(fqbn) : null
  const [secenekler, setSecenekler] = useState<BoardConfigOption[]>([])
  const [acik, setAcik] = useState(false)
  const kapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSecenekler([])
    if (!temel) return
    let iptal = false
    window.api.arduinoCli
      .getBoardOptions(temel)
      .then((l) => !iptal && setSecenekler(l))
      .catch(() => undefined)
    return () => {
      iptal = true
    }
  }, [temel])

  useEffect(() => {
    if (!acik) return
    const disari = (e: MouseEvent): void => {
      if (kapRef.current && !kapRef.current.contains(e.target as Node)) setAcik(false)
    }
    const tus = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setAcik(false)
    }
    window.addEventListener('mousedown', disari)
    window.addEventListener('keydown', tus)
    return () => {
      window.removeEventListener('mousedown', disari)
      window.removeEventListener('keydown', tus)
    }
  }, [acik])

  if (!temel || secenekler.length === 0) return null

  const secili = state.settings?.boardOptions?.[temel] ?? {}
  const degisenSayisi = Object.keys(secili).filter((k) => secenekler.some((o) => o.option === k)).length

  return (
    <div ref={kapRef} className="relative">
      <button
        onClick={() => setAcik((a) => !a)}
        aria-expanded={acik}
        title={t('Kart ayarları (işlemci, bölüm şeması, yükleme hızı…)')}
        aria-label={t('Kart ayarları')}
        className={`relative flex h-7 w-7 items-center justify-center rounded border bg-panel transition-colors hover:bg-panel-border ${
          acik ? 'border-accent text-gray-100' : 'border-panel-border text-gray-400 hover:text-gray-200'
        }`}
      >
        <SlidersIcon />
        {degisenSayisi > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent ring-2 ring-panel-light" aria-label={t('Varsayılandan farklı ayar var')} />}
      </button>

      {acik && (
        <div role="dialog" aria-label={t('Kart ayarları')} className="absolute left-0 top-full z-50 mt-1.5 w-80 rounded-[8px] border border-panel-border bg-panel-light p-3.5 shadow-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-gray-100">{t('Kart ayarları')}</h3>
            {degisenSayisi > 0 && (
              <button
                onClick={() => secenekler.forEach((o) => void setBoardOption(temel, o.option, null))}
                className="text-[11px] text-gray-500 hover:text-gray-200"
              >
                {t('Varsayılana dön')}
              </button>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[10.5px] text-gray-500">{temel}</p>

          <div className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">
            {secenekler.map((o) => {
              const deger = secili[o.option] ?? o.varsayilan
              const ipucu = IPUCLARI[o.option.toLowerCase()]
              return (
                <label key={o.option} className="block text-xs text-gray-300">
                  {o.label}
                  <select
                    value={deger}
                    onChange={(e) => void setBoardOption(temel, o.option, e.target.value === o.varsayilan ? null : e.target.value)}
                    className="mt-1 block h-7 w-full rounded-[5px] border border-panel-border bg-panel px-2 text-xs text-gray-100 outline-none focus:border-accent"
                  >
                    {o.values.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label}
                        {v.value === o.varsayilan ? ` (${t('varsayılan')})` : ''}
                      </option>
                    ))}
                  </select>
                  {ipucu && <span className="mt-0.5 block text-[11px] leading-snug text-gray-600">{t(ipucu)}</span>}
                </label>
              )
            })}
          </div>
          <p className="mt-3 border-t border-panel-border pt-2 text-[11px] leading-relaxed text-gray-600">
            {t('Ayarlar bu kart için hatırlanır ve Derle/Yükle ile Cloud AI’ın derlemelerinde kullanılır.')}
          </p>
        </div>
      )}
    </div>
  )
}

function SlidersIcon(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </svg>
  )
}

export default KartAyarlari
