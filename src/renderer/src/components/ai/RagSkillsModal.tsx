import { useState, useEffect, type ReactElement } from 'react'
import type { CustomSkill, RagChunkSummary, SkillsInfoResult } from '@shared/types'
import { ArchitecturesView } from './ArchitecturesView'
import { RagVectorView } from './RagVectorView'
import { CustomMarkdownSkillsView } from './CustomSkillsView'
import { useT } from '../../i18n'
import { CloseIcon, CpuIcon, DatabaseIcon, FileCodeIcon, MicrochipIcon } from './skillsIcons'

interface RagSkillsModalProps {
  isOpen: boolean
  onClose: () => void
  activeBoardContext?: {
    name?: string
    fqbn?: string
    platformName?: string
  }
}

type TabType = 'architectures' | 'rag' | 'custom'

export function RagSkillsModal({ isOpen, onClose, activeBoardContext }: RagSkillsModalProps): ReactElement | null {
  const t = useT()
  const [activeTab, setActiveTab] = useState<TabType>('architectures')
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [skillsInfo, setSkillsInfo] = useState<SkillsInfoResult | null>(null)
  const [customSkills, setCustomSkills] = useState<CustomSkill[]>([])
  const [skillsDirectory, setSkillsDirectory] = useState<string>('')
  const [selectedCustomSkill, setSelectedCustomSkill] = useState<CustomSkill | null>(null)

  // RAG Arama & Seçim State
  const [ragSearchQuery, setRagSearchQuery] = useState('')
  const [ragFamilyFilter, setRagFamilyFilter] = useState('all')
  const [reindexing, setReindexing] = useState(false)
  const [selectedChunk, setSelectedChunk] = useState<RagChunkSummary | null>(null)

  // Yeni Beceri Ekleme Form State
  const [isAddingSkill, setIsAddingSkill] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBoardFamily, setNewBoardFamily] = useState('general')
  const [newType, setNewType] = useState<'snippet' | 'rule'>('snippet')
  const [newContent, setNewContent] = useState('')
  const [savingSkill, setSavingSkill] = useState(false)
  const [kopyalandi, setKopyalandi] = useState(false)

  // Bilgileri yükle (zaman aşımı ve hata koruması ile)
  const verileriYukle = async (): Promise<void> => {
    setLoading(true)
    setLoadingError(null)

    try {
      const yuklemeIslemi = Promise.all([
        window.api.skills.getSkillsInfo(activeBoardContext),
        window.api.skills.listCustomSkills(),
        window.api.skills.getSkillsDirectory()
      ])

      // 8 saniyelik zaman aşımı emniyeti
      const zamanAsimi = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(t('Yükleme zaman aşımına uğradı'))), 8000)
      )

      const [info, customList, dirPath] = await Promise.race([yuklemeIslemi, zamanAsimi])

      setSkillsInfo(info)
      setCustomSkills(customList)
      setSkillsDirectory(dirPath)

      if (customList.length > 0 && !selectedCustomSkill) {
        setSelectedCustomSkill(customList[0])
      }
      if (info.chunks.length > 0 && !selectedChunk) {
        setSelectedChunk(info.chunks[0])
      }
    } catch (err: any) {
      console.error('RAG ve Beceri verileri yüklenemedi:', err)
      setLoadingError(err?.message || t('Veriler yüklenirken bir sorun oluştu.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      void verileriYukle()
    }
  }, [isOpen, activeBoardContext?.fqbn])

  // ESC tuşuyla kapatma
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
    return undefined
  }, [isOpen, onClose])

  if (!isOpen) return null

  // RAG Filtreleme
  const filteredChunks = (skillsInfo?.chunks || []).filter((c) => {
    if (ragFamilyFilter !== 'all' && (c.boardFamily || 'general').toLowerCase() !== ragFamilyFilter.toLowerCase()) {
      return false
    }
    if (!ragSearchQuery.trim()) return true
    const q = ragSearchQuery.toLowerCase().trim()
    return (
      c.title.toLowerCase().includes(q) ||
      c.sourceOwner.toLowerCase().includes(q) ||
      c.content.toLowerCase().includes(q)
    )
  })

  // Yeni Beceri Kaydetme
  const handleAddSkill = async (): Promise<void> => {
    if (!newTitle.trim() || !newContent.trim()) return
    setSavingSkill(true)
    try {
      const added = await window.api.skills.addCustomSkill({
        title: newTitle.trim(),
        boardFamily: newBoardFamily,
        type: newType,
        content: newContent.trim()
      })
      setNewTitle('')
      setNewContent('')
      setIsAddingSkill(false)
      await verileriYukle()
      setSelectedCustomSkill(added)
    } catch (err) {
      console.error('Özel beceri kaydedilemedi:', err)
    } finally {
      setSavingSkill(false)
    }
  }

  // Özel Beceri Silme
  const handleDeleteSkill = async (id: string): Promise<void> => {
    try {
      await window.api.skills.deleteCustomSkill(id)
      const guncel = customSkills.filter((s) => s.id !== id)
      setCustomSkills(guncel)
      if (selectedCustomSkill?.id === id) {
        setSelectedCustomSkill(guncel[0] || null)
      }
      await verileriYukle()
    } catch (err) {
      console.error('Özel beceri silinemedi:', err)
    }
  }

  // RAG Yeniden İndeksleme
  const handleReindex = async (): Promise<void> => {
    setReindexing(true)
    try {
      await window.api.skills.reindexRag()
      await verileriYukle()
    } catch (err) {
      console.error('RAG yeniden indeksleme hatası:', err)
    } finally {
      setReindexing(false)
    }
  }

  // Klasörü Aç
  const handleOpenFolder = async (): Promise<void> => {
    try {
      await window.api.skills.openSkillsFolder()
    } catch (err) {
      console.error('Beceriler klasörü açılamadı:', err)
    }
  }

  const kopyalaMetin = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setKopyalandi(true)
      setTimeout(() => setKopyalandi(false), 2000)
    } catch {}
  }

  const sekmeler: Array<{ id: TabType; ad: string; sayi?: number; ikon: typeof CpuIcon; renk: string }> = [
    { id: 'architectures', ad: t('Kartlar'), ikon: CpuIcon, renk: 'text-sky-400' },
    { id: 'rag', ad: t('Bilgi tabanı'), sayi: skillsInfo?.chunks.length || 0, ikon: DatabaseIcon, renk: 'text-emerald-400' },
    { id: 'custom', ad: t('Kurallarım'), sayi: customSkills.length, ikon: FileCodeIcon, renk: 'text-cyan-400' }
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('Donanım ve bilgi tabanı')}
        className="flex h-[84vh] max-h-[780px] min-h-[480px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12141c] text-gray-200 shadow-[0_24px_80px_rgba(0,0,0,0.7),0_0_60px_rgba(14,127,196,0.15)]"
      >
        {/* Üst şerit: ikon, başlık ve sekmeler */}
        <div className="relative shrink-0 overflow-hidden border-b border-white/10">
          <div className="pointer-events-none absolute -left-20 -top-24 h-52 w-52 rounded-full bg-[#0e7fc4]/20 blur-3xl" />
          <div className="pointer-events-none absolute right-10 -top-24 h-52 w-52 rounded-full bg-[#10b981]/15 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4 px-6 pt-5">
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-gradient-to-br from-[#1d3a52] to-[#13222f] text-[#7cc4f0] shadow-lg shadow-sky-500/20">
                <MicrochipIcon className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h2 className="bg-gradient-to-r from-white to-[#bfe3fa] bg-clip-text text-lg font-semibold text-transparent">
                  {t('Donanım ve bilgi tabanı')}
                </h2>
                <p className="mt-0.5 text-xs text-gray-400">
                  {t('Yapay zekânın kartınız, kütüphaneleriniz ve kendi kurallarınız hakkında bildiklerini buradan görür ve düzenlersiniz.')}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              title={t('Kapat (Esc)')}
              aria-label={t('Kapat')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <div role="tablist" className="relative mt-4 flex gap-1 px-5">
            {sekmeler.map((sek) => {
              const secili = activeTab === sek.id
              const Ikon = sek.ikon
              return (
                <button
                  key={sek.id}
                  role="tab"
                  aria-selected={secili}
                  onClick={() => setActiveTab(sek.id)}
                  className={`relative flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-[13px] font-medium transition-colors ${
                    secili ? 'bg-white/[0.06] text-white' : 'text-gray-400 hover:bg-white/[0.03] hover:text-gray-200'
                  }`}
                >
                  <Ikon className={`h-4 w-4 ${sek.renk}`} />
                  {sek.ad}
                  {sek.sayi !== undefined && (
                    <span className="rounded-full bg-white/10 px-1.5 py-px text-[10.5px] tabular-nums text-gray-300">{sek.sayi}</span>
                  )}
                  {secili && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-[#0e7fc4] to-[#2aa8f2]" />}
                </button>
              )
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden bg-[#0f1118]">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-xs text-gray-500">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border border-gray-500 border-t-transparent" />
              {t('Yükleniyor…')}
            </div>
          ) : loadingError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="max-w-md text-xs text-rose-300">{loadingError}</p>
              <button onClick={verileriYukle} className="rounded border border-panel-border px-3 py-1.5 text-xs text-gray-200 hover:bg-white/5">
                {t('Tekrar dene')}
              </button>
            </div>
          ) : activeTab === 'architectures' ? (
            <ArchitecturesView
              profiles={skillsInfo?.boardProfiles || []}
              activeFamily={skillsInfo?.activeBoardFamily || 'general'}
              activeBoardName={activeBoardContext?.name}
              onRefresh={verileriYukle}
            />
          ) : activeTab === 'rag' ? (
            <RagVectorView
              ragStatus={skillsInfo?.rag}
              chunks={filteredChunks}
              query={ragSearchQuery}
              onQueryChange={setRagSearchQuery}
              familyFilter={ragFamilyFilter}
              onFamilyFilterChange={setRagFamilyFilter}
              onReindex={handleReindex}
              reindexing={reindexing}
              selectedChunk={selectedChunk || filteredChunks[0] || null}
              onSelectChunk={setSelectedChunk}
              kopyalaMetin={kopyalaMetin}
              kopyalandi={kopyalandi}
            />
          ) : (
            <CustomMarkdownSkillsView
              skills={customSkills}
              skillsDirectory={skillsDirectory}
              selectedSkill={selectedCustomSkill || customSkills[0] || null}
              onSelectSkill={setSelectedCustomSkill}
              isAdding={isAddingSkill}
              onToggleAdd={() => setIsAddingSkill((p) => !p)}
              title={newTitle}
              onTitleChange={setNewTitle}
              boardFamily={newBoardFamily}
              onBoardFamilyChange={setNewBoardFamily}
              type={newType}
              onTypeChange={setNewType}
              content={newContent}
              onContentChange={setNewContent}
              saving={savingSkill}
              onSave={handleAddSkill}
              onDelete={handleDeleteSkill}
              onOpenFolder={handleOpenFolder}
              onRefresh={verileriYukle}
              kopyalaMetin={kopyalaMetin}
              kopyalandi={kopyalandi}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default RagSkillsModal
