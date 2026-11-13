import { useEffect, useState, type ReactElement } from 'react'
import { SURUM_ADLARI, surumAdiBul, type SurumAdi } from '@shared/surumAdlari'

interface SurumYumurtasiProps {
  surum: string
  onKapat: () => void
}

/** Arka planda süzülen bulutlar: yükseklik (%), boyut (px), süre (sn), gecikme (sn), saydamlık */
const BULUTLAR: Array<[number, number, number, number, number]> = [
  [8, 260, 70, -10, 0.1],
  [22, 180, 52, -34, 0.07],
  [38, 340, 96, -60, 0.09],
  [58, 220, 64, -22, 0.06],
  [74, 300, 84, -48, 0.1],
  [88, 200, 58, -5, 0.07]
]

function BulutSekli({ boyut, saydamlik }: { boyut: number; saydamlik: number }): ReactElement {
  return (
    <svg width={boyut} height={boyut * 0.4} viewBox="0 0 200 80" fill="#bfe3fa" fillOpacity={saydamlik} aria-hidden="true">
      <circle cx="60" cy="50" r="26" />
      <circle cx="95" cy="38" r="32" />
      <circle cx="135" cy="50" r="24" />
      <rect x="36" y="50" width="128" height="26" rx="13" />
    </svg>
  )
}

/**
 * Sürüm yumurtası: sürüm rozetine art arda tıklayınca açılır. Kod adını (bulut türü), onun ne anlama
 * geldiğini ve bundan sonraki bulutları gösterir; bulutlar ekranda süzülür.
 */
function SurumYumurtasi({ surum, onKapat }: SurumYumurtasiProps): ReactElement {
  const simdiki = surumAdiBul(surum)
  const [bakilan, setBakilan] = useState<SurumAdi>(simdiki)

  useEffect(() => {
    const tus = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onKapat()
    }
    window.addEventListener('keydown', tus)
    return () => window.removeEventListener('keydown', tus)
  }, [onKapat])

  const sira = [...SURUM_ADLARI].reverse() // en yüksek bulut üstte

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Sürüm kod adı: ${simdiki.ad}`}
      onClick={onKapat}
      className="fixed inset-0 z-[90] overflow-hidden bg-[#0a121b]/95 backdrop-blur-sm"
      style={{ animation: 'surum-belir 400ms ease-out both' }}
    >
      {BULUTLAR.map(([ust, boyut, sure, gecikme, saydamlik], i) => (
        <div key={i} className="bulut-suru pointer-events-none absolute left-0" style={{ top: `${ust}%`, animationDuration: `${sure}s`, animationDelay: `${gecikme}s` }}>
          <BulutSekli boyut={boyut} saydamlik={saydamlik} />
        </div>
      ))}

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6" onClick={(e) => e.stopPropagation()}>
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-sky-300/70">v{surum} · kod adı</p>
        <h1 className="mt-3 font-serif text-[76px] font-normal italic leading-none text-white">{simdiki.ad}</h1>
        <div className="mt-5 space-y-1.5" aria-hidden="true">
          {[1, 0.55, 0.28].map((o, i) => (
            <div key={i} className="mx-auto h-px bg-sky-200" style={{ width: 220 - i * 40, opacity: o * 0.5 }} />
          ))}
        </div>
        <p className="mt-6 max-w-md text-center text-[14px] leading-relaxed text-sky-100/80">{simdiki.bulut}</p>

        <ol className="mt-10 w-full max-w-sm" aria-label="Bulut basamakları">
          {sira.map((a) => {
            const buradasin = a.ad === simdiki.ad
            const gelecek = SURUM_ADLARI.indexOf(a) > SURUM_ADLARI.indexOf(simdiki)
            const secili = a.ad === bakilan.ad
            const yukseklik = ((SURUM_ADLARI.indexOf(a) + 1) / SURUM_ADLARI.length) * 100
            return (
              <li key={a.ad}>
                <button
                  onClick={() => setBakilan(a)}
                  className={`group flex w-full items-center gap-3 rounded px-2 py-1 text-left transition-colors hover:bg-white/[0.05] ${secili ? 'bg-white/[0.06]' : ''}`}
                >
                  <span className="w-16 shrink-0 font-mono text-[10.5px] text-sky-200/50">
                    {a.baslangic[0]}.{a.baslangic[1]}
                    {a.ad === 'Cumulonimbus' ? '+' : '.x'}
                  </span>
                  <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/10">
                    <span className={`absolute inset-y-0 left-0 rounded-full ${gelecek ? 'bg-sky-200/25' : 'bg-sky-300'}`} style={{ width: `${yukseklik}%` }} />
                  </span>
                  <span className={`w-28 shrink-0 text-right text-[13px] ${buradasin ? 'font-semibold text-white' : gelecek ? 'text-sky-100/40' : 'text-sky-100/80'}`}>
                    {a.ad}
                    {buradasin && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#3ddc84] shadow-[0_0_6px_#3ddc84]" title="Buradasın" />}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        <div className="mt-4 min-h-[56px] max-w-md text-center text-[12px] leading-relaxed text-sky-100/60">
          <p>
            <span className="text-sky-100/80">{bakilan.ad}</span> · {bakilan.yukseklik}
          </p>
          <p className="mt-0.5">{bakilan.donem}</p>
        </div>

        <p className="mt-6 text-[11px] text-sky-200/35">Her sürümde bulut biraz daha yükselir · kapatmak için tıklayın ya da Esc</p>
      </div>
    </div>
  )
}

export default SurumYumurtasi
