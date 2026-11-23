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
  BuildSize,
  CompileResult,
  DerlemeHatasi,
  DetectedPort,
  EditorTemasi,
  LineEnding,
  PlatformSummary,
  SerialStatus,
  SketchFile,
  SketchInfo,
  UploadResult,
  AgentChangeItem
} from '@shared/types'
import { DEFAULT_BAUD_RATE } from '@shared/types'
import { fqbnSecenekleriyle, temelFqbn } from '@shared/boardFqbn'
import { useToast } from './ToastContext'
import { ayniDosyaMi } from '../utils/paths'

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
  /** Hangi sketch/proje klasörüne ait olduğu (çoklu proje çalışma alanı için) */
  sketchFolderPath?: string
}

export interface SeriSatir {
  id: number
  text: string
  timestamp: number
  /** Satırın geldiği seri port */
  port: string
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
    /** Aynı pencerede açık olan tüm bağımsız sketch projeleri (Çoklu Proje Çalışma Alanı) */
    workspaceSketches: SketchInfo[]
    /** Derleme ve yükleme için şu anda hedef seçili olan aktif sketch klasörü yolu */
    activeSketchPath: string | null
  }
  build: {
    currentOperation: 'compile' | 'upload' | null
    log: string
    errors: DerlemeHatasi[]
    /** Problems panelinden bir hataya tıklanınca editörün gitmesi istenen konum */
    revealTarget: { path: string; line: number } | null
    /** Son başarılı derlemenin flash/RAM kullanımı */
    boyut: BuildSize | null
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
   * tutulur (mesaj geçmişi ise AgentContext'te tutulur).
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
  /** Ajanın yazdığı kodun editörde daktilo gibi akması: içerik zaten diske yazılmış ve durumda güncel; yalnızca görsel efekt */
  aiYazim: { id: number; filePath: string; onceki: string; hedef: string } | null
  /** BAGLANTI.json güncellendiğinde Bağlantı Kılavuzu panelini yenilemek için sayaç */
  baglantiSurumu: number
}

/** Yazım efektlerini ayırt etmek için artan kimlik */
let aiYazimSayaci = 0

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
  sketch: { info: null, tabs: [], activeTabPath: null, workspaceSketches: [], activeSketchPath: null },
  build: { currentOperation: null, log: '', errors: [], revealTarget: null, boyut: null },
  serial: {
    status: { open: false, port: null, baud: null, portlar: [], temporarilyClosedForUpload: false },
    lines: []
  },
  dretAi: { open: false, seed: null },
  editorHighlight: null,
  aiDiffReview: null,
  aiYazim: null,
  baglantiSurumu: 0
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
  | { type: 'sketch/workspaceSketchAdded'; info: SketchInfo }
  | { type: 'sketch/workspaceSketchRemoved'; folderPath: string }
  | { type: 'sketch/activeSketchChanged'; folderPath: string }
  | { type: 'sketch/filesRefreshed'; files: SketchFile[]; folderPath?: string }
  | { type: 'sketch/tabOpened'; path: string; name: string; content: string; isMainFile: boolean; readOnly?: boolean; sketchFolderPath?: string }
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
  | { type: 'serial/linesAdded'; lines: SeriSatir[] }
  | { type: 'serial/cleared'; port?: string }
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
  | { type: 'aiYazim/basladi'; id: number; filePath: string; onceki: string; hedef: string }
  | { type: 'aiYazim/bitti'; id: number }
  | { type: 'aiDiff/writingFinished' }
  | { type: 'aiDiff/accepted' }
  | { type: 'aiDiff/rejected' }
  | { type: 'baglanti/yenilendi' }

const SERI_TAMPON_LIMIT = 5000
const OTOMATIK_ANLIK_ARALIK_MS = 2 * 60 * 1000
const SON_OTOMATIK_ANLIK = new Map<string, number>()

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
      return {
        ...state,
        sketch: {
          info: action.info,
          tabs: [],
          activeTabPath: null,
          workspaceSketches: [action.info],
          activeSketchPath: action.info.folderPath
        }
      }
    case 'sketch/projectRenamed': {
      const guncelSketches = state.sketch.workspaceSketches.map((s) =>
        ayniDosyaMi(s.folderPath, action.info.folderPath) ? action.info : s
      )
      return {
        ...state,
        sketch: {
          info: action.info,
          tabs: action.tabs,
          activeTabPath: action.activeTabPath,
          workspaceSketches: guncelSketches.length > 0 ? guncelSketches : [action.info],
          activeSketchPath: action.info.folderPath
        }
      }
    }
    case 'sketch/closed':
      return { ...state, sketch: { info: null, tabs: [], activeTabPath: null, workspaceSketches: [], activeSketchPath: null } }
    case 'sketch/workspaceSketchAdded': {
      const zatenVar = state.sketch.workspaceSketches.some((s) => ayniDosyaMi(s.folderPath, action.info.folderPath))
      const yeniWorkspace = zatenVar
        ? state.sketch.workspaceSketches.map((s) => (ayniDosyaMi(s.folderPath, action.info.folderPath) ? action.info : s))
        : [...state.sketch.workspaceSketches, action.info]
      return {
        ...state,
        sketch: {
          ...state.sketch,
          info: state.sketch.info || action.info,
          workspaceSketches: yeniWorkspace,
          activeSketchPath: state.sketch.activeSketchPath || action.info.folderPath
        }
      }
    }
    case 'sketch/workspaceSketchRemoved': {
      const kalanWorkspace = state.sketch.workspaceSketches.filter((s) => !ayniDosyaMi(s.folderPath, action.folderPath))
      const kalanSekmeler = state.sketch.tabs.filter((t) => {
        if (t.sketchFolderPath && ayniDosyaMi(t.sketchFolderPath, action.folderPath)) return false
        if (t.path.toLowerCase().startsWith(action.folderPath.toLowerCase())) return false
        return true
      })
      const yeniAktifInfo = kalanWorkspace.length > 0 ? kalanWorkspace[0] : null
      return {
        ...state,
        sketch: {
          ...state.sketch,
          info: ayniDosyaMi(state.sketch.info?.folderPath || '', action.folderPath) ? yeniAktifInfo : state.sketch.info,
          workspaceSketches: kalanWorkspace,
          activeSketchPath: yeniAktifInfo ? yeniAktifInfo.folderPath : null,
          tabs: kalanSekmeler,
          activeTabPath: kalanSekmeler.length > 0 ? kalanSekmeler[kalanSekmeler.length - 1].path : null
        }
      }
    }
    case 'sketch/activeSketchChanged': {
      const secilen = state.sketch.workspaceSketches.find((s) => ayniDosyaMi(s.folderPath, action.folderPath))
      return {
        ...state,
        sketch: {
          ...state.sketch,
          info: secilen || state.sketch.info,
          activeSketchPath: action.folderPath
        }
      }
    }
    case 'sketch/filesRefreshed': {
      const folder = action.folderPath || (action.files.length > 0 ? action.files[0].path : '')
      const guncellenmisWorkspace = state.sketch.workspaceSketches.map((s) => {
        const ayni = folder && (ayniDosyaMi(s.folderPath, folder) || folder.toLowerCase().startsWith(s.folderPath.toLowerCase()))
        return ayni ? { ...s, files: action.files } : s
      })
      const infoAyni = state.sketch.info && folder && (ayniDosyaMi(state.sketch.info.folderPath, folder) || folder.toLowerCase().startsWith(state.sketch.info.folderPath.toLowerCase()))
      return {
        ...state,
        sketch: {
          ...state.sketch,
          info: infoAyni && state.sketch.info ? { ...state.sketch.info, files: action.files } : state.sketch.info,
          workspaceSketches: guncellenmisWorkspace
        }
      }
    }
    case 'sketch/tabOpened': {
      if (state.sketch.tabs.some((t) => ayniDosyaMi(t.path, action.path))) return state
      const yeniSekme: AcikSekme = {
        path: action.path,
        name: action.name,
        content: action.content,
        savedContent: action.content,
        isMainFile: action.isMainFile,
        readOnly: action.readOnly ?? false,
        sketchFolderPath: action.sketchFolderPath
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
    case 'sketch/activeTabChanged': {
      const tiklananSekme = state.sketch.tabs.find((t) => ayniDosyaMi(t.path, action.path))
      const hedefSketch = state.sketch.workspaceSketches.find((s) => {
        if (tiklananSekme?.sketchFolderPath && ayniDosyaMi(s.folderPath, tiklananSekme.sketchFolderPath)) return true
        return action.path.toLowerCase().startsWith(s.folderPath.toLowerCase())
      })
      return {
        ...state,
        sketch: {
          ...state.sketch,
          activeTabPath: action.path,
          info: hedefSketch || state.sketch.info,
          activeSketchPath: hedefSketch ? hedefSketch.folderPath : state.sketch.activeSketchPath
        }
      }
    }

    case 'build/operationEvent': {
      if (action.phase === 'basladi') {
        // Yükleme öncesi derlemeden gelen boyut bilgisi yükleme sırasında kaybolmasın
        return {
          ...state,
          build: { currentOperation: action.kind, log: '', errors: [], revealTarget: null, boyut: action.kind === 'upload' ? state.build.boyut : null }
        }
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
          // Derleme başarısız ama satır bazlı hata ayrıştırılamadıysa (ör. kart paketi eksik), Problems boş kalmasın
          errors:
            !action.result.success && action.result.errors.length === 0 && action.result.topLevelError
              ? [{ dosya: '', satir: 0, sutun: 0, tur: 'error', mesaj: action.result.topLevelError, hamMetin: action.result.topLevelError }]
              : action.result.errors,
          boyut: action.result.success ? (action.result.boyut ?? null) : null,
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
    case 'serial/linesAdded': {
      const guncelSatirlar = [...state.serial.lines, ...action.lines]
      if (guncelSatirlar.length > SERI_TAMPON_LIMIT) {
        guncelSatirlar.splice(0, guncelSatirlar.length - SERI_TAMPON_LIMIT)
      }
      return { ...state, serial: { ...state.serial, lines: guncelSatirlar } }
    }
    case 'serial/cleared':
      return {
        ...state,
        serial: { ...state.serial, lines: action.port ? state.serial.lines.filter((s) => s.port !== action.port) : [] }
      }

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
    case 'aiYazim/basladi':
      return { ...state, aiYazim: { id: action.id, filePath: action.filePath, onceki: action.onceki, hedef: action.hedef } }
    case 'aiYazim/bitti':
      return state.aiYazim && state.aiYazim.id === action.id ? { ...state, aiYazim: null } : state
    case 'aiDiff/writingFinished':
      return state.aiDiffReview
        ? { ...state, aiDiffReview: { ...state.aiDiffReview, isWriting: false } }
        : state
    case 'aiDiff/accepted':
      return { ...state, aiDiffReview: null }
    case 'aiDiff/rejected':
      return { ...state, aiDiffReview: null }
    case 'baglanti/yenilendi':
      return { ...state, baglantiSurumu: state.baglantiSurumu + 1 }

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
  /** Seçili kartın derleme/yükleme için kullanılan tam adı: temel FQBN + kart seçenekleri (işlemci, bölüm şeması…) */
  efektifFqbnAl: () => string | null
  /** Bir kart seçeneğini kaydeder; değer null ise seçenek kart paketinin varsayılanına döner */
  setBoardOption: (temelFqbn: string, option: string, value: string | null) => Promise<void>
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
  /** AgentPanel, bekleyen seed'i kendi durumuna aktardıktan sonra çağırır */
  clearDretAiSeed: () => void
  /** AI tarafından üretilen kodu editöre uygular ve renkli gradient animasyonu tetikler */
  applyAiCodeToEditor: (
    kod: string,
    hedefAralik?: { filePath?: string; startLine?: number; endLine?: number }
  ) => void | Promise<void>
  clearEditorHighlight: () => void
  /** AI kodu editöre yazma ve Onayla/Reddet akışını başlatır */
  startAiDiffReview: (filePath: string, newCode: string, targetRange?: { startLine: number; endLine: number }) => void | Promise<void>
  setAiDiffWritingFinished: () => void
  /** Editördeki yazım efekti bitince çağrılır */
  aiYazimBitti: (id: number) => void
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
  openFileInTab: (path: string, name: string, isMainFile: boolean, sketchFolderPath?: string) => Promise<void>
  setActiveTab: (path: string) => void
  updateTabContent: (path: string, content: string) => void
  saveTab: (path: string) => Promise<void>
  saveAllTabs: () => Promise<void>
  closeTab: (path: string) => void
  /** Açık sketch'te kaydedilmemiş değişiklik olup olmadığını anlık okur (pencere kapatma onayı için) */
  hasUnsavedChanges: () => boolean
  addFile: (fileName: string, targetFolderPath?: string) => Promise<SketchFile | null>
  createFileWithContent: (fileName: string, content: string) => Promise<SketchFile | null>
  /** Bağımsız kardeş bir sketch klasörü açar, ana .ino dosyasını oluşturur ve çalışma alanına ekler */
  createSiblingSketchWithContent: (sketchName: string, content: string) => Promise<SketchInfo | null>
  /** Mevcut çalışma alanına başka bir sketch projesi ekler */
  addSketchToWorkspace: (info: SketchInfo) => Promise<void>
  /** Dosya seçici ile çalışma alanına yeni bir sketch projesi ekler */
  addSketchToWorkspaceDialog: () => Promise<SketchInfo | null>
  /** Bir projeyi çalışma alanından kaldırır (diskten silmez) */
  removeSketchFromWorkspace: (folderPath: string) => void
  /** Derleme ve yükleme için aktif olan hedef sketch'i belirler */
  setActiveSketch: (folderPath: string) => void
  /** Yeni bir bağımsız uygulama penceresi açar */
  openInNewWindow: (sketchPath?: string) => Promise<void>
  deleteFile: (path: string, folderPath?: string) => Promise<void>
  renameFile: (path: string, newName: string) => Promise<SketchFile | null>
  updateFileContent: (path: string, content: string) => Promise<void>
  /** Agent'ın diskte yaptığı değişiklikleri açık sekmelere ve dosya ağacına yansıtır */
  syncAgentChanges: (changes: AgentChangeItem[]) => Promise<void>
  /** Verilen sketch klasörlerini diskten yeniden okur (geri alma sonrası) */
  reloadSketchFolders: (folders: string[]) => Promise<void>
  // build
  compileActive: () => Promise<void>
  uploadActive: () => Promise<void>
  cancelBuild: () => Promise<void>
  /** Problems panelinden bir hataya tıklanınca dosyayı açıp o satıra gitmeyi ister */
  requestReveal: (path: string, line: number) => Promise<void>
  clearReveal: () => void
  // serial
  /** Üst çubukta seçili portu açar; diğer açık portlara dokunmaz */
  connectSerial: () => Promise<void>
  disconnectSerial: (port?: string) => Promise<void>
  writeSerial: (data: string, lineEnding: LineEnding, port?: string) => Promise<void>
  clearSerial: (port?: string) => void
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

      let baslangicYolu: string | null = null
      try {
        baslangicYolu = await window.api.sketch.getInitialSketchPath()
      } catch {
        // Başlangıç yolu sorgusu başarısızsa yok say
      }

      let sonSketch: SketchInfo | null = null
      if (baslangicYolu) {
        try {
          sonSketch = await window.api.sketch.openPath(baslangicYolu)
        } catch {
          // Belirtilen yol açılamadıysa devam et
        }
      }

      if (!sonSketch) {
        sonSketch = await window.api.sketch.getLastOpened()
      }

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
          dispatch({
            type: 'sketch/tabOpened',
            path: anaDosya.path,
            name: anaDosya.name,
            content: icerik,
            isMainFile: true,
            sketchFolderPath: sonSketch.folderPath
          })
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
    // Seri veri sık gelir; her satırda tüm arayüzü yeniden çizmemek için satırlar ~80 ms'de bir toplu eklenir
    let seriTampon: SeriSatir[] = []
    let seriZamanlayici: ReturnType<typeof setTimeout> | null = null
    const seriBosalt = (): void => {
      seriZamanlayici = null
      if (seriTampon.length === 0) return
      const toplu = seriTampon
      seriTampon = []
      dispatch({ type: 'serial/linesAdded', lines: toplu })
    }
    const seriVeriKaldir = window.api.serial.onData((parca) => {
      seriSatirSayaci.current += 1
      seriTampon.push({ id: seriSatirSayaci.current, text: parca.data, timestamp: parca.timestamp, port: parca.port })
      if (!seriZamanlayici) seriZamanlayici = setTimeout(seriBosalt, 80)
    })
    const seriDurumKaldir = window.api.serial.onStatusChanged((durum) => dispatch({ type: 'serial/status', status: durum }))

    return () => {
      iptalEdildi = true
      busyKaldir()
      olayKaldir()
      seriVeriKaldir()
      seriDurumKaldir()
      if (seriZamanlayici) clearTimeout(seriZamanlayici)
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
  const efektifFqbnAl = useCallback((): string | null => {
    const fqbn = stateRef.current.arduinoCli.selectedFqbn
    if (!fqbn) return null
    return fqbnSecenekleriyle(fqbn, stateRef.current.settings?.boardOptions?.[temelFqbn(fqbn)])
  }, [])

  const setBoardOption = useCallback(async (temel: string, option: string, value: string | null): Promise<void> => {
    const tumu = { ...(stateRef.current.settings?.boardOptions ?? {}) }
    const kart = { ...(tumu[temel] ?? {}) }
    if (value === null) delete kart[option]
    else kart[option] = value
    if (Object.keys(kart).length === 0) delete tumu[temel]
    else tumu[temel] = kart
    dispatch({ type: 'settings/patched', patch: { boardOptions: tumu } })
    try {
      await window.api.settings.set('boardOptions', tumu)
    } catch (hata) {
      console.error('Kart seçeneği kaydedilemedi:', hata)
    }
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

  const updateFileContent = useCallback(
    async (path: string, content: string): Promise<void> => {
      const { info, activeSketchPath } = stateRef.current.sketch
      const targetFolder = klasorYoluAl(path) || activeSketchPath || info?.folderPath
      try {
        await window.api.sketch.writeFile(path, content)
        const acikSekme = stateRef.current.sketch.tabs.find((t) => ayniDosyaMi(t.path, path))
        if (acikSekme) {
          dispatch({ type: 'sketch/tabContentChanged', path, content })
          dispatch({ type: 'sketch/tabSaved', path, content })
        } else {
          dispatch({
            type: 'sketch/tabOpened',
            path,
            name: dosyaAdiAl(path),
            content,
            isMainFile: path.endsWith('.ino'),
            sketchFolderPath: targetFolder
          })
          dispatch({ type: 'sketch/tabSaved', path, content })
          dispatch({ type: 'sketch/activeTabChanged', path })
        }
        if (targetFolder) {
          const guncelDosyalar = await window.api.sketch.listFiles(targetFolder)
          dispatch({ type: 'sketch/filesRefreshed', files: guncelDosyalar, folderPath: targetFolder })
        }
      } catch (hata) {
        toastGoster(hata instanceof Error ? hata.message : 'Dosya güncellenemedi', 'hata')
      }
    },
    [toastGoster]
  )

  const reloadSketchFolders = useCallback(async (folders: string[]): Promise<void> => {
    for (const klasor of [...new Set(folders)]) {
      let bilgi: SketchInfo | null = null
      try {
        bilgi = await window.api.sketch.openPath(klasor)
      } catch {
        bilgi = null
      }
      if (!bilgi) {
        // Klasör artık yok (ör. oluşturulan sketch geri alındı)
        dispatch({ type: 'sketch/workspaceSketchRemoved', folderPath: klasor })
        continue
      }
      dispatch({ type: 'sketch/workspaceSketchAdded', info: bilgi })
      const sekmeler = stateRef.current.sketch.tabs.filter(
        (t) => t.sketchFolderPath && ayniDosyaMi(t.sketchFolderPath, klasor) && !t.readOnly
      )
      for (const sekme of sekmeler) {
        try {
          const icerik = await window.api.sketch.readFile(sekme.path)
          dispatch({ type: 'sketch/tabContentChanged', path: sekme.path, content: icerik })
          dispatch({ type: 'sketch/tabSaved', path: sekme.path, content: icerik })
        } catch {
          dispatch({ type: 'sketch/tabClosed', path: sekme.path })
        }
      }
    }
    if (folders.length > 0) dispatch({ type: 'baglanti/yenilendi' })
  }, [])

  const syncAgentChanges = useCallback(
    async (changes: AgentChangeItem[]): Promise<void> => {
      const yenilenecek = new Set<string>()
      let baglantiGuncellendi = false
      for (const c of changes) {
        if (c.fileName?.toUpperCase() === 'BAGLANTI.JSON' || c.path.toLowerCase().endsWith('baglanti.json')) {
          baglantiGuncellendi = true
        }
        switch (c.kind) {
          case 'write_file':
          case 'create_file': {
            yenilenecek.add(c.sketchPath)
            if (c.content !== undefined) {
              const acik = stateRef.current.sketch.tabs.some((t) => ayniDosyaMi(t.path, c.path))
              if (acik) {
                const sekme = stateRef.current.sketch.tabs.find((t) => ayniDosyaMi(t.path, c.path))
                const aktifMi = ayniDosyaMi(stateRef.current.sketch.activeTabPath ?? '', c.path)
                // Yalnızca açık ve görünen sekmede, makul boyutta içerikte optik tarama yazım efektini oynat
                if (
                  sekme &&
                  aktifMi &&
                  sekme.content !== c.content &&
                  c.content.length < 60000 &&
                  !window.matchMedia('(prefers-reduced-motion: reduce)').matches
                ) {
                  aiYazimSayaci += 1
                  dispatch({ type: 'aiYazim/basladi', id: aiYazimSayaci, filePath: c.path, onceki: sekme.content, hedef: c.content })
                }
                dispatch({ type: 'sketch/tabContentChanged', path: c.path, content: c.content })
                dispatch({ type: 'sketch/tabSaved', path: c.path, content: c.content })
              }
            }
            break
          }
          case 'delete_file':
            dispatch({ type: 'sketch/tabClosed', path: c.path })
            yenilenecek.add(c.sketchPath)
            break
          case 'rename_file':
            if (c.oldPath) dispatch({ type: 'sketch/tabClosed', path: c.oldPath })
            yenilenecek.add(c.sketchPath)
            break
          case 'create_sketch':
            yenilenecek.add(c.path)
            break
          case 'delete_sketch':
            dispatch({ type: 'sketch/workspaceSketchRemoved', folderPath: c.path })
            break
          case 'rename_sketch':
            if (c.oldPath) dispatch({ type: 'sketch/workspaceSketchRemoved', folderPath: c.oldPath })
            yenilenecek.add(c.path)
            break
        }
      }
      if (yenilenecek.size > 0) await reloadSketchFolders([...yenilenecek])
      if (baglantiGuncellendi) dispatch({ type: 'baglanti/yenilendi' })
    },
    [reloadSketchFolders]
  )

  /** AI tarafından önerilen kodu aktif sekmede belirtilen konuma uygular, diske kaydeder ve gradient animasyonunu tetikler */
  const applyAiCodeToEditor = useCallback(
    async (kod: string, hedefAralik?: { filePath?: string; startLine?: number; endLine?: number }) => {
      const { activeTabPath, tabs, info } = stateRef.current.sketch
      const hedefYol =
        hedefAralik?.filePath ||
        activeTabPath ||
        info?.files.find((f) => f.isMainFile)?.path ||
        info?.files[0]?.path

      if (!hedefYol) {
        toastGoster('Kodu uygulamak için açık bir dosya bulunamadı', 'hata')
        return
      }

      const sekme = tabs.find((t) => ayniDosyaMi(t.path, hedefYol))
      const temizKod = kod.trim()
      const eklenenSatirSayisi = temizKod.split('\n').length

      const isSelection = Boolean(
        hedefAralik &&
          typeof hedefAralik.startLine === 'number' &&
          hedefAralik.startLine > 0 &&
          typeof hedefAralik.endLine === 'number' &&
          hedefAralik.endLine >= hedefAralik.startLine
      )

      let yeniIcerik = temizKod
      let highlightStart = 1
      let highlightEnd = eklenenSatirSayisi

      if (isSelection && sekme) {
        const satirlar = sekme.content.split('\n')
        const bas = satirlar.slice(0, hedefAralik!.startLine! - 1)
        const son = satirlar.slice(hedefAralik!.endLine!)
        yeniIcerik = [...bas, temizKod, ...son].join('\n')
        highlightStart = hedefAralik!.startLine!
        highlightEnd = hedefAralik!.startLine! + eklenenSatirSayisi - 1
      }

      // Kodu hem diske hem sekmelere doğrudan ve güvenle yaz
      await updateFileContent(hedefYol, yeniIcerik)

      dispatch({
        type: 'editor/highlightRequested',
        filePath: hedefYol,
        startLine: highlightStart,
        endLine: highlightEnd
      })

      toastGoster(isSelection ? `Kod ${highlightStart}. satıra uygulandı` : 'Kod tüm dosyaya uygulandı', 'basari')
    },
    [updateFileContent, toastGoster]
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

  const aiYazimBitti = useCallback((id: number) => {
    dispatch({ type: 'aiYazim/bitti', id })
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
        dispatch({
          type: 'sketch/tabOpened',
          path: anaDosya.path,
          name: anaDosya.name,
          content: icerik,
          isMainFile: true,
          sketchFolderPath: info.folderPath
        })
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

  /**
   * Kaydetmeden önce diskteki mevcut hali sürüm geçmişine yazar (en çok 2 dakikada bir, proje başına).
   * Böylece düzenlemeden önceki her durum geri getirilebilir. Hata kaydetmeyi engellemez.
   */
  const kaydetmedenOnceAnlikGoruntu = useCallback(async (klasor: string | undefined): Promise<void> => {
    if (!klasor) return
    const son = SON_OTOMATIK_ANLIK.get(klasor) ?? 0
    if (Date.now() - son < OTOMATIK_ANLIK_ARALIK_MS) return
    SON_OTOMATIK_ANLIK.set(klasor, Date.now())
    try {
      await window.api.history.commit(klasor, '', true)
    } catch {
      // geçmiş alınamadıysa kaydetme yine de devam eder
    }
  }, [])

  const saveTab = useCallback(async (path: string) => {
    const sekme = stateRef.current.sketch.tabs.find((t) => ayniDosyaMi(t.path, path))
    if (!sekme) return
    await kaydetmedenOnceAnlikGoruntu(sekme.sketchFolderPath)
    await window.api.sketch.writeFile(path, sekme.content)
    dispatch({ type: 'sketch/tabSaved', path, content: sekme.content })
  }, [kaydetmedenOnceAnlikGoruntu])

  const saveAllTabs = useCallback(async () => {
    const kirliSekmeler = stateRef.current.sketch.tabs.filter((t) => t.content !== t.savedContent)
    for (const klasor of new Set(kirliSekmeler.map((t) => t.sketchFolderPath))) await kaydetmedenOnceAnlikGoruntu(klasor)
    for (const sekme of kirliSekmeler) {
      await window.api.sketch.writeFile(sekme.path, sekme.content)
      dispatch({ type: 'sketch/tabSaved', path: sekme.path, content: sekme.content })
    }
  }, [kaydetmedenOnceAnlikGoruntu])

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

  const openFileInTab = useCallback(async (path: string, name: string, isMainFile: boolean, sketchFolderPath?: string) => {
    const zatenAcik = stateRef.current.sketch.tabs.some((t) => ayniDosyaMi(t.path, path))
    if (!zatenAcik) {
      const icerik = await window.api.sketch.readFile(path)
      dispatch({ type: 'sketch/tabOpened', path, name, content: icerik, isMainFile, sketchFolderPath })
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
    async (fileName: string, targetFolderPath?: string): Promise<SketchFile | null> => {
      const { info, workspaceSketches, activeSketchPath } = stateRef.current.sketch
      const folderToUse = targetFolderPath || activeSketchPath
      const hedefSketch =
        (folderToUse ? workspaceSketches.find((s) => ayniDosyaMi(s.folderPath, folderToUse)) : null) ||
        info
      if (!hedefSketch) return null
      try {
        const dosya = await window.api.sketch.addFile(hedefSketch.folderPath, fileName)
        const guncelDosyalar = await window.api.sketch.listFiles(hedefSketch.folderPath)
        dispatch({ type: 'sketch/filesRefreshed', files: guncelDosyalar, folderPath: hedefSketch.folderPath })
        await openFileInTab(dosya.path, dosya.name, dosya.isMainFile, hedefSketch.folderPath)
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
      const { info, workspaceSketches, activeSketchPath } = stateRef.current.sketch
      const hedefSketch =
        (activeSketchPath ? workspaceSketches.find((s) => ayniDosyaMi(s.folderPath, activeSketchPath)) : null) ||
        info
      if (!hedefSketch) {
        toastGoster('Dosya oluşturmak için açık bir sketch olmalı', 'hata')
        return null
      }
      try {
        const temizAd = fileName.trim()
        const mevcutDosya = hedefSketch.files.find((f) => f.name.toLowerCase() === temizAd.toLowerCase())
        let dosyaYolu = mevcutDosya?.path
        let isMain = mevcutDosya?.isMainFile ?? false

        if (!mevcutDosya) {
          const yeniDosya = await window.api.sketch.addFile(hedefSketch.folderPath, temizAd)
          dosyaYolu = yeniDosya.path
          isMain = yeniDosya.isMainFile
        }

        if (dosyaYolu) {
          await window.api.sketch.writeFile(dosyaYolu, content)
          const guncelDosyalar = await window.api.sketch.listFiles(hedefSketch.folderPath)
          dispatch({ type: 'sketch/filesRefreshed', files: guncelDosyalar, folderPath: hedefSketch.folderPath })

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
              isMainFile: isMain,
              sketchFolderPath: hedefSketch.folderPath
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

  /** Bağımsız kardeş bir sketch klasörü açar, ana .ino dosyasını oluşturur ve çalışma alanına ekler */
  const createSiblingSketchWithContent = useCallback(
    async (sketchName: string, content: string): Promise<SketchInfo | null> => {
      const { info, activeSketchPath, workspaceSketches } = stateRef.current.sketch
      const bazSketch =
        (activeSketchPath ? workspaceSketches.find((s) => ayniDosyaMi(s.folderPath, activeSketchPath)) : null) ||
        info
      if (!bazSketch) {
        toastGoster('Kardeş sketch oluşturmak için açık bir proje olmalı', 'hata')
        return null
      }
      try {
        const temizAd = sketchName.trim().replace(/\.ino$/i, '')
        const yeniSketch = await window.api.sketch.createSiblingSketch(bazSketch.folderPath, temizAd, content)
        dispatch({ type: 'sketch/workspaceSketchAdded', info: yeniSketch })
        dispatch({ type: 'sketch/activeSketchChanged', folderPath: yeniSketch.folderPath })

        // Yeni sketch'in ana dosyasını sekmede aç
        const anaDosya = yeniSketch.files.find((f) => f.isMainFile) || yeniSketch.files[0]
        if (anaDosya) {
          await openFileInTab(anaDosya.path, anaDosya.name, true, yeniSketch.folderPath)
        }

        toastGoster(`"${yeniSketch.name}" ayrı bir sketch klasörü olarak oluşturuldu ve çalışma alanına eklendi`, 'basari')
        return yeniSketch
      } catch (hata) {
        toastGoster(hata instanceof Error ? hata.message : 'Kardeş sketch oluşturulamadı', 'hata')
        return null
      }
    },
    [openFileInTab, toastGoster]
  )

  /** Mevcut çalışma alanına başka bir sketch projesi ekler */
  const addSketchToWorkspace = useCallback(
    async (info: SketchInfo) => {
      dispatch({ type: 'sketch/workspaceSketchAdded', info })
      dispatch({ type: 'sketch/activeSketchChanged', folderPath: info.folderPath })
      const anaDosya = info.files.find((f) => f.isMainFile) || info.files[0]
      if (anaDosya) {
        await openFileInTab(anaDosya.path, anaDosya.name, true, info.folderPath)
      }
      toastGoster(`"${info.name}" projeler arasına eklendi`, 'basari')
    },
    [openFileInTab, toastGoster]
  )

  /** Dosya seçici ile çalışma alanına yeni bir sketch projesi ekler */
  const addSketchToWorkspaceDialog = useCallback(async (): Promise<SketchInfo | null> => {
    try {
      const info = await window.api.sketch.openDialog()
      if (info) {
        await addSketchToWorkspace(info)
        return info
      }
      return null
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : 'Proje eklenemedi', 'hata')
      return null
    }
  }, [addSketchToWorkspace, toastGoster])

  /** Bir projeyi çalışma alanından kaldırır (diskten silmez) */
  const removeSketchFromWorkspace = useCallback(
    (folderPath: string) => {
      dispatch({ type: 'sketch/workspaceSketchRemoved', folderPath })
      toastGoster('Proje çalışma alanından kaldırıldı', 'bilgi')
    },
    [toastGoster]
  )

  /** Derleme ve yükleme için aktif olan hedef sketch'i belirler */
  const setActiveSketch = useCallback((folderPath: string) => {
    dispatch({ type: 'sketch/activeSketchChanged', folderPath })
  }, [])

  /** Yeni bir bağımsız uygulama penceresi açar */
  const openInNewWindow = useCallback(
    async (sketchPath?: string) => {
      try {
        await window.api.window.openNewWindow(sketchPath)
      } catch (hata) {
        toastGoster(hata instanceof Error ? hata.message : 'Yeni pencere açılamadı', 'hata')
      }
    },
    [toastGoster]
  )

  const deleteFile = useCallback(
    async (path: string, folderPath?: string) => {
      const { info, activeSketchPath } = stateRef.current.sketch
      const targetFolder = folderPath || klasorYoluAl(path) || activeSketchPath || info?.folderPath
      if (!targetFolder) return
      try {
        await window.api.sketch.deleteFile(path)
        dispatch({ type: 'sketch/tabClosed', path })
        const guncelDosyalar = await window.api.sketch.listFiles(targetFolder)
        dispatch({ type: 'sketch/filesRefreshed', files: guncelDosyalar, folderPath: targetFolder })

        // Silinen dosyadan sonra açık sekme kalmadıysa ana dosyayı otomatik aç
        const kalanTabs = stateRef.current.sketch.tabs.filter((t) => !ayniDosyaMi(t.path, path))
        if (kalanTabs.length === 0 && guncelDosyalar.length > 0) {
          const ana = guncelDosyalar.find((f) => f.isMainFile) || guncelDosyalar[0]
          if (ana) {
            await openFileInTab(ana.path, ana.name, ana.isMainFile, targetFolder)
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
    const { info, workspaceSketches, activeSketchPath } = stateRef.current.sketch
    const aktifSketch =
      (activeSketchPath ? workspaceSketches.find((s) => ayniDosyaMi(s.folderPath, activeSketchPath)) : null) ||
      info
    const selectedFqbn = efektifFqbnAl()
    if (!aktifSketch) return toastGoster('Önce bir sketch açın', 'hata')
    if (!selectedFqbn) return toastGoster('Önce bir kart seçin', 'hata')
    await saveAllTabs()
    const operationId = crypto.randomUUID()
    try {
      const sonuc = await window.api.arduinoCli.compile(aktifSketch.folderPath, selectedFqbn, operationId)
      dispatch({ type: 'build/compileResult', result: sonuc })
      toastGoster(
        sonuc.success ? `Derleme başarılı (${aktifSketch.name})` : `Derleme başarısız (${sonuc.errors.length} hata)`,
        sonuc.success ? 'basari' : 'hata'
      )
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : 'Derleme başarısız oldu', 'hata')
    }
  }, [saveAllTabs, toastGoster, efektifFqbnAl])

  const uploadActive = useCallback(async () => {
    const { info, workspaceSketches, activeSketchPath } = stateRef.current.sketch
    const aktifSketch =
      (activeSketchPath ? workspaceSketches.find((s) => ayniDosyaMi(s.folderPath, activeSketchPath)) : null) ||
      info
    const selectedFqbn = efektifFqbnAl()
    const { selectedPort } = stateRef.current.arduinoCli
    if (!aktifSketch) return toastGoster('Önce bir sketch açın', 'hata')
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
      const derlemeSonucu = await window.api.arduinoCli.compile(aktifSketch.folderPath, selectedFqbn, operationId)
      dispatch({ type: 'build/compileResult', result: derlemeSonucu })
      if (!derlemeSonucu.success) {
        toastGoster(`Derleme başarısız (${derlemeSonucu.errors.length} hata); yükleme yapılmadı`, 'hata')
        return
      }
      const sonuc = await window.api.arduinoCli.upload(aktifSketch.folderPath, selectedFqbn, selectedPort, operationId)
      dispatch({ type: 'build/uploadResult', result: sonuc })
      toastGoster(
        sonuc.success ? `Yükleme başarılı (${aktifSketch.name})` : `Yükleme başarısız: ${sonuc.topLevelError ?? ''}`,
        sonuc.success ? 'basari' : 'hata'
      )
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : 'Yükleme başarısız oldu', 'hata')
    }
  }, [saveAllTabs, toastGoster, efektifFqbnAl])

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

  const disconnectSerial = useCallback(async (port?: string) => {
    try {
      await window.api.serial.close(port)
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : 'Port kapatılamadı', 'hata')
    }
  }, [toastGoster])

  const writeSerial = useCallback(
    async (data: string, lineEnding: LineEnding, port?: string) => {
      try {
        await window.api.serial.write(data, lineEnding, port)
      } catch (hata) {
        toastGoster(hata instanceof Error ? hata.message : 'Veri gönderilemedi', 'hata')
      }
    },
    [toastGoster]
  )

  const clearSerial = useCallback((port?: string) => dispatch({ type: 'serial/cleared', port }), [])

  const value = useMemo<AppStateBaglami>(
    () => ({
      state,
      yenidenDenearduinoCli,
      setCliPath,
      browseForCliPath,
      refreshPlatforms,
      refreshPorts,
      selectFqbn,
      efektifFqbnAl,
      setBoardOption,
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
      aiYazimBitti,
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
      createSiblingSketchWithContent,
      addSketchToWorkspace,
      addSketchToWorkspaceDialog,
      removeSketchFromWorkspace,
      setActiveSketch,
      openInNewWindow,
      deleteFile,
      renameFile,
      updateFileContent,
      syncAgentChanges,
      reloadSketchFolders,
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
      efektifFqbnAl,
      setBoardOption,
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
      aiYazimBitti,
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
      createSiblingSketchWithContent,
      addSketchToWorkspace,
      addSketchToWorkspaceDialog,
      removeSketchFromWorkspace,
      setActiveSketch,
      openInNewWindow,
      deleteFile,
      renameFile,
      updateFileContent,
      syncAgentChanges,
      reloadSketchFolders,
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
