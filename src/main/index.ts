import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { disAdresMi, mutlakYol } from './ipc/yolDogrulama'
import { IPC_CHANNELS } from '@shared/types'
import { isCustomProvider } from '@shared/ozelSaglayici'
import { ArduinoCliService } from './services/ArduinoCliService'
import { KutuphaneSembolServisi } from './services/KutuphaneSembolServisi'
import { SketchService } from './services/SketchService'
import { HistoryService } from './services/HistoryService'
import { historyIpcKaydet } from './ipc/historyIpc'
import { UpdateService } from './services/UpdateService'
import { updaterIpcKaydet } from './ipc/updaterIpc'
import { logTamponuKur } from './services/LogTamponu'
import { TanilamaService } from './services/TanilamaService'
import { tanilamaIpcKaydet } from './ipc/tanilamaIpc'
import { SerialService } from './services/SerialService'
import { DeviceLock } from './services/DeviceLock'
import { SettingsService } from './services/SettingsService'
import { SecretsService } from './services/SecretsService'
import { ChatService } from './services/ChatService'
import { BoardSkillEngine } from './services/BoardSkillEngine'
import { RagService } from './services/RagService'
import { ChatCompactionService } from './services/ChatCompactionService'
import { STATIK_MODELLER } from './services/agent/staticModels'
import { arduinoCliIpcKaydet } from './ipc/arduinoCliIpc'
import { sketchIpcKaydet, setPendingInitialSketchPath, varsayilanSketchbookDizini } from './ipc/sketchIpc'
import { agentIpcKaydet } from './ipc/agentIpc'
import { AgentService } from './services/agent/AgentService'
import { modelleriListele } from './services/agent/models'
import { serialIpcKaydet } from './ipc/serialIpc'
import { settingsIpcKaydet } from './ipc/settingsIpc'
import { secretsIpcKaydet } from './ipc/secretsIpc'
import { chatIpcKaydet } from './ipc/chatIpc'
import { skillsIpcKaydet } from './ipc/skillsIpc'
import { CustomSkillService } from './services/CustomSkillService'

logTamponuKur()

// Beklenmeyen hatalar sessizce kaybolmasın: günlük tamponuna (Sorun bildir raporuna) düşer
process.on('uncaughtException', (hata) => console.error('[ana süreç] yakalanmayan hata:', hata))
process.on('unhandledRejection', (neden) => console.error('[ana süreç] işlenmeyen promise reddi:', neden))

const isDev = !app.isPackaged

app.setName('Cloud IDE')
if (process.platform === 'win32') {
  app.setAppUserModelId('com.efe.cloudide')
}

// Bazı Linux sürücülerinde/sanal makinelerde GPU hızlandırması boş pencereye yol açar.
// `--disable-gpu` argümanı ya da CLOUD_IDE_GPU_KAPALI=1 ile yazılımsal çizime geçilir.
if (process.env['CLOUD_IDE_GPU_KAPALI'] === '1' || process.argv.includes('--disable-gpu')) {
  app.disableHardwareAcceleration()
}
app.on('child-process-gone', (_e, ayrinti) => {
  if (ayrinti.type === 'GPU') {
    console.error(
      `[gpu] GPU süreci kapandı (${ayrinti.reason}). Pencere boş kalırsa uygulamayı --disable-gpu ile başlatın.`
    )
  }
})

/** Uygulamanın kendi renderer sayfasının adresi (geliştirmede Vite sunucusu, paketli sürümde index.html) */
function uygulamaAdresi(): string {
  if (isDev && process.env['ELECTRON_RENDERER_URL']) return process.env['ELECTRON_RENDERER_URL']
  return pathToFileURL(join(__dirname, '../renderer/index.html')).href
}

/** Verilen adres uygulamanın kendi sayfası mı (aynı kaynak; paketli sürümde aynı dosya, # kısmı yok sayılır) */
function uygulamaSayfasiMi(url: string): boolean {
  try {
    const hedef = new URL(url)
    const kok = new URL(uygulamaAdresi())
    if (kok.protocol === 'file:') return hedef.protocol === 'file:' && hedef.pathname === kok.pathname
    return hedef.origin === kok.origin
  } catch {
    return false
  }
}

/**
 * Yeni bir uygulama penceresi oluşturur. Güvenlik için contextIsolation açık,
 * nodeIntegration kapalı tutulur. İsteğe bağlı olarak belirli bir sketch yolu ile açılabilir.
 */
function createWindow(initialSketchPath?: string): BrowserWindow {
  // Windows .ico kullanır; Linux pencere ikonu için PNG ister (macOS'ta ikon paketten gelir)
  const ikonDosyasi = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, ikonDosyasi)
    : join(app.getAppPath(), 'resources', ikonDosyasi)

  const win = new BrowserWindow({
    title: 'Cloud IDE (BETA)',
    icon: iconPath,
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (initialSketchPath) {
    setPendingInitialSketchPath(win.webContents.id, initialSketchPath)
  }

  win.on('ready-to-show', () => {
    win.maximize()
    win.show()
  })

  // Dış bağlantıları uygulama içinde değil, sistem tarayıcısında aç; yalnızca http(s) ve mailto
  // (file:, smb: ve özel protokoller işletim sistemine açtırılmaz)
  win.webContents.setWindowOpenHandler((details) => {
    if (disAdresMi(details.url)) void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Pencere uygulama sayfasından başka yere gidemez (içerik enjeksiyonu olsa bile IPC yüzeyi başka sayfaya açılmaz)
  win.webContents.on('will-navigate', (event, url) => {
    if (!uygulamaSayfasiMi(url)) {
      event.preventDefault()
      if (disAdresMi(url)) void shell.openExternal(url)
    }
  })
  win.webContents.on('will-attach-webview', (event) => event.preventDefault())

  // Boş pencere sorunlarını (özellikle Linux'ta GPU/sürücü kaynaklı) teşhis edebilmek için arayüz
  // hatalarını ana sürecin günlüğüne de yaz: kullanıcı terminal çıktısını gönderince sebep görünür.
  win.webContents.on('console-message', (_e, seviye, mesaj, satir, kaynak) => {
    if (seviye >= 3) console.error(`[arayüz] ${mesaj} (${kaynak}:${satir})`)
  })
  win.webContents.on('did-fail-load', (_e, kod, aciklama, adres) => {
    console.error(`[arayüz] Sayfa yüklenemedi: ${aciklama} (${kod}) ${adres}`)
  })
  win.webContents.on('render-process-gone', (_e, ayrinti) => {
    console.error(`[arayüz] Arayüz süreci kapandı: ${ayrinti.reason} (çıkış kodu ${ayrinti.exitCode})`)
  })
  win.on('unresponsive', () => console.warn('[arayüz] Pencere yanıt vermiyor.'))

  kapatmaOnayiniBagla(win)

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

/**
 * Pencere kapatılırken kaydedilmemiş değişiklik olup olmadığını renderer'a
 * sorar; renderer (açık sekmelerin dirty durumuna bakarak) karar verip
 * cevap verene kadar gerçek kapatma ertelenir. Kullanıcı "kaydetmeden çık"
 * derse ya da kaydedilmemiş bir şey yoksa pencere gerçekten kapanır.
 */
function kapatmaOnayiniBagla(win: BrowserWindow): void {
  let kapatmayaHazir = false
  let yanitBekleme: NodeJS.Timeout | null = null
  const wcId = win.webContents.id

  const beklemeyiBitir = (): void => {
    if (yanitBekleme) clearTimeout(yanitBekleme)
    yanitBekleme = null
  }
  const zorlaKapat = (): void => {
    beklemeyiBitir()
    kapatmayaHazir = true
    if (!win.isDestroyed()) win.close()
  }

  win.on('close', (event) => {
    if (kapatmayaHazir) return
    // Arayüz çöktüyse soracak kimse yok: doğrudan kapat
    if (win.webContents.isDestroyed() || win.webContents.isCrashed()) return
    event.preventDefault()
    win.webContents.send(IPC_CHANNELS.window.onCloseRequested)
    // Arayüz takıldıysa ya da hiç yüklenmediyse pencere kapanmaz hale gelmesin
    beklemeyiBitir()
    yanitBekleme = setTimeout(() => {
      console.warn('[pencere] Arayüz kapatma isteğine yanıt vermedi; pencere zorla kapatılıyor.')
      zorlaKapat()
    }, 3000)
  })

  const alindi = (event: Electron.IpcMainEvent): void => {
    if (event.sender.id === wcId) beklemeyiBitir()
  }
  const listener = (event: Electron.IpcMainEvent, devamEt: boolean): void => {
    if (event.sender.id !== wcId) return
    beklemeyiBitir()
    if (devamEt) zorlaKapat()
  }

  ipcMain.on(IPC_CHANNELS.window.closeRequestReceived, alindi)
  ipcMain.on(IPC_CHANNELS.window.replyCloseRequest, listener)

  win.on('closed', () => {
    beklemeyiBitir()
    ipcMain.removeListener(IPC_CHANNELS.window.closeRequestReceived, alindi)
    ipcMain.removeListener(IPC_CHANNELS.window.replyCloseRequest, listener)
  })
}

app.whenReady().then(async () => {
  // Web izinleri (kamera, mikrofon, konum, bildirim…) uygulama için gerekmez: hepsi reddedilir
  session.defaultSession.setPermissionRequestHandler((_wc, _izin, geri) => geri(false))

  const settingsService = new SettingsService()
  const secretsService = new SecretsService()
  const customSkillService = new CustomSkillService(app.getPath('userData'))
  const arduinoCliService = new ArduinoCliService(app.getPath('userData'), settingsService)
  const kutuphaneSembolServisi = new KutuphaneSembolServisi(arduinoCliService)
  const ragService = new RagService(arduinoCliService)
  const boardSkillEngine = new BoardSkillEngine(arduinoCliService, ragService, customSkillService, app.getPath('userData'))
  const compactionService = new ChatCompactionService(secretsService, settingsService)
  const chatService = new ChatService(app.getPath('userData'))
  const sketchService = new SketchService()
  const historyService = new HistoryService()
  const serialService = new SerialService()
  const deviceLock = new DeviceLock(serialService)
  const agentService = new AgentService({
    secrets: secretsService,
    settings: settingsService,
    arduino: arduinoCliService,
    boardSkills: boardSkillEngine,
    deviceLock,
    sketchService,
    serial: serialService,
    sketchbookDir: varsayilanSketchbookDizini(app.getPath('documents')),
    userDataDir: app.getPath('userData'),
    history: historyService
  })

  // Uygulama geneli bilgi ucu
  ipcMain.handle(IPC_CHANNELS.app.getVersion, () => app.getVersion())

  // Yeni pencere açma ucu
  ipcMain.handle(IPC_CHANNELS.window.openNewWindow, (_e, sketchPath?: unknown) => {
    createWindow(typeof sketchPath === 'string' ? mutlakYol(sketchPath, 'Sketch yolu') : undefined)
    return true
  })

  const mainWindow = createWindow()

  arduinoCliIpcKaydet(mainWindow, arduinoCliService, deviceLock, {
    history: historyService,
    settings: settingsService,
    kutuphaneSembolleri: kutuphaneSembolServisi
  })
  sketchIpcKaydet(mainWindow, app.getPath('documents'), sketchService, settingsService)
  serialIpcKaydet(mainWindow, serialService, deviceLock)
  settingsIpcKaydet(settingsService, secretsService)
  tanilamaIpcKaydet(new TanilamaService(arduinoCliService))
  const updateService = new UpdateService(settingsService)
  updaterIpcKaydet(updateService)
  updateService.baslat()
  historyIpcKaydet(historyService, settingsService, varsayilanSketchbookDizini(app.getPath('documents')))
  secretsIpcKaydet(secretsService)
  chatIpcKaydet(chatService, compactionService, async (provider) => {
    // Canlı model listesi (Ollama /api/tags dahil); bulut sağlayıcılarda başarısızlıkta statik listeye düşer
    try {
      const liste = await modelleriListele(provider, secretsService, settingsService)
      if (liste.length) return liste
    } catch {
      // aşağıdaki geri dönüşe düş
    }
    // Özel sağlayıcıların hazır listesi yoktur; model adı elle yazılır
    return provider === 'ollama' || isCustomProvider(provider) ? [] : (STATIK_MODELLER[provider] ?? [])
  })
  agentIpcKaydet(agentService)
  skillsIpcKaydet(ragService, boardSkillEngine, customSkillService)

  // İzole veri dizinini/config'i hazırla ve arduino-cli'yi bulmayı dene;
  // bulunamazsa uygulama çökmez, arayüz bunu bir durum olarak gösterir.
  await arduinoCliService.initialize()

  // Arka planda yerel RAG (multilingual-e5-small) modelini, özel becerileri ve örnek kodları ısıt (UI'ı asla bekletmez)
  setTimeout(() => {
    ragService
      .ensureModelLoaded()
      .then(async () => {
        // Özel becerileri RAG deposuna senkronize et
        const customSkills = await customSkillService.list()
        await ragService.syncCustomSkills(customSkills)

        // Kurulu kütüphane örneklerini arka planda sessizce indeksle
        ragService
          .indexInstalledExamples(25)
          .then(() => ragService.indexLibraryApis(40))
          .catch((err) => console.warn('[main] örnek/kütüphane indeksleme uyarısı:', err instanceof Error ? err.message : err))
      })
      .catch((err) => {
        console.warn('[main] RAG arka plan başlatma uyarısı:', err)
      })
  }, 3500)

  app.on('activate', () => {
    // macOS'ta dock ikonuna tıklanınca pencere yoksa yeniden oluştur
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  app.on('before-quit', () => {
    // Açık bir seri port varsa uygulama kapanırken düzgünce serbest bırak
    if (serialService.isOpen()) {
      serialService.close().catch(() => {
        // Kapanışta oluşan hatalar önemsiz; uygulama zaten sonlanıyor
      })
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
