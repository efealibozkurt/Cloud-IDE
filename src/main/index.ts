import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { IPC_CHANNELS } from '@shared/types'
import { ArduinoCliService } from './services/ArduinoCliService'
import { SketchService } from './services/SketchService'
import { SerialService } from './services/SerialService'
import { DeviceLock } from './services/DeviceLock'
import { SettingsService } from './services/SettingsService'
import { SecretsService } from './services/SecretsService'
import { ChatService } from './services/ChatService'
import { LlmService } from './services/LlmService'
import { arduinoCliIpcKaydet } from './ipc/arduinoCliIpc'
import { sketchIpcKaydet } from './ipc/sketchIpc'
import { serialIpcKaydet } from './ipc/serialIpc'
import { settingsIpcKaydet } from './ipc/settingsIpc'
import { secretsIpcKaydet } from './ipc/secretsIpc'
import { chatIpcKaydet } from './ipc/chatIpc'
import { skillsIpcKaydet } from './ipc/skillsIpc'
import { CustomSkillService } from './services/CustomSkillService'

const isDev = !app.isPackaged

app.setName('Cloud IDE')
if (process.platform === 'win32') {
  app.setAppUserModelId('com.efe.cloudide')
}

/**
 * Ana pencereyi oluşturur. Güvenlik için contextIsolation açık,
 * nodeIntegration kapalı tutulur; renderer'ın sistem erişimi yalnızca
 * preload köprüsü üzerinden, tipli API ile sağlanır.
 */
function createWindow(): BrowserWindow {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.ico')
    : join(app.getAppPath(), 'resources', 'icon.ico')

  const mainWindow = new BrowserWindow({
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

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Dış bağlantıları uygulama içinde değil, sistem tarayıcısında aç
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

/**
 * Pencere kapatılırken kaydedilmemiş değişiklik olup olmadığını renderer'a
 * sorar; renderer (açık sekmelerin dirty durumuna bakarak) karar verip
 * cevap verene kadar gerçek kapatma ertelenir. Kullanıcı "kaydetmeden çık"
 * derse ya da kaydedilmemiş bir şey yoksa pencere gerçekten kapanır.
 */
function kapatmaOnayiniBagla(mainWindow: BrowserWindow): void {
  let kapatmayaHazir = false

  mainWindow.on('close', (event) => {
    if (kapatmayaHazir) return
    event.preventDefault()
    mainWindow.webContents.send(IPC_CHANNELS.window.onCloseRequested)
  })

  ipcMain.on(IPC_CHANNELS.window.replyCloseRequest, (_event, devamEt: boolean) => {
    if (devamEt) {
      kapatmayaHazir = true
      mainWindow.close()
    }
  })
}

app.whenReady().then(async () => {
  const settingsService = new SettingsService()
  const secretsService = new SecretsService()
  const customSkillService = new CustomSkillService(app.getPath('userData'))
  const arduinoCliService = new ArduinoCliService(app.getPath('userData'), settingsService)
  const llmService = new LlmService(secretsService, arduinoCliService, undefined, customSkillService, app.getPath('userData'))
  const chatService = new ChatService(app.getPath('userData'))
  const sketchService = new SketchService()
  const serialService = new SerialService()
  const deviceLock = new DeviceLock(serialService)

  // Uygulama geneli bilgi ucu
  ipcMain.handle(IPC_CHANNELS.app.getVersion, () => app.getVersion())

  const mainWindow = createWindow()

  arduinoCliIpcKaydet(mainWindow, arduinoCliService, deviceLock)
  sketchIpcKaydet(mainWindow, app.getPath('documents'), sketchService, settingsService)
  serialIpcKaydet(mainWindow, serialService, deviceLock)
  settingsIpcKaydet(settingsService)
  secretsIpcKaydet(secretsService)
  chatIpcKaydet(chatService, llmService)
  skillsIpcKaydet(llmService.getRagService(), llmService.getBoardSkillEngine(), customSkillService)
  kapatmaOnayiniBagla(mainWindow)

  // İzole veri dizinini/config'i hazırla ve arduino-cli'yi bulmayı dene;
  // bulunamazsa uygulama çökmez, arayüz bunu bir durum olarak gösterir.
  await arduinoCliService.initialize()

  // Arka planda yerel RAG (multilingual-e5-small) modelini, özel becerileri ve örnek kodları ısıt (UI'ı asla bekletmez)
  setTimeout(() => {
    llmService
      .getRagService()
      .ensureModelLoaded()
      .then(async () => {
        // Özel becerileri RAG deposuna senkronize et
        const customSkills = await customSkillService.list()
        await llmService.getRagService().syncCustomSkills(customSkills)

        // Kurulu kütüphane örneklerini arka planda sessizce indeksle
        llmService.getRagService().indexInstalledExamples(25).catch(() => {})
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
