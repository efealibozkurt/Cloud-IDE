import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { surumAdiBul } from '@shared/surumAdlari'
import { useYardim } from '../../state/HelpContext'
import { YARDIM_KONULARI, konuBul, type YardimKonuId } from './yardimKonulari'

interface HelpModalProps {
  baslangicKonusu?: YardimKonuId
  surum: string
  onClose: () => void
}

function sadelestir(m: string): string {
  return m.toLocaleLowerCase('tr-TR').replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c] ?? c)
}

/** "Yardım ve rehber": soldan konu seçilir, sağda anlatım görünür. F1 ile ya da bölüm başlıklarındaki "?" ile açılır. */
function HelpModal({ baslangicKonusu, surum, onClose }: HelpModalProps): ReactElement {
  const [secili, setSecili] = useState<YardimKonuId>(baslangicKonusu ?? 'baslangic')
  const [arama, setArama] = useState('')
  const icerikRef = useRef<HTMLDivElement>(null)
  const { turuBaslat, sorunBildirAc } = useYardim()

  const konular = useMemo(() => {
    const q = sadelestir(arama.trim())
    if (!q) return YARDIM_KONULARI
    return YARDIM_KONULARI.filter((k) => sadelestir(`${k.baslik} ${k.ozet} ${k.anahtarlar}`).includes(q))
  }, [arama])

  const konu = konuBul(secili)

  useEffect(() => {
    const tus = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', tus)
    return () => window.removeEventListener('keydown', tus)
  }, [onClose])

  useEffect(() => {
    icerikRef.current?.scrollTo({ top: 0 })
  }, [secili])

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/55 p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Yardım ve rehber" className="flex h-full max-h-[640px] w-full max-w-3xl overflow-hidden rounded-[8px] border border-panel-border bg-panel shadow-2xl">
        <nav aria-label="Yardım konuları" className="flex w-56 shrink-0 flex-col border-r border-panel-border bg-panel-light">
          <div className="border-b border-panel-border p-2.5">
            <input
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="Yardımda ara…"
              aria-label="Yardımda ara"
              autoFocus
              className="h-7 w-full rounded-[5px] border border-panel-border bg-panel px-2 text-xs text-gray-100 outline-none placeholder:text-gray-600 focus:border-accent"
            />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto py-1">
            {konular.length === 0 && <li className="px-3 py-3 text-xs text-gray-500">Sonuç yok. Başka bir kelime deneyin (ör. “port”, “geri al”, “kütüphane”).</li>}
            {konular.map((k) => (
              <li key={k.id}>
                <button
                  onClick={() => setSecili(k.id)}
                  aria-current={k.id === secili}
                  className={`relative block w-full px-3 py-2 text-left transition-colors ${k.id === secili ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'}`}
                >
                  {k.id === secili && <span className="absolute inset-y-1.5 left-0 w-0.5 bg-accent" />}
                  <span className={`block text-[12.5px] ${k.id === secili ? 'font-medium text-gray-100' : 'text-gray-300'}`}>{k.baslik}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">{k.ozet}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-panel-border px-3 pt-2">
            <button onClick={turuBaslat} className="w-full rounded border border-panel-border px-2 py-1.5 text-left text-[12px] text-gray-300 hover:bg-white/[0.06]">
              Başlangıç turunu yeniden izle
            </button>
            <button onClick={sorunBildirAc} className="mt-1.5 w-full rounded border border-panel-border px-2 py-1.5 text-left text-[12px] text-gray-300 hover:bg-white/[0.06]">
              Sorun bildir
            </button>
          </div>
          <div className="px-3 py-2 text-[11px] leading-relaxed text-gray-600">
            Cloud IDE v{surum} {surumAdiBul(surum).ad} · GPL-3.0
            <br />
            Yardımı açmak/kapatmak için <kbd className="font-mono text-gray-500">F1</kbd>
          </div>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-panel-border px-4">
            <h2 className="truncate text-sm font-semibold text-gray-100">{konu.baslik}</h2>
            <button onClick={onClose} aria-label="Kapat" className="flex h-6 w-6 items-center justify-center rounded-[4px] text-gray-500 hover:bg-white/[0.08] hover:text-gray-200">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div ref={icerikRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {konu.icerik()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HelpModal
