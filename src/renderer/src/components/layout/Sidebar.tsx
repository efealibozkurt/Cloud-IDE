import type { ReactElement } from 'react'
import FileTree from '../sketch/FileTree'
import BoardManager from '../boards/BoardManager'
import LibraryManager from '../libraries/LibraryManager'

export type SidebarTab = 'dosyalar' | 'kartlar' | 'kutuphaneler'

interface SidebarProps {
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
}

const TABS: { id: SidebarTab; label: string }[] = [
  { id: 'dosyalar', label: 'Dosyalar' },
  { id: 'kartlar', label: 'Kart Yöneticisi' },
  { id: 'kutuphaneler', label: 'Kütüphane Yöneticisi' }
]

/**
 * Sol panel: sketch dosya ağacı, Kart Yöneticisi ve Kütüphane Yöneticisi
 * sekmeleri arasında geçiş sağlar.
 */
function Sidebar({ activeTab, onTabChange }: SidebarProps): ReactElement {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-panel-border bg-panel-light">
      <nav className="flex border-b border-panel-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            title={tab.label}
            className={`flex-1 truncate border-b-2 px-2 py-2 text-[11px] transition-colors ${
              activeTab === tab.id
                ? 'border-accent text-gray-100'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'dosyalar' && <FileTree />}
        {activeTab === 'kartlar' && <BoardManager />}
        {activeTab === 'kutuphaneler' && <LibraryManager />}
      </div>
    </aside>
  )
}

export default Sidebar
