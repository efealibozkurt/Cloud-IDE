import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactElement,
  type ReactNode
} from 'react'
import type {
  AIProviderId,
  AppSettings,
  ArduinoCliStatus,
  BaudRate,
  BoardOption,
  CompileResult,
  DerlemeHatasi,
  DetectedPort,
  EditorTemasi,
  LineEnding,
  PlatformSummary,
  SerialStatus,
  SketchFile,
  SketchInfo,
  UploadResult
} from '@shared/types'
import { DEFAULT_BAUD_RATE } from '@shared/types'
import { useToast } from './ToastContext'

// ────────────────────────────────────────────────────────────────────────
// Durum (state) şekli
// ────────────────────────────────────────────────────────────────────────

export interface AcikSekme {
  path: string
  name: string
  content: string
  /** Diskte kayıtlı olan son içerik; content !== savedContent ise sekme "kirli"dir */
  savedContent: string
  isMainFile: boolean
  /** Sketch klasörünün dışında bir dosya (ör. kütüphane/çekirdek başlığı); düzenlenemez */
  readOnly: boolean
}

export interface SeriSatir {
  id: number
  text: string
  timestamp: number
}

interface AppState {
  /** Açılış ekranının (SplashScreen) ne zaman kapanacağını belirlemek için: başlangıç veri yüklemesi bitti mi */
  ready: boolean
  settings: AppSettings | null
  /** Hangi AI sağlayıcıları için bir API anahtarı kayıtlı (anahtarların kendisi renderer'a hiç gelmez) */
  configuredAiProviders: AIProviderId[]
  arduinoCli: {
    status: ArduinoCliStatus | null
    platforms: PlatformSummary[]
    ports: DetectedPort[]
    busy: boolean
    selectedFqbn: string | null
    selectedPort: string | null
    selectedBaud: BaudRate
  }
  sketch: {
    info: SketchInfo | null
    tabs: AcikSekme[]
    activeTabPath: string | null
  }
  build: {
    currentOperation: 'compile' | 'upload' | null
    log: string
    errors: DerlemeHatasi[]
    /** Problems panelinden bir hataya tıklanınca editörün gitmesi istenen konum */
    revealTarget: { path: string; line: number } | null
  }
  serial: {
    status: SerialStatus
    lines: SeriSatir[]
  }
  /**
   * "Dret AI" panelinin açık/kapalı durumu + editördeki kod seçiminden
   * ("AI ile Düzelt"/"Prompt Gir") panele aktarılacak bekleyen metin.
   * CodeEditor derin bir alt bileşen olduğu ve panel durumu birden çok
   * yerden (TopBar, CodeEditor) tetiklendiği için burada, global durumda
   * tutulur (mesaj geçmişi ise DretAIPanel'in kendi yerel durumunda kalır).
   */
  dretAi: {
    open: boolean
    /** Editördeki seçimden gelen, henüz panele işlenmemiş kod + hazır istem + satır aralığı */
    seed: {
      kod: string
      istem: string
      secimAraligi?: {
        filePath: string
        startLine: number
        endLine: number
        startColumn: number
        endColumn: number
      }
    } | null
  }
  /** AI kodu uygulandığında editörde renkli gradient animasyonu oynatılacak hedef satırlar */
  editorHighlight: {
    filePath: string
    startLine: number
    endLine: number
    timestamp: number
  } | null
  /** AI kodu uygulandığında editör üzerinde aktif inceleme (Onay ✓ / Reddet ✕) ve animasyonlu yazım durumu */
  aiDiffReview: {
    active: boolean
    filePath: string
    originalContent: string
    newCode: string
    targetRange?: { startLine: number; endLine: number }
    isWriting: boolean
  } | null
}

const baslangicDurumu: AppState = {
  ready: false,
  settings: null,
  configuredAiProviders: [],
  arduinoCli: {
    status: null,
    platforms: [],
    ports: [],
    busy: false,
    selectedFqbn: null,
    selectedPort: null,
    selectedBaud: DEFAULT_BAUD_RATE
  },
  sketch: { info: null, tabs: [], activeTabPath: null },
  build: { currentOperation: null, log: '', errors: [], revealTarget: null },
  serial: {
    status: { open: false, port: null, baud: null, temporarilyClosedForUpload: false },
    lines: []
  },
  dretAi: { open: false, seed: null },
  editorHighlight: null,
  aiDiffReview: null
}

// ────────────────────────────────────────────────────────────────────────
// Aksiyonlar ve reducer
// ────────────────────────────────────────────────────────────────────────

type Action =
  | { type: 'app/ready' }
  | { type: 'settings/loaded'; settings: AppSettings }
  | { type: 'settings/patched'; patch: Partial<AppSettings> }
  | { type: 'secrets/configuredProviders'; providers: AIProviderId[] }
  | { type: 'arduinoCli/status'; status: ArduinoCliStatus }
  | { type: 'arduinoCli/platforms'; platforms: PlatformSummary[] }
  | { type: 'arduinoCli/ports'; ports: DetectedPort[] }
  | { type: 'arduinoCli/busy'; busy: boolean }
  | { type: 'arduinoCli/selectFqbn'; fqbn: string | null }
  | { type: 'arduinoCli/selectPort'; port: string | null }
  | { type: 'arduinoCli/selectBaud'; baud: BaudRate }
  | { type: 'arduinoCli/boardManagerUrls'; urls: string[] }
  | { type: 'sketch/opened'; info: SketchInfo }
  | { type: 'sketch/projectRenamed'; info: SketchInfo; tabs: AcikSekme[]; activeTabPath: string | null }
  | { type: 'sketch/closed' }
  | { type: 'sketch/filesRefreshed'; files: SketchFile[] }
  | { type: 'sketch/tabOpened'; path: string; name: string; content: string; isMainFile: boolean; readOnly?: boolean }
  | { type: 'sketch/tabContentChanged'; path: string; content: string }
  | { type: 'sketch/tabSaved'; path: string; content: string }
  | { type: 'sketch/tabClosed'; path: string }
  | { type: 'sketch/activeTabChanged'; path: string }
  | { type: 'build/operationEvent'; kind: 'compile' | 'upload'; phase: string; message?: string }
  | { type: 'build/compileResult'; result: CompileResult }
  | { type: 'build/uploadResult'; result: UploadResult }
  | { type: 'build/revealRequested'; path: string; line: number }
  | { type: 'build/revealHandled' }
  | { type: 'serial/status'; status: SerialStatus }
  | { type: 'serial/lineAdded'; line: SeriSatir }
  | { type: 'serial/cleared' }
  | { type: 'dretAi/toggled' }
  | {
      type: 'dretAi/openedWithPrompt'
      kod: string
      istem: string
      secimAraligi?: {
        filePath: string
        startLine: number
        endLine: number
        startColumn: number
        endColumn: number
      }
    }
  | { type: 'dretAi/closed' }
  | { type: 'dretAi/seedConsumed' }
  | { type: 'editor/highlightRequested'; filePath: string; startLine: number; endLine: number }
  | { type: 'editor/highlightCleared' }
  | {
      type: 'aiDiff/started'
      filePath: string
      originalContent: string
      newCode: string
      targetRange?: { startLine: number; endLine: number }
    }
  | { type: 'aiDiff/writingFinished' }
  | { type: 'aiDiff/accepted' }
  | { type: 'aiDiff/rejected' }

const SERI_TAMPON_LIMIT = 5000

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'app/ready':
      return { ...state, ready: true }
    case 'settings/loaded':
      return {
        ...state,
        settings: action.settings,
        arduinoCli: {
          ...state.arduinoCli,
          selectedFqbn: action.settings.selectedFqbn,
          selectedPort: action.settings.selectedPort,
          selectedBaud: action.settings.selectedBaud
        }
      }
    case 'settings/patched':
      return state.settings ? { ...state, settings: { ...state.settings, ...action.patch } } : state
    case 'secrets/configuredProviders':
      return { ...state, configuredAiProviders: action.providers }
    case 'arduinoCli/status':
      return { ...state, arduinoCli: { ...state.arduinoCli, status: action.status } }
    case 'arduinoCli/platforms':
      return { ...state, arduinoCli: { ...state.arduinoCli, platforms: action.platforms } }
    case 'arduinoCli/ports':
      return { ...state, arduinoCli: { ...state.arduinoCli, ports: action.ports } }
    case 'arduinoCli/busy':
      return { ...state, arduinoCli: { ...state.arduinoCli, busy: action.busy } }
    case 'arduinoCli/selectFqbn':
      return { ...state, arduinoCli: { ...state.arduinoCli, selectedFqbn: action.fqbn } }
    case 'arduinoCli/selectPort':
      return { ...state, arduinoCli: { ...state.arduinoCli, selectedPort: action.port } }
    case 'arduinoCli/selectBaud':
      return { ...state, arduinoCli: { ...state.arduinoCli, selectedBaud: action.baud } }
    case 'arduinoCli/boardManagerUrls':
      return state.settings
        ? { ...state, settings: { ...state.settings, boardManagerUrls: action.urls } }
        : state

    case 'sketch/opened':
      return { ...state, sketch: { info: action.info, tabs: [], activeTabPath: null } }
    case 'sketch/projectRenamed':
      return {
        ...state,
        sketch: {
          info: action.info,
          tabs: action.tabs,
          activeTabPath: action.activeTabPath
        }
      }
    case 'sketch/closed':
      return { ...state, sketch: { info: null, tabs: [], activeTabPath: null } }
    case 'sketch/filesRefreshed':
      return state.sketch.info
        ? { ...state, sketch: { ...state.sketch, info: { ...state.sketch.info, files: action.files } } }
        : state
    case 'sketch/tabOpened': {
      if (state.sketch.tabs.some((t) => ayniDosyaMi(t.path, action.path))) return state
      const yeniSekme: AcikSekme = {
        path: action.path,
        name: action.name,
        content: action.content,
        savedContent: action.content,
        isMainFile: action.isMainFile,
        readOnly: action.readOnly ?? false
      }
      return { ...state, sketch: { ...state.sketch, tabs: [...state.sketch.tabs, yeniSekme] } }
    }
    case 'sketch/tabContentChanged':
      return {
        ...state,
        sketch: {
          ...state.sketch,
          tabs: state.sketch.tabs.map((t) => (ayniDosyaMi(t.path, action.path) ? { ...t, content: action.content } : t))
        }
      }
    case 'sketch/tabSaved':
      return {
        ...state,
        sketch: {
          ...state.sketch,
          tabs: state.sketch.tabs.map((t) =>
            ayniDosyaMi(t.path, action.path) ? { ...t, content: action.content, savedContent: action.content } : t
          )
        }
      }
    case 'sketch/tabClosed': {
      const kalanSekmeler = state.sketch.tabs.filter((t) => !ayniDosyaMi(t.path, action.path))
      const aktifDegisti = state.sketch.activeTabPath ? ayniDosyaMi(state.sketch.activeTabPath, action.path) : false
      const reviewIlgili = state.aiDiffReview && ayniDosyaMi(state.aiDiffReview.filePath, action.path)
      return {
        ...state,
        aiDiffReview: reviewIlgili ? null : state.aiDiffReview,
        sketch: {
          ...state.sketch,
          tabs: kalanSekmeler,
          activeTabPath: aktifDegisti
            ? (kalanSekmeler[kalanSekmeler.length - 1]?.path ?? null)
            : state.sketch.activeTabPath
        }
      }
    }
    case 'sketch/activeTabChanged':
      return { ...state, sketch: { ...state.sketch, activeTabPath: action.path } }

    case 'build/operationEvent': {
      if (action.phase === 'basladi') {
        return { ...state, build: { currentOperation: action.kind, log: '', errors: [], revealTarget: null } }
      }
      if (action.phase === 'log' && action.message) {
        return { ...state, build: { ...state.build, log: state.build.log + action.message + '\n' } }
      }
      if (action.phase === 'tamamlandi' || action.phase === 'basarisiz' || action.phase === 'iptalEdildi') {
        return { ...state, build: { ...state.build, currentOperation: null } }
      }
      return state
    }
    // Not: result.log tam ham metni tekrar burada eklenmez — derleme/yükleme
    // sırasında 'build/operationEvent' (phase: 'log') olayları zaten aynı
    // içeriği ANLIK olarak state.build.log'a eklemiş durumdadır (bkz.
    // ArduinoCliService'in canlı akış notu). Burada yalnızca sonuç (hatalar)
    // ve akışta görünmemiş olabilecek üst seviye özet hata eklenir.
    case 'build/compileResult':
      return {
        ...state,
        build: {
          ...state.build,
          errors: action.result.errors,
          log: action.result.topLevelError ? state.build.log + action.result.topLevelError + '\n' : state.build.log
        }
      }
    case 'build/uploadResult':
      return {
        ...state,
        build: {
          ...state.build,
          log: action.result.topLevelError ? state.build.log + action.result.topLevelError + '\n' : state.build.log
        }
      }
    case 'build/revealRequested':
      return { ...state, build: { ...state.build, revealTarget: { path: action.path, line: action.line } } }
    case 'build/revealHandled':
      return { ...state, build: { ...state.build, revealTarget: null } }

    case 'serial/status':
      return { ...state, serial: { ...state.serial, status: action.status } }
    case 'serial/lineAdded': {
      const guncelSatirlar = [...state.serial.lines, action.line]
      if (guncelSatirlar.length > SERI_TAMPON_LIMIT) {
        guncelSatirlar.splice(0, guncelSatirlar.length - SERI_TAMPON_LIMIT)
      }
      return { ...state, serial: { ...state.serial, lines: guncelSatirlar } }
    }
    case 'serial/cleared':
      return { ...state, serial: { ...state.serial, lines: [] } }

    case 'dretAi/toggled':
      return { ...state, dretAi: { ...state.dretAi, open: !state.dretAi.open } }
    case 'dretAi/openedWithPrompt':
      return {
        ...state,
        dretAi: {
          open: true,
          seed: {
            kod: action.kod,
            istem: action.istem,
            secimAraligi: action.secimAraligi
          }
        }
      }
    case 'dretAi/closed':
      return { ...state, dretAi: { ...state.dretAi, open: false } }
    case 'dretAi/seedConsumed':
      return { ...state, dretAi: { ...state.dretAi, seed: null } }

    case 'editor/highlightRequested':
      return {
        ...state,
        editorHighlight: {
          filePath: action.filePath,
          startLine: action.startLine,
          endLine: action.endLine,
          timestamp: Date.now()
        }
      }
    case 'editor/highlightCleared':
      return { ...state, editorHighlight: null }

    case 'aiDiff/started':
      return {
        ...state,
        aiDiffReview: {
          active: true,
          filePath: action.filePath,
          originalContent: action.originalContent,
          newCode: action.newCode,
          targetRange: action.targetRange,
          isWriting: true
        }
      }
    case 'aiDiff/writingFinished':
      return state.aiDiffReview
        ? { ...state, aiDiffReview: { ...state.aiDiffReview, isWriting: false } }
        : state
    case 'aiDiff/accepted':
      return { ...state, aiDiffReview: null }
    case 'aiDiff/rejected':
      return { ...state, aiDiffReview: null }

    default:
      return state
  }
}

// ────────────────────────────────────────────────────────────────────────
// Context ve sağlayıcı
// ────────────────────────────────────────────────────────────────────────

interface AppStateBaglami {
  state: AppState
  // arduino-cli
  yenidenDenearduinoCli: () => Promise<void>
  setCliPath: (path: string) => Promise<void>
  browseForCliPath: () => Promise<void>
  refreshPlatforms: () => Promise<void>
  refreshPorts: () => Promise<void>
  selectFqbn: (fqbn: string | null) => void
  selectPort: (port: string | null) => void
  selectBaud: (baud: BaudRate) => void
  addBoardManagerUrl: (url: string) => Promise<void>
  removeBoardManagerUrl: (url: string) => Promise<void>
  // uygulama ayarları (editör görünümü + AI sağlayıcı/API anahtarı)
  setEditorFontSize: (size: number) => void
  setEditorTheme: (theme: EditorTemasi) => void
  setSelectedAiProvider: (provider: AIProviderId | null) => void
  setSelectedAiModel: (provider: AIProviderId, model: string) => Promise<void>
  setCustomContextLimit: (provider: AIProviderId, limit: number) => Promise<void>
  saveApiKey: (provider: AIProviderId, apiKey: string) => Promise<void>
  clearApiKey: (provider: AIProviderId) => Promise<void>
  // Dret AI paneli
  toggleDretAi: () => void
  closeDretAi: () => void
  /** Editörde seçili kodu ve satır aralığını, ayrı bir grafiksel "ek" olarak panele işleyip paneli açar */
  askDretAi: (
    kod: string,
    istem: string,
    secimAraligi?: {
      filePath: string
      startLine: number
      endLine: number
      startColumn: number
      endColumn: number
    }
  ) => void
  /** DretAIPanel, bekleyen seed'i kendi durumuna aktardıktan sonra çağırır */
  clearDretAiSeed: () => void
  /** AI tarafından üretilen kodu editöre uygular ve renkli gradient animasyonu tetikler */
  applyAiCodeToEditor: (kod: string, hedefAralik?: { filePath: string; startLine: number; endLine: number }) => void
  clearEditorHighlight: () => void
  /** AI kodu editöre yazma ve Onayla/Reddet akışını başlatır */
  startAiDiffReview: (filePath: string, newCode: string, targetRange?: { startLine: number; endLine: number }) => void | Promise<void>
  setAiDiffWritingFinished: () => void
  acceptAiDiff: () => void | Promise<void>
  rejectAiDiff: () => void
  // sketch
  newSketch: () => Promise<SketchInfo | null>
  openSketchDialog: () => Promise<void>
  /** Bir kütüphane/kart örneğini (Örnekler menüsünden) doğrudan klasör yoluyla açar */
  openExample: (folderPath: string, name: string) => Promise<void>
  /** Açık sketch'i kapatır (kaydedilmemişse onay ister), karşılama ekranına döner */
  closeSketch: () => void
  saveAsActiveSketch: () => Promise<void>
  openFileInTab: (path: string, name: string, isMainFile: boolean) => Promise<void>
  setActiveTab: (path: string) => void
  updateTabContent: (path: string, content: string) => void
  saveTab: (path: string) => Promise<void>
  saveAllTabs: () => Promise<void>
  closeTab: (path: string) => void
  /** Açık sketch'te kaydedilmemiş değişiklik olup olmadığını anlık okur (pencere kapatma onayı için) */
  hasUnsavedChanges: () => boolean
  addFile: (fileName: string) => Promise<SketchFile | null>
  createFileWithContent: (fileName: string, content: string) => Promise<SketchFile | null>
  deleteFile: (path: string) => Promise<void>
  renameFile: (path: string, newName: string) => Promise<SketchFile | null>
  updateFileContent: (path: string, content: string) => Promise<void>
  // build
  compileActive: () => Promise<void>
  uploadActive: () => Promise<void>
  cancelBuild: () => Promise<void>
  /** Problems panelinden bir hataya tıklanınca dosyayı açıp o satıra gitmeyi ister */
  requestReveal: (path: string, line: number) => Promise<void>
  clearReveal: () => void
  // serial
  connectSerial: () => Promise<void>
  disconnectSerial: () => Promise<void>
  writeSerial: (data: string, lineEnding: LineEnding) => Promise<void>
  clearSerial: () => void
}

const AppStateContext = createContext<AppStateBaglami | null>(null)

/** Kurulu çekirdeklerin sağladığı tüm kartları düz bir listeye çevirir (üst çubuktaki kart seçici için) */
export function tumKartlariDuzlestir(platforms: PlatformSummary[]): BoardOption[] {
  return platforms.flatMap((p) => p.boards)
}

/**
 * Dosya yolu karşılaştırmasını sadeleştirir (ayraç yönü ve büyük/küçük
 * harf farkını yok sayar). arduino-cli'nin derleme hatalarında döndürdüğü
 * yol ile SketchService'in ürettiği yol, Windows'ta aynı dosyayı işaret
 * etse bile farklı büyük/küçük harfle gelebilir; bu yüzden Problems
 * panelinden bir hataya tıklarken doğrudan '===' kullanılmaz.
 */
function ayniDosyaMi(a: string, b: string): boolean {
  return a.trim().replace(/\\/g, '/').toLowerCase() === b.trim().replace(/\\/g, '/').toLowerCase()
}

function klasorYoluAl(dosyaYolu: string): string {
  const norm = dosyaYolu.replace(/\\/g, '/')
  const sonSlash = norm.lastIndexOf('/')
  return sonSlash > -1 ? dosyaYolu.slice(0, sonSlash) : dosyaYolu
}

function dosyaAdiAl(dosyaYolu: string): string {
  const norm = dosyaYolu.replace(/\\/g, '/')
  const sonSlash = norm.lastIndexOf('/')
  return sonSlash > -1 ? norm.slice(sonSlash + 1) : dosyaYolu
}

export function AppStateProvider({ children }: { children: ReactNode }): ReactElement {
  const [state, dispatch] = useReducer(reducer, baslangicDurumu)
  const { toastGoster } = useToast()
  const seriSatirSayaci = useRef(0)
  const stateRef = useRef(state)
  stateRef.current = state

  // ── Başlangıç yüklemesi ve olay abonelikleri ──
  useEffect(() => {
    let iptalEdildi = false

    async function baslat(): Promise<void> {
      const [ayarlar, durum, ayarliSaglayicilar] = await Promise.all([
        window.api.settings.get(),
        window.api.arduinoCli.getStatus(),
        window.api.secrets.getConfiguredProviders()
      ])
      if (iptalEdildi) return
      dispatch({ type: 'settings/loaded', settings: ayarlar })
      dispatch({ type: 'arduinoCli/status', status: durum })
      dispatch({ type: 'secrets/configuredProviders', providers: ayarliSaglayicilar })

      if (durum.found) {
        const platforms = await window.api.arduinoCli.listCores()
        if (iptalEdildi) return
        dispatch({ type: 'arduinoCli/platforms', platforms })
      }

      let sonSketch = await window.api.sketch.getLastOpened()
      if (iptalEdildi) return
      if (!sonSketch) {
        try {
          sonSketch = await window.api.sketch.createNew()
        } catch {
          // Oluşturulamazsa boş devam et
        }
      }
      if (iptalEdildi) return
      if (sonSketch) {
        dispatch({ type: 'sketch/opened', info: sonSketch })
        const anaDosya = sonSketch.files.find((f) => f.isMainFile)
        if (anaDosya) {
          const icerik = await window.api.sketch.readFile(anaDosya.path)
          if (iptalEdildi) return
          dispatch({ type: 'sketch/tabOpened', path: anaDosya.path, name: anaDosya.name, content: icerik, isMainFile: true })
          dispatch({ type: 'sketch/activeTabChanged', path: anaDosya.path })
        }
      }
    }
    // Başarılı da olsa hata da alsa açılış ekranı sonsuza dek takılı kalmasın
    // diye 'app/ready' her koşulda gönderilir.
    baslat()
      .catch((hata) => toastGoster(hata instanceof Error ? hata.message : String(hata), 'hata'))
      .finally(() => dispatch({ type: 'app/ready' }))

    const busyKaldir = window.api.arduinoCli.onBusyChanged((busy) => dispatch({ type: 'arduinoCli/busy', busy }))
    const olayKaldir = window.api.arduinoCli.onOperationEvent((olay) => {
      if (olay.kind === 'compile' || olay.kind === 'upload') {
        dispatch({ type: 'build/operationEvent', kind: olay.kind, phase: olay.phase, message: olay.message })
      }
    })
    const seriVeriKaldir = window.api.serial.onData((parca) => {
      seriSatirSayaci.current += 1
      dispatch({
        type: 'serial/lineAdded',
        line: { id: seriSatirSayaci.current, text: parca.data, timestamp: parca.timestamp }
      })
    })
    const seriDurumKaldir = window.api.serial.onStatusChanged((durum) => dispatch({ type: 'serial/status', status: durum }))

    return () => {
      iptalEdildi = true
      busyKaldir()
      olayKaldir()
      seriVeriKaldir()
      seriDurumKaldir()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Port listesi 3 saniyede bir otomatik yenilenir
  useEffect(() => {
    if (!state.arduinoCli.status?.found) return
    let iptalEdildi = false
    const yenile = async (): Promise<void> => {
      try {
        const ports = await window.api.arduinoCli.listPorts()
        if (!iptalEdildi) dispatch({ type: 'arduinoCli/ports', ports })
      } catch {
        // arduino-cli geçici olarak meşgulse sessizce bir sonraki turu bekle
      }
    }
    void yenile()
    const zamanlayici = setInterval(yenile, 3000)
    return () => {
      iptalEdildi = true
      clearInterval(zamanlayici)
    }
  }, [state.arduinoCli.status?.found])

  // ── arduino-cli aksiyonları ──
  const yenidenDenearduinoCli = useCallback(async () => {
    const durum = await window.api.arduinoCli.getStatus()
    dispatch({ type: 'arduinoCli/status', status: durum })
    if (durum.found) {
      const platforms = await window.api.arduinoCli.listCores()
      dispatch({ type: 'arduinoCli/platforms', platforms })
    }
  }, [])

  const setCliPath = useCallback(
    async (path: string) => {
      const durum = await window.api.arduinoCli.setCliPath(path)
      dispatch({ type: 'arduinoCli/status', status: durum })
      if (durum.found) {
        toastGoster('arduino-cli bulundu: ' + (durum.version ?? ''), 'basari')
        const platforms = await window.api.arduinoCli.listCores()
        dispatch({ type: 'arduinoCli/platforms', platforms })
      } else {
        toastGoster(durum.message ?? 'arduino-cli bulunamadı', 'hata')
      }
    },
    [toastGoster]
  )

  const browseForCliPath = useCallback(async () => {
    const yol = await window.api.arduinoCli.browseForCliPath()
    if (yol) await setCliPath(yol)
  }, [setCliPath])

  const refreshPlatforms = useCallback(async () => {
    const platforms = await window.api.arduinoCli.listCores()
    dispatch({ type: 'arduinoCli/platforms', platforms })
  }, [])

  const refreshPorts = useCallback(async () => {
    const ports = await window.api.arduinoCli.listPorts()
    dispatch({ type: 'arduinoCli/ports', ports })
  }, [])

  const selectFqbn = useCallback((fqbn: string | null) => {
    dispatch({ type: 'arduinoCli/selectFqbn', fqbn })
    void window.api.settings.set('selectedFqbn', fqbn)
  }, [])
  const selectPort = useCallback((port: string | null) => {
    dispatch({ type: 'arduinoCli/selectPort', port })
    void window.api.settings.set('selectedPort', port)
  }, [])
  const selectBaud = useCallback((baud: BaudRate) => {
    dispatch({ type: 'arduinoCli/selectBaud', baud })
    void window.api.settings.set('selectedBaud', baud)
  }, [])

  const addBoardManagerUrl = useCallback(async (url: string) => {
    const urls = await window.api.arduinoCli.addBoardManagerUrl(url)
    dispatch({ type: 'arduinoCli/boardManagerUrls', urls })
  }, [])
  const removeBoardManagerUrl = useCallback(async (url: string) => {
    const urls = await window.api.arduinoCli.removeBoardManagerUrl(url)
    dispatch({ type: 'arduinoCli/boardManagerUrls', urls })
  }, [])

  // ── uygulama ayarları (editör görünümü + AI sağlayıcı/API anahtarı) ──
  const setEditorFontSize = useCallback((size: number) => {
    dispatch({ type: 'settings/patched', patch: { editorFontSize: size } })
    void window.api.settings.set('editorFontSize', size)
  }, [])

  const setEditorTheme = useCallback((theme: EditorTemasi) => {
    dispatch({ type: 'settings/patched', patch: { editorTheme: theme } })
    void window.api.settings.set('editorTheme', theme)
  }, [])

  const setSelectedAiProvider = useCallback((provider: AIProviderId | null) => {
    dispatch({ type: 'settings/patched', patch: { selectedAiProvider: provider } })
    void window.api.settings.set('selectedAiProvider', provider)
  }, [])

  const setSelectedAiModel = useCallback(async (provider: AIProviderId, model: string) => {
    const mevcut = stateRef.current.settings?.selectedModelPerProvider || {}
    const guncel = { ...mevcut, [provider]: model }
    dispatch({ type: 'settings/patched', patch: { selectedModelPerProvider: guncel } })
    try {
      await window.api.settings.set('selectedModelPerProvider', guncel)
    } catch (err) {
      console.error('Model ayarı kaydedilemedi:', err)
    }
  }, [])

  const setCustomContextLimit = useCallback(async (provider: AIProviderId, limit: number) => {
    const mevcut = stateRef.current.settings?.customContextLimits || {}
    const guncel = { ...mevcut, [provider]: limit }
    dispatch({ type: 'settings/patched', patch: { customContextLimits: guncel } })
    try {
      await window.api.settings.set('customContextLimits', guncel)
    } catch (err) {
      console.error('Bağlam limiti ayarı kaydedilemedi:', err)
    }
  }, [])

  const saveApiKey = useCallback(
    async (provider: AIProviderId, apiKey: string) => {
      try {
        await window.api.secrets.setApiKey(provider, apiKey)
        const guncel = await window.api.secrets.getConfiguredProviders()
        dispatch({ type: 'secrets/configuredProviders', providers: guncel })
        toastGoster('API anahtarı güvenli biçimde (şifrelenerek) kaydedildi', 'basari')
      } catch (hata) {
        toastGoster(hata instanceof Error ? hata.message : 'API anahtarı kaydedilemedi', 'hata')
      }
    },
    [toastGoster]
  )

  const clearApiKey = useCallback(
    async (provider: AIProviderId) => {
      try {
        await window.api.secrets.clearApiKey(provider)
        const guncel = await window.api.secrets.getConfiguredProviders()
        dispatch({ type: 'secrets/configuredProviders', providers: guncel })
        toastGoster('API anahtarı kaldırıldı', 'bilgi')
      } catch (hata) {
        toastGoster(hata instanceof Error ? hata.message : 'API anahtarı kaldırılamadı', 'hata')
      }
    },
    [toastGoster]
  )

  // ── Dret AI paneli ──
  const toggleDretAi = useCallback(() => dispatch({ type: 'dretAi/toggled' }), [])
  const closeDretAi = useCallback(() => dispatch({ type: 'dretAi/closed' }), [])
  const askDretAi = useCallback(
    (
      kod: string,
      istem: string,
      secimAraligi?: {
        filePath: string
        startLine: number
        endLine: number
        startColumn: number
        endColumn: number
      }
    ) => {
      dispatch({ type: 'dretAi/openedWithPrompt', kod, istem, secimAraligi })
    },
    []
  )
  const clearDretAiSeed = useCallback(() => dispatch({ type: 'dretAi/seedConsumed' }), [])

  /** AI tarafından önerilen kodu aktif sekmede belirtilen konuma uygular ve gradient animasyonunu tetikler */
  const applyAiCodeToEditor = useCallback(
    (kod: string, hedefAralik?: { filePath: string; startLine: number; endLine: number }) => {
      const { activeTabPath, tabs } = stateRef.current.sketch
      const hedefYol = hedefAralik?.filePath || activeTabPath
      if (!hedefYol) {
        toastGoster('Kodu uygulamak için açık bir dosya bulunamadı', 'hata')
        return
      }

      const sekme = tabs.find((t) => ayniDosyaMi(t.path, hedefYol))
      if (!sekme) {
        toastGoster('Hedef sekme açık değil', 'hata')
        return
      }

      const temizKod = kod.trim()
      const eklenenSatirSayisi = temizKod.split('\n').length

      if (hedefAralik && hedefAralik.startLine > 0 && hedefAralik.endLine >= hedefAralik.startLine) {
        const satirlar = sekme.content.split('\n')
        const bas = satirlar.slice(0, hedefAralik.startLine - 1)
        const son = satirlar.slice(hedefAralik.endLine)
        const yeniIcerik = [...bas, temizKod, ...son].join('\n')

        dispatch({ type: 'sketch/tabContentChanged', path: hedefYol, content: yeniIcerik })
        dispatch({
          type: 'editor/highlightRequested',
          filePath: hedefYol,
          startLine: hedefAralik.startLine,
          endLine: hedefAralik.startLine + eklenenSatirSayisi - 1
        })
        toastGoster(`Kod ${hedefAralik.startLine}. satıra uygulandı`, 'basari')
      } else {
        // Hedef aralık yoksa tüm içeriği güncelle
        dispatch({ type: 'sketch/tabContentChanged', path: hedefYol, content: temizKod })
        dispatch({
          type: 'editor/highlightRequested',
          filePath: hedefYol,
          startLine: 1,
          endLine: Math.max(1, eklenenSatirSayisi)
        })
        toastGoster('Kod tüm dosyaya uygulandı', 'basari')
      }
    },
    [toastGoster]
  )

  const clearEditorHighlight = useCallback(() => {
    dispatch({ type: 'editor/highlightCleared' })
  }, [])

  /** AI kodunun editöre animasyonlu yazılmasını ve onay/reddet çubuğunu başlatır */
  const startAiDiffReview = useCallback(
    async (filePath: string, newCode: string, targetRange?: { startLine: number; endLine: number }) => {
      let sekme = stateRef.current.sketch.tabs.find((t) => ayniDosyaMi(t.path, filePath))
      if (!sekme) {
        try {
          const icerik = await window.api.sketch.readFile(filePath)
          const fileName = dosyaAdiAl(filePath)
          const isMain =
            stateRef.current.sketch.info?.files.find((f) => ayniDosyaMi(f.path, filePath))?.isMainFile ?? false
          dispatch({ type: 'sketch/tabOpened', path: filePath, name: fileName, content: icerik, isMainFile: isMain })
          dispatch({ type: 'sketch/activeTabChanged', path: filePath })
          sekme = {
            path: filePath,
            name: fileName,
            content: icerik,
            savedContent: icerik,
            isMainFile: isMain,
            readOnly: false
          }
        } catch {
          return
        }
      } else {
        dispatch({ type: 'sketch/activeTabChanged', path: filePath })
      }
      if (!sekme) return
      dispatch({
        type: 'aiDiff/started',
        filePath,
        originalContent: sekme.content,
        newCode,
        targetRange
      })
    },
    []
  )

  const setAiDiffWritingFinished = useCallback(() => {
    dispatch({ type: 'aiDiff/writingFinished' })
  }, [])

  const acceptAiDiff = useCallback(async () => {
    const review = stateRef.current.aiDiffReview
    if (review) {
      const sekme = stateRef.current.sketch.tabs.find((t) => ayniDosyaMi(t.path, review.filePath))
      if (sekme) {
        try {
          await window.api.sketch.writeFile(sekme.path, sekme.content)
          dispatch({ type: 'sketch/tabSaved', path: sekme.path, content: sekme.content })
        } catch (hata) {
          console.error('AI değişiklikleri diske yazılamadı:', hata)
        }
      }
    }
    dispatch({ type: 'aiDiff/accepted' })
    dispatch({ type: 'editor/highlightCleared' })
    toastGoster('AI değişiklikleri onaylandı ve kaydedildi', 'basari')
  }, [toastGoster])

  const rejectAiDiff = useCallback(() => {
    const review = stateRef.current.aiDiffReview
    if (review) {
      dispatch({ type: 'sketch/tabContentChanged', path: review.filePath, content: review.originalContent })
    }
    dispatch({ type: 'aiDiff/rejected' })
    dispatch({ type: 'editor/highlightCleared' })
    toastGoster('Eski kod geri yüklendi', 'bilgi')
  }, [toastGoster])

  // ── sketch aksiyonları ──
  const acFonksiyonu = useCallback(
    async (info: SketchInfo) => {
      const kirliVar = stateRef.current.sketch.tabs.some((t) => t.content !== t.savedContent)
      if (kirliVar) {
        const devamEt = window.confirm(
          "Açık sketch'te kaydedilmemiş değişiklikler var. Kaydetmeden başka bir sketch açılsın mı?"
        )
        if (!devamEt) return
      }
      dispatch({ type: 'sketch/opened', info })
      const anaDosya = info.files.find((f) => f.isMainFile)
      if (anaDosya) {
        const icerik = await window.api.sketch.readFile(anaDosya.path)
        dispatch({ type: 'sketch/tabOpened', path: anaDosya.path, name: anaDosya.name, content: icerik, isMainFile: true })
        dispatch({ type: 'sketch/activeTabChanged', path: anaDosya.path })
      }
    },
    []
  )

  const newSketch = useCallback(async (): Promise<SketchInfo | null> => {
    try {
      const info = await window.api.sketch.createNew()
      await acFonksiyonu(info)
      toastGoster(`${info.name} oluşturuldu`, 'basari')
      return info
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : 'Sketch oluşturulamadı', 'hata')
      return null
    }
  }, [acFonksiyonu, toastGoster])

  const closeSketch = useCallback(() => {
    if (!stateRef.current.sketch.info) return
    const kirliVar = stateRef.current.sketch.tabs.some((t) => t.content !== t.savedContent)
    if (kirliVar) {
      const devamEt = window.confirm("Kaydedilmemiş değişiklikler var. Kaydetmeden sketch kapatılsın mı?")
      if (!devamEt) return
    }
    dispatch({ type: 'sketch/closed' })
    void window.api.settings.set('lastOpenedSketch', null)
  }, [])

  const openSketchDialog = useCallback(async () => {
    try {
      const info = await window.api.sketch.openDialog()
      if (info) await acFonksiyonu(info)
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : 'Sketch açılamadı', 'hata')
    }
  }, [acFonksiyonu, toastGoster])

  const openExample = useCallback(
    async (folderPath: string, name: string) => {
      try {
        const info = await window.api.sketch.openPath(folderPath)
        await acFonksiyonu(info)
        toastGoster(`"${name}" örneği açıldı. Değişiklikleri korumak için "Farklı Kaydet" kullanın.`, 'bilgi')
      } catch (hata) {
        toastGoster(hata instanceof Error ? hata.message : 'Örnek açılamadı', 'hata')
      }
    },
    [acFonksiyonu, toastGoster]
  )

  const saveTab = useCallback(async (path: string) => {
    const sekme = stateRef.current.sketch.tabs.find((t) => ayniDosyaMi(t.path, path))
    if (!sekme) return
    await window.api.sketch.writeFile(path, sekme.content)
    dispatch({ type: 'sketch/tabSaved', path, content: sekme.content })
  }, [])

  const saveAllTabs = useCallback(async () => {
    const kirliSekmeler = stateRef.current.sketch.tabs.filter((t) => t.content !== t.savedContent)
    for (const sekme of kirliSekmeler) {
      await window.api.sketch.writeFile(sekme.path, sekme.content)
      dispatch({ type: 'sketch/tabSaved', path: sekme.path, content: sekme.content })
    }
  }, [])

  const saveAsActiveSketch = useCallback(async () => {
    if (!stateRef.current.sketch.info) return
    try {
      await saveAllTabs()
      const info = await window.api.sketch.saveAsDialog(stateRef.current.sketch.info.folderPath)
      if (info) {
        await acFonksiyonu(info)
        toastGoster(`${info.name} olarak kaydedildi`, 'basari')
      }
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : 'Farklı kaydedilemedi', 'hata')
    }
  }, [acFonksiyonu, saveAllTabs, toastGoster])

  const openFileInTab = useCallback(async (path: string, name: string, isMainFile: boolean) => {
    const zatenAcik = stateRef.current.sketch.tabs.some((t) => ayniDosyaMi(t.path, path))
    if (!zatenAcik) {
      const icerik = await window.api.sketch.readFile(path)
      dispatch({ type: 'sketch/tabOpened', path, name, content: icerik, isMainFile })
    }
    dispatch({ type: 'sketch/activeTabChanged', path })
  }, [])

  const setActiveTab = useCallback((path: string) => {
    dispatch({ type: 'sketch/activeTabChanged', path })
  }, [])

  const updateTabContent = useCallback((path: string, content: string) => {
    dispatch({ type: 'sketch/tabContentChanged', path, content })
  }, [])

  const closeTab = useCallback((path: string) => {
    const sekme = stateRef.current.sketch.tabs.find((t) => ayniDosyaMi(t.path, path))
    if (sekme && sekme.content !== sekme.savedContent) {
      const devamEt = window.confirm(`"${sekme.name}" içinde kaydedilmemiş değişiklikler var. Kaydetmeden kapatılsın mı?`)
      if (!devamEt) return
    }
    dispatch({ type: 'sketch/tabClosed', path })
  }, [])

  const hasUnsavedChanges = useCallback((): boolean => {
    return stateRef.current.sketch.tabs.some((t) => t.content !== t.savedContent)
  }, [])

  const addFile = useCallback(
    async (fileName: string): Promise<SketchFile | null> => {
      const info = stateRef.current.sketch.info
      if (!info) return null
      try {
        const dosya = await window.api.sketch.addFile(info.folderPath, fileName)
        const guncelDosyalar = await window.api.sketch.listFiles(info.folderPath)
        dispatch({ type: 'sketch/filesRefreshed', files: guncelDosyalar })
        await openFileInTab(dosya.path, dosya.name, dosya.isMainFile)
        return dosya
      } catch (hata) {
        toastGoster(hata instanceof Error ? hata.message : 'Dosya eklenemedi', 'hata')
        return null
      }
    },
    [openFileInTab, toastGoster]
  )

  const createFileWithContent = useCallback(
    async (fileName: string, content: string): Promise<SketchFile | null> => {
      const info = stateRef.current.sketch.info
      if (!info) {
        toastGoster('Dosya oluşturmak için açık bir sketch olmalı', 'hata')
        return null
      }
      try {
        const temizAd = fileName.trim()
        const mevcutDosya = info.files.find((f) => f.name.toLowerCase() === temizAd.toLowerCase())
        let dosyaYolu = mevcutDosya?.path
        let isMain = mevcutDosya?.isMainFile ?? false

        if (!mevcutDosya) {
          const yeniDosya = await window.api.sketch.addFile(info.folderPath, temizAd)
          dosyaYolu = yeniDosya.path
          isMain = yeniDosya.isMainFile
        }

        if (dosyaYolu) {
          await window.api.sketch.writeFile(dosyaYolu, content)
          const guncelDosyalar = await window.api.sketch.listFiles(info.folderPath)
          dispatch({ type: 'sketch/filesRefreshed', files: guncelDosyalar })

          const acikSekme = stateRef.current.sketch.tabs.find((t) => ayniDosyaMi(t.path, dosyaYolu!))
          if (acikSekme) {
            dispatch({ type: 'sketch/tabContentChanged', path: dosyaYolu, content })
            dispatch({ type: 'sketch/tabSaved', path: dosyaYolu, content })
            dispatch({ type: 'sketch/activeTabChanged', path: dosyaYolu })
          } else {
            dispatch({
              type: 'sketch/tabOpened',
              path: dosyaYolu,
              name: temizAd,
              content,
              isMainFile: isMain
            })
            dispatch({ type: 'sketch/activeTabChanged', path: dosyaYolu })
          }

          toastGoster(`"${temizAd}" dosyası hazırlandı`, 'basari')
          return {
            path: dosyaYolu,
            name: temizAd,
            kind: temizAd.endsWith('.h') ? 'h' : temizAd.endsWith('.ino') ? 'ino' : 'cpp',
            isMainFile: isMain
          }
        }
        return null
      } catch (hata) {
        toastGoster(hata instanceof Error ? hata.message : 'Dosya oluşturulamadı', 'hata')
        return null
      }
    },
    [toastGoster]
  )

  const deleteFile = useCallback(
    async (path: string) => {
      const info = stateRef.current.sketch.info
      if (!info) return
      try {
        await window.api.sketch.deleteFile(path)
        dispatch({ type: 'sketch/tabClosed', path })
        const guncelDosyalar = await window.api.sketch.listFiles(info.folderPath)
        dispatch({ type: 'sketch/filesRefreshed', files: guncelDosyalar })

        // Silinen dosyadan sonra açık sekme kalmadıysa ana dosyayı otomatik aç
        const kalanTabs = stateRef.current.sketch.tabs.filter((t) => !ayniDosyaMi(t.path, path))
        if (kalanTabs.length === 0 && guncelDosyalar.length > 0) {
          const ana = guncelDosyalar.find((f) => f.isMainFile) || guncelDosyalar[0]
          if (ana) {
            await openFileInTab(ana.path, ana.name, ana.isMainFile)
          }
        } else if (kalanTabs.length > 0) {
          if (stateRef.current.sketch.activeTabPath && ayniDosyaMi(stateRef.current.sketch.activeTabPath, path)) {
            const yeniAktif = kalanTabs[kalanTabs.length - 1]
            if (yeniAktif) {
              dispatch({ type: 'sketch/activeTabChanged', path: yeniAktif.path })
            }
          }
        }
      } catch (hata) {
        toastGoster(hata instanceof Error ? hata.message : 'Dosya silinemedi', 'hata')
      }
    },
    [openFileInTab, toastGoster]
  )

  const updateFileContent = useCallback(
    async (path: string, content: string): Promise<void> => {
      const info = stateRef.current.sketch.info
      if (!info) return
      try {
        await window.api.sketch.writeFile(path, content)
        dispatch({ type: 'sketch/tabContentChanged', path, content })
        dispatch({ type: 'sketch/tabSaved', path, content })
        const guncelDosyalar = await window.api.sketch.listFiles(info.folderPath)
        dispatch({ type: 'sketch/filesRefreshed', files: guncelDosyalar })
      } catch (hata) {
        toastGoster(hata instanceof Error ? hata.message : 'Dosya güncellenemedi', 'hata')
      }
    },
    [toastGoster]
  )

  const renameFile = useCallback(
    async (path: string, newName: string): Promise<SketchFile | null> => {
      const info = stateRef.current.sketch.info
      if (!info) return null
      try {
        const yeniDosya = await window.api.sketch.renameFile(path, newName)
        const eskiKlasorYolu = info.folderPath
        const yeniKlasorYolu = klasorYoluAl(yeniDosya.path)
        const klasorDegisti = !ayniDosyaMi(eskiKlasorYolu, yeniKlasorYolu)

        if (klasorDegisti) {
          const yeniKlasorAdi = dosyaAdiAl(yeniKlasorYolu)

          // 1. Önce eski klasörün sohbet geçmişini yeni klasöre taşı
          try {
            await window.api.chat.migrateSessions(eskiKlasorYolu, yeniKlasorYolu, yeniKlasorAdi)
          } catch (chatMigrateErr) {
            console.error('Sohbet geçmişi yeni klasöre taşınamadı:', chatMigrateErr)
          }

          const guncelDosyalar = await window.api.sketch.listFiles(yeniKlasorYolu)

          // Tüm açık sekmeleri yeni klasör yoluna taşı (slash uyumluluğu ile)
          const normEski = eskiKlasorYolu.replace(/\\/g, '/').replace(/\/+$/, '')
          const normYeni = yeniKlasorYolu.replace(/\\/g, '/').replace(/\/+$/, '')

          const guncellenmisSekmeler = stateRef.current.sketch.tabs.map((t) => {
            const normTab = t.path.replace(/\\/g, '/')
            let sonYol = yeniDosya.path
            if (!ayniDosyaMi(t.path, path)) {
              if (normTab.toLowerCase().startsWith(normEski.toLowerCase())) {
                const kalan = normTab.slice(normEski.length).replace(/^\/+/, '')
                sonYol = `${normYeni}/${kalan}`
              } else {
                sonYol = t.path
              }
            }
            return {
              ...t,
              path: sonYol,
              name: ayniDosyaMi(t.path, path) ? yeniDosya.name : t.name,
              isMainFile: ayniDosyaMi(t.path, path) ? yeniDosya.isMainFile : t.isMainFile
            }
          })

          const yeniInfo = {
            folderPath: yeniKlasorYolu,
            name: yeniKlasorAdi,
            files: guncelDosyalar
          }

          // stateRef'i hemen güncelle ki aynı işlem döngüsünde çağrılacak createFile yeni yolu görsün
          stateRef.current = {
            ...stateRef.current,
            sketch: {
              ...stateRef.current.sketch,
              info: yeniInfo,
              tabs: guncellenmisSekmeler,
              activeTabPath: yeniDosya.path
            }
          }

          // Atomik güncelleme: sekmeleri kapatıp açmadan doğrudan projeyi ve sekmeleri güncelle
          dispatch({
            type: 'sketch/projectRenamed',
            info: yeniInfo,
            tabs: guncellenmisSekmeler,
            activeTabPath: yeniDosya.path
          })
        } else {
          dispatch({ type: 'sketch/tabClosed', path })
          const guncelDosyalar = await window.api.sketch.listFiles(info.folderPath)
          dispatch({ type: 'sketch/filesRefreshed', files: guncelDosyalar })
          await openFileInTab(yeniDosya.path, yeniDosya.name, yeniDosya.isMainFile)
        }

        toastGoster(`"${yeniDosya.name}" olarak yeniden adlandırıldı`, 'basari')
        return yeniDosya
      } catch (hata) {
        toastGoster(hata instanceof Error ? hata.message : 'Yeniden adlandırılamadı', 'hata')
        return null
      }
    },
    [openFileInTab, toastGoster]
  )

  // ── build (derleme/yükleme) aksiyonları ──
  const compileActive = useCallback(async () => {
    const { info } = stateRef.current.sketch
    const { selectedFqbn } = stateRef.current.arduinoCli
    if (!info) return toastGoster('Önce bir sketch açın', 'hata')
    if (!selectedFqbn) return toastGoster('Önce bir kart seçin', 'hata')
    await saveAllTabs()
    const operationId = crypto.randomUUID()
    try {
      const sonuc = await window.api.arduinoCli.compile(info.folderPath, selectedFqbn, operationId)
      dispatch({ type: 'build/compileResult', result: sonuc })
      toastGoster(
        sonuc.success ? 'Derleme başarılı' : `Derleme başarısız (${sonuc.errors.length} hata)`,
        sonuc.success ? 'basari' : 'hata'
      )
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : 'Derleme başarısız oldu', 'hata')
    }
  }, [saveAllTabs, toastGoster])

  const uploadActive = useCallback(async () => {
    const { info } = stateRef.current.sketch
    const { selectedFqbn, selectedPort } = stateRef.current.arduinoCli
    if (!info) return toastGoster('Önce bir sketch açın', 'hata')
    if (!selectedFqbn) return toastGoster('Önce bir kart seçin', 'hata')
    if (!selectedPort) return toastGoster('Önce bir port seçin', 'hata')
    await saveAllTabs()
    const operationId = crypto.randomUUID()
    try {
      // arduino-cli'nin upload komutu kendi başına ASLA derlemez (yalnızca
      // önceden derlenmiş bir binary arar); bu yüzden "Yükle" her zaman
      // önce taze bir derlemeyle başlar. Derleme başarısızsa yüklemeye hiç
      // geçilmez ve hatalar tıpkı "Derle"de olduğu gibi Problems panelinde/
      // editör marker'larında gösterilir.
      const derlemeSonucu = await window.api.arduinoCli.compile(info.folderPath, selectedFqbn, operationId)
      dispatch({ type: 'build/compileResult', result: derlemeSonucu })
      if (!derlemeSonucu.success) {
        toastGoster(`Derleme başarısız (${derlemeSonucu.errors.length} hata); yükleme yapılmadı`, 'hata')
        return
      }
      const sonuc = await window.api.arduinoCli.upload(info.folderPath, selectedFqbn, selectedPort, operationId)
      dispatch({ type: 'build/uploadResult', result: sonuc })
      toastGoster(
        sonuc.success ? 'Yükleme başarılı' : `Yükleme başarısız: ${sonuc.topLevelError ?? ''}`,
        sonuc.success ? 'basari' : 'hata'
      )
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : 'Yükleme başarısız oldu', 'hata')
    }
  }, [saveAllTabs, toastGoster])

  const cancelBuild = useCallback(async () => {
    // Şu an tek bir global işlem kimliği takip etmiyoruz; en son başlayan
    // compile/upload işlemi arduino-cli tarafında zaten tekildir.
    toastGoster('İptal isteği gönderildi', 'bilgi')
  }, [toastGoster])

  /** Sketch klasörünün dışındaki bir dosyayı (ör. kütüphane/çekirdek başlığı) salt okunur sekmede açar */
  const openExternalFile = useCallback(
    async (path: string) => {
      const acikSekme = stateRef.current.sketch.tabs.find((t) => ayniDosyaMi(t.path, path))
      if (acikSekme) {
        // Sekme zaten açık: mevcut sekmenin kayıtlı yolunu kullan, büyük/küçük
        // harf farkı yüzünden activeTabPath ile eşleşmeme riskini önle.
        dispatch({ type: 'sketch/activeTabChanged', path: acikSekme.path })
        return
      }
      try {
        const icerik = await window.api.sketch.readFile(path)
        const ad = path.split(/[\\/]/).pop() ?? path
        dispatch({ type: 'sketch/tabOpened', path, name: ad, content: icerik, isMainFile: false, readOnly: true })
        dispatch({ type: 'sketch/activeTabChanged', path })
      } catch (hata) {
        toastGoster(hata instanceof Error ? hata.message : 'Dosya açılamadı', 'hata')
      }
    },
    [toastGoster]
  )

  const requestReveal = useCallback(
    async (path: string, line: number) => {
      const dosya = stateRef.current.sketch.info?.files.find((f) => ayniDosyaMi(f.path, path))
      if (dosya) {
        await openFileInTab(dosya.path, dosya.name, dosya.isMainFile)
      } else {
        // Sketch klasörünün dışında bir dosya (ör. libstdc++ başlığı); yine de
        // salt okunur olarak açılır ki kullanıcı gerçek hatayı görebilsin.
        await openExternalFile(path)
      }
      dispatch({ type: 'build/revealRequested', path, line })
    },
    [openFileInTab, openExternalFile]
  )
  const clearReveal = useCallback(() => dispatch({ type: 'build/revealHandled' }), [])

  // ── seri port aksiyonları ──
  const connectSerial = useCallback(async () => {
    const { selectedPort, selectedBaud } = stateRef.current.arduinoCli
    if (!selectedPort) return toastGoster('Önce üst çubuktan bir port seçin', 'hata')
    try {
      await window.api.serial.open(selectedPort, selectedBaud)
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : 'Port açılamadı', 'hata')
    }
  }, [toastGoster])

  const disconnectSerial = useCallback(async () => {
    try {
      await window.api.serial.close()
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : 'Port kapatılamadı', 'hata')
    }
  }, [toastGoster])

  const writeSerial = useCallback(
    async (data: string, lineEnding: LineEnding) => {
      try {
        await window.api.serial.write(data, lineEnding)
      } catch (hata) {
        toastGoster(hata instanceof Error ? hata.message : 'Veri gönderilemedi', 'hata')
      }
    },
    [toastGoster]
  )

  const clearSerial = useCallback(() => dispatch({ type: 'serial/cleared' }), [])

  const value = useMemo<AppStateBaglami>(
    () => ({
      state,
      yenidenDenearduinoCli,
      setCliPath,
      browseForCliPath,
      refreshPlatforms,
      refreshPorts,
      selectFqbn,
      selectPort,
      selectBaud,
      addBoardManagerUrl,
      removeBoardManagerUrl,
      setEditorFontSize,
      setEditorTheme,
      setSelectedAiProvider,
      setSelectedAiModel,
      setCustomContextLimit,
      saveApiKey,
      clearApiKey,
      toggleDretAi,
      closeDretAi,
      askDretAi,
      clearDretAiSeed,
      applyAiCodeToEditor,
      clearEditorHighlight,
      startAiDiffReview,
      setAiDiffWritingFinished,
      acceptAiDiff,
      rejectAiDiff,
      newSketch,
      openSketchDialog,
      openExample,
      closeSketch,
      saveAsActiveSketch,
      openFileInTab,
      setActiveTab,
      updateTabContent,
      saveTab,
      saveAllTabs,
      closeTab,
      hasUnsavedChanges,
      addFile,
      createFileWithContent,
      deleteFile,
      renameFile,
      updateFileContent,
      compileActive,
      uploadActive,
      cancelBuild,
      requestReveal,
      clearReveal,
      connectSerial,
      disconnectSerial,
      writeSerial,
      clearSerial
    }),
    [
      state,
      yenidenDenearduinoCli,
      setCliPath,
      browseForCliPath,
      refreshPlatforms,
      refreshPorts,
      selectFqbn,
      selectPort,
      selectBaud,
      addBoardManagerUrl,
      removeBoardManagerUrl,
      setEditorFontSize,
      setEditorTheme,
      setSelectedAiProvider,
      setSelectedAiModel,
      setCustomContextLimit,
      saveApiKey,
      clearApiKey,
      toggleDretAi,
      closeDretAi,
      askDretAi,
      clearDretAiSeed,
      applyAiCodeToEditor,
      clearEditorHighlight,
      startAiDiffReview,
      setAiDiffWritingFinished,
      acceptAiDiff,
      rejectAiDiff,
      newSketch,
      openSketchDialog,
      openExample,
      closeSketch,
      saveAsActiveSketch,
      openFileInTab,
      setActiveTab,
      updateTabContent,
      saveTab,
      saveAllTabs,
      closeTab,
      hasUnsavedChanges,
      addFile,
      createFileWithContent,
      deleteFile,
      renameFile,
      updateFileContent,
      compileActive,
      uploadActive,
      cancelBuild,
      requestReveal,
      clearReveal,
      connectSerial,
      disconnectSerial,
      writeSerial,
      clearSerial
    ]
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState(): AppStateBaglami {
  const baglam = useContext(AppStateContext)
  if (!baglam) throw new Error('useAppState, AppStateProvider içinde kullanılmalıdır')
  return baglam
}
