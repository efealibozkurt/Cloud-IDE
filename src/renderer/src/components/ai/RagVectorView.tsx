import { type ReactElement } from 'react'
import type { RagChunkSummary, SkillsInfoResult } from '@shared/types'
import { useT } from '../../i18n'
import { RefreshIcon, CopyIcon, CheckIcon, SearchIcon } from './skillsIcons'

const AILE_STILI: Record<string, string> = {
  deneyap: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
  esp32: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
  avr: 'border-teal-400/30 bg-teal-400/10 text-teal-300',
  rp2040: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  stm32: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  general: 'border-white/15 bg-white/5 text-gray-400'
}
const ailePuli = (f?: string): string => AILE_STILI[(f || 'general').toLowerCase()] ?? AILE_STILI.general


const AILELER: Array<{ id: string; ad: string }> = [
  { id: 'all', ad: 'Tüm kartlar' },
  { id: 'deneyap', ad: 'Deneyap' },
  { id: 'esp32', ad: 'ESP32' },
  { id: 'avr', ad: 'Arduino AVR' },
  { id: 'rp2040', ad: 'RP2040' },
  { id: 'stm32', ad: 'STM32' },
  { id: 'general', ad: 'Genel' }
]

/**
 * Bilgi tabanı: yapay zekânın arayabildiği kayıtlar (kütüphane API'leri, örnek kodlar,
 * kart notları, kendi kurallarınız). Solda liste, sağda seçili kaydın içeriği.
 */
export function RagVectorView({
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
  const t = useT()
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] bg-white/[0.02] px-6 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-medium text-emerald-300">
            {t('{n} kayıt', { n: ragStatus?.totalChunks ?? 0 })}
          </span>
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
              ragStatus?.modelLoaded ? 'border-sky-400/30 bg-sky-400/10 text-sky-300' : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${ragStatus?.modelLoaded ? 'bg-sky-400' : 'animate-pulse bg-amber-400'}`} />
            {ragStatus?.modelLoaded ? t('Anlamsal arama hazır') : t('Anlamsal arama yükleniyor, sözcük araması çalışıyor')}
          </span>
        </div>
        <button
          onClick={onReindex}
          disabled={reindexing}
          className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 font-medium text-gray-100 transition-colors hover:bg-white/10 disabled:opacity-50"
          title={t('Kurulu kütüphaneleri ve örnekleri yeniden tarar')}
        >
          <RefreshIcon className={`h-3.5 w-3.5 ${reindexing ? 'animate-spin' : ''}`} />
          {reindexing ? t('Taranıyor…') : t('Kütüphaneleri yeniden tara')}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-80 shrink-0 flex-col border-r border-white/[0.07]">
          <div className="flex gap-2 border-b border-white/[0.07] p-3">
            <span className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={t('Ara: wifi, servo, imu…')}
              aria-label={t('Kayıtlarda ara')}
              className="w-full rounded-lg border border-white/10 bg-[#0b0d13] py-1.5 pl-8 pr-2.5 text-xs text-gray-100 outline-none placeholder:text-gray-600 focus:border-[#2aa8f2]/70"
            />
            </span>
            <select
              value={familyFilter}
              onChange={(e) => onFamilyFilterChange(e.target.value)}
              aria-label={t('Kart ailesi')}
              className="w-28 rounded border border-panel-border bg-panel px-1.5 py-1.5 text-xs text-gray-200 outline-none focus:border-accent"
            >
              {AILELER.map((a) => (
                <option key={a.id} value={a.id}>
                  {t(a.ad)}
                </option>
              ))}
            </select>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto">
            {chunks.length === 0 ? (
              <li className="p-6 text-center text-xs text-gray-500">{t('Aramanızla eşleşen kayıt yok.')}</li>
            ) : (
              chunks.map((c) => {
                const secili = selectedChunk?.id === c.id
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => onSelectChunk(c)}
                      className={`relative block w-full px-4 py-2.5 text-left transition-colors hover:bg-white/[0.05] ${secili ? 'bg-white/[0.06]' : ''}`}
                    >
                      {secili && <span className="absolute inset-y-1 left-0 w-1 rounded-r bg-accent" />}
                      <p className="truncate text-[13px] font-medium text-gray-100">{c.title}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                        <span className={`shrink-0 rounded-full border px-1.5 py-px text-[10px] ${ailePuli(c.boardFamily)}`}>{c.boardFamily || t('genel')}</span>
                        <span className="truncate">{c.sourceOwner}</span>
                        {c.isCustom && <span className="shrink-0 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-px text-[10px] text-cyan-300">{t('sizin')}</span>}
                      </p>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {selectedChunk ? (
            <>
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.07] bg-white/[0.02] px-5 py-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[13px] font-medium text-gray-100">{selectedChunk.title}</h3>
                  <p className="mt-0.5 truncate text-xs text-gray-500" title={selectedChunk.sourceFile}>
                    {selectedChunk.sourceOwner}
                  </p>
                </div>
                <button
                  onClick={() => void kopyalaMetin(selectedChunk.content)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-100 transition-colors hover:bg-white/10"
                >
                  {kopyalandi ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <CopyIcon className="h-3.5 w-3.5 text-gray-400" />}
                  {kopyalandi ? t('Kopyalandı') : t('Kopyala')}
                </button>
              </div>
              <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap bg-[#0b0d13] p-5 font-mono text-xs leading-relaxed text-sky-100/90">
                {selectedChunk.content}
              </pre>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-500">{t('Soldan bir kayıt seçin.')}</div>
          )}
        </div>
      </div>
    </div>
  )
}
