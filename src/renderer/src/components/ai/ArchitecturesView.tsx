import { useState, useEffect, type ReactElement } from 'react'
import type { BoardProfileInfo, BoardModelVariant } from '@shared/types'
import { kartGorseli, kartRengi } from '../../utils/boardImages'
import BoardThumb from '../common/BoardThumb'
import { useT } from '../../i18n'
import { VoltageIcon, QuartzIcon, CpuIcon, MemoryIcon } from './skillsIcons'

const girdiSinifi =
  'w-full rounded border border-panel-border bg-panel px-2.5 py-1.5 text-xs text-gray-100 outline-none placeholder:text-gray-600 focus:border-accent'
const ikincilButon = 'rounded border border-panel-border px-3 py-1 text-xs text-gray-200 hover:bg-white/5 disabled:opacity-40'
const metinButonu = 'text-xs text-gray-400 hover:text-gray-100 hover:underline'

function Bolum({
  baslik,
  aciklama,
  sag,
  children
}: {
  baslik: string
  aciklama?: string
  sag?: ReactElement
  children: ReactElement | ReactElement[]
}): ReactElement {
  return (
    <section className="border-t border-white/[0.07] px-6 py-4 first:border-t-0">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-[13px] font-semibold text-gray-100">
            <span className="h-3.5 w-1 rounded-full bg-accent" />
            {baslik}
          </h3>
          {aciklama && <p className="mt-0.5 text-xs text-gray-500">{aciklama}</p>}
        </div>
        {sag}
      </div>
      {children}
    </section>
  )
}

/** Liste ekleme satırı: tek satır giriş + Ekle düğmesi */
function EkleSatiri({
  deger,
  onDegisim,
  onEkle,
  placeholder
}: {
  deger: string
  onDegisim: (v: string) => void
  onEkle: () => void
  placeholder: string
}): ReactElement {
  const t = useT()
  return (
    <div className="mt-2 flex gap-2">
      <input
        value={deger}
        onChange={(e) => onDegisim(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEkle()
        }}
        placeholder={placeholder}
        className={girdiSinifi}
      />
      <button onClick={onEkle} disabled={!deger.trim()} className={ikincilButon}>
        {t('Ekle')}
      </button>
    </div>
  )
}

/**
 * Kartlar: bir kart ailesi ve modeli seçilir; voltaj, pinler, çevre birimleri ve yapay zekâya
 * verilen kurallar burada görülür ve düzenlenir. Değişiklikler anında kaydedilir.
 */
export function ArchitecturesView({
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
  const t = useT()
  const [selectedFamily, setSelectedFamily] = useState<string>(activeFamily || 'deneyap')

  const currentProfile = profiles.find((p) => p.family.toLowerCase() === selectedFamily.toLowerCase()) || profiles[0]

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFamily, currentProfile])

  const currentModel: BoardModelVariant =
    currentProfile?.models?.find((m) => m.id === selectedModelId) ||
    currentProfile?.models?.[0] || {
      id: 'default',
      name: currentProfile?.name || 'Varsayılan model',
      voltage: currentProfile?.voltage || '3.3V',
      clockSpeed: currentProfile?.clockSpeed || '240 MHz',
      architecture: currentProfile?.architecture || 'ESP32',
      flashRam: currentProfile?.flashRam || '4MB Flash',
      features: currentProfile?.features || [],
      pins: currentProfile?.pins || [],
      rules: currentProfile?.rules || []
    }

  // Pin ekleme ve düzenleme
  const [newPinInput, setNewPinInput] = useState('')
  const [editingPinIdx, setEditingPinIdx] = useState<number | null>(null)
  const [editingPinVal, setEditingPinVal] = useState('')
  const [isBatchPinMode, setIsBatchPinMode] = useState(false)
  const [batchPinText, setBatchPinText] = useState('')

  // Donanım bilgileri düzenleme
  const [isEditingSpecs, setIsEditingSpecs] = useState(false)
  const [specVoltage, setSpecVoltage] = useState('')
  const [specClock, setSpecClock] = useState('')
  const [specArch, setSpecArch] = useState('')
  const [specFlashRam, setSpecFlashRam] = useState('')

  // Özellik ve kural ekleme
  const [newFeatureInput, setNewFeatureInput] = useState('')
  const [newRuleInput, setNewRuleInput] = useState('')

  // Yeni model ekleme
  const [isAddingModel, setIsAddingModel] = useState(false)
  const [newModelName, setNewModelName] = useState('')
  const [newModelArch, setNewModelArch] = useState('')
  const [newModelVoltage, setNewModelVoltage] = useState('3.3V')
  const [newModelClock, setNewModelClock] = useState('240 MHz')
  const [newModelFlashRam, setNewModelFlashRam] = useState('4MB Flash / 520KB SRAM')
  const [newModelPinsText, setNewModelPinsText] = useState('')
  const [newModelFeaturesText, setNewModelFeaturesText] = useState('')

  // Durum mesajı
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const showToast = (msg: string): void => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const saveCurrentModel = async (updatedModel: BoardModelVariant): Promise<void> => {
    try {
      await window.api.skills.saveBoardModel(currentProfile.family, updatedModel)
      showToast(t('Kaydedildi'))
      if (onRefresh) await onRefresh()
    } catch (err) {
      console.error('Model kaydedilemedi:', err)
      showToast(t('Kaydedilemedi'))
    }
  }

  const handleAddPin = async (): Promise<void> => {
    const pin = newPinInput.trim()
    if (!pin) return
    setNewPinInput('')
    if (currentModel.pins.includes(pin)) return
    await saveCurrentModel({ ...currentModel, pins: [...currentModel.pins, pin], isCustom: true })
  }

  const handleDeletePin = async (index: number): Promise<void> => {
    await saveCurrentModel({ ...currentModel, pins: currentModel.pins.filter((_, idx) => idx !== index), isCustom: true })
  }

  const handleSavePinEdit = async (index: number): Promise<void> => {
    const val = editingPinVal.trim()
    setEditingPinIdx(null)
    setEditingPinVal('')
    if (!val) return
    const updatedPins = [...currentModel.pins]
    updatedPins[index] = val
    await saveCurrentModel({ ...currentModel, pins: updatedPins, isCustom: true })
  }

  const handleOpenBatchPin = (): void => {
    setBatchPinText(currentModel.pins.join(', '))
    setIsBatchPinMode(true)
  }

  const handleSaveBatchPin = async (): Promise<void> => {
    const parsed = batchPinText
      .split(/[\n,]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
    setIsBatchPinMode(false)
    await saveCurrentModel({ ...currentModel, pins: parsed, isCustom: true })
  }

  const handleOpenEditSpecs = (): void => {
    setSpecVoltage(currentModel.voltage || currentProfile.voltage)
    setSpecClock(currentModel.clockSpeed || currentProfile.clockSpeed)
    setSpecArch(currentModel.architecture || currentProfile.architecture)
    setSpecFlashRam(currentModel.flashRam || currentProfile.flashRam)
    setIsEditingSpecs(true)
  }

  const handleSaveSpecs = async (): Promise<void> => {
    setIsEditingSpecs(false)
    await saveCurrentModel({
      ...currentModel,
      voltage: specVoltage.trim(),
      clockSpeed: specClock.trim(),
      architecture: specArch.trim(),
      flashRam: specFlashRam.trim(),
      isCustom: true
    })
  }

  const handleAddFeature = async (): Promise<void> => {
    const feat = newFeatureInput.trim()
    if (!feat) return
    setNewFeatureInput('')
    await saveCurrentModel({ ...currentModel, features: [...(currentModel.features || []), feat], isCustom: true })
  }

  const handleDeleteFeature = async (index: number): Promise<void> => {
    await saveCurrentModel({ ...currentModel, features: (currentModel.features || []).filter((_, i) => i !== index), isCustom: true })
  }

  const handleAddRule = async (): Promise<void> => {
    const rule = newRuleInput.trim()
    if (!rule) return
    setNewRuleInput('')
    await saveCurrentModel({ ...currentModel, rules: [...(currentModel.rules || []), rule], isCustom: true })
  }

  const handleDeleteRule = async (index: number): Promise<void> => {
    await saveCurrentModel({ ...currentModel, rules: (currentModel.rules || []).filter((_, i) => i !== index), isCustom: true })
  }

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
      features: features.length > 0 ? features : ['Özel kullanıcı kartı'],
      rules: [`Bu model '${newModelName.trim()}' kullanıcı tarafından eklenmiştir.`, 'Pin haritasında tanımlı isimleri kullan.'],
      isCustom: true
    }

    await window.api.skills.addBoardModel(currentProfile.family, newVariant)
    setSelectedModelId(newId)
    setIsAddingModel(false)
    showToast(t("'{ad}' eklendi", { ad: newModelName.trim() }))
    if (onRefresh) await onRefresh()
  }

  const handleResetToDefault = async (): Promise<void> => {
    if (!window.confirm(t("'{ad}' modeli fabrika ayarlarına döndürülsün mü?", { ad: currentModel.name }))) return
    await window.api.skills.resetBoardModel(currentProfile.family, currentModel.id)
    showToast(t('Varsayılana döndürüldü'))
    if (onRefresh) await onRefresh()
  }

  const handleDeleteCurrentModel = async (): Promise<void> => {
    if (!window.confirm(t("'{ad}' modeli silinsin mi?", { ad: currentModel.name }))) return
    await window.api.skills.deleteBoardModel(currentProfile.family, currentModel.id)
    showToast(t('Model silindi'))
    if (onRefresh) await onRefresh()
  }

  if (!currentProfile) {
    return <div className="flex h-full items-center justify-center text-xs text-gray-500">{t('Kart profili bulunamadı.')}</div>
  }

  const ozellikler: Array<{ ad: string; deger: string; ikon: typeof VoltageIcon; stil: string; ikonStil: string }> = [
    { ad: t('Mantık voltajı'), deger: currentModel.voltage || currentProfile.voltage, ikon: VoltageIcon, stil: 'border-amber-400/20 bg-amber-400/[0.06]', ikonStil: 'text-amber-300 bg-amber-400/15' },
    { ad: t('Saat hızı'), deger: currentModel.clockSpeed || currentProfile.clockSpeed, ikon: QuartzIcon, stil: 'border-sky-400/20 bg-sky-400/[0.06]', ikonStil: 'text-sky-300 bg-sky-400/15' },
    { ad: t('Mimari'), deger: currentModel.architecture || currentProfile.architecture, ikon: CpuIcon, stil: 'border-cyan-400/20 bg-cyan-400/[0.06]', ikonStil: 'text-cyan-300 bg-cyan-400/15' },
    { ad: t('Bellek'), deger: currentModel.flashRam || currentProfile.flashRam, ikon: MemoryIcon, stil: 'border-emerald-400/20 bg-emerald-400/[0.06]', ikonStil: 'text-emerald-300 bg-emerald-400/15' }
  ]

  const silinebilir = currentModel.isCustom && (currentProfile.models?.length || 0) > 1

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-end gap-3 border-b border-white/[0.07] bg-white/[0.02] px-6 py-3.5">
        <BoardThumb
          src={kartGorseli({ name: currentModel.name, fqbn: currentModel.fqbnMatch?.[0] })}
          renk={kartRengi({ name: `${currentProfile.name} ${currentModel.name}`, fqbn: currentModel.fqbnMatch?.[0] })}
          genislik={84}
          alt={currentModel.name}
        />
        <label className="text-xs text-gray-400">
          {t('Kart ailesi')}
          <select
            value={currentProfile.family}
            onChange={(e) => setSelectedFamily(e.target.value)}
            className={`${girdiSinifi} mt-1 min-w-[150px]`}
          >
            {profiles.map((p) => (
              <option key={p.family} value={p.family}>
                {p.name}
                {p.family.toLowerCase() === activeFamily.toLowerCase() ? ` (${t('seçili kart')})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-400">
          {t('Model')}
          <select
            value={currentModel.id}
            onChange={(e) => setSelectedModelId(e.target.value)}
            className={`${girdiSinifi} mt-1 min-w-[190px]`}
          >
            {(currentProfile.models || []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.isCustom ? ' •' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={handleOpenAddModel} className={ikincilButon}>
            {t('Yeni model')}
          </button>
          <button onClick={handleResetToDefault} className={ikincilButon} title={t('Bu modeli fabrika ayarlarına döndürür')}>
            {t('Sıfırla')}
          </button>
          {silinebilir && (
            <button onClick={handleDeleteCurrentModel} className={`${ikincilButon} text-rose-300`}>
              {t('Sil')}
            </button>
          )}
        </div>
        {activeBoardName && (
          <p className="basis-full text-xs text-gray-500">
            {t('Derleme için seçili kart: {ad}. Burada yaptığınız değişiklikler yapay zekânın kod yazarken kullandığı bilgiyi etkiler.', { ad: activeBoardName })}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Bolum
          baslik={t('Özellikler')}
          sag={
            isEditingSpecs ? undefined : (
              <button onClick={handleOpenEditSpecs} className={metinButonu}>
                {t('Düzenle')}
              </button>
            )
          }
        >
          {isEditingSpecs ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-gray-400">
                  {t('Mantık voltajı')}
                  <input value={specVoltage} onChange={(e) => setSpecVoltage(e.target.value)} className={`${girdiSinifi} mt-1`} />
                </label>
                <label className="text-xs text-gray-400">
                  {t('Saat hızı')}
                  <input value={specClock} onChange={(e) => setSpecClock(e.target.value)} className={`${girdiSinifi} mt-1`} />
                </label>
                <label className="text-xs text-gray-400">
                  {t('Mimari')}
                  <input value={specArch} onChange={(e) => setSpecArch(e.target.value)} className={`${girdiSinifi} mt-1`} />
                </label>
                <label className="text-xs text-gray-400">
                  {t('Bellek')}
                  <input value={specFlashRam} onChange={(e) => setSpecFlashRam(e.target.value)} className={`${girdiSinifi} mt-1`} />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsEditingSpecs(false)} className={ikincilButon}>
                  {t('Vazgeç')}
                </button>
                <button onClick={() => void handleSaveSpecs()} className="rounded-md bg-accent px-3.5 py-1 text-xs font-semibold text-white hover:bg-accent-hover">
                  {t('Kaydet')}
                </button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ozellikler.map((o) => {
                const Ikon = o.ikon
                return (
                  <div key={o.ad} className={`flex items-center gap-3 rounded-md border p-3 ${o.stil}`}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${o.ikonStil}`}>
                      <Ikon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-[11px] text-gray-400">{o.ad}</dt>
                      <dd className="mt-0.5 truncate text-[13px] font-semibold text-white" title={o.deger}>
                        {o.deger || '—'}
                      </dd>
                    </div>
                  </div>
                )
              })}
            </dl>
          )}
        </Bolum>

        <Bolum
          baslik={t('Pinler')}
          aciklama={t('Yapay zekâ kod yazarken yalnızca bu isimleri kullanır.')}
          sag={
            isBatchPinMode ? undefined : (
              <button onClick={handleOpenBatchPin} className={metinButonu}>
                {t('Toplu düzenle')}
              </button>
            )
          }
        >
          {isBatchPinMode ? (
            <div className="space-y-2">
              <textarea
                value={batchPinText}
                onChange={(e) => setBatchPinText(e.target.value)}
                rows={4}
                placeholder={t('Pinleri virgül veya satır ile ayırın')}
                className={`${girdiSinifi} font-mono`}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsBatchPinMode(false)} className={ikincilButon}>
                  {t('Vazgeç')}
                </button>
                <button onClick={() => void handleSaveBatchPin()} className="rounded-md bg-accent px-3.5 py-1 text-xs font-semibold text-white hover:bg-accent-hover">
                  {t('Kaydet')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <ul className="flex flex-wrap gap-1.5">
                {currentModel.pins.length === 0 && <li className="text-xs text-gray-500">{t('Henüz pin tanımlı değil.')}</li>}
                {currentModel.pins.map((pin, idx) => (
                  <li key={`${pin}-${idx}`} className="group flex items-center rounded-md border border-white/15 bg-white/[0.05] text-xs transition-colors hover:border-white/30 hover:bg-white/[0.1]">
                    {editingPinIdx === idx ? (
                      <input
                        autoFocus
                        value={editingPinVal}
                        onChange={(e) => setEditingPinVal(e.target.value)}
                        onBlur={() => void handleSavePinEdit(idx)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleSavePinEdit(idx)
                          if (e.key === 'Escape') setEditingPinIdx(null)
                        }}
                        className="w-28 bg-transparent px-2 py-1 font-mono text-gray-100 outline-none"
                      />
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingPinIdx(idx)
                            setEditingPinVal(pin)
                          }}
                          title={t('Düzenlemek için tıklayın')}
                          className="px-2 py-1 font-mono text-gray-100 hover:text-white"
                        >
                          {pin}
                        </button>
                        <button
                          onClick={() => void handleDeletePin(idx)}
                          aria-label={t('{pin} pinini sil', { pin })}
                          className="hidden px-1.5 py-1 text-gray-500 hover:text-rose-300 group-hover:block"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <EkleSatiri deger={newPinInput} onDegisim={setNewPinInput} onEkle={() => void handleAddPin()} placeholder={t('Yeni pin, örn. GPIO4 ya da D_RGB')} />
            </>
          )}
        </Bolum>

        <Bolum baslik={t('Çevre birimleri')} aciklama={t('Kartın dahili sensörleri ve donanımları.')}>
          <>
            <ul className="space-y-1">
              {(currentModel.features || []).length === 0 && <li className="text-xs text-gray-500">{t('Henüz eklenmedi.')}</li>}
              {(currentModel.features || []).map((f, i) => (
                <li key={`${f}-${i}`} className="group flex items-start justify-between gap-3 text-[13px] text-gray-300">
                  <span className="flex items-start gap-2.5">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    {f}
                  </span>
                  <button
                    onClick={() => void handleDeleteFeature(i)}
                    aria-label={t('Çevre birimini sil')}
                    className="hidden shrink-0 text-xs text-gray-500 hover:text-rose-300 group-hover:block"
                  >
                    {t('Sil')}
                  </button>
                </li>
              ))}
            </ul>
            <EkleSatiri deger={newFeatureInput} onDegisim={setNewFeatureInput} onEkle={() => void handleAddFeature()} placeholder={t('Örn. Dahili IMU (LSM6DSM)')} />
          </>
        </Bolum>

        <Bolum baslik={t('Yapay zekâ kuralları')} aciklama={t('Bu kart için kod yazarken her zaman uyulacak yönergeler.')}>
          <>
            <ul className="space-y-1">
              {(currentModel.rules || []).length === 0 && <li className="text-xs text-gray-500">{t('Henüz kural yok.')}</li>}
              {(currentModel.rules || []).map((r, i) => (
                <li key={`${r}-${i}`} className="group flex items-start justify-between gap-3 text-[13px] text-gray-300">
                  <span className="flex items-start gap-2.5">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                    {r}
                  </span>
                  <button
                    onClick={() => void handleDeleteRule(i)}
                    aria-label={t('Kuralı sil')}
                    className="hidden shrink-0 text-xs text-gray-500 hover:text-rose-300 group-hover:block"
                  >
                    {t('Sil')}
                  </button>
                </li>
              ))}
            </ul>
            <EkleSatiri deger={newRuleInput} onDegisim={setNewRuleInput} onEkle={() => void handleAddRule()} placeholder={t('Örn. Seri portu 115200 baud ile başlat')} />
          </>
        </Bolum>
      </div>

      {toastMessage && (
        <div role="status" className="absolute bottom-3 right-5 rounded border border-panel-border bg-panel px-3 py-1.5 text-xs text-gray-200 shadow">
          {toastMessage}
        </div>
      )}

      {isAddingModel && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-6">
          <div role="dialog" aria-label={t('Yeni model')} className="max-h-full w-full max-w-lg overflow-y-auto rounded border border-panel-border bg-panel-light p-5 shadow-xl">
            <h3 className="text-[13px] font-medium text-gray-100">{t('Yeni model')}</h3>
            <p className="mt-0.5 text-xs text-gray-500">{t('{ad} ailesine eklenir. Boş bıraktığınız alanlar ailenin değerleriyle doldurulur.', { ad: currentProfile.name })}</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="col-span-2 text-xs text-gray-400">
                {t('Model adı')}
                <input autoFocus value={newModelName} onChange={(e) => setNewModelName(e.target.value)} placeholder={t('Örn. ESP32-S3 DevKit')} className={`${girdiSinifi} mt-1`} />
              </label>
              <label className="text-xs text-gray-400">
                {t('Mimari')}
                <input value={newModelArch} onChange={(e) => setNewModelArch(e.target.value)} className={`${girdiSinifi} mt-1`} />
              </label>
              <label className="text-xs text-gray-400">
                {t('Mantık voltajı')}
                <input value={newModelVoltage} onChange={(e) => setNewModelVoltage(e.target.value)} className={`${girdiSinifi} mt-1`} />
              </label>
              <label className="text-xs text-gray-400">
                {t('Saat hızı')}
                <input value={newModelClock} onChange={(e) => setNewModelClock(e.target.value)} className={`${girdiSinifi} mt-1`} />
              </label>
              <label className="text-xs text-gray-400">
                {t('Bellek')}
                <input value={newModelFlashRam} onChange={(e) => setNewModelFlashRam(e.target.value)} className={`${girdiSinifi} mt-1`} />
              </label>
              <label className="col-span-2 text-xs text-gray-400">
                {t('Pinler (virgül veya satır ile ayırın)')}
                <textarea value={newModelPinsText} onChange={(e) => setNewModelPinsText(e.target.value)} rows={3} className={`${girdiSinifi} mt-1 font-mono`} />
              </label>
              <label className="col-span-2 text-xs text-gray-400">
                {t('Çevre birimleri (her satıra bir tane)')}
                <textarea value={newModelFeaturesText} onChange={(e) => setNewModelFeaturesText(e.target.value)} rows={3} className={`${girdiSinifi} mt-1`} />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setIsAddingModel(false)} className={ikincilButon}>
                {t('Vazgeç')}
              </button>
              <button
                onClick={() => void handleSaveNewModel()}
                disabled={!newModelName.trim()}
                className="rounded-md bg-accent px-3.5 py-1 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
              >
                {t('Modeli ekle')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
