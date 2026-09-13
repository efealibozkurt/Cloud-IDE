import { useState, useEffect, type ReactElement } from 'react'
import type { BoardProfileInfo, BoardModelVariant, CustomSkill, RagChunkSummary, SkillsInfoResult } from '@shared/types'

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
        setTimeout(() => reject(new Error('Yükleme zaman aşımına uğradı')), 8000)
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
      setLoadingError(err?.message || 'Veriler yüklenirken bir sorun oluştu.')
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-8 md:p-12 backdrop-blur-md animate-in fade-in duration-150">
      {/* ── Ana Panel Kapsayıcısı: Mat titanyum/arduvaz gövde, hassas 1px kenarlık ── */}
      <div className="relative flex h-[86vh] max-h-[780px] min-h-[520px] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#262936] bg-[#111218] text-gray-200 shadow-2xl font-sans">
        
        {/* ── Üst Mühendislik Başlık Çubuğu ── */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#212430] bg-[#151720] px-5 sm:px-6">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            {/* Donanım Enstrüman Amblemi */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#2e3344] bg-[#1b1e2a] text-blue-400 shadow-inner">
              <MicrochipIcon className="h-4 w-4 text-blue-400" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold tracking-tight text-white font-sans uppercase">
                  Donanım Laboratuvarı & Bilgi Bankası
                </h2>
                <span className="hidden sm:inline-flex items-center rounded border border-[#2b3040] bg-[#1a1d28] px-1.5 py-0.5 text-[9.5px] font-mono font-medium text-gray-400">
                  v0.2.0 · HARDWARE STUDIO
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-sans truncate">
                Hedef kart mimarileri, pin haritaları, doğrulanmış C++ şablonları ve yerel .md direktifleri
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Endüstriyel Segmentli Sekme Çubuğu */}
            <div className="flex items-center rounded-lg border border-[#262a38] bg-[#0e1016] p-0.5 text-xs">
              <button
                onClick={() => setActiveTab('architectures')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-all font-sans ${
                  activeTab === 'architectures'
                    ? 'bg-[#1f2330] text-white shadow-sm font-medium border border-[#303648]'
                    : 'text-gray-400 hover:text-gray-200 border border-transparent'
                }`}
              >
                <CpuIcon className="h-3.5 w-3.5 text-blue-400" />
                <span>Kart & Pinout</span>
              </button>

              <button
                onClick={() => setActiveTab('rag')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-all font-sans ${
                  activeTab === 'rag'
                    ? 'bg-[#1f2330] text-white shadow-sm font-medium border border-[#303648]'
                    : 'text-gray-400 hover:text-gray-200 border border-transparent'
                }`}
              >
                <DatabaseIcon className="h-3.5 w-3.5 text-emerald-400" />
                <span>Kod İndeksi (RAG)</span>
                <span className="ml-0.5 rounded bg-black/60 px-1.5 py-0.2 font-mono text-[9px] text-gray-400 border border-white/5">
                  {skillsInfo?.chunks.length || 0}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('custom')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-all font-sans ${
                  activeTab === 'custom'
                    ? 'bg-[#1f2330] text-white shadow-sm font-medium border border-[#303648]'
                    : 'text-gray-400 hover:text-gray-200 border border-transparent'
                }`}
              >
                <FileCodeIcon className="h-3.5 w-3.5 text-indigo-400" />
                <span>Özel .md Kuralları</span>
                <span className="ml-0.5 rounded bg-black/60 px-1.5 py-0.2 font-mono text-[9px] text-gray-400 border border-white/5">
                  {customSkills.length}
                </span>
              </button>
            </div>

            {/* Kapat Butonu */}
            <button
              onClick={onClose}
              title="Kapat (Esc)"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-gray-400 transition-colors hover:border-[#303546] hover:bg-[#1d202c] hover:text-white"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Gövde İçeriği ── */}
        <div className="min-h-0 flex-1 overflow-hidden bg-[#101117]">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-300 font-sans">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <span className="text-xs font-medium tracking-normal text-gray-400 font-sans">
                Donanım kayıtları ve vektör bilgi bankası doğrulanıyor...
              </span>
            </div>
          ) : loadingError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center font-sans">
              <div className="rounded-lg border border-red-500/20 bg-red-950/20 p-4 max-w-md">
                <p className="text-xs text-red-300">{loadingError}</p>
              </div>
              <button
                onClick={verileriYukle}
                className="rounded-lg border border-blue-500/40 bg-blue-600/20 px-4 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-600/30 transition-colors"
              >
                Yeniden Dene
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

/**
 * ── 1. Sekme: Kart Mimarileri, Modeller & Donanım Özellikleri (Hardware Workbench) ──
 */
function ArchitecturesView({
  profiles,
  activeFamily,
  activeBoardName,
  onRefresh
}: {
  profiles: BoardProfileInfo[]
  activeFamily: string
  activeBoardName?: string
  onRefresh?: () => Promise<void>
}): ReactElement {
  const [selectedFamily, setSelectedFamily] = useState<string>(activeFamily || 'deneyap')

  const currentProfile =
    profiles.find((p) => p.family.toLowerCase() === selectedFamily.toLowerCase()) || profiles[0]

  const [selectedModelId, setSelectedModelId] = useState<string>(
    currentProfile?.selectedModelId || currentProfile?.models?.[0]?.id || ''
  )

  // Aile değiştiğinde model seçimini güncelle
  useEffect(() => {
    if (currentProfile) {
      const match = currentProfile.models?.find((m) => m.id === selectedModelId)
      if (!match) {
        setSelectedModelId(currentProfile.selectedModelId || currentProfile.models?.[0]?.id || '')
      }
    }
  }, [selectedFamily, currentProfile])

  const currentModel: BoardModelVariant =
    currentProfile?.models?.find((m) => m.id === selectedModelId) ||
    currentProfile?.models?.[0] || {
      id: 'default',
      name: currentProfile?.name || 'Varsayılan Model',
      voltage: currentProfile?.voltage || '3.3V',
      clockSpeed: currentProfile?.clockSpeed || '240 MHz',
      architecture: currentProfile?.architecture || 'ESP32',
      flashRam: currentProfile?.flashRam || '4MB Flash',
      features: currentProfile?.features || [],
      pins: currentProfile?.pins || [],
      rules: currentProfile?.rules || []
    }

  // Pin ekleme ve düzenleme state
  const [newPinInput, setNewPinInput] = useState('')
  const [editingPinIdx, setEditingPinIdx] = useState<number | null>(null)
  const [editingPinVal, setEditingPinVal] = useState('')

  // Toplu pin düzenleme
  const [isBatchPinMode, setIsBatchPinMode] = useState(false)
  const [batchPinText, setBatchPinText] = useState('')

  // Donanım bilgileri düzenleme modu
  const [isEditingSpecs, setIsEditingSpecs] = useState(false)
  const [specVoltage, setSpecVoltage] = useState('')
  const [specClock, setSpecClock] = useState('')
  const [specArch, setSpecArch] = useState('')
  const [specFlashRam, setSpecFlashRam] = useState('')

  // Özellik ve kural ekleme
  const [newFeatureInput, setNewFeatureInput] = useState('')
  const [newRuleInput, setNewRuleInput] = useState('')

  // Yeni Model Ekleme Modalı
  const [isAddingModel, setIsAddingModel] = useState(false)
  const [newModelName, setNewModelName] = useState('')
  const [newModelArch, setNewModelArch] = useState('')
  const [newModelVoltage, setNewModelVoltage] = useState('3.3V')
  const [newModelClock, setNewModelClock] = useState('240 MHz')
  const [newModelFlashRam, setNewModelFlashRam] = useState('4MB Flash / 520KB SRAM')
  const [newModelPinsText, setNewModelPinsText] = useState('')
  const [newModelFeaturesText, setNewModelFeaturesText] = useState('')

  // Toast bildirim
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string): void => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Model kaydetme işlemi
  const saveCurrentModel = async (updatedModel: BoardModelVariant): Promise<void> => {
    try {
      await window.api.skills.saveBoardModel(currentProfile.family, updatedModel)
      showToast(`'${updatedModel.name}' güncellendi ve AI prompt bağlamına aktarıldı.`)
      if (onRefresh) await onRefresh()
    } catch (err) {
      console.error('Model kaydedilemedi:', err)
    }
  }

  // Pin ekle
  const handleAddPin = async (): Promise<void> => {
    const pin = newPinInput.trim()
    if (!pin) return
    if (currentModel.pins.includes(pin)) {
      setNewPinInput('')
      return
    }
    const updatedPins = [...currentModel.pins, pin]
    const updatedModel = { ...currentModel, pins: updatedPins, isCustom: true }
    setNewPinInput('')
    await saveCurrentModel(updatedModel)
  }

  // Pin sil
  const handleDeletePin = async (index: number): Promise<void> => {
    const updatedPins = currentModel.pins.filter((_, idx) => idx !== index)
    const updatedModel = { ...currentModel, pins: updatedPins, isCustom: true }
    await saveCurrentModel(updatedModel)
  }

  // Pin düzenleme kaydet
  const handleSavePinEdit = async (index: number): Promise<void> => {
    const val = editingPinVal.trim()
    if (!val) {
      setEditingPinIdx(null)
      return
    }
    const updatedPins = [...currentModel.pins]
    updatedPins[index] = val
    const updatedModel = { ...currentModel, pins: updatedPins, isCustom: true }
    setEditingPinIdx(null)
    setEditingPinVal('')
    await saveCurrentModel(updatedModel)
  }

  // Toplu pin düzenle
  const handleOpenBatchPin = (): void => {
    setBatchPinText(currentModel.pins.join(', '))
    setIsBatchPinMode(true)
  }

  const handleSaveBatchPin = async (): Promise<void> => {
    const parsed = batchPinText
      .split(/[\n,]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
    const updatedModel = { ...currentModel, pins: parsed, isCustom: true }
    setIsBatchPinMode(false)
    await saveCurrentModel(updatedModel)
  }

  // Donanım bilgileri düzenleme
  const handleOpenEditSpecs = (): void => {
    setSpecVoltage(currentModel.voltage || currentProfile.voltage)
    setSpecClock(currentModel.clockSpeed || currentProfile.clockSpeed)
    setSpecArch(currentModel.architecture || currentProfile.architecture)
    setSpecFlashRam(currentModel.flashRam || currentProfile.flashRam)
    setIsEditingSpecs(true)
  }

  const handleSaveSpecs = async (): Promise<void> => {
    const updatedModel = {
      ...currentModel,
      voltage: specVoltage.trim(),
      clockSpeed: specClock.trim(),
      architecture: specArch.trim(),
      flashRam: specFlashRam.trim(),
      isCustom: true
    }
    setIsEditingSpecs(false)
    await saveCurrentModel(updatedModel)
  }

  // Özellik ekleme & silme
  const handleAddFeature = async (): Promise<void> => {
    const feat = newFeatureInput.trim()
    if (!feat) return
    const updatedFeatures = [...(currentModel.features || []), feat]
    const updatedModel = { ...currentModel, features: updatedFeatures, isCustom: true }
    setNewFeatureInput('')
    await saveCurrentModel(updatedModel)
  }

  const handleDeleteFeature = async (index: number): Promise<void> => {
    const updatedFeatures = (currentModel.features || []).filter((_, idx) => idx !== index)
    const updatedModel = { ...currentModel, features: updatedFeatures, isCustom: true }
    await saveCurrentModel(updatedModel)
  }

  // Kural ekleme & silme
  const handleAddRule = async (): Promise<void> => {
    const rule = newRuleInput.trim()
    if (!rule) return
    const updatedRules = [...(currentModel.rules || []), rule]
    const updatedModel = { ...currentModel, rules: updatedRules, isCustom: true }
    setNewRuleInput('')
    await saveCurrentModel(updatedModel)
  }

  const handleDeleteRule = async (index: number): Promise<void> => {
    const updatedRules = (currentModel.rules || []).filter((_, idx) => idx !== index)
    const updatedModel = { ...currentModel, rules: updatedRules, isCustom: true }
    await saveCurrentModel(updatedModel)
  }

  // Yeni Model Ekle Modalını Aç
  const handleOpenAddModel = (): void => {
    setNewModelName('')
    setNewModelArch(currentModel.architecture || '')
    setNewModelVoltage(currentModel.voltage || '3.3V')
    setNewModelClock(currentModel.clockSpeed || '240 MHz')
    setNewModelFlashRam(currentModel.flashRam || '4MB Flash / 520KB SRAM')
    setNewModelPinsText(currentModel.pins.join(', '))
    setNewModelFeaturesText((currentModel.features || []).join('\n'))
    setIsAddingModel(true)
  }

  // Yeni Modeli Kaydet
  const handleSaveNewModel = async (): Promise<void> => {
    if (!newModelName.trim()) return
    const newId = `${currentProfile.family}_${Date.now()}`
    const pins = newModelPinsText
      .split(/[\n,]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
    const features = newModelFeaturesText
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f.length > 0)

    const newVariant: BoardModelVariant = {
      id: newId,
      name: newModelName.trim(),
      architecture: newModelArch.trim() || currentProfile.architecture,
      voltage: newModelVoltage.trim() || currentProfile.voltage,
      clockSpeed: newModelClock.trim() || currentProfile.clockSpeed,
      flashRam: newModelFlashRam.trim() || currentProfile.flashRam,
      pins: pins.length > 0 ? pins : ['D0', 'D1', 'A0', 'LED_BUILTIN'],
      features: features.length > 0 ? features : ['Özel Kullanıcı Kartı'],
      rules: [
        `Bu model '${newModelName.trim()}' kullanıcı tarafından özel olarak eklenmiştir.`,
        `Pin haritasında tanımlı isimleri kullanınız.`
      ],
      isCustom: true
    }

    await window.api.skills.addBoardModel(currentProfile.family, newVariant)
    setSelectedModelId(newId)
    setIsAddingModel(false)
    showToast(`'${newModelName.trim()}' modeli başarıyla oluşturuldu!`)
    if (onRefresh) await onRefresh()
  }

  // Varsayılana Sıfırla
  const handleResetToDefault = async (): Promise<void> => {
    const onay = window.confirm(
      `'${currentModel.name}' modelini orijinal fabrika ayarlarına sıfırlamak istediğinize emin misiniz?`
    )
    if (!onay) return
    await window.api.skills.resetBoardModel(currentProfile.family, currentModel.id)
    showToast(`'${currentModel.name}' varsayılan ayarlarına döndürüldü.`)
    if (onRefresh) await onRefresh()
  }

  // Modeli Sil
  const handleDeleteCurrentModel = async (): Promise<void> => {
    const onay = window.confirm(`'${currentModel.name}' modelini silmek istediğinize emin misiniz?`)
    if (!onay) return
    await window.api.skills.deleteBoardModel(currentProfile.family, currentModel.id)
    showToast(`'${currentModel.name}' silindi.`)
    if (onRefresh) await onRefresh()
  }

  return (
    <div className="relative flex h-full flex-col p-5 sm:p-6 font-sans">
      {/* Bildirim Toast */}
      {toastMessage && (
        <div className="absolute top-4 right-6 z-30 flex items-center gap-2 rounded-lg border border-[#2e3748] bg-[#141822] px-3.5 py-2 text-xs text-blue-200 shadow-xl animate-in fade-in duration-200">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Aktif Donanım Bağlamı Şeridi (Mühendislik Terminali Hissi) */}
      <div className="mb-3.5 flex shrink-0 items-center justify-between rounded-lg border border-[#262c3a] bg-[#141722] px-4 py-2 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
          <span className="text-gray-400 font-medium">Aktif Derleme Hedefi:</span>
          <span className="font-mono font-semibold text-emerald-400 uppercase tracking-wide">
            {activeBoardName || activeFamily} ({activeFamily})
          </span>
        </div>
        <span className="text-[11px] text-gray-400 font-mono">
          [CANLI ENJEKSİYON: Pin ve mimari direktifleri Cloud AI kod üretimine otomatik bağlanır]
        </span>
      </div>

      {/* 1. KART AİLESİ SEÇİCİ SEKMELERİ */}
      <div className="mb-3 flex shrink-0 items-center gap-1.5 overflow-x-auto pb-1">
        {profiles.map((p) => {
          const isSelected = p.family.toLowerCase() === selectedFamily.toLowerCase()
          const isTargetActive = p.family.toLowerCase() === activeFamily.toLowerCase()
          return (
            <button
              key={p.family}
              onClick={() => setSelectedFamily(p.family)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                isSelected
                  ? 'border-[#3b4358] bg-[#1b202c] text-white shadow-sm'
                  : 'border-[#222532] bg-[#12141c] text-gray-400 hover:border-[#2f3546] hover:text-gray-200'
              }`}
            >
              <span>{p.name}</span>
              {isTargetActive && (
                <span className="rounded bg-emerald-500/10 px-1 py-0.2 font-mono text-[9px] font-semibold text-emerald-400 border border-emerald-500/20">
                  AKTİF
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 2. MODEL / VARYANT SEÇİCİ VE YÖNETİM BAR */}
      <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-[#242735] bg-[#13151f] px-3.5 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] font-mono uppercase text-gray-400 mr-1 flex items-center gap-1">
            <MicrochipIcon className="h-3.5 w-3.5 text-gray-400" />
            Modeller:
          </span>
          {(currentProfile?.models || []).map((m) => {
            const isModelSelected = m.id === currentModel.id
            return (
              <button
                key={m.id}
                onClick={() => setSelectedModelId(m.id)}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-all ${
                  isModelSelected
                    ? 'border-[#3d455c] bg-[#202534] text-white font-medium shadow-sm'
                    : 'border-[#232634] bg-[#161823] text-gray-400 hover:border-[#2d3244] hover:text-gray-200'
                }`}
              >
                <span>{m.name}</span>
                {m.isCustom && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Kullanıcı Özelleştirmesi" />
                )}
              </button>
            )
          })}
        </div>

        {/* Eylem Butonları */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleOpenAddModel}
            className="flex items-center gap-1 rounded-md border border-[#2e3547] bg-[#1a1e2b] px-2.5 py-1 text-xs font-medium text-blue-300 hover:bg-[#22283a] hover:text-white transition-colors"
            title="Bu aileye özel yeni bir kart modeli tanımla"
          >
            <PlusSmallIcon className="h-3.5 w-3.5 text-blue-400" />
            <span>Yeni Model Ekle</span>
          </button>

          <button
            onClick={handleResetToDefault}
            className="flex items-center gap-1 rounded-md border border-[#262a38] bg-[#161822] px-2.5 py-1 text-xs font-medium text-gray-300 hover:bg-[#1f2230] hover:text-white transition-colors"
            title="Bu modeli fabrika ayarlarına döndür"
          >
            <RefreshIcon className="h-3 w-3 text-gray-400" />
            <span>Sıfırla</span>
          </button>

          {currentModel.isCustom && (currentProfile?.models?.length || 0) > 1 && (
            <button
              onClick={handleDeleteCurrentModel}
              className="flex items-center gap-1 rounded-md border border-red-500/20 bg-red-950/20 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-900/30 transition-colors"
              title="Bu özel modeli sil"
            >
              <TrashIcon className="h-3 w-3 text-red-400" />
              <span>Sil</span>
            </button>
          )}
        </div>
      </div>

      {/* SEÇİLİ MODEL DETAY VE DÜZENLEME ALANI */}
      <div className="min-h-0 flex-1 overflow-y-auto space-y-3.5 pr-1">
        {/* DONANIM ENSTRÜMAN / SPESİFİKASYON PANELİ */}
        <div className="rounded-lg border border-[#232735] bg-[#141620] p-3.5">
          <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06] mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                Donanım Spesifikasyonları
              </span>
              <span className="rounded border border-[#2e3447] bg-[#1a1e2b] px-2 py-0.5 text-[10px] font-mono text-blue-300">
                {currentModel.name}
              </span>
              {currentModel.isCustom && (
                <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-mono text-amber-300">
                  ÖZEL
                </span>
              )}
            </div>
            <button
              onClick={() => {
                if (isEditingSpecs) {
                  setIsEditingSpecs(false)
                } else {
                  handleOpenEditSpecs()
                }
              }}
              className="flex items-center gap-1.5 rounded-md border border-[#2e3448] bg-[#191c28] px-2.5 py-1 text-xs font-medium text-gray-300 hover:bg-[#212636] hover:text-white transition-colors"
            >
              <EditIcon className="h-3 w-3 text-gray-400" />
              <span>{isEditingSpecs ? 'Düzenlemeyi Kapat' : 'Donanım Bilgilerini Düzenle'}</span>
            </button>
          </div>

          {isEditingSpecs ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-[#0e1017] p-3.5 rounded-lg border border-[#292f40]">
              <div>
                <label className="text-[10px] font-mono uppercase text-gray-400 block mb-1">Mantık Voltajı</label>
                <input
                  type="text"
                  value={specVoltage}
                  onChange={(e) => setSpecVoltage(e.target.value)}
                  className="w-full rounded border border-[#2b3042] bg-[#151722] px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
                  placeholder="3.3V (5V Toleranssız)"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-gray-400 block mb-1">Saat Frekansı</label>
                <input
                  type="text"
                  value={specClock}
                  onChange={(e) => setSpecClock(e.target.value)}
                  className="w-full rounded border border-[#2b3042] bg-[#151722] px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
                  placeholder="240 MHz"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-gray-400 block mb-1">Mimari / Çekirdek</label>
                <input
                  type="text"
                  value={specArch}
                  onChange={(e) => setSpecArch(e.target.value)}
                  className="w-full rounded border border-[#2b3042] bg-[#151722] px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
                  placeholder="ESP32 (Xtensa LX6)"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-gray-400 block mb-1">Bellek (Flash / RAM)</label>
                <input
                  type="text"
                  value={specFlashRam}
                  onChange={(e) => setSpecFlashRam(e.target.value)}
                  className="w-full rounded border border-[#2b3042] bg-[#151722] px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
                  placeholder="4MB Flash / 520KB SRAM"
                />
              </div>
              <div className="sm:col-span-2 md:col-span-4 flex justify-end gap-2 mt-1">
                <button
                  onClick={() => setIsEditingSpecs(false)}
                  className="rounded border border-[#2b3042] px-3 py-1 text-xs text-gray-300 hover:bg-[#181b26]"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveSpecs}
                  className="rounded border border-blue-500/50 bg-blue-600 px-4 py-1 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  Özellikleri Kaydet
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {/* Mantık Voltajı */}
              <div className="rounded-lg border border-[#232736] bg-[#0f1118] p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-400">
                  <span className="text-[10.5px] font-mono uppercase">Mantık Voltajı</span>
                  <VoltageIcon className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-sm font-semibold text-white">
                    {currentModel.voltage || currentProfile.voltage}
                  </span>
                  {(currentModel.voltage || currentProfile.voltage).includes('3.3V') && (
                    <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-mono text-amber-300 font-medium">
                      5V Toleranssız
                    </span>
                  )}
                </div>
              </div>

              {/* Saat Frekansı */}
              <div className="rounded-lg border border-[#232736] bg-[#0f1118] p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-400">
                  <span className="text-[10.5px] font-mono uppercase">Saat Frekansı</span>
                  <QuartzIcon className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <div className="mt-1 font-mono text-sm font-semibold text-white">
                  {currentModel.clockSpeed || currentProfile.clockSpeed}
                </div>
              </div>

              {/* Mimari / Çekirdek */}
              <div className="rounded-lg border border-[#232736] bg-[#0f1118] p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-400">
                  <span className="text-[10.5px] font-mono uppercase">Mimari / Çekirdek</span>
                  <CpuIcon className="h-3.5 w-3.5 text-indigo-400" />
                </div>
                <div className="mt-1 font-mono text-xs font-semibold text-blue-300 truncate">
                  {currentModel.architecture || currentProfile.architecture}
                </div>
              </div>

              {/* Bellek Kapasitesi */}
              <div className="rounded-lg border border-[#232736] bg-[#0f1118] p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-400">
                  <span className="text-[10.5px] font-mono uppercase">Bellek (Flash / RAM)</span>
                  <MemoryIcon className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div className="mt-1 font-mono text-xs font-semibold text-gray-200 truncate">
                  {currentModel.flashRam || currentProfile.flashRam}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. İNTERAKTİF PİN HARİTASI STÜDYOSU (DONANIM HEADER / SOKET ESTETİĞİ) */}
        <div className="rounded-lg border border-[#232735] bg-[#141620] p-4">
          <div className="flex flex-wrap items-center justify-between pb-2.5 border-b border-white/[0.06] gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-white font-mono uppercase tracking-wider">
                  Kullanılabilir Pin Haritası (I/O Terminali)
                </h4>
                <span className="rounded border border-[#292f40] bg-[#191c28] px-1.5 py-0.2 font-mono text-[9.5px] text-gray-300 font-semibold">
                  {currentModel.pins.length} Pin Tanımlı
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                AI kod üretimi bu pin tanımlarını referans alır. Pinin adına tıklayarak doğrudan düzenleyebilirsiniz.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (isBatchPinMode) {
                    setIsBatchPinMode(false)
                  } else {
                    handleOpenBatchPin()
                  }
                }}
                className="rounded border border-[#2a2f40] bg-[#181b26] px-2.5 py-1 text-xs text-gray-300 hover:text-white transition-colors"
              >
                {isBatchPinMode ? 'Normal Görünüm' : 'Toplu Pin Düzenle'}
              </button>
            </div>
          </div>

          {/* Hızlı Pin Ekleme Konsolu */}
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-gray-500 select-none">
                pin&gt;
              </span>
              <input
                type="text"
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleAddPin()
                }}
                placeholder="Yeni pin adı ekle... (Örn: D16, GPKEY, SOIL_A0, RELAY_1)"
                className="w-full rounded border border-[#262b3a] bg-[#0e1017] pl-11 pr-3 py-1.5 text-xs font-mono text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              onClick={() => void handleAddPin()}
              className="rounded border border-blue-500/40 bg-blue-600/80 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-600 transition-colors shrink-0"
            >
              Pin Ekle
            </button>
          </div>

          {/* Pin Çipleri Listesi (Header Terminal Soket Görünümü) */}
          {isBatchPinMode ? (
            <div className="mt-3 space-y-2">
              <textarea
                value={batchPinText}
                onChange={(e) => setBatchPinText(e.target.value)}
                rows={4}
                className="w-full rounded border border-[#2a3042] bg-[#0e1017] p-3 text-xs font-mono text-gray-200 focus:border-blue-500 focus:outline-none leading-relaxed"
                placeholder="Pinleri virgül veya yeni satır ile ayırarak yazınız..."
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsBatchPinMode(false)}
                  className="rounded border border-[#2a3042] px-3 py-1 text-xs text-gray-300 hover:bg-[#181b26]"
                >
                  Vazgeç
                </button>
                <button
                  onClick={() => void handleSaveBatchPin()}
                  className="rounded border border-blue-500/50 bg-blue-600 px-4 py-1 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  Toplu Pinleri Kaydet
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1">
              {currentModel.pins.map((pin, idx) => {
                const isEditingThisPin = editingPinIdx === idx
                if (isEditingThisPin) {
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-1 rounded border border-blue-500 bg-[#162036] px-2 py-0.5"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editingPinVal}
                        onChange={(e) => setEditingPinVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleSavePinEdit(idx)
                          if (e.key === 'Escape') setEditingPinIdx(null)
                        }}
                        className="w-24 bg-transparent text-xs font-mono text-white focus:outline-none"
                      />
                      <button
                        onClick={() => void handleSavePinEdit(idx)}
                        className="text-emerald-400 hover:text-emerald-300 p-0.5 text-xs font-bold"
                        title="Kaydet"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingPinIdx(null)}
                        className="text-gray-400 hover:text-gray-300 p-0.5 text-xs"
                        title="İptal"
                      >
                        ✕
                      </button>
                    </div>
                  )
                }

                // Pin tipi belirteci (Analog, Dijital, Bus/Özel)
                const isAnalog = pin.startsWith('A') || pin.includes('_A')
                const isSpecial = ['SDA', 'SCL', 'MOSI', 'MISO', 'SCK', 'TX', 'RX', 'SS', 'LED_BUILTIN'].includes(pin)
                const dotColor = isSpecial
                  ? 'bg-emerald-400'
                  : isAnalog
                  ? 'bg-amber-400'
                  : 'bg-blue-400'

                return (
                  <div
                    key={idx}
                    className="group relative flex items-center gap-1.5 rounded border border-[#232736] bg-[#10121a] px-2.5 py-1 text-xs font-mono text-gray-300 transition-colors hover:border-[#384259] hover:bg-[#181c28]"
                  >
                    {/* Donanım Pin Soket Terminal Noktası */}
                    <span className={`h-1.5 w-1.5 rounded-full ${dotColor} opacity-70`} />

                    <span
                      onClick={() => {
                        setEditingPinIdx(idx)
                        setEditingPinVal(pin)
                      }}
                      className="cursor-pointer hover:text-white"
                      title="Pini yeniden adlandırmak için tıklayın"
                    >
                      {pin}
                    </span>

                    {/* Düzenle İkonu */}
                    <button
                      onClick={() => {
                        setEditingPinIdx(idx)
                        setEditingPinVal(pin)
                      }}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-blue-300 transition-opacity p-0.5"
                      title="Adı değiştir"
                    >
                      <EditIcon className="w-2.5 h-2.5" />
                    </button>

                    {/* Sil Butonu */}
                    <button
                      onClick={() => void handleDeletePin(idx)}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity p-0.5 text-xs font-bold leading-none"
                      title="Pini sil"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 4. DONANIM ÖZELLİKLERİ VE KRİTİK MİMARİ KURALLARI (2 SÜTUNLU DÜZEN) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Periferikler ve Donanım Özellikleri */}
          <div className="rounded-lg border border-[#232735] bg-[#141620] p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] mb-2.5">
                <h5 className="text-xs font-semibold text-gray-200 font-mono uppercase tracking-wider">
                  Donanım Çevre Birimleri & Özellikleri
                </h5>
                <span className="text-[10px] font-mono text-gray-400">{currentModel.features?.length || 0} Tanım</span>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
                {(currentModel.features || []).map((f, i) => (
                  <div
                    key={i}
                    className="group flex items-center gap-1.5 rounded bg-[#10121a] border border-[#232736] px-2.5 py-1 text-xs text-gray-300"
                  >
                    <span>{f}</span>
                    <button
                      onClick={() => void handleDeleteFeature(i)}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs font-bold"
                      title="Özelliği sil"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Özellik Ekle */}
            <div className="mt-3 pt-2 border-t border-white/[0.06] flex items-center gap-2">
              <input
                type="text"
                value={newFeatureInput}
                onChange={(e) => setNewFeatureInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleAddFeature()
                }}
                placeholder="Yeni özellik ekle... (Örn: Dahili Qwiic I2C Soketi)"
                className="flex-1 rounded border border-[#262b3a] bg-[#0e1017] px-2.5 py-1 text-xs text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none font-sans"
              />
              <button
                onClick={() => void handleAddFeature()}
                className="rounded border border-[#2e3547] bg-[#1a1e2b] px-2.5 py-1 text-xs font-medium text-gray-300 hover:bg-[#22283a] hover:text-white"
              >
                Ekle
              </button>
            </div>
          </div>

          {/* Sistem Promptu Mimari Kuralları */}
          <div className="rounded-lg border border-[#232735] bg-[#141620] p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] mb-2.5">
                <h5 className="text-xs font-semibold text-gray-200 font-mono uppercase tracking-wider">
                  Sistem Promptu Mimari Direktifleri
                </h5>
                <span className="text-[10px] font-mono text-gray-400">{currentModel.rules?.length || 0} Direktif</span>
              </div>

              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {(currentModel.rules || []).map((rule, idx) => (
                  <div
                    key={idx}
                    className="group flex items-start justify-between gap-2 rounded bg-[#10121a] border border-[#202330] p-2 text-xs text-gray-300 leading-relaxed"
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#1c202d] text-[9.5px] font-mono font-semibold text-blue-400 border border-white/5">
                        {idx + 1}
                      </span>
                      <p className="font-sans">{rule}</p>
                    </div>
                    <button
                      onClick={() => void handleDeleteRule(idx)}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs font-bold shrink-0 ml-1"
                      title="Kuralı sil"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Kural Ekle */}
            <div className="mt-3 pt-2 border-t border-white/[0.06] flex items-center gap-2">
              <input
                type="text"
                value={newRuleInput}
                onChange={(e) => setNewRuleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleAddRule()
                }}
                placeholder="Yeni mimari kural ekle... (Örn: analogWrite yerine ledcAttach kullan)"
                className="flex-1 rounded border border-[#262b3a] bg-[#0e1017] px-2.5 py-1 text-xs text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none font-sans"
              />
              <button
                onClick={() => void handleAddRule()}
                className="rounded border border-[#2e3547] bg-[#1a1e2b] px-2.5 py-1 text-xs font-medium text-gray-300 hover:bg-[#22283a] hover:text-white"
              >
                Ekle
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. YENİ MODEL EKLEME MODALI */}
      {isAddingModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-xl border border-[#2e3447] bg-[#141622] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="text-xs font-semibold text-white font-mono uppercase flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-400" />
                Yeni Kart Modeli Tanımla ({currentProfile.name})
              </h3>
              <button
                onClick={() => setIsAddingModel(false)}
                className="text-gray-400 hover:text-white text-sm leading-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[68vh] overflow-y-auto pr-1">
              <div>
                <label className="text-[10px] font-mono uppercase text-gray-400 block mb-1">
                  Model Adı <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder="Örn: Deneyap Kart 1A Özel Robotik"
                  className="w-full rounded border border-[#2a2f42] bg-[#0e1017] px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase text-gray-400 block mb-1">
                    Mimari / Çekirdek
                  </label>
                  <input
                    type="text"
                    value={newModelArch}
                    onChange={(e) => setNewModelArch(e.target.value)}
                    placeholder="Örn: ESP32-S3 Dual LX7"
                    className="w-full rounded border border-[#2a2f42] bg-[#0e1017] px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-gray-400 block mb-1">
                    Mantık Voltajı
                  </label>
                  <input
                    type="text"
                    value={newModelVoltage}
                    onChange={(e) => setNewModelVoltage(e.target.value)}
                    placeholder="3.3V (5V Toleranssız)"
                    className="w-full rounded border border-[#2a2f42] bg-[#0e1017] px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase text-gray-400 block mb-1">
                    Saat Frekansı
                  </label>
                  <input
                    type="text"
                    value={newModelClock}
                    onChange={(e) => setNewModelClock(e.target.value)}
                    placeholder="240 MHz"
                    className="w-full rounded border border-[#2a2f42] bg-[#0e1017] px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-gray-400 block mb-1">
                    Bellek Kapasitesi
                  </label>
                  <input
                    type="text"
                    value={newModelFlashRam}
                    onChange={(e) => setNewModelFlashRam(e.target.value)}
                    placeholder="4MB Flash / 520KB SRAM"
                    className="w-full rounded border border-[#2a2f42] bg-[#0e1017] px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-gray-400 block mb-1">
                  Başlangıç Pin Haritası (Virgülle Ayrılmış)
                </label>
                <textarea
                  value={newModelPinsText}
                  onChange={(e) => setNewModelPinsText(e.target.value)}
                  rows={3}
                  placeholder="D0, D1, D2, A0, A1, D_RGB, GPKEY..."
                  className="w-full rounded border border-[#2a2f42] bg-[#0e1017] p-2.5 text-xs font-mono text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-gray-400 block mb-1">
                  Donanım Özellikleri (Her Satıra Bir Tane)
                </label>
                <textarea
                  value={newModelFeaturesText}
                  onChange={(e) => setNewModelFeaturesText(e.target.value)}
                  rows={3}
                  placeholder="Dahili Wi-Fi & BLE&#10;Dahili 6-Eksen IMU..."
                  className="w-full rounded border border-[#2a2f42] bg-[#0e1017] p-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setIsAddingModel(false)}
                className="rounded border border-[#2a2f42] px-4 py-1.5 text-xs text-gray-300 hover:bg-[#1c2030]"
              >
                İptal
              </button>
              <button
                onClick={() => void handleSaveNewModel()}
                disabled={!newModelName.trim()}
                className="rounded border border-blue-500 bg-blue-600 px-5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                Modeli Oluştur & Seç
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * ── 2. Sekme: Semantik Kod Kütüphanesi & Vektör İndeksi (RAG Master-Detail) ──
 */
function RagVectorView({
  ragStatus,
  chunks,
  query,
  onQueryChange,
  familyFilter,
  onFamilyFilterChange,
  onReindex,
  reindexing,
  selectedChunk,
  onSelectChunk,
  kopyalaMetin,
  kopyalandi
}: {
  ragStatus?: SkillsInfoResult['rag']
  chunks: RagChunkSummary[]
  query: string
  onQueryChange: (q: string) => void
  familyFilter: string
  onFamilyFilterChange: (f: string) => void
  onReindex: () => void
  reindexing: boolean
  selectedChunk: RagChunkSummary | null
  onSelectChunk: (c: RagChunkSummary) => void
  kopyalaMetin: (text: string) => void
  kopyalandi: boolean
}): ReactElement {
  return (
    <div className="flex h-full flex-col font-sans">
      {/* Durum ve Filtre Başlığı */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#212430] bg-[#141620] px-5 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono font-semibold text-white uppercase tracking-wide">Semantik Kod İndeksi</span>
            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.2 font-mono text-[9.5px] font-medium text-emerald-300">
              {ragStatus?.modelLoaded ? 'INT8 VEKTÖR MODELİ AKTİF' : 'MODEL YÜKLENİYOR'}
            </span>
          </div>
          <span className="text-gray-600">•</span>
          <span className="text-xs text-gray-400 font-mono">
            Toplam <span className="font-semibold text-blue-400">{ragStatus?.totalChunks || 0}</span> doğrulanmış kod referansı
          </span>
        </div>

        <button
          onClick={onReindex}
          disabled={reindexing}
          className="flex items-center gap-1.5 rounded border border-[#2b3142] bg-[#181c28] px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-[#202536] hover:text-white disabled:opacity-40"
        >
          {reindexing ? (
            <>
              <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
              <span>İndeksleniyor...</span>
            </>
          ) : (
            <>
              <RefreshIcon className="h-3.5 w-3.5 text-gray-400" />
              <span>Kütüphaneleri Tara & İndeksle</span>
            </>
          )}
        </button>
      </div>

      {/* Master-Detail Split: Sol Liste, Sağ Monaco Tarzı Kod İnceleyici */}
      <div className="flex min-h-0 flex-1">
        {/* Sol Panel: Arama ve Liste */}
        <div className="flex w-80 sm:w-96 shrink-0 flex-col border-r border-[#212430] bg-[#0e1017]">
          <div className="border-b border-[#212430] p-3 space-y-2">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                <SearchIcon className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Semantik arama yap (ör. wifi, imu, timer)..."
                className="w-full rounded border border-[#242938] bg-[#13151f] pl-8 pr-3 py-1.5 text-xs text-gray-200 outline-none placeholder:text-gray-600 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-gray-400 uppercase">Filtre:</span>
              <select
                value={familyFilter}
                onChange={(e) => onFamilyFilterChange(e.target.value)}
                className="flex-1 rounded border border-[#242938] bg-[#13151f] px-2.5 py-1 text-xs text-gray-300 outline-none focus:border-blue-500 font-sans"
              >
                <option value="all">Tüm Mimariler</option>
                <option value="deneyap">Deneyap Kart</option>
                <option value="esp32">ESP32</option>
                <option value="avr">Arduino AVR (Uno/Nano)</option>
                <option value="rp2040">RP2040 (Pico)</option>
                <option value="stm32">STM32</option>
                <option value="general">Genel</option>
              </select>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1">
            {chunks.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                Aramayla eşleşen kod parçacığı bulunamadı.
              </div>
            ) : (
              chunks.map((c) => {
                const isSelected = selectedChunk?.id === c.id
                return (
                  <div
                    key={c.id}
                    onClick={() => onSelectChunk(c)}
                    className={`cursor-pointer rounded-lg border p-2.5 transition-all ${
                      isSelected
                        ? 'border-[#38425a] bg-[#191d2a] text-white shadow-sm'
                        : 'border-transparent bg-[#12141d] hover:border-[#242838] hover:bg-[#161822] text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold truncate font-sans">{c.title}</span>
                      {c.isCustom && (
                        <span className="shrink-0 rounded border border-purple-500/30 bg-purple-500/10 px-1 py-0.2 font-mono text-[9px] text-purple-300">
                          Özel
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10.5px] text-gray-400">
                      <span className="truncate">{c.sourceOwner}</span>
                      <span>•</span>
                      <span className="uppercase font-mono text-[9.5px] text-gray-500">{c.boardFamily || 'Genel'}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Sağ Panel: Monaco/IDE Kalitesinde Kod İnceleyici */}
        <div className="flex min-h-0 flex-1 flex-col bg-[#0b0c10]">
          {selectedChunk ? (
            <>
              <div className="flex shrink-0 items-center justify-between border-b border-[#212430] bg-[#13151f] px-5 py-2.5">
                <div className="min-w-0 flex-1 pr-3">
                  <h3 className="text-xs font-semibold text-white truncate font-sans">{selectedChunk.title}</h3>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-400 font-mono">
                    <span>Kaynak: {selectedChunk.sourceOwner}</span>
                    <span>•</span>
                    <span className="truncate">Dosya: {selectedChunk.sourceFile}</span>
                  </div>
                </div>

                <button
                  onClick={() => void kopyalaMetin(selectedChunk.content)}
                  className="flex items-center gap-1.5 rounded border border-[#292e3e] bg-[#171b26] px-3 py-1 text-xs font-medium text-gray-200 hover:text-white transition-colors"
                >
                  {kopyalandi ? (
                    <span className="flex items-center gap-1 text-emerald-400 font-mono">
                      <CheckIcon className="h-3.5 w-3.5" />
                      <span>Kopyalandı</span>
                    </span>
                  ) : (
                    <>
                      <CopyIcon className="h-3.5 w-3.5 text-gray-400" />
                      <span>Kodu Kopyala</span>
                    </>
                  )}
                </button>
              </div>

              {/* Kod Görüntüleyici: Temiz monospaced terminal */}
              <div className="min-h-0 flex-1 overflow-auto p-4">
                <div className="rounded-lg border border-[#1e222e] bg-[#08090d] p-4">
                  <pre className="font-mono text-[11.5px] leading-relaxed text-gray-300 selection:bg-blue-900/60 selection:text-white">
                    {selectedChunk.content}
                  </pre>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-500 font-mono">
              İncelemek için sol listeden bir kod parçacığı seçiniz.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * ── 3. Sekme: Yerel Markdown (.md) Becerilerim (Dosya Sistemi & Master-Detail) ──
 */
function CustomMarkdownSkillsView({
  skills,
  skillsDirectory,
  selectedSkill,
  onSelectSkill,
  isAdding,
  onToggleAdd,
  title,
  onTitleChange,
  boardFamily,
  onBoardFamilyChange,
  type,
  onTypeChange,
  content,
  onContentChange,
  saving,
  onSave,
  onDelete,
  onOpenFolder,
  onRefresh,
  kopyalaMetin,
  kopyalandi
}: {
  skills: CustomSkill[]
  skillsDirectory: string
  selectedSkill: CustomSkill | null
  onSelectSkill: (s: CustomSkill) => void
  isAdding: boolean
  onToggleAdd: () => void
  title: string
  onTitleChange: (v: string) => void
  boardFamily: string
  onBoardFamilyChange: (v: string) => void
  type: 'snippet' | 'rule'
  onTypeChange: (v: 'snippet' | 'rule') => void
  content: string
  onContentChange: (v: string) => void
  saving: boolean
  onSave: () => void
  onDelete: (id: string) => void
  onOpenFolder: () => void
  onRefresh: () => void
  kopyalaMetin: (text: string) => void
  kopyalandi: boolean
}): ReactElement {
  return (
    <div className="flex h-full flex-col font-sans">
      {/* Üst Dosya Sistemi Çubuğu */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#212430] bg-[#141620] px-5 py-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[11px] font-mono uppercase text-gray-400 shrink-0">Yerel Dizin:</span>
          <span
            title={skillsDirectory}
            className="truncate rounded border border-[#242938] bg-[#0c0d12] px-2.5 py-1 font-mono text-[11px] text-gray-300"
          >
            {skillsDirectory || '.../dret-ide/skills'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenFolder}
            title="Beceriler klasörünü Windows Dosya Gezgini'nde açar"
            className="flex items-center gap-1.5 rounded border border-[#292e3e] bg-[#171b26] px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-[#202536] hover:text-white"
          >
            <FolderOpenIcon className="h-3.5 w-3.5 text-amber-400" />
            <span>Klasörü Aç (Explorer)</span>
          </button>

          <button
            onClick={onRefresh}
            title="Dosya sistemindeki değişiklikleri yeniden yükler"
            className="flex items-center gap-1.5 rounded border border-[#292e3e] bg-[#171b26] px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-[#202536] hover:text-white"
          >
            <RefreshIcon className="h-3.5 w-3.5 text-gray-400" />
            <span>Yenile</span>
          </button>

          <button
            onClick={onToggleAdd}
            className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold transition-colors ${
              isAdding
                ? 'border-gray-600 bg-[#222634] text-gray-300'
                : 'border-blue-500/50 bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            {isAdding ? (
              <>
                <CloseIcon className="h-3.5 w-3.5" />
                <span>Formu Kapat</span>
              </>
            ) : (
              <>
                <PlusSmallIcon className="h-3.5 w-3.5" />
                <span>Yeni Beceri / Kural (.md)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Yeni Beceri Ekleme Formu */}
      {isAdding ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="max-w-3xl rounded-xl border border-[#272c3d] bg-[#13151f] p-5 sm:p-6 shadow-xl space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-white font-mono uppercase tracking-wide">
                Yeni Markdown (.md) Becerisi Tanımla
              </h4>
              <p className="mt-0.5 text-xs text-gray-400">
                Bu beceri <span className="font-mono text-gray-300">skills/</span> dizininde bağımsız bir .md dosyası olarak kaydedilecek ve otomatik vektör indeksine dahil edilecektir.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Beceri Başlığı:</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="Örn: BMP280 I2C Basınç ve Sıcaklık Sensörü"
                  className="w-full rounded border border-[#242938] bg-[#0c0e14] px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Hedef Mimari:</label>
                  <select
                    value={boardFamily}
                    onChange={(e) => onBoardFamilyChange(e.target.value)}
                    className="w-full rounded border border-[#242938] bg-[#0c0e14] px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500 font-sans"
                  >
                    <option value="general">Tümü (Genel)</option>
                    <option value="deneyap">Deneyap Kart</option>
                    <option value="esp32">ESP32</option>
                    <option value="avr">Arduino AVR</option>
                    <option value="rp2040">RP2040</option>
                    <option value="stm32">STM32</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Beceri Türü:</label>
                  <select
                    value={type}
                    onChange={(e) => onTypeChange(e.target.value as any)}
                    className="w-full rounded border border-[#242938] bg-[#0c0e14] px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500 font-sans"
                  >
                    <option value="snippet">Kod Parçacığı (RAG)</option>
                    <option value="rule">Mimari Kural (Prompt)</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                {type === 'snippet' ? 'C++ Örnek Kodu / Şablon:' : 'Kural Açıklaması (Prompt Direktifi):'}
              </label>
              <textarea
                value={content}
                onChange={(e) => onContentChange(e.target.value)}
                placeholder={
                  type === 'snippet'
                    ? '// #include <Adafruit_BMP280.h>\nvoid setup() { ... }'
                    : 'Örn: Tüm pin tanımlamalarında mutlaka const int yerine constexpr veya #define kullan.'
                }
                rows={6}
                className="w-full rounded border border-[#242938] bg-[#0c0e14] p-3 font-mono text-[11.5px] text-gray-200 outline-none focus:border-blue-500 leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={onToggleAdd}
                className="rounded border border-[#292e3e] px-3.5 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Vazgeç
              </button>
              <button
                onClick={onSave}
                disabled={!title.trim() || !content.trim() || saving}
                className="rounded border border-blue-500 bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:bg-blue-500 disabled:opacity-40"
              >
                {saving ? 'Kaydediliyor (.md)...' : '.md Olarak Kaydet'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Master-Detail: Sol .md Dosyaları, Sağ İçerik */
        <div className="flex min-h-0 flex-1">
          {/* Sol Panel: .md Dosya Listesi */}
          <div className="flex w-80 sm:w-96 shrink-0 flex-col border-r border-[#212430] bg-[#0e1017]">
            <div className="border-b border-[#212430] px-4 py-2 text-[11px] font-mono text-gray-400 uppercase">
              Yüklü .md Becerileri ({skills.length})
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1">
              {skills.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  Henüz bir beceri dosyası bulunamadı. &quot;Yeni Beceri / Kural&quot; butonuna basabilir veya klasöre doğrudan .md dosyaları ekleyebilirsiniz.
                </div>
              ) : (
                skills.map((s) => {
                  const isSelected = selectedSkill?.id === s.id
                  return (
                    <div
                      key={s.id}
                      onClick={() => onSelectSkill(s)}
                      className={`cursor-pointer rounded-lg border p-2.5 transition-all ${
                        isSelected
                          ? 'border-[#38425a] bg-[#191d2a] text-white shadow-sm'
                          : 'border-transparent bg-[#12141d] hover:border-[#242838] hover:bg-[#161822] text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold truncate font-sans">{s.title}</span>
                        <span
                          className={`shrink-0 rounded border px-1 py-0.2 font-mono text-[9px] font-semibold ${
                            s.type === 'snippet'
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
                          }`}
                        >
                          {s.type === 'snippet' ? 'Kod' : 'Kural'}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400">
                        <span className="truncate font-mono text-[10px] text-gray-500">{s.fileName || s.title}</span>
                        <span className="uppercase font-mono text-[9.5px] text-gray-400">{s.boardFamily}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Sağ Panel: Seçili Beceri İçeriği ve Silme */}
          <div className="flex min-h-0 flex-1 flex-col bg-[#0b0c10]">
            {selectedSkill ? (
              <>
                <div className="flex shrink-0 items-center justify-between border-b border-[#212430] bg-[#13151f] px-5 py-2.5">
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold text-white truncate font-sans">{selectedSkill.title}</h3>
                      <span className="rounded border border-white/10 bg-black/50 px-2 py-0.5 text-[9.5px] font-mono text-gray-300 uppercase">
                        {selectedSkill.boardFamily}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-400 font-mono">
                      <span>Dosya: {selectedSkill.fileName || selectedSkill.title + '.md'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void kopyalaMetin(selectedSkill.content)}
                      className="flex items-center gap-1.5 rounded border border-[#292e3e] bg-[#171b26] px-3 py-1 text-xs font-medium text-gray-200 hover:text-white transition-colors"
                    >
                      {kopyalandi ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-mono">
                          <CheckIcon className="h-3.5 w-3.5" />
                          <span>Kopyalandı</span>
                        </span>
                      ) : (
                        <>
                          <CopyIcon className="h-3.5 w-3.5 text-gray-400" />
                          <span>Kopyala</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => onDelete(selectedSkill.id)}
                      title="Beceriyi ve .md dosyasını sil"
                      className="flex items-center gap-1 rounded border border-red-500/20 bg-red-950/20 px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-900/30 transition-colors"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      <span>Sil</span>
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-4">
                  <div className="rounded-lg border border-[#1e222e] bg-[#08090d] p-4">
                    <pre className="font-mono text-[11.5px] leading-relaxed text-gray-300">
                      {selectedSkill.content}
                    </pre>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-gray-500 font-mono">
                Görüntülemek için sol taraftan bir beceri seçiniz.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Endüstriyel Standartta Temiz Mühendislik SVG İkonları (Sıfır Emoji Kuralı)
// ────────────────────────────────────────────────────────────────────────

function MicrochipIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
      <line x1="2" y1="9" x2="4" y2="9" />
      <line x1="2" y1="15" x2="4" y2="15" />
      <line x1="20" y1="9" x2="22" y2="9" />
      <line x1="20" y1="15" x2="22" y2="15" />
      <line x1="9" y1="2" x2="9" y2="4" />
      <line x1="15" y1="2" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="22" />
      <line x1="15" y1="20" x2="15" y2="22" />
    </svg>
  )
}

function CpuIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M15 2v2M9 2v2M15 20v2M9 20v2M2 15h2M2 9h2M20 15h2M20 9h2" />
    </svg>
  )
}

function VoltageIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  )
}

function QuartzIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  )
}

function MemoryIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10v4M10 10v4M14 10v4M18 10v4" />
    </svg>
  )
}

function DatabaseIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  )
}

function FileCodeIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <polyline points="10 13 8 15 10 17" />
      <polyline points="14 13 16 15 14 17" />
    </svg>
  )
}

function FolderOpenIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 2h6l2 2h6a2 2 0 0 1 2 2v2H6V2z" />
      <path d="M2 10h20l-3 10H5L2 10z" />
    </svg>
  )
}

function RefreshIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  )
}

function CopyIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function EditIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function PlusSmallIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export default RagSkillsModal
