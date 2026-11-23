import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import type { BoardOption } from '@shared/types'
import { kartGorseli, kartRengi } from '../../utils/boardImages'
import BoardThumb from '../common/BoardThumb'
import { useT } from '../../i18n'

interface BoardPickerProps {
  boards: BoardOption[]
  value: string | null
  disabled?: boolean
  onChange: (fqbn: string | null) => void
}

const MAKS_SATIR = 80

/** Aramasız listede sıra: seçili kartın platformu, sonra fotoğrafı olan kartlar */
function oncelik(kart: BoardOption, secili: BoardOption | null): number {
  const ayniPlatform = secili && kart.platformId === secili.platformId ? 2 : 0
  const tamFotograf = kartGorseli(kart, true) ? 1 : 0
  return ayniPlatform + tamFotograf
}

/**
 * Üst çubuktaki kart seçici: arama kutulu liste, kartın fotoğrafı varsa yanında gösterilir.
 * Yüzlerce kart olabildiği için ekranda en fazla MAKS_SATIR satır çizilir; aramayla daraltılır.
 */
function BoardPicker({ boards, value, disabled, onChange }: BoardPickerProps): ReactElement {
  const t = useT()
  const [acik, setAcik] = useState(false)
  const [arama, setArama] = useState('')
  const [aktifIndeks, setAktifIndeks] = useState(0)
  const kapRef = useRef<HTMLDivElement>(null)
  const listeRef = useRef<HTMLUListElement>(null)

  const secili = boards.find((b) => b.fqbn === value) ?? null

  const sonuc = useMemo(() => {
    const q = arama.trim().toLowerCase()
    const eslesen = q
      ? boards.filter((b) => `${b.name} ${b.platformName} ${b.fqbn}`.toLowerCase().includes(q))
      : // Aramasız listede fotoğrafı olan (tanınan) kartlar öne alınır
        [...boards].sort((a, b) => oncelik(b, secili) - oncelik(a, secili))
    return { gorunen: eslesen.slice(0, MAKS_SATIR), toplam: eslesen.length }
  }, [boards, arama])

  useEffect(() => {
    if (!acik) return
    const disTik = (e: MouseEvent): void => {
      if (kapRef.current && !kapRef.current.contains(e.target as Node)) setAcik(false)
    }
    document.addEventListener('mousedown', disTik)
    return () => document.removeEventListener('mousedown', disTik)
  }, [acik])

  useEffect(() => {
    setAktifIndeks(0)
  }, [arama, acik])

  useEffect(() => {
    listeRef.current?.querySelector<HTMLElement>('[data-aktif="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [aktifIndeks])

  const sec = (fqbn: string | null): void => {
    onChange(fqbn)
    setAcik(false)
    setArama('')
  }

  const tus = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') {
      setAcik(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAktifIndeks((i) => Math.min(sonuc.gorunen.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAktifIndeks((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hedef = sonuc.gorunen[aktifIndeks]
      if (hedef) sec(hedef.fqbn)
    }
  }

  return (
    <div ref={kapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAcik((a) => !a)}
        aria-haspopup="listbox"
        aria-expanded={acik}
        title={t('Kart seçici')}
        className="flex h-7 max-w-[240px] items-center gap-2 rounded border border-panel-border bg-panel pl-1 pr-2 text-xs text-gray-300 hover:enabled:bg-panel-border disabled:cursor-not-allowed disabled:text-gray-500"
      >
        <BoardThumb src={kartGorseli(secili)} renk={kartRengi(secili)} genislik={34} />
        <span className="truncate">{secili ? secili.name : t('Kart seçilmedi')}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 text-gray-500">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {acik && (
        <div className="absolute left-0 top-full z-50 mt-1 flex max-h-[440px] w-[380px] flex-col overflow-hidden rounded border border-panel-border bg-panel-light shadow-xl">
          <div className="border-b border-panel-border p-2">
            <input
              autoFocus
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              onKeyDown={tus}
              placeholder={t('Kart ara: uno, esp32, pico…')}
              aria-label={t('Kart ara')}
              className="w-full rounded border border-panel-border bg-panel px-2.5 py-1.5 text-xs text-gray-100 outline-none placeholder:text-gray-600 focus:border-accent"
            />
          </div>

          <ul ref={listeRef} role="listbox" className="min-h-0 flex-1 overflow-y-auto py-1">
            {!arama && (
              <li>
                <button
                  onClick={() => sec(null)}
                  className="flex w-full items-center gap-3 px-3 py-1.5 text-left text-xs text-gray-400 hover:bg-white/[0.06]"
                >
                  <BoardThumb src={null} genislik={44} />
                  {t('Kart seçilmedi')}
                </button>
              </li>
            )}
            {sonuc.gorunen.length === 0 && <li className="px-3 py-6 text-center text-xs text-gray-500">{t('Eşleşen kart yok.')}</li>}
            {sonuc.gorunen.map((b, i) => {
              const aktif = i === aktifIndeks
              const secilmis = b.fqbn === value
              return (
                <li key={b.fqbn} role="option" aria-selected={secilmis} data-aktif={aktif}>
                  <button
                    onClick={() => sec(b.fqbn)}
                    onMouseMove={() => setAktifIndeks(i)}
                    className={`flex w-full items-center gap-3 px-3 py-1.5 text-left ${aktif ? 'bg-white/[0.07]' : ''}`}
                  >
                    <BoardThumb src={kartGorseli(b)} renk={kartRengi(b)} genislik={44} alt={b.name} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-xs ${secilmis ? 'font-medium text-gray-50' : 'text-gray-200'}`}>{b.name}</span>
                      <span className="block truncate text-[11px] text-gray-500">{b.platformName}</span>
                    </span>
                    {secilmis && <span className="text-xs text-accent-hover">{t('Seçili')}</span>}
                  </button>
                </li>
              )
            })}
            {sonuc.toplam > sonuc.gorunen.length && (
              <li className="px-3 py-2 text-xs text-gray-500">
                {t('{n} kart daha var. Aramayı daraltın.', { n: sonuc.toplam - sonuc.gorunen.length })}
              </li>
            )}
          </ul>

          <p className="border-t border-panel-border px-3 py-1.5 text-[10.5px] text-gray-600">
            {t('Görseller: Wikimedia Commons (CC) ve resmi Deneyap deposu.')}
          </p>
        </div>
      )}
    </div>
  )
}

export default BoardPicker
