import { ChildProcess, spawn } from 'child_process'
import type { Dirent } from 'fs'
import { access, readdir } from 'fs/promises'
import { basename, join } from 'path'
import {
  ArduinoCliStatus,
  BoardOption,
  CompileResult,
  DerlemeHatasi,
  DetectedPort,
  ExampleGroup,
  ExampleItem,
  LibraryInfo,
  LibrarySearchResult,
  PlatformSearchResult,
  PlatformSummary,
  UploadResult
} from '@shared/types'
import { resolveArduinoCliPath } from '../utils/cliPath'
import { ArduinoCliOrtami, arduinoCliOrtamiHazirla } from '../utils/arduinoCliConfig'
import { baslikEksikligiDeseniMi, tumToolchainBaslikYollariniOnar } from '../utils/toolchainHeaderFix'
import { SettingsService } from './SettingsService'

/** Kullanıcı bir işlemi iptal ettiğinde fırlatılan özel hata türü */
export class OperationCancelledError extends Error {
  constructor(operationId: string) {
    super(`İşlem iptal edildi: ${operationId}`)
    this.name = 'OperationCancelledError'
  }
}

/** Bir metnin ilk (boş olmayan) satırını döner; kısa hata özeti çıkarmak için kullanılır */
function ilkSatir(metin: string): string {
  return (
    metin
      .trim()
      .split(/\r?\n/)
      .find((satir) => satir.trim().length > 0)
      ?.trim() ?? ''
  )
}

/**
 * Sürüm dizelerini ("1.8.8", "2.0.0-alpha" gibi) sayısal parça parça
 * karşılaştırır. Object anahtarlarının doğal string sıralaması
 * "1.10.0" değerini "1.9.0"dan önce koyacağı için düz string sort
 * kullanılamaz.
 */
function surumKarsilastir(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((p) => parseInt(p, 10))
  const pb = b.split(/[.-]/).map((p) => parseInt(p, 10))
  const uzunluk = Math.max(pa.length, pb.length)
  for (let i = 0; i < uzunluk; i++) {
    const x = pa[i]
    const y = pb[i]
    if (Number.isNaN(x) || Number.isNaN(y)) continue
    if (x !== y) return x - y
  }
  return 0
}

/** gcc'nin klasik "dosya:satır:sütun: tür: mesaj" biçimli tek bir çıktı satırını yakalar */
const GCC_HATA_DESENI = /^(.+?):(\d+):(\d+):\s+(error|warning|note):\s+(.+)$/

/**
 * builder_result.diagnostics JSON'da yoksa (ör. daha eski bir arduino-cli
 * sürümü ya da beklenmeyen bir çıktı) devreye giren YEDEK yol: ham
 * derleyici çıktısını (stderr) doğrudan regex ile ayrıştırır. "In file
 * included from ..." gibi gürültü satırları ana listeye karışmaz; bir
 * sonraki hatanın 'baglam' dizisine eklenir.
 */
function stderrdenHatalariCikar(stderrMetni: string): DerlemeHatasi[] {
  const satirlar = stderrMetni.split(/\r?\n/)
  const hatalar: DerlemeHatasi[] = []
  let baglamBirikimi: string[] = []

  for (const satir of satirlar) {
    const eslesme = GCC_HATA_DESENI.exec(satir)
    if (eslesme) {
      const [, dosya, satirNoMetni, sutunNoMetni, tur, mesaj] = eslesme
      hatalar.push({
        dosya,
        satir: parseInt(satirNoMetni, 10),
        sutun: parseInt(sutunNoMetni, 10),
        tur: tur as 'error' | 'warning' | 'note',
        mesaj,
        hamMetin: satir,
        baglam: baglamBirikimi.length > 0 ? baglamBirikimi : undefined
      })
      baglamBirikimi = []
    } else if (satir.trim().length > 0) {
      baglamBirikimi.push(satir.trim())
    }
  }
  return hatalar
}

/** Terminal renklendirme kodları (arduino-cli'nin "Used library/platform" tablosunda kullanılır) */
const ANSI_KODU_DESENI = /\x1b\[[0-9;]*m/g

/** Bir metindeki tüm ANSI renk kodlarını temizler (düz metin panelinde anlamsız kaçış dizileri kalmasın) */
function ansiTemizle(metin: string): string {
  return metin.replace(ANSI_KODU_DESENI, '')
}

/**
 * Çıktı panelinde CANLI gösterilecek satırları süzer. `compile`/`upload`
 * `--verbose` ile çalıştığında gcc/g++ çağrılarının TAM komut satırı
 * (onlarca -I/-D/-l bayrağıyla, binlerce karakter) ham çıktıya karışır;
 * bunlar kullanıcı için anlamsız gürültüdür. Gerçek bir derleyici
 * hatası/uyarısı ise (GCC_HATA_DESENI ile eşleşiyorsa) uzunluğuna
 * bakılmaksızın her zaman gösterilir. Not: bu süzgeç yalnızca CANLI
 * gösterimi etkiler; hata ayrıştırma (stderrdenHatalariCikar) her zaman
 * süzülmemiş tam metin üzerinde çalışır.
 */
const CANLI_GURULTU_UZUNLUK_SINIRI = 300
function canliGunlukIcinSuz(satir: string): string | null {
  const temiz = ansiTemizle(satir).trimEnd()
  if (!temiz.trim()) return null
  if (temiz.length > CANLI_GURULTU_UZUNLUK_SINIRI && !GCC_HATA_DESENI.test(temiz)) return null
  return temiz
}

/** Bir dosya/klasörün var olup olmadığını hatasız kontrol eder */
async function yolVarMi(yol: string): Promise<boolean> {
  try {
    await access(yol)
    return true
  } catch {
    return false
  }
}

/**
 * Bir kütüphane klasöründeki `examples/` alt klasörünü tarar. İki yaygın
 * yapıyı da tanır: düz ("examples/Blink/Blink.ino") ve tek seviye
 * kategorili ("examples/ADC/AnalogOkuma/AnalogOkuma.ino" — ör. Deneyap
 * kütüphanesi). Sketch kuralına uyarak, klasörle aynı isimde bir .ino
 * dosyası olmayan alt klasörler örnek sayılmaz.
 */
async function kutuphaneOrnekleriniTara(kutuphaneKlasoru: string): Promise<ExampleItem[]> {
  const ornekKlasoru = join(kutuphaneKlasoru, 'examples')
  let girdiler: Dirent[]
  try {
    girdiler = await readdir(ornekKlasoru, { withFileTypes: true })
  } catch {
    return []
  }

  const sonuc: ExampleItem[] = []
  for (const girdi of girdiler) {
    if (!girdi.isDirectory()) continue
    const altKlasor = join(ornekKlasoru, girdi.name)
    if (await yolVarMi(join(altKlasor, `${girdi.name}.ino`))) {
      sonuc.push({ name: girdi.name, folderPath: altKlasor })
      continue
    }
    // Doğrudan bir sketch değilse, bir kategori klasörü olabilir; bir
    // seviye daha içine bak.
    try {
      const altGirdiler = await readdir(altKlasor, { withFileTypes: true })
      for (const altGirdi of altGirdiler) {
        if (!altGirdi.isDirectory()) continue
        const derinKlasor = join(altKlasor, altGirdi.name)
        if (await yolVarMi(join(derinKlasor, `${altGirdi.name}.ino`))) {
          sonuc.push({ name: `${girdi.name}/${altGirdi.name}`, folderPath: derinKlasor })
        }
      }
    } catch {
      // Kategori klasörü de değilse yoksay
    }
  }
  return sonuc.sort((a, b) => a.name.localeCompare(b.name, 'tr'))
}

/**
 * Kurulu bir kart platformunun (core) gömülü kütüphanelerinin bulunduğu
 * klasörleri bulur. arduino-cli'nin standart veri dizini yerleşimine göre:
 * `packages/<vendor>/hardware/<mimari>/<sürüm>/libraries/*`.
 */
async function cekirdekKutuphaneKlasorleriniBul(
  dataDir: string,
  platformId: string,
  installedVersion: string
): Promise<string[]> {
  const parcalar = platformId.split(':')
  if (parcalar.length !== 2) return []
  const [saglayici, mimari] = parcalar
  const kutuphanelerKlasoru = join(dataDir, 'packages', saglayici, 'hardware', mimari, installedVersion, 'libraries')
  try {
    const girdiler = await readdir(kutuphanelerKlasoru, { withFileTypes: true })
    return girdiler.filter((g) => g.isDirectory()).map((g) => join(kutuphanelerKlasoru, g.name))
  } catch {
    return []
  }
}

// ── arduino-cli --format json ham çıktı şekilleri (sürüm 1.5.x ile doğrulandı) ──

interface HamPort {
  address: string
  label: string
  protocol: string
  protocol_label: string
  hardware_id?: string
}
interface HamEslesenKart {
  name: string
  fqbn?: string
}
interface HamBoardList {
  detected_ports?: Array<{ port: HamPort; matching_boards?: HamEslesenKart[] }>
}

interface HamListAllKart {
  name: string
  fqbn: string
  platform: { metadata: { id: string }; release: { name: string } }
}
interface HamBoardListAll {
  boards?: HamListAllKart[]
}

interface HamRelease {
  name?: string
  version: string
  boards?: Array<{ name: string; fqbn?: string }>
}
interface HamPlatform {
  id: string
  maintainer?: string
  releases: Record<string, HamRelease>
  installed_version?: string | null
  latest_version?: string | null
}
interface HamCoreList {
  platforms?: HamPlatform[]
}

interface HamLibSearchGirdi {
  name: string
  releases: Record<string, { author?: string; sentence?: string; version: string }>
  latest: { author?: string; sentence?: string; version: string }
  available_versions?: string[]
}
interface HamLibSearch {
  libraries?: HamLibSearchGirdi[]
}

/**
 * arduino-cli süreçlerini yöneten servis sınıfı. IPC'den tamamen
 * bağımsızdır: ileride v0.2'de AI agent bu sınıfı doğrudan bir "tool"
 * olarak çağırabilir. Ham stdout asla olduğu gibi arayüze basılmaz; her
 * zaman ayrıştırılıp tipli bir yapıya çevrilir. Çoğu komut `--format json`
 * ile çalışır. **İstisna: `compile`/`upload`.** Ölçülerek doğrulandı ki
 * arduino-cli `--format json` modunda TÜM çıktıyı işlem bitene kadar
 * arabelleğe alır (satır satır akış YOKTUR, bkz. CONTEXT.md);
 * bu yüzden bu iki komut düz metin + `--verbose` ile çalıştırılır (gerçek
 * anlık akış için), hata ayrıştırması JSON yerine `stderrdenHatalariCikar`
 * regex yoluyla yapılır, başarı durumu çıkış koduyla belirlenir.
 */
export class ArduinoCliService {
  private cliPath: string | null = null
  private ortam: ArduinoCliOrtami | null = null
  /** İptal edilebilmesi için çalışan süreçlerin operationId -> ChildProcess eşlemesi */
  private surecler = new Map<string, ChildProcess>()

  constructor(
    private readonly userDataDir: string,
    private readonly settings: SettingsService
  ) {}

  /** Uygulama açılışında bir kez çağrılır: izole veri dizinini/yaml'ı hazırlar ve durumu döner */
  async initialize(): Promise<ArduinoCliStatus> {
    await this.ortamiYenile()
    return this.getStatus()
  }

  /** Kullanıcının mevcut Arduino kurulumunu bozmayan izole config'i (yeniden) yazar */
  private async ortamiYenile(): Promise<void> {
    this.ortam = await arduinoCliOrtamiHazirla(this.userDataDir, this.settings.get('boardManagerUrls'))
  }

  async getStatus(): Promise<ArduinoCliStatus> {
    const yol = await resolveArduinoCliPath(this.settings.get('arduinoCliPath'))
    if (!yol) {
      this.cliPath = null
      return {
        found: false,
        path: null,
        version: null,
        message:
          'arduino-cli bulunamadı. Ayarlardan arduino-cli.exe dosyasının yolunu seçebilir ya da resmi siteden indirebilirsiniz.'
      }
    }
    this.cliPath = yol
    try {
      const surum = await this.runJson<{ VersionString: string }>(['version'])
      return { found: true, path: yol, version: surum.VersionString ?? null }
    } catch {
      return {
        found: false,
        path: yol,
        version: null,
        message: 'arduino-cli bulundu ama çalıştırılamadı. Dosyanın bozuk olmadığından emin olun.'
      }
    }
  }

  async setCliPath(path: string): Promise<ArduinoCliStatus> {
    this.settings.set('arduinoCliPath', path)
    return this.getStatus()
  }

  getBoardManagerUrls(): string[] {
    return this.settings.get('boardManagerUrls')
  }

  async addBoardManagerUrl(url: string): Promise<string[]> {
    const mevcut = this.settings.get('boardManagerUrls')
    if (!mevcut.includes(url)) {
      this.settings.set('boardManagerUrls', [...mevcut, url])
      await this.ortamiYenile()
    }
    return this.settings.get('boardManagerUrls')
  }

  async removeBoardManagerUrl(url: string): Promise<string[]> {
    const guncellenmis = this.settings.get('boardManagerUrls').filter((u) => u !== url)
    this.settings.set('boardManagerUrls', guncellenmis)
    await this.ortamiYenile()
    return guncellenmis
  }

  // ── Doğrulama yardımcıları ──

  private ensureReady(): void {
    if (!this.cliPath) {
      throw new Error('arduino-cli bulunamadı; önce ayarlardan yolunu belirtin')
    }
    if (!this.ortam) {
      throw new Error('arduino-cli çalışma ortamı henüz hazırlanmadı')
    }
  }

  /**
   * Tek seferde sonuç dönen (streaming gerektirmeyen) komutlar için genel
   * çalıştırıcı. stdout'u JSON olarak ayrıştırır; boş çıktıyı (bazı
   * komutlar başarı durumunda hiçbir şey yazmaz) hata saymaz.
   */
  private runJson<T>(args: string[]): Promise<T> {
    this.ensureReady()
    return new Promise((resolve, reject) => {
      const tamArgs = [...args, '--config-file', this.ortam!.configPath, '--format', 'json']
      const surec = spawn(this.cliPath as string, tamArgs, { windowsHide: true })
      let stdout = ''
      let stderr = ''
      surec.stdout.on('data', (parca) => (stdout += parca.toString()))
      surec.stderr.on('data', (parca) => (stderr += parca.toString()))
      surec.on('error', (hata) => reject(new Error(`arduino-cli çalıştırılamadı: ${hata.message}`)))
      surec.on('close', (kod) => {
        if (kod !== 0) {
          reject(new Error(ilkSatir(stderr) || ilkSatir(stdout) || `arduino-cli işlemi ${kod} koduyla başarısız oldu`))
          return
        }
        if (!stdout.trim()) {
          resolve({} as T)
          return
        }
        try {
          resolve(JSON.parse(stdout) as T)
        } catch {
          reject(new Error('arduino-cli çıktısı ayrıştırılamadı'))
        }
      })
    })
  }

  /**
   * İptal edilebilir, uzun süren komutlar için çalıştırıcı. Süreç referansı
   * `operationId` ile saklanır ki `cancelOperation` onu sonlandırabilsin.
   * `jsonFormat=false` verilirse `--format json` eklenmez (bkz. compile/
   * upload'ın neden düz metne geçtiğine dair sınıf başındaki not); bu
   * durumda gerçek zamanlı satır akışı sağlanır.
   *
   * Her akış (stdout/stderr) kendi tamponunda satır tamamlanana kadar
   * birikir; bir veri parçası (özellikle --verbose modundaki onlarca KB'lık
   * tek bir derleyici komut satırında) bir satırın ortasında kesilebilir,
   * bu yüzden yalnızca tamamlanmış satırlar `onLog`'a iletilir.
   */
  private calistirVeIzle(
    args: string[],
    operationId: string,
    onLog?: (satir: string) => void,
    jsonFormat: boolean = true
  ): Promise<{ stdout: string; stderr: string; kod: number | null }> {
    this.ensureReady()
    return new Promise((resolve, reject) => {
      const tamArgs = jsonFormat
        ? [...args, '--config-file', this.ortam!.configPath, '--format', 'json']
        : [...args, '--config-file', this.ortam!.configPath]
      const surec = spawn(this.cliPath as string, tamArgs, { windowsHide: true })
      this.surecler.set(operationId, surec)

      let stdout = ''
      let stderr = ''
      let stdoutTamponu = ''
      let stderrTamponu = ''

      const tamamlananSatirlariYayinla = (birikmisMetin: string, sonKez: boolean): string => {
        const parcalar = birikmisMetin.split(/\r\n|\r|\n/)
        const kalan = sonKez ? '' : parcalar.pop() ?? ''
        parcalar.filter((satir) => satir.trim().length > 0).forEach((satir) => onLog?.(satir))
        return kalan
      }

      surec.stdout.on('data', (parca) => {
        const metin = parca.toString()
        stdout += metin
        stdoutTamponu = tamamlananSatirlariYayinla(stdoutTamponu + metin, false)
      })
      surec.stderr.on('data', (parca) => {
        const metin = parca.toString()
        stderr += metin
        stderrTamponu = tamamlananSatirlariYayinla(stderrTamponu + metin, false)
      })
      surec.on('error', (hata) => {
        this.surecler.delete(operationId)
        reject(new Error(`arduino-cli çalıştırılamadı: ${hata.message}`))
      })
      surec.on('close', (kod, sinyal) => {
        this.surecler.delete(operationId)
        tamamlananSatirlariYayinla(stdoutTamponu, true)
        tamamlananSatirlariYayinla(stderrTamponu, true)
        if (sinyal === 'SIGTERM' || sinyal === 'SIGKILL') {
          reject(new OperationCancelledError(operationId))
          return
        }
        resolve({ stdout, stderr, kod })
      })
    })
  }

  /** Çalışan bir işlemi (installCore/installLibrary/compile/upload) iptal eder */
  cancelOperation(operationId: string): boolean {
    const surec = this.surecler.get(operationId)
    if (!surec) return false
    surec.kill()
    return true
  }

  // ── Çekirdek (core / board) yönetimi ──

  async updateIndex(): Promise<void> {
    await this.runJson(['core', 'update-index'])
    await this.runJson(['lib', 'update-index'])
  }

  async listCores(): Promise<PlatformSummary[]> {
    const veri = await this.runJson<HamCoreList>(['core', 'list'])
    return (veri.platforms ?? []).map((p) => {
      const kuruluRelease = p.installed_version ? p.releases[p.installed_version] : undefined
      const platformAdi = kuruluRelease?.name ?? p.id
      return {
        id: p.id,
        name: platformAdi,
        maintainer: p.maintainer,
        installedVersion: p.installed_version ?? null,
        latestVersion: p.latest_version ?? null,
        boards: (kuruluRelease?.boards ?? [])
          .filter((b): b is { name: string; fqbn: string } => Boolean(b.fqbn))
          .map((b) => ({ name: b.name, fqbn: b.fqbn, platformId: p.id, platformName: platformAdi }))
      }
    })
  }

  async searchCores(query: string): Promise<PlatformSearchResult[]> {
    const args = query.trim() ? ['core', 'search', query.trim()] : ['core', 'search']
    const veri = await this.runJson<HamCoreList>(args)
    return (veri.platforms ?? []).map((p) => {
      const versiyonlar = Object.keys(p.releases).sort(surumKarsilastir)
      const enSonSurum = p.latest_version ?? versiyonlar[versiyonlar.length - 1]
      const enSonRelease = p.releases[enSonSurum]
      return {
        id: p.id,
        name: enSonRelease?.name ?? p.id,
        maintainer: p.maintainer,
        installed: Boolean(p.installed_version),
        installedVersion: p.installed_version ?? null,
        latestVersion: enSonSurum,
        availableVersions: versiyonlar,
        boardNames: (enSonRelease?.boards ?? []).map((b) => b.name)
      }
    })
  }

  async installCore(id: string, operationId: string, onLog?: (satir: string) => void): Promise<void> {
    const { stdout, stderr, kod } = await this.calistirVeIzle(['core', 'install', id], operationId, onLog)
    if (kod !== 0) {
      const hamSonuc = bunuJsonYap<{ error?: string }>(stdout)
      throw new Error(hamSonuc?.error || ilkSatir(stderr) || ilkSatir(stdout) || `${id} kurulamadı`)
    }
    // Windows'ta bazı xtensa/GCC tabanlı toolchain'lerde (deneyap, esp32 vb.)
    // bilinen bir başlık dosyası çözümleme sorununu otomatik onar; bkz.
    // toolchainHeaderFix.ts. Bu adım en iyi çaba niteliğindedir, kurulumun
    // başarısını etkilemez.
    if (this.ortam) {
      try {
        const onarilan = await tumToolchainBaslikYollariniOnar(this.ortam.dataDir)
        if (onarilan > 0) onLog?.(`Bilinen bir toolchain başlık sorunu önceden onarıldı (${onarilan} dosya).`)
      } catch {
        // Onarım denemesi başarısız olsa bile kurulum başarılı sayılır
      }
    }
  }

  async uninstallCore(id: string): Promise<void> {
    await this.runJson(['core', 'uninstall', id])
  }

  async listPorts(): Promise<DetectedPort[]> {
    const veri = await this.runJson<HamBoardList>(['board', 'list'])
    return (veri.detected_ports ?? []).map((girdi) => ({
      address: girdi.port.address,
      label: girdi.port.label,
      protocol: girdi.port.protocol,
      protocolLabel: girdi.port.protocol_label,
      hardwareId: girdi.port.hardware_id,
      matchingBoards: (girdi.matching_boards ?? []).map((k) => ({ name: k.name, fqbn: k.fqbn }))
    }))
  }

  async listAllBoards(): Promise<BoardOption[]> {
    const veri = await this.runJson<HamBoardListAll>(['board', 'listall'])
    return (veri.boards ?? []).map((k) => ({
      name: k.name,
      fqbn: k.fqbn,
      platformId: k.platform.metadata.id,
      platformName: k.platform.release.name
    }))
  }

  // ── Kütüphane yönetimi ──

  private kuruluKutuphanelerOnbellegi: LibraryInfo[] | null = null
  private kuruluKutuphanelerOnbellekZamani = 0
  private readonly KUTUPHANE_ONBELLEK_SURESI_MS = 60_000 // 60 saniye
  private aramaSonuclariOnbellegi = new Map<string, { zaman: number; sonuclar: LibrarySearchResult[] }>()

  async listLibraries(force = false): Promise<LibraryInfo[]> {
    if (!force && this.kuruluKutuphanelerOnbellegi && Date.now() - this.kuruluKutuphanelerOnbellekZamani < this.KUTUPHANE_ONBELLEK_SURESI_MS) {
      return this.kuruluKutuphanelerOnbellegi
    }
    try {
      const veri = await this.runJson<any>(['lib', 'list'])
      const hamDizi: any[] = Array.isArray(veri)
        ? veri
        : (veri?.installed_libraries ?? veri?.libraries ?? [])

      const sonuc: LibraryInfo[] = []
      for (const g of hamDizi) {
        const l = g?.library ?? g
        if (l && l.name) {
          sonuc.push({
            name: l.name,
            version: l.version ?? l.installed_version ?? '',
            author: l.author ?? l.maintainer ?? l.latest?.author ?? undefined,
            sentence: l.sentence ?? l.paragraph ?? l.latest?.sentence ?? undefined,
            installDir: l.install_dir ?? l.path ?? ''
          })
        }
      }
      this.kuruluKutuphanelerOnbellegi = sonuc
      this.kuruluKutuphanelerOnbellekZamani = Date.now()
      return sonuc
    } catch (err) {
      console.warn('[ArduinoCliService] listLibraries başarısız:', err)
      return this.kuruluKutuphanelerOnbellegi ?? []
    }
  }

  async searchLibraries(query: string): Promise<LibrarySearchResult[]> {
    const q = query.trim()
    const onbellekGirdisi = this.aramaSonuclariOnbellegi.get(q)
    if (onbellekGirdisi && Date.now() - onbellekGirdisi.zaman < this.KUTUPHANE_ONBELLEK_SURESI_MS) {
      const kurulular = await this.listLibraries()
      const kuruluMap = new Map(kurulular.map((l) => [l.name, l]))
      return onbellekGirdisi.sonuclar.map((lib) => {
        const kurulu = kuruluMap.get(lib.name)
        return {
          ...lib,
          installed: Boolean(kurulu),
          installedVersion: kurulu?.version ?? null
        }
      })
    }

    const [kurulular, veri] = await Promise.all([
      this.listLibraries(),
      this.runJson<HamLibSearch>(q ? ['lib', 'search', q] : ['lib', 'search']).catch(() => ({ libraries: [] }))
    ])
    const kuruluMap = new Map(kurulular.map((l) => [l.name, l]))
    const sonuclar = (veri.libraries ?? []).map((lib: any) => {
      const kurulu = kuruluMap.get(lib.name)
      const author =
        lib.latest?.author ||
        (lib.releases ? Object.values(lib.releases as Record<string, any>).find((r: any) => r?.author)?.author : undefined) ||
        lib.author ||
        lib.maintainer ||
        kurulu?.author ||
        undefined

      const sentence =
        lib.latest?.sentence ||
        lib.sentence ||
        lib.latest?.paragraph ||
        lib.paragraph ||
        kurulu?.sentence ||
        undefined

      const surumler = (lib.available_versions ?? (lib.releases ? Object.keys(lib.releases) : [])).sort(surumKarsilastir)

      return {
        name: lib.name,
        latestVersion: lib.latest?.version || (surumler.length > 0 ? surumler[surumler.length - 1] : ''),
        availableVersions: surumler,
        author,
        sentence,
        installed: Boolean(kurulu),
        installedVersion: kurulu?.version ?? null
      }
    })

    this.aramaSonuclariOnbellegi.set(q, {
      zaman: Date.now(),
      sonuclar
    })

    if (this.aramaSonuclariOnbellegi.size > 30) {
      const ilkAnahtar = this.aramaSonuclariOnbellegi.keys().next().value
      if (ilkAnahtar !== undefined) this.aramaSonuclariOnbellegi.delete(ilkAnahtar)
    }

    return sonuclar
  }

  async installLibrary(
    name: string,
    version: string | undefined,
    operationId: string,
    onLog?: (satir: string) => void
  ): Promise<void> {
    const hedef = version ? `${name}@${version}` : name
    const { stdout, stderr, kod } = await this.calistirVeIzle(['lib', 'install', hedef], operationId, onLog)
    if (kod !== 0) {
      const hamSonuc = bunuJsonYap<{ error?: string }>(stdout)
      throw new Error(hamSonuc?.error || ilkSatir(stderr) || ilkSatir(stdout) || `${name} kurulamadı`)
    }
    // Kurulum sonrası önbellekleri geçersiz kıl
    this.kuruluKutuphanelerOnbellegi = null
    this.aramaSonuclariOnbellegi.clear()
  }

  async uninstallLibrary(name: string): Promise<void> {
    await this.runJson(['lib', 'uninstall', name])
    // Kaldırma sonrası önbellekleri geçersiz kıl
    this.kuruluKutuphanelerOnbellegi = null
    this.aramaSonuclariOnbellegi.clear()
  }

  // ── Örnekler (Examples) ──

  /**
   * Kurulu kütüphanelerin ve kurulu kart platformlarının (core) gömülü
   * kütüphanelerinin `examples/` klasörlerini tarar. Saf dosya sistemi
   * okumasıdır, arduino-cli süreci başlatmaz (yalnızca `listLibraries`/
   * `listCores` için birer JSON çağrısı yapılır); bu yüzden iptal
   * edilebilir bir operationId gerektirmez.
   */
  async listExamples(): Promise<ExampleGroup[]> {
    const gruplar: ExampleGroup[] = []

    const kutuphaneler = await this.listLibraries()
    const kutuphaneOrnekleri = await Promise.all(kutuphaneler.map((lib) => kutuphaneOrnekleriniTara(lib.installDir)))
    kutuphaneler.forEach((lib, i) => {
      if (kutuphaneOrnekleri[i].length > 0) {
        gruplar.push({ ownerName: lib.name, source: 'library', examples: kutuphaneOrnekleri[i] })
      }
    })

    if (this.ortam) {
      const cekirdekler = await this.listCores()
      for (const c of cekirdekler) {
        if (!c.installedVersion) continue
        const kutuphaneKlasorleri = await cekirdekKutuphaneKlasorleriniBul(this.ortam.dataDir, c.id, c.installedVersion)
        const cekirdekOrnekleri = await Promise.all(kutuphaneKlasorleri.map((kk) => kutuphaneOrnekleriniTara(kk)))
        kutuphaneKlasorleri.forEach((kk, i) => {
          if (cekirdekOrnekleri[i].length > 0) {
            gruplar.push({ ownerName: basename(kk), source: 'core', coreName: c.name, examples: cekirdekOrnekleri[i] })
          }
        })
      }
    }

    return gruplar.sort((a, b) => a.ownerName.localeCompare(b.ownerName, 'tr'))
  }

  // ── Derleme ve yükleme (Aşama 4-5) ──

  async compile(
    sketchPath: string,
    fqbn: string,
    operationId: string,
    onLog?: (satir: string) => void
  ): Promise<CompileResult> {
    const ilkSonuc = await this.compileBirKez(sketchPath, fqbn, operationId, onLog)
    // Bilinen "hedefe-özel bits/ başlığı bulunamadı" toolchain sorununa
    // (bkz. toolchainHeaderFix.ts) rastlanırsa: otomatik onar ve derlemeyi
    // bir kez daha dene. Kullanıcı hiçbir şey yapmadan sorun kendiliğinden
    // giderilmiş olur.
    const hataMetni = ilkSonuc.log + (ilkSonuc.topLevelError ?? '') + ilkSonuc.errors.map((h) => h.hamMetin).join('\n')
    if (!ilkSonuc.success && this.ortam && baslikEksikligiDeseniMi(hataMetni)) {
      const onarilan = await tumToolchainBaslikYollariniOnar(this.ortam.dataDir).catch(() => 0)
      if (onarilan > 0) {
        onLog?.(`Bilinen bir toolchain başlık sorunu tespit edildi, ${onarilan} dosya onarıldı; derleme tekrar deneniyor...`)
        return this.compileBirKez(sketchPath, fqbn, operationId, onLog)
      }
    }
    return ilkSonuc
  }

  private async compileBirKez(
    sketchPath: string,
    fqbn: string,
    operationId: string,
    onLog?: (satir: string) => void
  ): Promise<CompileResult> {
    const { stdout, stderr, kod } = await this.calistirVeIzle(
      ['compile', '--fqbn', fqbn, sketchPath, '--warnings', 'all', '--verbose'],
      operationId,
      onLog && ((satir) => {
        const temiz = canliGunlukIcinSuz(satir)
        if (temiz) onLog(temiz)
      }),
      false
    )
    const hatalar = stderrdenHatalariCikar(stderr)
    const basarili = kod === 0
    return {
      success: basarili,
      errors: hatalar,
      log: ansiTemizle([stdout, stderr].filter(Boolean).join('\n')),
      topLevelError:
        !basarili && hatalar.length === 0 ? ilkSatir(stderr) || ilkSatir(stdout) || 'Derleme başarısız oldu' : undefined
    }
  }

  /**
   * Karta yükler (yalnızca flash adımı). **Not:** arduino-cli'nin `upload`
   * komutu kendi başına ASLA derlemez — yalnızca önceden derlenmiş
   * (önbellekteki) binary'i arar, bulamazsa "Compiled sketch not found"
   * hatasıyla başarısız olur (ölçülerek doğrulandı). Bu yüzden "Yükle"nin
   * her zaman taze bir derlemeyle başlaması gerekliliği bilerek burada
   * DEĞİL, çağıran katmanda (bkz. arduinoCliIpc.ts) sağlanır: böylece seri
   * port yalnızca bu kısa flash adımı için kapatılır, olası uzun süren
   * derleme adımı boyunca Seri Monitör kullanılabilir kalır.
   */
  async upload(
    sketchPath: string,
    fqbn: string,
    port: string,
    operationId: string,
    onLog?: (satir: string) => void
  ): Promise<UploadResult> {
    const { stdout, stderr, kod } = await this.calistirVeIzle(
      ['upload', '-p', port, '--fqbn', fqbn, sketchPath, '--verbose'],
      operationId,
      onLog && ((satir) => {
        const temiz = canliGunlukIcinSuz(satir)
        if (temiz) onLog(temiz)
      }),
      false
    )
    const basarili = kod === 0
    return {
      success: basarili,
      log: ansiTemizle([stdout, stderr].filter(Boolean).join('\n')),
      topLevelError: !basarili ? ilkSatir(stderr) || ilkSatir(stdout) || 'Yükleme başarısız oldu' : undefined
    }
  }
}

/** JSON.parse'ı hata fırlatmadan dener; başarısız olursa null döner */
function bunuJsonYap<T>(metin: string): T | null {
  const aday = metin.trim()
  if (!aday) return null
  try {
    return JSON.parse(aday) as T
  } catch {
    return null
  }
}
