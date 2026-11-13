import { type ReactElement } from 'react'
import type { CustomSkill } from '@shared/types'
import { FolderOpenIcon, RefreshIcon, PlusSmallIcon, CopyIcon, CheckIcon, TrashIcon } from './skillsIcons'

const AILELER: Array<{ id: string; ad: string }> = [
  { id: 'general', ad: 'Tüm kartlar' },
  { id: 'deneyap', ad: 'Deneyap' },
  { id: 'esp32', ad: 'ESP32' },
  { id: 'avr', ad: 'Arduino AVR' },
  { id: 'rp2040', ad: 'RP2040' },
  { id: 'stm32', ad: 'STM32' }
]

const girdiSinifi =
  'w-full rounded border border-panel-border bg-panel px-2.5 py-1.5 text-xs text-gray-100 outline-none placeholder:text-gray-600 focus:border-accent'

/**
 * Kurallarım: kendi yazdığınız .md dosyaları. "Kod" türü örnek şablon olarak aranabilir,
 * "Kural" türü yapay zekâya her seferinde uyması gereken bir yönerge olarak verilir.
 */
export function CustomMarkdownSkillsView({
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
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] bg-white/[0.02] px-6 py-3 text-xs">
        <p className="min-w-0 truncate text-gray-500" title={skillsDirectory}>
          Dosyalar: {skillsDirectory || 'skills klasörü'}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={onOpenFolder} className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-gray-100 transition-colors hover:bg-white/10">
            <FolderOpenIcon className="h-3.5 w-3.5 text-amber-400" />
            Klasörü aç
          </button>
          <button onClick={onRefresh} className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-gray-100 transition-colors hover:bg-white/10">
            <RefreshIcon className="h-3.5 w-3.5 text-gray-400" />
            Yenile
          </button>
          <button
            onClick={onToggleAdd}
            className={
              isAdding
                ? 'rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-gray-100 hover:bg-white/10'
                : 'flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0e7fc4] to-[#2aa8f2] px-3.5 py-1.5 font-semibold text-white shadow-md shadow-sky-500/20 hover:brightness-110'
            }
          >
            {!isAdding && <PlusSmallIcon className="h-3.5 w-3.5" />}
            {isAdding ? 'Vazgeç' : 'Yeni kural'}
          </button>
        </div>
      </div>

      {isAdding ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="max-w-2xl space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block text-xs text-gray-400 sm:col-span-3">
                Başlık
                <input
                  type="text"
                  value={title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="Örn. BMP280 sıcaklık sensörü"
                  className={`${girdiSinifi} mt-1`}
                />
              </label>
              <label className="block text-xs text-gray-400">
                Hangi kartlar için
                <select value={boardFamily} onChange={(e) => onBoardFamilyChange(e.target.value)} className={`${girdiSinifi} mt-1`}>
                  {AILELER.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.ad}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-gray-400 sm:col-span-2">
                Tür
                <select value={type} onChange={(e) => onTypeChange(e.target.value as 'snippet' | 'rule')} className={`${girdiSinifi} mt-1`}>
                  <option value="snippet">Kod örneği: gerektiğinde aranır</option>
                  <option value="rule">Kural: her zaman yönerge olarak verilir</option>
                </select>
              </label>
            </div>

            <label className="block text-xs text-gray-400">
              {type === 'snippet' ? 'Örnek kod' : 'Kural metni'}
              <textarea
                value={content}
                onChange={(e) => onContentChange(e.target.value)}
                placeholder={
                  type === 'snippet'
                    ? '#include <Adafruit_BMP280.h>\nvoid setup() { }'
                    : 'Örn. Pin tanımlarında const int yerine constexpr kullan.'
                }
                rows={9}
                className={`${girdiSinifi} mt-1 font-mono leading-relaxed`}
              />
            </label>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">Kaydedince skills klasörüne .md dosyası olarak yazılır.</p>
              <button
                onClick={onSave}
                disabled={!title.trim() || !content.trim() || saving}
                className="rounded-lg bg-gradient-to-r from-[#0e7fc4] to-[#2aa8f2] px-4 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-40"
              >
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <ul className="w-80 shrink-0 overflow-y-auto border-r border-white/[0.07]">
            {skills.length === 0 ? (
              <li className="p-6 text-xs leading-relaxed text-gray-500">
                Henüz kuralınız yok. “Yeni kural” ile ekleyebilir ya da skills klasörüne doğrudan .md dosyası bırakabilirsiniz.
              </li>
            ) : (
              skills.map((s) => {
                const secili = selectedSkill?.id === s.id
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => onSelectSkill(s)}
                      className={`relative block w-full px-4 py-2.5 text-left transition-colors hover:bg-white/[0.05] ${secili ? 'bg-gradient-to-r from-[#2aa8f2]/15 to-transparent' : ''}`}
                    >
                      {secili && <span className="absolute inset-y-1 left-0 w-1 rounded-r bg-gradient-to-b from-[#0e7fc4] to-[#2aa8f2]" />}
                      <p className="truncate text-[13px] font-medium text-gray-100">{s.title}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                        <span
                          className={`rounded-full border px-1.5 py-px text-[10px] ${
                            s.type === 'snippet' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
                          }`}
                        >
                          {s.type === 'snippet' ? 'Kod örneği' : 'Kural'}
                        </span>
                        <span className="truncate">{AILELER.find((a) => a.id === s.boardFamily)?.ad ?? s.boardFamily}</span>
                      </p>
                    </button>
                  </li>
                )
              })
            )}
          </ul>

          <div className="flex min-w-0 flex-1 flex-col">
            {selectedSkill ? (
              <>
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-panel-border px-5 py-2.5">
                  <div className="min-w-0">
                    <h3 className="truncate text-[13px] font-medium text-gray-100">{selectedSkill.title}</h3>
                    <p className="mt-0.5 truncate text-xs text-gray-500">{selectedSkill.fileName || `${selectedSkill.title}.md`}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    <button
                      onClick={() => void kopyalaMetin(selectedSkill.content)}
                      className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 font-medium text-gray-100 hover:bg-white/10"
                    >
                      {kopyalandi ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <CopyIcon className="h-3.5 w-3.5 text-gray-400" />}
                      {kopyalandi ? 'Kopyalandı' : 'Kopyala'}
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`“${selectedSkill.title}” silinsin mi? .md dosyası da kaldırılır.`)) onDelete(selectedSkill.id)
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-rose-400/25 bg-rose-400/10 px-3 py-1.5 text-rose-300 hover:bg-rose-400/20"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      Sil
                    </button>
                  </div>
                </div>
                <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap bg-[#0b0d13] p-5 font-mono text-xs leading-relaxed text-sky-100/90">
                  {selectedSkill.content}
                </pre>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-gray-500">Soldan bir kural seçin.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
