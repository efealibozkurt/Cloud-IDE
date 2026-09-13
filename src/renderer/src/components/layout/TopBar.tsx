import { useEffect, useRef, useState, type ReactElement } from 'react'
import { BAUD_RATES, type BaudRate } from '@shared/types'
import { tumKartlariDuzlestir, useAppState } from '../../state/AppStateContext'
import ExamplesMenu from './ExamplesMenu'
import type { AIModeOrigin } from '../ai/AIModeScreen'
import beyazCloudIde from '../../assets/beyaz_cloud_ide.png'
import cloudIcon from '../../assets/icon.png'

interface TopBarProps {
  /** Sürüm bilgisini gösterir (main process'ten preload API'si ile alınır) */
  appVersion: string
  /** Alt paneldeki Seri Monitör sekmesini açıp kapatan geri çağırım */
  onToggleSerialMonitor: () => void
  serialMonitorActive: boolean
  /** Tam ekran "AI ile Geliştir" modunu, düğmenin ekrandaki konumuyla birlikte açan geri çağırım (bkz. AIModeScreen) */
  onOpenAiMode: (origin: AIModeOrigin) => void
  /** "Uygulama Ayarları" modalını açan geri çağırım (bkz. SettingsModal) */
  onOpenSettings: () => void
  /** "Geliştiriciden Mesaj" modalını açan geri çağırım (bkz. DeveloperMessageModal) */
  onOpenDeveloperMessage?: () => void
  /** Sağdaki kalıcı "Dret AI" sohbet panelini açıp/kapatan geri çağırım (bkz. DretAIPanel) */
  onToggleDretAi: () => void
  dretAiActive: boolean
}

/**
 * Üst çubuk: Derle/Yükle eylemleri, kart/port/baud seçiciler, seri monitör
 * anahtarı. Port listesi AppStateContext tarafından 3 saniyede bir
 * otomatik yenilenir. Bir derleme/yükleme sürerken tüm kontroller pasif
 * hâle gelir (DeviceLock ile eşleşen "meşgul" durumu).
 */
function TopBar({
  appVersion,
  onToggleSerialMonitor,
  serialMonitorActive,
  onOpenAiMode,
  onOpenSettings,
  onOpenDeveloperMessage,
  onToggleDretAi,
  dretAiActive
}: TopBarProps): ReactElement {
  const { state, selectFqbn, selectPort, selectBaud, refreshPorts, compileActive, uploadActive } = useAppState()
  const { platforms, ports, busy, selectedFqbn, selectedPort, selectedBaud, status } = state.arduinoCli

  const kartlar = tumKartlariDuzlestir(platforms)
  const hataSayisi = state.build.errors.filter((h) => h.tur === 'error').length
  const uyariSayisi = state.build.errors.filter((h) => h.tur === 'warning').length
  const meşgulNedeni = busy ? 'Bir derleme/yükleme işlemi zaten çalışıyor' : undefined

  const [ornekMenuAcik, setOrnekMenuAcik] = useState(false)
  const ornekMenuRef = useRef<HTMLDivElement>(null)
  const aiButtonRef = useRef<HTMLButtonElement>(null)

  const aiModunuAc = (): void => {
    const dikdortgen = aiButtonRef.current?.getBoundingClientRect()
    onOpenAiMode(
      dikdortgen
        ? { x: dikdortgen.left + dikdortgen.width / 2, y: dikdortgen.top + dikdortgen.height / 2 }
        : { x: window.innerWidth - 60, y: 24 }
    )
  }

  useEffect(() => {
    if (!ornekMenuAcik) return
    const disaTiklama = (e: MouseEvent): void => {
      if (ornekMenuRef.current && !ornekMenuRef.current.contains(e.target as Node)) {
        setOrnekMenuAcik(false)
      }
    }
    window.addEventListener('mousedown', disaTiklama)
    return () => window.removeEventListener('mousedown', disaTiklama)
  }, [ornekMenuAcik])

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-panel-border bg-panel-light px-3 select-none">
      <div className="mr-3 flex items-center gap-2.5">
        <img
          src={beyazCloudIde}
          alt="Cloud IDE"
          className="h-7 w-auto object-contain cursor-default select-none drop-shadow-[0_0_12px_rgba(147,165,251,0.25)]"
        />
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 border border-white/10">v{appVersion}</span>
          <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-300 uppercase shadow-sm">BETA</span>
        </div>
      </div>

      <ToolbarButton
        label="Derle"
        title={meşgulNedeni ?? "Sketch'i derle (Ctrl+R)"}
        disabled={busy}
        onClick={() => void compileActive()}
        icon={<CompileIcon />}
      />
      <ToolbarButton
        label="Yükle"
        title={meşgulNedeni ?? 'Karta yükle (Ctrl+U)'}
        disabled={busy}
        onClick={() => void uploadActive()}
        icon={<UploadIcon />}
      />

      <div ref={ornekMenuRef} className="relative">
        <ToolbarButton
          label="Örnekler"
          title="Kurulu kütüphane/kart örneklerini aç"
          onClick={() => setOrnekMenuAcik((a) => !a)}
          icon={<ExamplesIcon />}
        />
        {ornekMenuAcik && <ExamplesMenu onClose={() => setOrnekMenuAcik(false)} />}
      </div>

      {(hataSayisi > 0 || uyariSayisi > 0) && (
        <div className="flex items-center gap-2 text-[11px]">
          {hataSayisi > 0 && <span className="text-red-400">✕ {hataSayisi}</span>}
          {uyariSayisi > 0 && <span className="text-amber-400">⚠ {uyariSayisi}</span>}
        </div>
      )}

      <div className="mx-2 h-6 w-px bg-panel-border" />

      <select
        disabled={busy || !status?.found}
        value={selectedFqbn ?? ''}
        onChange={(e) => selectFqbn(e.target.value || null)}
        title="Kart seçici"
        className="h-7 max-w-[220px] rounded border border-panel-border bg-panel px-2 text-xs text-gray-300 disabled:cursor-not-allowed disabled:text-gray-500"
      >
        <option value="">Kart seçilmedi</option>
        {kartlar.map((k) => (
          <option key={k.fqbn} value={k.fqbn}>
            {k.name}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1">
        <select
          disabled={busy || !status?.found}
          value={selectedPort ?? ''}
          onChange={(e) => selectPort(e.target.value || null)}
          title="Port seçici (3 saniyede bir otomatik yenilenir)"
          className="h-7 max-w-[200px] rounded border border-panel-border bg-panel px-2 text-xs text-gray-300 disabled:cursor-not-allowed disabled:text-gray-500"
        >
          <option value="">Port bulunamadı</option>
          {ports.map((p) => (
            <option key={p.address} value={p.address}>
              {p.address}
              {p.matchingBoards[0] ? ` (${p.matchingBoards[0].name})` : ''}
            </option>
          ))}
        </select>
        <button
          onClick={() => void refreshPorts()}
          disabled={busy || !status?.found}
          title="Port listesini şimdi yenile"
          className="flex h-7 w-7 items-center justify-center rounded border border-panel-border bg-panel text-gray-400 hover:enabled:bg-panel-border disabled:cursor-not-allowed disabled:text-gray-600"
        >
          <RefreshIcon />
        </button>
      </div>

      <select
        disabled={busy}
        value={selectedBaud}
        onChange={(e) => selectBaud(Number(e.target.value) as BaudRate)}
        title="Baud hızı"
        className="h-7 rounded border border-panel-border bg-panel px-2 text-xs text-gray-300 disabled:cursor-not-allowed"
      >
        {BAUD_RATES.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>

      <div className="flex-1" />

      <button
        onClick={onToggleSerialMonitor}
        title="Seri Monitör'ü aç/kapat (Ctrl+Shift+M)"
        className={`flex h-7 items-center gap-1.5 rounded border px-2 text-xs transition-colors ${
          serialMonitorActive
            ? 'border-accent bg-accent/20 text-accent-hover'
            : 'border-panel-border bg-panel text-gray-300 hover:bg-panel-border'
        }`}
      >
        <SerialIcon />
        Seri Monitör
      </button>

      <div className="relative ml-1 opacity-70 hover:opacity-100 transition-opacity">
        <button
          ref={aiButtonRef}
          onClick={aiModunuAc}
          title="AI ile Geliştir (Yakında - Farklı AI Ajan Sistemi) · Kod yazma ve düzenleme için Cloud AI aktiftir"
          className="flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-panel px-2.5 text-xs text-gray-400 hover:border-white/20 hover:text-gray-200"
        >
          <SparkleIcon className="text-gray-500" />
          <span>AI ile Geliştir</span>
          <span className="rounded bg-white/5 px-1 py-0.2 text-[9px] text-gray-500">Yakında</span>
        </button>
      </div>

      <div className="group relative ml-1">
        <div
          className={`pointer-events-none absolute -inset-1 rounded-lg bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] opacity-40 blur-sm transition-opacity duration-300 ${
            dretAiActive ? 'opacity-90' : 'group-hover:opacity-60'
          }`}
        />
        <button
          onClick={onToggleDretAi}
          title="Cloud AI asistanını aç/kapat (Kod yazma & düzenleme)"
          className={`relative flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all ${
            dretAiActive
              ? 'border-[#93a5fb] bg-panel-light text-[#93a5fb] shadow-md'
              : 'border-panel-border bg-panel text-gray-200 hover:border-[#93a5fb]/60 hover:text-white'
          }`}
        >
          <img src={cloudIcon} alt="Cloud AI" className="h-4 w-4 object-contain shrink-0 drop-shadow-[0_0_5px_rgba(147,165,251,0.5)]" />
          <span className="bg-gradient-to-r from-[#93a5fb] via-[#c4b5fd] to-[#93a5fb] bg-clip-text font-semibold text-transparent">
            Cloud AI
          </span>
        </button>
      </div>

      {onOpenDeveloperMessage && (
        <button
          onClick={onOpenDeveloperMessage}
          title="Geliştiriciden Mesaj & Beta Sürüm Notu"
          className="flex h-7 items-center gap-1.5 rounded border border-panel-border bg-panel px-2 text-xs text-gray-300 transition-colors hover:border-indigo-500/40 hover:bg-panel-border hover:text-white"
        >
          <DeveloperIcon />
          <span className="hidden xl:inline text-[11px]">Geliştirici & Sürüm Notu</span>
          <span className="rounded bg-indigo-500/20 px-1 py-0.2 text-[8.5px] font-bold text-indigo-300 border border-indigo-500/30 uppercase">BETA</span>
        </button>
      )}

      <button
        onClick={onOpenSettings}
        title="Uygulama Ayarları"
        className="flex h-7 w-7 items-center justify-center rounded border border-panel-border bg-panel text-gray-400 hover:bg-panel-border hover:text-gray-200"
      >
        <SettingsIcon />
      </button>
    </header>
  )
}

interface ToolbarButtonProps {
  label: string
  title: string
  icon: ReactElement
  disabled?: boolean
  onClick?: () => void
}

function ToolbarButton({ label, title, icon, disabled, onClick }: ToolbarButtonProps): ReactElement {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-7 items-center gap-1.5 rounded border border-panel-border bg-panel px-2 text-xs text-gray-300 transition-colors hover:enabled:bg-panel-border disabled:cursor-not-allowed disabled:text-gray-600"
    >
      {icon}
      {label}
    </button>
  )
}

function CompileIcon(): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function UploadIcon(): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  )
}

function ExamplesIcon(): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  )
}

function SparkleIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className}>
      <path d="M12 2.5c.35 3.32 1.1 5.63 2.25 6.9 1.15 1.28 3.3 2.1 6.25 2.6-2.95.5-5.1 1.32-6.25 2.6-1.15 1.27-1.9 3.58-2.25 6.9-.35-3.32-1.1-5.63-2.25-6.9-1.15-1.28-3.3-2.1-6.25-2.6 2.95-.5 5.1-1.32 6.25-2.6 1.15-1.27 1.9-3.58 2.25-6.9Z" />
    </svg>
  )
}


function RefreshIcon(): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4v6h6M20 20v-6h-6M4.5 15a8 8 0 0014.14 3.36M19.5 9A8 8 0 005.36 5.64" />
    </svg>
  )
}

function SettingsIcon(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function DeveloperIcon(): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M12 7v2" />
      <path d="M12 13h.01" />
    </svg>
  )
}

function SerialIcon(): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M7 9h.01M7 12h.01M11 9h4M11 12h6M8 16h8" />
    </svg>
  )
}

export default TopBar
