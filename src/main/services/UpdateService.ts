import { app, BrowserWindow, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '@shared/types'
import { IPC_CHANNELS } from '@shared/types'
import { surumNotunuSadelestir } from './surumNotlari'
import type { SettingsService } from './SettingsService'

const SURUMLER_ADRESI = 'https://github.com/efealibozkurt/Cloud-IDE/releases'
const ILK_DENETIM_MS = 25_000
const DENETIM_ARALIGI_MS = 6 * 60 * 60 * 1000

/**
 * Uygulama güncellemesi (GitHub Releases). Yalnızca kurulu (paketlenmiş) uygulamada çalışır; geliştirme
 * modunda ve taşınabilir (portable) sürümde otomatik kurulum yoktur, kullanıcı Sürümler sayfasına yönlendirilir.
 * Hiçbir şey kullanıcı onayı olmadan indirilmez ya da kurulmaz.
 */
export class UpdateService {
  private durum: UpdateStatus = { durum: 'bosta' }
  private zamanlayici: ReturnType<typeof setInterval> | null = null
  private readonly kurulabilir: boolean
  private readonly elleIndir: boolean

  constructor(private readonly settings: SettingsService) {
    this.kurulabilir = app.isPackaged
    this.elleIndir = Boolean(process.env.PORTABLE_EXECUTABLE_DIR)
    if (!this.kurulabilir) {
      this.durum = { durum: 'desteklenmiyor', mesaj: 'Geliştirme modunda güncelleme denetlenmez.' }
      return
    }
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = true
    autoUpdater.logger = null

    autoUpdater.on('checking-for-update', () => this.ayarla({ durum: 'denetleniyor' }))
    autoUpdater.on('update-not-available', () => this.ayarla({ durum: 'guncel' }))
    autoUpdater.on('update-available', (bilgi) =>
      this.ayarla({
        durum: 'var',
        surum: bilgi.version,
        notlar: surumNotunuSadelestir(bilgi.releaseNotes),
        elleIndir: this.elleIndir
      })
    )
    autoUpdater.on('download-progress', (p) => this.ayarla({ ...this.durum, durum: 'indiriliyor', yuzde: Math.round(p.percent) }))
    autoUpdater.on('update-downloaded', (bilgi) => this.ayarla({ durum: 'hazir', surum: bilgi.version, notlar: this.durum.notlar }))
    autoUpdater.on('error', (hata) => this.ayarla({ durum: 'hata', mesaj: this.hataMetni(hata) }))
  }

  /** Açılıştan kısa süre sonra ve düzenli aralıklarla, ayar açıksa arka planda denetler. */
  baslat(): void {
    if (!this.kurulabilir) return
    setTimeout(() => void this.otomatikDenetle(), ILK_DENETIM_MS)
    this.zamanlayici = setInterval(() => void this.otomatikDenetle(), DENETIM_ARALIGI_MS)
  }

  durdur(): void {
    if (this.zamanlayici) clearInterval(this.zamanlayici)
    this.zamanlayici = null
  }

  private async otomatikDenetle(): Promise<void> {
    if (this.settings.get('autoUpdateCheck') === false) return
    if (this.durum.durum === 'indiriliyor' || this.durum.durum === 'hazir') return
    await this.denetle()
  }

  getStatus(): UpdateStatus {
    return this.durum
  }

  async denetle(): Promise<UpdateStatus> {
    if (!this.kurulabilir) return this.durum
    try {
      await autoUpdater.checkForUpdates()
    } catch (hata) {
      this.ayarla({ durum: 'hata', mesaj: this.hataMetni(hata) })
    }
    return this.durum
  }

  async indir(): Promise<void> {
    if (!this.kurulabilir || this.durum.durum !== 'var') return
    if (this.elleIndir) {
      await this.surumlerSayfasiniAc()
      return
    }
    try {
      this.ayarla({ ...this.durum, durum: 'indiriliyor', yuzde: 0 })
      await autoUpdater.downloadUpdate()
    } catch (hata) {
      this.ayarla({ durum: 'hata', mesaj: this.hataMetni(hata) })
    }
  }

  kurVeYenidenBaslat(): void {
    if (this.kurulabilir && this.durum.durum === 'hazir') autoUpdater.quitAndInstall(false, true)
  }

  async surumlerSayfasiniAc(): Promise<void> {
    await shell.openExternal(SURUMLER_ADRESI)
  }

  private ayarla(yeni: UpdateStatus): void {
    this.durum = yeni
    for (const pencere of BrowserWindow.getAllWindows()) {
      if (!pencere.isDestroyed()) pencere.webContents.send(IPC_CHANNELS.updater.onStatus, yeni)
    }
  }

  private hataMetni(hata: unknown): string {
    const m = hata instanceof Error ? hata.message : String(hata)
    if (/ENOTFOUND|ECONN|ETIMEDOUT|net::|network/i.test(m)) return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.'
    if (/404|Not Found|Cannot find latest/i.test(m)) return 'Henüz yayınlanmış bir sürüm bulunamadı.'
    if (/403|rate limit/i.test(m)) return 'GitHub istek sınırına takıldı; biraz sonra tekrar deneyin.'
    return m.split('\n')[0].slice(0, 200)
  }
}
