/**
 * Main, preload ve renderer arasında paylaşılan ortak tip tanımları.
 * Preload katmanının contextBridge ile expose ettiği API'nin tek doğruluk
 * kaynağı burasıdır. İleride eklenecek her yeni IPC yeteneği önce bu
 * dosyaya, sonra preload'a, sonra main'e eklenmelidir.
 *
 * NOT: Bu dosya renderer tarafında da import edildiği için burada
 * Node.js'e özgü tipler (örn. NodeJS.Platform) yerine taşınabilir
 * tipler kullanılır.
 */

/** Çalışılan işletim sistemi platformu */
export type PlatformName = 'win32' | 'darwin' | 'linux' | string

/** Uygulama geneli bilgi API'si (sürüm, platform vb.) */
export interface AppInfoAPI {
  /** package.json'daki uygulama sürümünü döner */
  getVersion: () => Promise<string>
  /** İşletim sistemi platform adı */
  platform: PlatformName
}

/**
 * Tüm IPC kanal adlarının toplandığı tek sabit nesne. Kanal adları hiçbir
 * yerde elle string olarak yazılmaz; hem main hem renderer bu sabitler
 * üzerinden haberleşir. Böylece bir kanal adı değiştiğinde TypeScript
 * derleyicisi tüm kullanım yerlerini yakalar.
 */
export const IPC_CHANNELS = {
  app: {
    getVersion: 'app:getVersion'
  },
  arduinoCli: {
    getStatus: 'arduinoCli:getStatus',
    browseForCliPath: 'arduinoCli:browseForCliPath',
    setCliPath: 'arduinoCli:setCliPath',
    getBoardManagerUrls: 'arduinoCli:getBoardManagerUrls',
    addBoardManagerUrl: 'arduinoCli:addBoardManagerUrl',
    removeBoardManagerUrl: 'arduinoCli:removeBoardManagerUrl',
    updateIndex: 'arduinoCli:updateIndex',
    listCores: 'arduinoCli:listCores',
    searchCores: 'arduinoCli:searchCores',
    installCore: 'arduinoCli:installCore',
    uninstallCore: 'arduinoCli:uninstallCore',
    listPorts: 'arduinoCli:listPorts',
    listAllBoards: 'arduinoCli:listAllBoards',
    listLibraries: 'arduinoCli:listLibraries',
    searchLibraries: 'arduinoCli:searchLibraries',
    installLibrary: 'arduinoCli:installLibrary',
    uninstallLibrary: 'arduinoCli:uninstallLibrary',
    listExamples: 'arduinoCli:listExamples',
    compile: 'arduinoCli:compile',
    upload: 'arduinoCli:upload',
    cancelOperation: 'arduinoCli:cancelOperation',
    onOperationEvent: 'arduinoCli:onOperationEvent',
    onBusyChanged: 'arduinoCli:onBusyChanged'
  },
  sketch: {
    createNew: 'sketch:createNew',
    openDialog: 'sketch:openDialog',
    saveAsDialog: 'sketch:saveAsDialog',
    openPath: 'sketch:openPath',
    readFile: 'sketch:readFile',
    writeFile: 'sketch:writeFile',
    listFiles: 'sketch:listFiles',
    addFile: 'sketch:addFile',
    deleteFile: 'sketch:deleteFile',
    renameFile: 'sketch:renameFile',
    getRecent: 'sketch:getRecent',
    getLastOpened: 'sketch:getLastOpened'
  },
  serial: {
    listPorts: 'serial:listPorts',
    open: 'serial:open',
    close: 'serial:close',
    write: 'serial:write',
    isOpen: 'serial:isOpen',
    onData: 'serial:onData',
    onStatusChanged: 'serial:onStatusChanged'
  },
  settings: {
    get: 'settings:get',
    set: 'settings:set'
  },
  secrets: {
    setApiKey: 'secrets:setApiKey',
    clearApiKey: 'secrets:clearApiKey',
    getConfiguredProviders: 'secrets:getConfiguredProviders'
  },
  chat: {
    getSessions: 'chat:getSessions',
    getSession: 'chat:getSession',
    createSession: 'chat:createSession',
    saveSession: 'chat:saveSession',
    deleteSession: 'chat:deleteSession',
    renameSession: 'chat:renameSession',
    clearSessions: 'chat:clearSessions',
    migrateSessions: 'chat:migrateSessions',
    sendAiMessage: 'chat:sendAiMessage',
    sendAiMessageStream: 'chat:sendAiMessageStream',
    onStreamChunk: 'chat:onStreamChunk',
    getProviderModels: 'chat:getProviderModels',
    compactSession: 'chat:compactSession'
  },
  skills: {
    getSkillsInfo: 'skills:getSkillsInfo',
    listCustomSkills: 'skills:listCustomSkills',
    addCustomSkill: 'skills:addCustomSkill',
    deleteCustomSkill: 'skills:deleteCustomSkill',
    reindexRag: 'skills:reindexRag',
    getSkillsDirectory: 'skills:getSkillsDirectory',
    openSkillsFolder: 'skills:openSkillsFolder',
    saveBoardModel: 'skills:saveBoardModel',
    addBoardModel: 'skills:addBoardModel',
    deleteBoardModel: 'skills:deleteBoardModel',
    resetBoardModel: 'skills:resetBoardModel'
  },
  window: {
    onCloseRequested: 'window:onCloseRequested',
    replyCloseRequest: 'window:replyCloseRequest'
  }
} as const

// ────────────────────────────────────────────────────────────────────────
// arduino-cli durum ve ortam
// ────────────────────────────────────────────────────────────────────────

/** arduino-cli bulunamadığında kullanıcıya gösterilecek resmi indirme sayfası */
export const ARDUINO_CLI_DOWNLOAD_URL = 'https://arduino.github.io/arduino-cli/latest/installation/'

/** arduino-cli ikili dosyasının bulunma durumu (uygulama bunsuz çökmemeli) */
export interface ArduinoCliStatus {
  found: boolean
  path: string | null
  version: string | null
  /** Bulunamadığında kullanıcıya gösterilecek açıklayıcı Türkçe mesaj */
  message?: string
}

// ────────────────────────────────────────────────────────────────────────
// Kart / port / çekirdek (core) / kütüphane
// ────────────────────────────────────────────────────────────────────────

export interface MatchingBoard {
  name: string
  fqbn?: string
}

/** `board list` çıktısındaki tek bir algılanan port */
export interface DetectedPort {
  address: string
  label: string
  protocol: string
  protocolLabel: string
  hardwareId?: string
  matchingBoards: MatchingBoard[]
}

/** Kurulu bir çekirdeğin sağladığı, seçilebilir tek bir kart */
export interface BoardOption {
  name: string
  fqbn: string
  platformId: string
  platformName: string
}

/** `core list` çıktısındaki tek bir kurulu/kurulabilir platform özeti */
export interface PlatformSummary {
  id: string
  name: string
  maintainer?: string
  installedVersion: string | null
  latestVersion: string | null
  boards: BoardOption[]
}

/** `core search` sonucundaki tek bir platform */
export interface PlatformSearchResult {
  id: string
  name: string
  maintainer?: string
  installed: boolean
  installedVersion: string | null
  latestVersion: string
  availableVersions: string[]
  boardNames: string[]
}

/** `lib list` çıktısındaki kurulu bir kütüphane */
export interface LibraryInfo {
  name: string
  version: string
  author?: string
  sentence?: string
  installDir: string
}

/** `lib search` sonucundaki tek bir kütüphane */
export interface LibrarySearchResult {
  name: string
  latestVersion: string
  availableVersions: string[]
  author?: string
  sentence?: string
  installed: boolean
  installedVersion: string | null
}

/** Bir kütüphane/çekirdek "examples" klasöründeki tek bir örnek sketch */
export interface ExampleItem {
  /** Kategori alt klasörü varsa "Kategori/OrnekAdi" biçiminde (bkz. Deneyap kütüphanesi) */
  name: string
  folderPath: string
}

/** Aynı kütüphaneye/çekirdeğe ait örneklerin gruplandığı yapı (Örnekler menüsü için) */
export interface ExampleGroup {
  /** Kütüphane adı ya da çekirdek-gömülü kütüphane adı */
  ownerName: string
  source: 'library' | 'core'
  /** source 'core' ise örneğin geldiği kart platformunun adı (ör. "Deneyap Kart") */
  coreName?: string
  examples: ExampleItem[]
}

// ────────────────────────────────────────────────────────────────────────
// Uzun süren işlemler için ilerleme akışı
// ────────────────────────────────────────────────────────────────────────

export type ArduinoOperationKind =
  | 'updateIndex'
  | 'installCore'
  | 'uninstallCore'
  | 'installLibrary'
  | 'uninstallLibrary'
  | 'compile'
  | 'upload'

export type ArduinoOperationPhase = 'basladi' | 'log' | 'tamamlandi' | 'basarisiz' | 'iptalEdildi'

/**
 * Main process'ten renderer'a stream edilen ilerleme olayı.
 * NOT: arduino-cli --format json modunda çoğu komut sonuçlarını tek bir
 * bloğun içinde döner (satır satır ilerleme metni vermez); bu yüzden
 * 'log' aşaması yalnızca gerçekten stdout/stderr'e bir şey yazıldığında
 * üretilir. 'basladi'/'tamamlandi'/'basarisiz' aşamaları her zaman gelir.
 */
export interface ArduinoOperationEvent {
  operationId: string
  kind: ArduinoOperationKind
  phase: ArduinoOperationPhase
  message?: string
}

// ────────────────────────────────────────────────────────────────────────
// Derleme / yükleme sonuçları
// ────────────────────────────────────────────────────────────────────────

/**
 * Tek bir derleyici hata/uyarısının yapılandırılmış hâli. Problems paneli,
 * Monaco marker'ları ve üst çubuktaki sayaç bu yapıyı kullanır. v0.2'de
 * AI agent'a bağlam olarak doğrudan bu yapı gönderileceği için alan
 * adları sabit ve eksiksiz tutulmalıdır.
 */
export interface DerlemeHatasi {
  dosya: string
  satir: number
  sutun: number
  tur: 'error' | 'warning' | 'note'
  mesaj: string
  hamMetin: string
  baglam?: string[]
}

export interface CompileResult {
  success: boolean
  errors: DerlemeHatasi[]
  /** compiler_out + compiler_err ham metni; Çıktı paneline yazılır */
  log: string
  /** Diagnostics'e düşmeyen üst seviye hata (ör. kart platformu kurulu değil) */
  topLevelError?: string
}

export interface UploadResult {
  success: boolean
  log: string
  topLevelError?: string
}

// ────────────────────────────────────────────────────────────────────────
// Sketch ve dosya yönetimi
// ────────────────────────────────────────────────────────────────────────

export type SketchFileKind = 'ino' | 'h' | 'hpp' | 'cpp' | 'c' | 'other'

export interface SketchFile {
  path: string
  name: string
  kind: SketchFileKind
  /** Sketch klasörüyle aynı isimdeki ana .ino dosyası mı */
  isMainFile: boolean
}

export interface SketchInfo {
  folderPath: string
  name: string
  files: SketchFile[]
}

// ────────────────────────────────────────────────────────────────────────
// Seri port / seri monitör
// ────────────────────────────────────────────────────────────────────────

export type LineEnding = 'none' | 'nl' | 'cr' | 'nlcr'

/** Seri monitörde ve üst çubukta sunulan sabit baud hızı seçenekleri */
export const BAUD_RATES = [9600, 19200, 38400, 57600, 74880, 115200, 230400, 460800, 921600] as const
export type BaudRate = (typeof BAUD_RATES)[number]
export const DEFAULT_BAUD_RATE: BaudRate = 115200

export interface SerialPortInfo {
  path: string
  manufacturer?: string
  vendorId?: string
  productId?: string
}

export interface SerialDataChunk {
  data: string
  timestamp: number
}

export interface SerialStatus {
  open: boolean
  port: string | null
  baud: number | null
  /** true ise upload sırasında DeviceLock tarafından geçici olarak kapatıldı demektir */
  temporarilyClosedForUpload: boolean
}

// ────────────────────────────────────────────────────────────────────────
// Yapay zekâ sağlayıcıları (v0.2 AI agent altyapısı için API anahtarı yönetimi)
// ────────────────────────────────────────────────────────────────────────

/** İlk aşamada desteklenen AI sağlayıcıları; yenisi eklendiğinde yalnızca bu listeye eklenir */
export const AI_PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic (Claude)' },
  { id: 'gemini', name: 'Google Gemini' },
  { id: 'kimi', name: 'Kimi AI (Moonshot)' },
  { id: 'nvidia', name: 'NVIDIA Build (NIM)' },
  { id: 'lmstudio', name: 'LM Studio (Yerel / Local)' }
] as const

export type AIProviderId = (typeof AI_PROVIDERS)[number]['id']

/** Her yapay zekâ sağlayıcısı için varsayılan yaklaşık bağlam (context window) token sınırları */
export const PROVIDER_DEFAULT_CONTEXT_LIMITS: Record<AIProviderId, number> = {
  gemini: 1_000_000,
  openai: 1_000_000,
  anthropic: 1_000_000,
  deepseek: 1_000_000,
  kimi: 1_000_000,
  nvidia: 128_000,
  lmstudio: 16_000
}

/** Kullanıcının NVIDIA ve LM Studio için seçebileceği hazır bağlam seçenekleri */
export const ADJUSTABLE_CONTEXT_PRESETS = [
  { value: 4_000, label: '4k' },
  { value: 8_000, label: '8k' },
  { value: 16_000, label: '16k' },
  { value: 32_000, label: '32k' },
  { value: 64_000, label: '64k' },
  { value: 128_000, label: '128k' },
  { value: 256_000, label: '256k' },
  { value: 512_000, label: '512k' },
  { value: 1_000_000, label: '1M' },
  { value: 2_000_000, label: '2M' }
] as const

/**
 * Model veya sağlayıcıya göre bağlam sınırını tespit eder.
 * Kural: NVIDIA ve LM Studio dışındaki tüm modeller 1M kabul edilir.
 * NVIDIA ve LM Studio ise kullanıcı tarafından serbestçe ayarlanabilir.
 */
export function getModelContextLimit(
  provider: AIProviderId,
  model?: string,
  customLimits?: Partial<Record<AIProviderId, number>>
): number {
  // 1. Kullanıcı tarafından belirlenmiş özel limit (özellikle nvidia ve lmstudio için)
  if (customLimits && customLimits[provider]) {
    return customLimits[provider]!
  }

  // 2. NVIDIA ve LM Studio haricindeki tüm sağlayıcılar doğrudan 1 Milyon (1M) token
  if (provider !== 'nvidia' && provider !== 'lmstudio') {
    return 1_000_000
  }

  // 3. NVIDIA veya LM Studio için model adında belirtilmiş özel boyut varsa
  if (model) {
    const m = model.toLowerCase()
    if (m.includes('2m') || m.includes('2000k')) return 2_000_000
    if (m.includes('1m') || m.includes('1000k') || m.includes('1024k')) return 1_000_000
    if (m.includes('256k')) return 256_000
    if (m.includes('200k')) return 200_000
    if (m.includes('128k')) return 128_000
    if (m.includes('64k')) return 64_000
    if (m.includes('32k')) return 32_000
    if (m.includes('16k')) return 16_000
    if (m.includes('8k')) return 8_000
    if (m.includes('4k')) return 4_000
  }

  // 4. Varsayılanlar: nvidia -> 128_000, lmstudio -> 16_000
  return PROVIDER_DEFAULT_CONTEXT_LIMITS[provider] || 128_000
}

/**
 * Metin veya kod için hızlı, sıfır-bağımlılıklı yaklaşık token sayacı.
 * C++ kodu, Markdown ve Türkçe/İngilizce karma metinlerde ortalama 3.8 karakter ~ 1 token'dır.
 */
export function estimateTokens(text?: string | null): number {
  if (!text) return 0
  return Math.ceil(text.length / 3.8)
}


// ────────────────────────────────────────────────────────────────────────
// Editör görünüm ayarları
// ────────────────────────────────────────────────────────────────────────

export const EDITOR_TEMALARI = [
  { id: 'vs-dark', label: 'Koyu (Varsayılan)' },
  { id: 'vs', label: 'Açık' },
  { id: 'hc-black', label: 'Yüksek Kontrast (Koyu)' },
  { id: 'hc-light', label: 'Yüksek Kontrast (Açık)' }
] as const

export type EditorTemasi = (typeof EDITOR_TEMALARI)[number]['id']

export const DEFAULT_EDITOR_FONT_SIZE = 13
export const DEFAULT_EDITOR_THEME: EditorTemasi = 'vs-dark'

// ────────────────────────────────────────────────────────────────────────
// Ayarlar (electron-store)
// ────────────────────────────────────────────────────────────────────────

/** Ön tanımlı ek kart yöneticisi (board manager) URL'leri */
export const DEFAULT_BOARD_MANAGER_URLS = [
  'https://espressif.github.io/arduino-esp32/package_esp32_index.json',
  'https://raw.githubusercontent.com/deneyapkart/deneyapkart-arduino-core/master/package_deneyapkart_index.json'
] as const

export type ReasoningEffort = 'low' | 'medium' | 'high'

export interface AppSettings {
  arduinoCliPath: string | null
  boardManagerUrls: string[]
  selectedFqbn: string | null
  selectedPort: string | null
  selectedBaud: BaudRate
  recentSketches: string[]
  lastOpenedSketch: string | null
  editorFontSize: number
  editorTheme: EditorTemasi
  /** Yapay Zekâ ayarlarında seçili duran sağlayıcı */
  selectedAiProvider: AIProviderId | null
  /** Her sağlayıcı için seçilmiş olan model adı */
  selectedModelPerProvider?: Partial<Record<AIProviderId, string>>
  /** Model muhakeme derecesi: Düşük (hızlı), Orta (dengeli), Yüksek (derinlemesine) */
  selectedReasoningEffort?: ReasoningEffort
  /** Kullanıcı tanımlı özel bağlam sınırları (özellikle LM Studio ve NVIDIA için) */
  customContextLimits?: Partial<Record<AIProviderId, number>>
}

// ────────────────────────────────────────────────────────────────────────
// Preload API yüzeyi
// ────────────────────────────────────────────────────────────────────────

export interface ArduinoCliAPI {
  getStatus: () => Promise<ArduinoCliStatus>
  browseForCliPath: () => Promise<string | null>
  setCliPath: (path: string) => Promise<ArduinoCliStatus>
  getBoardManagerUrls: () => Promise<string[]>
  addBoardManagerUrl: (url: string) => Promise<string[]>
  removeBoardManagerUrl: (url: string) => Promise<string[]>
  updateIndex: () => Promise<void>
  listCores: () => Promise<PlatformSummary[]>
  searchCores: (query: string) => Promise<PlatformSearchResult[]>
  installCore: (id: string, operationId: string) => Promise<void>
  uninstallCore: (id: string) => Promise<void>
  listPorts: () => Promise<DetectedPort[]>
  listAllBoards: () => Promise<BoardOption[]>
  listLibraries: (force?: boolean) => Promise<LibraryInfo[]>
  searchLibraries: (query: string) => Promise<LibrarySearchResult[]>
  installLibrary: (name: string, version: string | undefined, operationId: string) => Promise<void>
  uninstallLibrary: (name: string) => Promise<void>
  listExamples: () => Promise<ExampleGroup[]>
  compile: (sketchPath: string, fqbn: string, operationId: string) => Promise<CompileResult>
  upload: (sketchPath: string, fqbn: string, port: string, operationId: string) => Promise<UploadResult>
  cancelOperation: (operationId: string) => Promise<boolean>
  onOperationEvent: (listener: (event: ArduinoOperationEvent) => void) => () => void
  onBusyChanged: (listener: (meşgul: boolean) => void) => () => void
}

export interface SketchAPI {
  /** İsim verilmezse Arduino IDE geleneğine uygun otomatik bir isim üretilir (sketch_20260802a gibi) */
  createNew: (name?: string) => Promise<SketchInfo>
  openDialog: () => Promise<SketchInfo | null>
  /** Diyalog açmadan, bilinen bir klasör yolunu sketch olarak açar (ör. Örnekler menüsünden) */
  openPath: (folderPath: string) => Promise<SketchInfo>
  saveAsDialog: (currentFolderPath: string) => Promise<SketchInfo | null>
  readFile: (filePath: string) => Promise<string>
  writeFile: (filePath: string, content: string) => Promise<void>
  listFiles: (folderPath: string) => Promise<SketchFile[]>
  addFile: (folderPath: string, fileName: string) => Promise<SketchFile>
  deleteFile: (filePath: string) => Promise<void>
  renameFile: (filePath: string, newName: string) => Promise<SketchFile>
  getRecent: () => Promise<string[]>
  getLastOpened: () => Promise<SketchInfo | null>
}

export interface SerialAPI {
  listPorts: () => Promise<SerialPortInfo[]>
  open: (port: string, baud: number) => Promise<void>
  close: () => Promise<void>
  write: (data: string, lineEnding: LineEnding) => Promise<void>
  isOpen: () => Promise<boolean>
  onData: (listener: (chunk: SerialDataChunk) => void) => () => void
  onStatusChanged: (listener: (status: SerialStatus) => void) => () => void
}

export interface SettingsAPI {
  get: () => Promise<AppSettings>
  set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<AppSettings>
}

/**
 * API anahtarlarını yönetir. Bilinçli olarak "getApiKey" YOKTUR — anahtar
 * bir kez kaydedildikten sonra renderer'a asla geri gönderilmez (yalnızca
 * hangi sağlayıcıların ayarlı olduğu, boolean/liste olarak döner). Anahtar
 * `electron.safeStorage` ile işletim sistemi düzeyinde şifrelenip diskte
 * saklanır (bkz. SecretsService.ts).
 */
export interface SecretsAPI {
  setApiKey: (provider: AIProviderId, apiKey: string) => Promise<void>
  clearApiKey: (provider: AIProviderId) => Promise<void>
  getConfiguredProviders: () => Promise<AIProviderId[]>
}

// ────────────────────────────────────────────────────────────────────────
// AI Sohbet Geçmişi ve Oturumlar (Proje / Sketch Bazlı)
// ────────────────────────────────────────────────────────────────────────

export interface AgentActionItem {
  type: 'replace_selection' | 'replace_file' | 'create_file'
  filename?: string
  rename?: string
  summary: string
  linesCount: number
  applied: boolean
  targetRange?: { startLine: number; endLine: number }
}

export interface ChatMessage {
  id: string
  rol: 'kullanici' | 'asistan'
  metin: string
  timestamp: number
  /** Opsiyonel: Mesajın hata bildirimi olup olmadığı */
  isError?: boolean
  /** Opsiyonel: Mesajın AI tarafından oluşturulmuş sıkıştırılmış hafıza özeti olup olmadığı */
  isCompactedSummary?: boolean
  /** Opsiyonel: AI Agent eylemi (kod editöre uygulandığında özet ve işlem bilgisi) */
  agentAction?: AgentActionItem
  /** Opsiyonel: Çoklu dosya eylemleri (örn. Alıcı ve Verici için hem ana dosya hem ek dosya oluşturma) */
  agentActions?: AgentActionItem[]
}

export interface ChatSession {
  id: string
  sketchPath: string
  sketchName: string
  baslik: string
  olusturmaTarihi: number
  guncellemeTarihi: number
  mesajlar: ChatMessage[]
}

export interface ChatSessionSummary {
  id: string
  sketchPath: string
  sketchName: string
  baslik: string
  olusturmaTarihi: number
  guncellemeTarihi: number
  mesajSayisi: number
  sonMesaj?: string
}

export interface CustomSkill {
  id: string
  title: string
  boardFamily: string // 'general' | 'deneyap' | 'esp32' | 'avr' | 'rp2040' | 'stm32' veya özel
  type: 'snippet' | 'rule' // 'snippet': RAG kod referansı, 'rule': LLM mimari davranış kuralı
  content: string
  fileName?: string // örn: 'deneyap-imu.md'
  filePath?: string // tam dosya yolu
  description?: string
  createdAt: number
  updatedAt: number
}

export interface BoardModelVariant {
  id: string
  name: string
  fqbnMatch?: string[]
  architecture?: string
  voltage?: string
  clockSpeed?: string
  flashRam?: string
  features: string[]
  pins: string[]
  rules?: string[]
  isCustom?: boolean
}

export interface BoardProfileInfo {
  family: string
  name: string
  architecture: string
  voltage: string
  clockSpeed: string
  flashRam: string
  features: string[]
  pins: string[]
  libraries: string[]
  rules: string[]
  models: BoardModelVariant[]
  selectedModelId?: string
  isCustom?: boolean
}

export interface RagStatusInfo {
  modelLoaded: boolean
  modelName: string
  totalChunks: number
  isIndexing: boolean
  storePath: string
}

export interface RagChunkSummary {
  id: string
  title: string
  sourceOwner: string
  sourceFile: string
  boardFamily?: string
  content: string
  isCustom?: boolean
}

export interface SkillsInfoResult {
  rag: RagStatusInfo
  boardProfiles: BoardProfileInfo[]
  activeBoardFamily: string
  chunks: RagChunkSummary[]
}

export interface StreamChunkEvent {
  streamId: string
  chunk: string
  reasoningChunk?: string
  done: boolean
  error?: string
}

export interface SendAiMessageParams {
  streamId?: string
  provider: AIProviderId
  model?: string
  reasoningEffort?: ReasoningEffort
  forceCompaction?: boolean
  messages: Array<{ rol: 'kullanici' | 'asistan' | 'sistem'; metin: string }>
  activeCodeContext?: {
    filePath: string
    fileName: string
    content: string
    selectedCode?: string
    selectionRange?: {
      startLine: number
      endLine: number
      startColumn?: number
      endColumn?: number
    }
    boardContext?: {
      name?: string
      fqbn?: string
      platformName?: string
      platformId?: string
    }
    sketchName?: string
    projectFiles?: Array<{
      name: string
      path: string
      isMainFile: boolean
      content?: string
    }>
  }
}

export interface SendAiMessageResult {
  success: boolean
  replyText?: string
  error?: string
}

export interface ChatAPI {
  getSessions: (sketchPath: string) => Promise<ChatSessionSummary[]>
  getSession: (sessionId: string) => Promise<ChatSession | null>
  createSession: (sketchPath: string, sketchName: string, baslik?: string) => Promise<ChatSession>
  saveSession: (session: ChatSession) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  renameSession: (sessionId: string, yeniBaslik: string) => Promise<void>
  clearSessions: (sketchPath: string) => Promise<void>
  migrateSessions: (oldSketchPath: string, newSketchPath: string, newSketchName: string) => Promise<void>
  sendAiMessage: (params: SendAiMessageParams) => Promise<SendAiMessageResult>
  sendAiMessageStream: (params: SendAiMessageParams) => Promise<string>
  onStreamChunk: (listener: (event: StreamChunkEvent) => void) => () => void
  getProviderModels: (provider: AIProviderId) => Promise<string[]>
  compactSession: (params: {
    sessionId: string
    provider: AIProviderId
    model?: string
  }) => Promise<{ success: boolean; session?: ChatSession; error?: string }>
}

export interface SkillsAPI {
  getSkillsInfo: (boardContext?: { fqbn?: string; name?: string }) => Promise<SkillsInfoResult>
  listCustomSkills: () => Promise<CustomSkill[]>
  addCustomSkill: (skill: Omit<CustomSkill, 'id' | 'createdAt' | 'updatedAt' | 'filePath' | 'fileName'>) => Promise<CustomSkill>
  deleteCustomSkill: (id: string) => Promise<boolean>
  reindexRag: () => Promise<{ newChunks: number; totalChunks: number }>
  getSkillsDirectory: () => Promise<string>
  openSkillsFolder: () => Promise<boolean>
  saveBoardModel: (family: string, model: BoardModelVariant) => Promise<boolean>
  addBoardModel: (family: string, model: BoardModelVariant) => Promise<boolean>
  deleteBoardModel: (family: string, modelId: string) => Promise<boolean>
  resetBoardModel: (family: string, modelId?: string) => Promise<boolean>
}

export interface WindowAPI {
  /** Pencere kapatılmak isteniyor ve kaydedilmemiş dosyalar var; renderer'dan karar bekleniyor */
  onCloseRequested: (listener: () => void) => () => void
  /** Renderer'ın kapatma isteğine verdiği cevap: true ise kapatmaya devam et */
  replyCloseRequest: (proceed: boolean) => void
}

/** Renderer'a preload üzerinden expose edilen tüm API'lerin birleşimi */
export interface DretAPI {
  app: AppInfoAPI
  arduinoCli: ArduinoCliAPI
  sketch: SketchAPI
  serial: SerialAPI
  settings: SettingsAPI
  secrets: SecretsAPI
  chat: ChatAPI
  skills: SkillsAPI
  window: WindowAPI
}

