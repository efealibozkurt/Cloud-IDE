import { useEffect, useRef, useState, type ReactElement } from 'react'
import { BAUD_RATES, type BaudRate } from '@shared/types'
import { tumKartlariDuzlestir, useAppState } from '../../state/AppStateContext'
import { useYardim } from '../../state/HelpContext'
import CloudAiDugmesi from './CloudAiDugmesi'
import KartAyarlari from '../boards/KartAyarlari'
import GuncellemeDugmesi from './GuncellemeDugmesi'
import SurumYumurtasi from '../common/SurumYumurtasi'
import { surumAdiBul } from '@shared/surumAdlari'
import ExamplesMenu from './ExamplesMenu'
import BoardPicker from '../boards/BoardPicker'
import type { AIModeOrigin } from '../ai/AIModeScreen'
import { useT } from '../../i18n'
import beyazCloudIde from '../../assets/beyaz_cloud_ide.png'

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
  /** Sağdaki kalıcı "Cloud AI" sohbet panelini açıp/kapatan geri çağırım (bkz. AgentPanel) */
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
  const {
    state,
    selectFqbn,
    selectPort,
    selectBaud,
    refreshPorts,
    compileActive,
    uploadActive,
    openInNewWindow,
    setActiveSketch
  } = useAppState()
  const { platforms, ports, busy, selectedFqbn, selectedPort, selectedBaud, status } = state.arduinoCli

  const t = useT()
  const { yardimAc } = useYardim()
  const [yumurtaAcik, setYumurtaAcik] = useState(false)
  const rozetTiklari = useRef<number[]>([])
  /** Sürüm rozetine 2 saniye içinde 5 kez tıklayınca sürüm yumurtası açılır */
  const rozeteTiklandi = (): void => {
    const simdi = Date.now()
    rozetTiklari.current = [...rozetTiklari.current.filter((t) => simdi - t < 2000), simdi]
    if (rozetTiklari.current.length >= 5) {
      rozetTiklari.current = []
      setYumurtaAcik(true)
    }
  }
  const kartlar = tumKartlariDuzlestir(platforms)
  const hataSayisi = state.build.errors.filter((h) => h.tur === 'error').length
  const uyariSayisi = state.build.errors.filter((h) => h.tur === 'warning').length
  const meşgulNedeni = busy ? t('Bir derleme/yükleme işlemi zaten çalışıyor') : undefined

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
          className="h-7 w-auto object-contain cursor-default select-none drop-shadow-[0_0_12px_rgba(124,196,240,0.25)]"
        />
        <div className="flex items-center gap-1.5">
          <span
            onClick={rozeteTiklandi}
            className="cursor-default rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400"
          >
            v{appVersion} <span className="text-[#7cc4f0]">{surumAdiBul(appVersion).ad}</span>
          </span>
          <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-300 uppercase shadow-sm">BETA</span>
        </div>
      </div>

      <div data-tur="derle" className="flex items-center gap-2">
      <ToolbarButton
        label={t('Derle')}
        title={meşgulNedeni ?? t("Sketch'i derle (Ctrl+R)")}
        disabled={busy}
        onClick={() => void compileActive()}
        icon={<CompileIcon />}
      />
      <ToolbarButton
        label={t('Yükle')}
        title={meşgulNedeni ?? t('Karta yükle (Ctrl+U)')}
        disabled={busy}
        onClick={() => void uploadActive()}
        icon={<UploadIcon />}
      />
      </div>

      <div ref={ornekMenuRef} data-tur="ornekler" className="relative">
        <ToolbarButton
          label={t('Örnekler')}
          title={t('Kurulu kütüphane/kart örneklerini aç')}
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

      {state.sketch.workspaceSketches.length > 1 && (
        <select
          value={state.sketch.activeSketchPath || state.sketch.info?.folderPath || ''}
          onChange={(e) => setActiveSketch(e.target.value)}
          aria-label={t('Derlenecek proje')}
          title={t('Derle ve Yükle düğmeleri bu projeye uygulanır')}
          className="h-7 min-w-0 max-w-[120px] rounded border border-panel-border bg-panel px-2 text-xs text-gray-300 outline-none focus:border-accent lg:max-w-[180px]"
        >
          {state.sketch.workspaceSketches.map((sk) => (
            <option key={sk.folderPath} value={sk.folderPath}>
              {sk.name}
            </option>
          ))}
        </select>
      )}

      <div className="mx-2 h-6 w-px bg-panel-border" />

      <div data-tur="kart" className="flex items-center gap-1">
        <BoardPicker boards={kartlar} value={selectedFqbn} disabled={busy || !status?.found} onChange={selectFqbn} />
        <KartAyarlari />
      </div>

      <div data-tur="port" className="flex items-center gap-1">
        <select
          disabled={busy || !status?.found}
          value={selectedPort ?? ''}
          onChange={(e) => selectPort(e.target.value || null)}
          title={t('Port seçici (3 saniyede bir otomatik yenilenir)')}
          className="h-7 min-w-0 max-w-[130px] rounded border border-panel-border bg-panel px-2 text-xs text-gray-300 disabled:cursor-not-allowed disabled:text-gray-500 lg:max-w-[200px]"
        >
          <option value="">{t('Port bulunamadı')}</option>
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
          title={t('Port listesini şimdi yenile')}
          className="flex h-7 w-7 items-center justify-center rounded border border-panel-border bg-panel text-gray-400 hover:enabled:bg-panel-border disabled:cursor-not-allowed disabled:text-gray-600"
        >
          <RefreshIcon />
        </button>
      </div>

      <select
        disabled={busy}
        value={selectedBaud}
        onChange={(e) => selectBaud(Number(e.target.value) as BaudRate)}
        title={t('Baud hızı')}
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
        title={t("Seri Monitör'ü aç/kapat (Ctrl+Shift+M)")}
        className={`flex h-7 items-center gap-1.5 rounded border px-2 text-xs transition-colors ${
          serialMonitorActive
            ? 'border-accent bg-accent/20 text-accent-hover'
            : 'border-panel-border bg-panel text-gray-300 hover:bg-panel-border'
        }`}
      >
        <SerialIcon />
        <span className="hidden lg:inline">{t('Seri Monitör')}</span>
      </button>

      {/* Dar pencerede (<1280px) yer açmak için gizlenir; "yakında" yer tutucusudur */}
      <div className="relative ml-1 hidden opacity-70 transition-opacity hover:opacity-100 xl:block">
        <button
          ref={aiButtonRef}
          onClick={aiModunuAc}
          title={t('AI ile Geliştir (Yakında - Farklı AI Ajan Sistemi) · Kod yazma ve düzenleme için Cloud AI aktiftir')}
          className="flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-panel px-2.5 text-xs text-gray-400 hover:border-white/20 hover:text-gray-200"
        >
          <SparkleIcon className="text-gray-500" />
          <span>{t('AI ile Geliştir')}</span>
          <span className="rounded bg-white/5 px-1 py-0.2 text-[9px] text-gray-500">{t('Yakında')}</span>
        </button>
      </div>

      <CloudAiDugmesi aktif={dretAiActive} onClick={onToggleDretAi} />

      {onOpenDeveloperMessage && (
        <button
          onClick={onOpenDeveloperMessage}
          title={t('Geliştiriciden Mesaj & Beta Sürüm Notu')}
          className="flex h-7 items-center gap-1.5 rounded border border-panel-border bg-panel px-2 text-xs text-gray-300 transition-colors hover:border-sky-500/40 hover:bg-panel-border hover:text-white"
        >
          <DeveloperIcon />
          <span className="hidden xl:inline text-[11px]">{t('Geliştirici & Sürüm Notu')}</span>
          <span className="hidden rounded border border-amber-500/30 bg-amber-500/15 px-1 py-px text-[8.5px] font-bold text-amber-300 uppercase xl:inline">BETA</span>
        </button>
      )}

      <button
        onClick={() => void openInNewWindow()}
        title={t('Yeni IDE Penceresi Aç (Ctrl+Shift+N)')}
        className="flex h-7 items-center gap-1.5 rounded border border-panel-border bg-panel px-2 text-xs text-gray-300 transition-colors hover:border-cyan-500/40 hover:bg-panel-border hover:text-cyan-200"
      >
        <WindowTopBarIcon />
        <span className="hidden xl:inline text-[11px]">{t('Yeni Pencere')}</span>
      </button>

      <GuncellemeDugmesi />

      <button
        onClick={() => yardimAc()}
        data-tur="yardim"
        title={t('Yardım ve rehber (F1)')}
        aria-label={t('Yardım ve rehber')}
        className="flex h-7 w-7 items-center justify-center rounded border border-panel-border bg-panel text-gray-400 hover:bg-panel-border hover:text-gray-200"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.6M12 17h.01" />
        </svg>
      </button>

      <button
        onClick={onOpenSettings}
        title={t('Uygulama Ayarları')}
        className="flex h-7 w-7 items-center justify-center rounded border border-panel-border bg-panel text-gray-400 hover:bg-panel-border hover:text-gray-200"
      >
        <SettingsIcon />
      </button>
      {yumurtaAcik && <SurumYumurtasi surum={appVersion} onKapat={() => setYumurtaAcik(false)} />}
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
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-400">
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

function WindowTopBarIcon(): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  )
}

export default TopBar
