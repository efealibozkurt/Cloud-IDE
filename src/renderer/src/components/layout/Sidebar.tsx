import { useEffect, useState, type ReactElement } from 'react'
import FileTree from '../sketch/FileTree'
import BoardManager from '../boards/BoardManager'
import LibraryManager from '../libraries/LibraryManager'
import HistoryPanel from '../history/HistoryPanel'
import NotlarPanel from '../notes/NotlarPanel'
import { useAppState } from '../../state/AppStateContext'
import { useKutuphaneGuncellemeleri } from '../../hooks/useKutuphaneGuncellemeleri'
import { YardimDugmesi } from '../common/YardimDugmesi'
import type { YardimKonuId } from '../help/yardimKonulari'
import { useT } from '../../i18n'

export type SidebarTab = 'dosyalar' | 'notlar' | 'gecmis' | 'kartlar' | 'kutuphaneler'

interface SidebarProps {
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
}

const YARDIM_KONUSU: Record<SidebarTab, YardimKonuId> = { dosyalar: 'projeler', notlar: 'notlar', gecmis: 'gecmis', kartlar: 'kartlar', kutuphaneler: 'kartlar' }

const ACIK_ANAHTARI = 'cloud_ide_sidebar_open'

const TABS: { id: SidebarTab; baslik: string; ipucu: string; ikon: () => ReactElement }[] = [
  { id: 'dosyalar', baslik: 'Dosyalar', ipucu: 'Dosyalar ve projeler', ikon: FilesIcon },
  { id: 'notlar', baslik: 'Proje notları', ipucu: 'Proje notları', ikon: NotesIcon },
  { id: 'gecmis', baslik: 'Sürüm geçmişi', ipucu: 'Sürüm geçmişi', ikon: HistoryIcon },
  { id: 'kartlar', baslik: 'Kart yöneticisi', ipucu: 'Kart yöneticisi', ikon: ChipIcon },
  { id: 'kutuphaneler', baslik: 'Kütüphane yöneticisi', ipucu: 'Kütüphane yöneticisi', ikon: BooksIcon }
]

/**
 * Sol taraf: ikonlu dikey çubuk + seçilen bölümün paneli (dosyalar, kartlar, kütüphaneler).
 * Açık olan bölümün ikonuna yeniden tıklamak paneli kapatır, böylece editöre yer açılır.
 */
function Sidebar({ activeTab, onTabChange }: SidebarProps): ReactElement {
  const [acik, setAcik] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ACIK_ANAHTARI) !== 'false'
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(ACIK_ANAHTARI, String(acik))
    } catch {
      // depolama kullanılamıyorsa tercih yalnızca bu oturumda geçerli olur
    }
  }, [acik])

  const t = useT()
  const { state } = useAppState()
  const { guncellemeler } = useKutuphaneGuncellemeleri(Boolean(state.arduinoCli.status?.found))
  const rozetSayisi: Partial<Record<SidebarTab, number>> = { kutuphaneler: guncellemeler.length }

  const aktif = TABS.find((t) => t.id === activeTab) ?? TABS[0]

  const sekmeTiklandi = (id: SidebarTab): void => {
    if (id === activeTab) {
      setAcik((a) => !a)
    } else {
      onTabChange(id)
      setAcik(true)
    }
  }

  return (
    <aside className="flex shrink-0 border-r border-panel-border bg-panel-light">
      <nav aria-label={t('Yan çubuk')} data-tur="yancubuk" className="flex w-12 shrink-0 flex-col items-center gap-0.5 border-r border-panel-border bg-panel py-1.5">
        {TABS.map((tab) => {
          const secili = tab.id === activeTab && acik
          const Ikon = tab.ikon
          return (
            <div key={tab.id} className="group relative">
              <button
                onClick={() => sekmeTiklandi(tab.id)}
                aria-label={t(tab.ipucu)}
                aria-pressed={secili}
                className={`relative flex h-11 w-12 items-center justify-center transition-colors ${
                  secili ? 'text-white' : 'text-gray-500 hover:text-gray-200'
                }`}
              >
                {secili && <span className="absolute inset-y-1.5 left-0 w-0.5 bg-accent" />}
                <Ikon />
                {(rozetSayisi[tab.id] ?? 0) > 0 && (
                  <span
                    className="absolute right-1.5 top-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold leading-none text-white"
                    aria-label={t('{n} güncelleme var', { n: rozetSayisi[tab.id] ?? 0 })}
                  >
                    {rozetSayisi[tab.id]}
                  </span>
                )}
              </button>
              <span
                role="tooltip"
                className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-[4px] border border-panel-border bg-panel-light px-2 py-1 text-xs text-gray-200 opacity-0 shadow-lg transition-opacity delay-300 group-hover:opacity-100"
              >
                {t(tab.ipucu)}
              </span>
            </div>
          )
        })}
      </nav>

      {acik && (
        <div className="flex w-52 flex-col bg-panel-light min-[1100px]:w-72">
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-panel-border px-3">
            <h2 className="text-[13px] font-medium text-gray-100">{t(aktif.baslik)}</h2>
            <span className="flex items-center gap-0.5">
            <YardimDugmesi konu={YARDIM_KONUSU[activeTab]} />
            <button
              onClick={() => setAcik(false)}
              aria-label={t('Paneli daralt')}
              title={t('Paneli daralt')}
              className="flex h-6 w-6 items-center justify-center rounded-[4px] text-gray-500 hover:bg-white/[0.08] hover:text-gray-200"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {activeTab === 'dosyalar' && <FileTree />}
            {activeTab === 'notlar' && <NotlarPanel />}
            {activeTab === 'gecmis' && <HistoryPanel />}
            {activeTab === 'kartlar' && <BoardManager />}
            {activeTab === 'kutuphaneler' && <LibraryManager />}
          </div>
        </div>
      )}
    </aside>
  )
}

function FilesIcon(): ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 3H8a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.5L14.5 3Z" />
      <path d="M14 3v5h5" />
      <path d="M4 7v12a2 2 0 0 0 2 2h9" />
    </svg>
  )
}

function NotesIcon(): ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5M8.5 12h7M8.5 15.5h7M8.5 19h4" />
    </svg>
  )
}

function HistoryIcon(): ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v6M12 15v6" />
    </svg>
  )
}

function ChipIcon(): ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </svg>
  )
}

function BooksIcon(): ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h4v16H4z" />
      <path d="M10 4h4v16h-4z" />
      <path d="m16.2 5.4 3.7-.9 3.2 14.5-3.7.9z" transform="translate(-2.2 0.2) scale(0.96)" />
    </svg>
  )
}

export default Sidebar
