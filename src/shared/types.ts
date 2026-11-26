import { isCustomProvider, type CustomAIProvider, type CustomAIProviderId } from './ozelSaglayici'

export * from './ozelSaglayici'

import type { SistemBilgisi, TemizlemeBaglami } from './tanilama'
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
    getLibrarySymbols: 'arduinoCli:getLibrarySymbols',
    searchLibraries: 'arduinoCli:searchLibraries',
    installLibrary: 'arduinoCli:installLibrary',
    suggestLibrary: 'arduinoCli:suggestLibrary',
    listUpdatableLibraries: 'arduinoCli:listUpdatableLibraries',
    getBoardOptions: 'arduinoCli:getBoardOptions',
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
    createFromTemplate: 'sketch:createFromTemplate',
    createSiblingSketch: 'sketch:createSiblingSketch',
    getInitialSketchPath: 'sketch:getInitialSketchPath',
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
  diagnostics: {
    collect: 'diagnostics:collect',
    saveReport: 'diagnostics:saveReport',
    openIssue: 'diagnostics:openIssue'
  },
  updater: {
    getStatus: 'updater:getStatus',
    check: 'updater:check',
    download: 'updater:download',
    install: 'updater:install',
    openReleases: 'updater:openReleases',
    onStatus: 'updater:onStatus'
  },
  history: {
    status: 'history:status',
    list: 'history:list',
    diff: 'history:diff',
    commit: 'history:commit',
    restore: 'history:restore',
    tag: 'history:tag',
    untag: 'history:untag',
    createBranch: 'history:createBranch',
    checkout: 'history:checkout',
    deleteBranch: 'history:deleteBranch',
    exportPackage: 'history:exportPackage',
    importPackage: 'history:importPackage'
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
    getProviderModels: 'chat:getProviderModels',
    compactSession: 'chat:compactSession',
    generateTitle: 'chat:generateTitle'
  },
  agent: {
    run: 'agent:run',
    abort: 'agent:abort',
    reply: 'agent:reply',
    undo: 'agent:undo',
    onEvent: 'agent:onEvent',
    testProvider: 'agent:testProvider'
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
    replyCloseRequest: 'window:replyCloseRequest',
    /** Renderer kapatma isteğini aldığını hemen bildirir (cevap kullanıcı onayına kadar gecikebilir) */
    closeRequestReceived: 'window:closeRequestReceived',
    openNewWindow: 'window:openNewWindow'
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
  /** USB bilgileri (serialport listesinden eklenir; dahili ve Bluetooth portlarında kimlik yoktur) */
  vendorId?: string
  productId?: string
  pnpId?: string
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

/** Kütüphane başlık dosyasından çıkarılan tekil fonksiyon, metot veya yapıcı sembolü */
export interface KutuphaneUyeSembolu {
  ad: string
  sinif?: string
  donusTipi: string
  parametreler: string
  imza: string
  kurucu?: boolean
}

/** Kurulu tek bir Arduino kütüphanesinin çevrimdışı IntelliSense sembol kaydı */
export interface KutuphaneSembolKaydi {
  kutuphane: string
  surum: string
  aciklama?: string
  basliklar: string[]
  siniflar: string[]
  uyeler: KutuphaneUyeSembolu[]
  sabitler: string[]
  anahtarKelimeler: string[]
}

/** Tüm kurulu kütüphanelerden derlenmiş çevrimdışı sembol indeksi */
export interface KutuphaneSembolIndeksi {
  olusturulmaZamani: number
  kutuphaneler: KutuphaneSembolKaydi[]
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
  /** Başarılı derlemede flash/RAM kullanımı */
  boyut?: BuildSize
}

/** Kartın bir ayar seçeneği (arduino-cli "config_options"): ör. Processor, Partition Scheme */
export interface BoardConfigOption {
  option: string
  label: string
  values: Array<{ value: string; label: string }>
  /** Kart paketinin varsayılan değeri */
  varsayilan: string
}

/** Güncellenebilir bir kütüphane: kurulu sürüm ve en son sürüm */
export interface LibraryUpdateInfo {
  name: string
  installed: string
  latest: string
}

/** Eksik başlık için öneri sonucu: kütüphane adayları ya da başlığın kart paketiyle geldiği bilgisi */
export interface LibrarySuggestionResult {
  header: string
  adaylar: LibrarySearchResult[]
  /** Başlık kart paketinin parçasıysa true: kütüphane değil, kart paketi/seçili kart kontrol edilmeli */
  kartPaketiBasligi: boolean
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
  pnpId?: string
}

export interface SerialDataChunk {
  data: string
  timestamp: number
  /** Satırın geldiği port */
  port: string
}

export interface SerialStatus {
  /** En az bir port açık mı */
  open: boolean
  /** Birincil (en son açılan) port */
  port: string | null
  baud: number | null
  /** Şu an açık olan tüm portlar (açılış sırasıyla) */
  portlar: Array<{ port: string; baud: number }>
  /** true ise upload sırasında DeviceLock tarafından geçici olarak kapatıldı demektir */
  temporarilyClosedForUpload: boolean
}

// ────────────────────────────────────────────────────────────────────────
// Yapay zekâ sağlayıcıları (v0.2 AI agent altyapısı için API anahtarı yönetimi)
// ────────────────────────────────────────────────────────────────────────

/** Desteklenen AI sağlayıcıları; yenisi eklendiğinde yalnızca bu listeye eklenir */
export const AI_PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic (Claude)' },
  { id: 'gemini', name: 'Google Gemini' },
  { id: 'kimi', name: 'Kimi AI (Moonshot)' },
  { id: 'nvidia', name: 'NVIDIA Build (NIM)' },
  { id: 'lmstudio', name: 'LM Studio (Yerel / Local)' },
  { id: 'ollama', name: 'Ollama (Yerel / Local)' }
] as const

export type BuiltinAIProviderId = (typeof AI_PROVIDERS)[number]['id']

/** Hazır sağlayıcılar ve kullanıcının eklediği özel sağlayıcılar */
export type AIProviderId = BuiltinAIProviderId | CustomAIProviderId

export function isValidProviderId(v: unknown): v is AIProviderId {
  return isCustomProvider(v) || AI_PROVIDERS.some((p) => p.id === v)
}

/** Seçim listeleri için hazır ve özel sağlayıcılar */
export function providerList(custom?: readonly CustomAIProvider[]): Array<{ id: AIProviderId; name: string }> {
  return [...AI_PROVIDERS, ...(custom ?? [])]
}

/** Bağlam sınırını kullanıcının seçebildiği sağlayıcılar */
export function isContextAdjustable(provider: AIProviderId): boolean {
  return provider === 'nvidia' || provider === 'lmstudio' || isCustomProvider(provider)
}

/** Yerel çalışan (internete çıkmayan) sağlayıcılar */
export const LOCAL_AI_PROVIDERS: readonly AIProviderId[] = ['lmstudio', 'ollama']

export function isLocalProvider(provider: AIProviderId): boolean {
  return LOCAL_AI_PROVIDERS.includes(provider)
}

/** Her yapay zekâ sağlayıcısı için varsayılan yaklaşık bağlam (context window) token sınırları */
export const PROVIDER_DEFAULT_CONTEXT_LIMITS: Record<BuiltinAIProviderId, number> = {
  gemini: 1_000_000,
  openai: 1_000_000,
  anthropic: 1_000_000,
  deepseek: 1_000_000,
  kimi: 1_000_000,
  nvidia: 128_000,
  lmstudio: 16_000,
  ollama: 16_000
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

  // 2. NVIDIA ve yerel sağlayıcılar haricindeki tüm sağlayıcılar doğrudan 1 Milyon (1M) token
  if (provider !== 'nvidia' && !isLocalProvider(provider) && !isCustomProvider(provider)) {
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
  return isCustomProvider(provider) ? 128_000 : PROVIDER_DEFAULT_CONTEXT_LIMITS[provider] || 128_000
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

/** Agent'ın dosya değiştirme yetki modu */
export type AgentPermissionMode = 'ask' | 'auto-edit' | 'full-auto'

/** Yerel modellerde araç çağırma biçimi: otomatik algıla, yerel (native) tool-calling ya da metin protokolü */
export type LocalToolMode = 'auto' | 'native' | 'text'

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
  /** Kullanıcı tanımlı özel bağlam sınırları (özellikle yerel sağlayıcılar ve NVIDIA için) */
  customContextLimits?: Partial<Record<AIProviderId, number>>
  /** Yerel sağlayıcılar (LM Studio / Ollama) için sunucu adresi; API anahtarı alanından ayrıdır */
  aiBaseUrls?: Partial<Record<AIProviderId, string>>
  /** Kullanıcının eklediği OpenAI uyumlu sağlayıcılar */
  customAiProviders?: CustomAIProvider[]
  /** Agent izin modu (varsayılan: auto-edit) */
  agentPermissionMode?: AgentPermissionMode
  /** Agent dosya değiştirdikten sonra derleyip hataları otomatik düzeltsin mi (varsayılan: açık) */
  agentAutoCompile?: boolean
  /** Yerel modeller için araç çağırma modu (varsayılan: auto) */
  localToolMode?: LocalToolMode
  /** Kaydederken ve yapay zekâ çalışmasından önce otomatik anlık görüntü al (varsayılan: açık) */
  historyAutoSnapshot?: boolean
  /** Saklanacak en fazla otomatik anlık görüntü sayısı (varsayılan: 50) */
  historyMaxAuto?: number
  /** Yeni sürüm olup olmadığını arka planda denetle (varsayılan: açık) */
  autoUpdateCheck?: boolean
  /** Kart başına seçili seçenekler: temel FQBN → { seçenek: değer } */
  boardOptions?: Record<string, Record<string, string>>
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
  /** Kurulu kütüphanelerin başlıklarından çıkarılan çevrimdışı IntelliSense sembollerini döner */
  getLibrarySymbols: (force?: boolean) => Promise<KutuphaneSembolIndeksi>
  searchLibraries: (query: string) => Promise<LibrarySearchResult[]>
  installLibrary: (name: string, version: string | undefined, operationId: string) => Promise<void>
  /** Kartın ayarlanabilir seçenekleri (işlemci, bölüm şeması, yükleme hızı…); kart paketi kuruluysa dolu döner */
  getBoardOptions: (fqbn: string) => Promise<BoardConfigOption[]>
  /** Kurulu olup daha yeni sürümü çıkmış kütüphaneler (ağ yoksa boş liste) */
  listUpdatableLibraries: (force?: boolean) => Promise<LibraryUpdateInfo[]>
  /** Eksik bir başlık dosyası (ör. Servo.h) için kurulabilecek kütüphane önerileri */
  suggestLibrary: (header: string) => Promise<LibrarySuggestionResult>
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
  /** Verilen kodla yeni proje oluşturur; ad çakışırsa _2, _3… eklenir */
  createFromTemplate: (name: string, code: string) => Promise<SketchInfo>
  /** Mevcut sketch'in yanında bağımsız bir kardeş sketch (ayrı klasör + .ino) oluşturur */
  createSiblingSketch: (baseFolderPath: string, sketchName: string, initialCode?: string) => Promise<SketchInfo>
  /** Pencere açılırken aktarılan başlangıç sketch yolunu döner (yoksa null) */
  getInitialSketchPath: () => Promise<string | null>
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
  /** Port verilmezse birincil (en son açılan) port kapatılır */
  close: (port?: string) => Promise<void>
  /** Port verilmezse birincil porta yazılır */
  write: (data: string, lineEnding: LineEnding, port?: string) => Promise<void>
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
  type: 'replace_selection' | 'replace_file' | 'create_file' | 'create_sketch'
  filename?: string
  sketchName?: string
  folderPath?: string
  rename?: string
  summary: string
  linesCount: number
  applied: boolean
  code?: string
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
  /** Opsiyonel: Agent'ın bu yanıt için attığı araç adımları (okuma, yazma, derleme vb.) */
  toolSteps?: AgentToolStep[]
  /** Opsiyonel: Bu yanıttaki dosya değişikliklerini geri almak için checkpoint kimliği */
  checkpointId?: string
  /** Opsiyonel: Checkpoint geri alındı mı */
  undone?: boolean
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

// ────────────────────────────────────────────────────────────────────────
// Cloud AI Agent (araç döngülü, main process'te çalışır)
// ────────────────────────────────────────────────────────────────────────

/** Agent'ın attığı tek bir araç adımının kalıcı özeti (sohbet geçmişinde saklanır) */
export interface AgentToolStep {
  callId: string
  name: string
  label: string
  ok: boolean
  detail?: string
}

export interface AgentPlanItem {
  text: string
  done: boolean
}

/** Agent'ın disk üzerinde yaptığı bir değişiklik; renderer editor/sekmeleri bununla senkronlar */
export interface AgentChangeItem {
  kind:
    | 'create_file'
    | 'write_file'
    | 'delete_file'
    | 'rename_file'
    | 'create_sketch'
    | 'delete_sketch'
    | 'rename_sketch'
  /** Dosya mutlak yolu (sketch işlemlerinde sketch klasörü yolu) */
  path: string
  oldPath?: string
  sketchPath: string
  sketchName: string
  fileName?: string
  linesCount?: number
  summary?: string
  /** Dosya yazıldıysa yeni içerik (sekmeyi anlık güncellemek için) */
  content?: string
}

export interface AgentRunParams {
  runId: string
  provider: AIProviderId
  model?: string
  reasoningEffort?: ReasoningEffort
  /** Sohbet geçmişi; son eleman kullanıcının yeni isteğidir */
  messages: Array<{ rol: 'kullanici' | 'asistan'; metin: string }>
  workspace: {
    activeSketchPath: string | null
    sketchPaths: string[]
    activeFilePath?: string
    selection?: { filePath: string; startLine: number; endLine: number; text: string }
  }
  board?: { name?: string; fqbn?: string; platformName?: string; platformId?: string }
  port?: string | null
  /** Kullanıcının seçtiği bağlam penceresi (yerel modellerde num_ctx için) */
  contextWindow?: number
  autoCompile?: boolean
}

export type AgentEvent =
  | { runId: string; type: 'text'; delta: string }
  | { runId: string; type: 'reasoning'; delta: string }
  | { runId: string; type: 'status'; message: string; warning?: boolean }
  | { runId: string; type: 'tool_start'; callId: string; name: string; label: string }
  | { runId: string; type: 'tool_end'; callId: string; name: string; ok: boolean; label: string; detail?: string }
  | { runId: string; type: 'plan'; todos: AgentPlanItem[] }
  | {
      runId: string
      type: 'approval'
      callId: string
      kind: 'permission' | 'question'
      name: string
      message: string
      options?: string[]
      /** Dosya yazma onaylarında editörde diff önizlemesi için önce/sonra içeriği */
      diff?: AgentDiffPreview
    }
  | { runId: string; type: 'changes'; changes: AgentChangeItem[] }
  | { runId: string; type: 'compile_result'; result: CompileResult }
  | {
      runId: string
      type: 'done'
      ok: boolean
      text: string
      error?: string
      aborted?: boolean
      changes: AgentChangeItem[]
      steps: AgentToolStep[]
      checkpointId?: string
    }

/** Onay bekleyen bir dosya değişikliğinin önizlemesi */
export interface AgentDiffPreview {
  filePath: string
  /** Yeni dosyada boş string */
  before: string
  after: string
  isNew: boolean
}

export interface AgentReply {
  approved: boolean
  /** 'question' türündeki isteklerde kullanıcının yanıtı */
  answer?: string
}

export interface AgentUndoResult {
  ok: boolean
  error?: string
  /** Geri alma sonrası diskten yeniden okunması gereken sketch klasörleri */
  affectedFolders: string[]
}

export interface ProviderTestResult {
  ok: boolean
  message: string
  details: string[]
  /** Algılanan model yetenekleri / bağlam bilgisi */
  contextLength?: number
  supportsTools?: boolean
  tokensPerSecond?: number
}

export interface AgentAPI {
  run: (params: AgentRunParams) => Promise<void>
  abort: (runId: string) => Promise<void>
  reply: (runId: string, callId: string, reply: AgentReply) => Promise<void>
  undo: (checkpointId: string) => Promise<AgentUndoResult>
  onEvent: (listener: (event: AgentEvent) => void) => () => void
  testProvider: (provider: AIProviderId, model?: string) => Promise<ProviderTestResult>
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
  getProviderModels: (provider: AIProviderId) => Promise<string[]>
  /** İlk yanıttan sonra sohbet için yapay zekâ ile başlık üretir, kaydeder ve döndürür (üretilemezse null) */
  generateTitle: (params: { sessionId: string; provider: AIProviderId; model?: string }) => Promise<string | null>
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
  /** Yeni bir bağımsız Cloud IDE uygulama penceresi açar; opsiyonel sketch yolu ile başlatabilir */
  openNewWindow: (sketchPath?: string) => Promise<boolean>
}

// ───────── Sorun bildirme (tanılama) ─────────

export interface TanilamaVerisi {
  sistem: SistemBilgisi
  /** Raporu paylaşmadan önce kişisel bilgileri temizlemek için kullanılır */
  temizleme: TemizlemeBaglami
}

export interface DiagnosticsAPI {
  /** Sistem, kart paketi ve kütüphane bilgisini toplar (kimlik bilgisi ya da proje içeriği içermez) */
  collect: () => Promise<TanilamaVerisi>
  /** Kayıt penceresi açar; iptalde null, aksi halde dosya yolu */
  saveReport: (metin: string) => Promise<string | null>
  /** GitHub'da önceden doldurulmuş yeni sorun sayfasını tarayıcıda açar */
  openIssue: (baslik: string, govde: string) => Promise<void>
}

// ───────── Uygulama güncellemesi ─────────

export type UpdateDurum = 'bosta' | 'denetleniyor' | 'guncel' | 'var' | 'indiriliyor' | 'hazir' | 'hata' | 'desteklenmiyor'

export interface UpdateStatus {
  durum: UpdateDurum
  /** Yeni sürüm numarası (var / indiriliyor / hazir) */
  surum?: string
  /** Sürüm notları (düz metin) */
  notlar?: string
  /** İndirme yüzdesi 0-100 */
  yuzde?: number
  /** Hata ya da "desteklenmiyor" açıklaması */
  mesaj?: string
  /** Taşınabilir sürüm: uygulama kendini güncelleyemez, Sürümler sayfasından indirilir */
  elleIndir?: boolean
}

export interface UpdaterAPI {
  getStatus: () => Promise<UpdateStatus>
  check: () => Promise<UpdateStatus>
  download: () => Promise<void>
  /** İndirilen güncellemeyi kurmak için uygulamayı yeniden başlatır */
  install: () => Promise<void>
  openReleases: () => Promise<void>
  onStatus: (listener: (s: UpdateStatus) => void) => () => void
}

// ───────── Sürüm geçmişi ─────────

export type HistoryCommitKind = 'elle' | 'otomatik' | 'agent-oncesi' | 'geri-yukleme-oncesi' | 'derleme'

export interface BuildSizeItem {
  kullanilan: number
  azami: number
}

/** Derleme sonrası bellek kullanımı (arduino-cli çıktısından) */
export interface BuildSize {
  flash?: BuildSizeItem
  ram?: BuildSizeItem
}

/** Bir sürümün başarıyla derlendiğini ve hangi ortamla derlendiğini anlatan kayıt */
export interface BuildMeta {
  fqbn: string
  zaman: number
  boyut?: BuildSize
  /** Kullanılan kütüphaneler: ad → sürüm */
  kutuphaneler: Record<string, string>
  cekirdek?: { ad: string; surum: string }
  /** Bu sürüm karta da yüklendi mi */
  yuklendi?: boolean
}

export interface HistoryCommit {
  id: string
  parent: string | null
  dal: string
  mesaj: string
  zaman: number
  tur: HistoryCommitKind
  dosyaSayisi: number
  etiketler: string[]
  derleme?: BuildMeta
}

export interface HistoryListResult {
  aktifDal: string
  dallar: string[]
  etiketler: Array<{ ad: string; id: string }>
  /** Aktif dalın ucundan geriye doğru, en yeni başta */
  surumler: HistoryCommit[]
}

export interface HistoryStatus {
  aktifDal: string
  basId: string | null
  degisenler: Array<{ ad: string; durum: 'eklendi' | 'degisti' | 'silindi' }>
}

export interface HistoryDiffFile {
  ad: string
  durum: 'eklendi' | 'degisti' | 'silindi'
  eski: string
  yeni: string
}

export interface HistoryAPI {
  status: (projePath: string) => Promise<HistoryStatus>
  list: (projePath: string, dal?: string) => Promise<HistoryListResult>
  /** `a` ve `b`: sürüm kimliği ya da 'calisma' (çalışma kopyası) */
  diff: (projePath: string, a: string, b: string) => Promise<HistoryDiffFile[]>
  /** Değişiklik yoksa null döner. `otomatik` true ise ayara bağlıdır ve eski otomatik kayıtlar budanır. */
  commit: (projePath: string, mesaj: string, otomatik?: boolean) => Promise<HistoryCommit | null>
  /** Değişen dosya adlarını döndürür */
  restore: (projePath: string, id: string, dosyalar?: string[]) => Promise<string[]>
  tag: (projePath: string, id: string, ad: string) => Promise<void>
  untag: (projePath: string, ad: string) => Promise<void>
  createBranch: (projePath: string, ad: string, id?: string) => Promise<void>
  checkout: (projePath: string, ad: string) => Promise<string[]>
  deleteBranch: (projePath: string, ad: string) => Promise<void>
  /** Kayıt penceresi açar; projeyi geçmişiyle .zip yapar. İptalde null, aksi halde dosya yolu. */
  exportPackage: (projePath: string) => Promise<string | null>
  /** Açma penceresi açar; paketi sketchbook'ta yeni klasöre açar. İptalde null, aksi halde proje klasörü. */
  importPackage: () => Promise<string | null>
}

/** Renderer'a preload üzerinden expose edilen tüm API'lerin birleşimi */
export interface DretAPI {
  diagnostics: DiagnosticsAPI
  updater: UpdaterAPI
  history: HistoryAPI
  app: AppInfoAPI
  arduinoCli: ArduinoCliAPI
  sketch: SketchAPI
  serial: SerialAPI
  settings: SettingsAPI
  secrets: SecretsAPI
  chat: ChatAPI
  agent: AgentAPI
  skills: SkillsAPI
  window: WindowAPI
}

