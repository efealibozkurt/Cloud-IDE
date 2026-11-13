import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { writeFileSync } from 'fs'
import { IPC_CHANNELS } from '@shared/types'
import { sorunAdresi } from '@shared/tanilama'
import type { TanilamaService } from '../services/TanilamaService'

const MAKS_RAPOR = 300_000

export function tanilamaIpcKaydet(servis: TanilamaService): void {
  const c = IPC_CHANNELS.diagnostics
  ipcMain.handle(c.collect, () => servis.topla())

  ipcMain.handle(c.saveReport, async (e, metin: unknown) => {
    if (typeof metin !== 'string' || metin.length === 0 || metin.length > MAKS_RAPOR) throw new Error('Geçersiz rapor')
    const pencere = BrowserWindow.fromWebContents(e.sender)
    const tarih = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const secenekler = {
      title: 'Sorun raporunu kaydet',
      defaultPath: `cloud-ide-sorun-raporu-${tarih}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    }
    const sonuc = pencere ? await dialog.showSaveDialog(pencere, secenekler) : await dialog.showSaveDialog(secenekler)
    if (sonuc.canceled || !sonuc.filePath) return null
    writeFileSync(sonuc.filePath, metin, 'utf8')
    return sonuc.filePath
  })

  // Adres ana süreçte, sabit depo adresinden üretilir: arayüz keyfi bir adres açtıramaz
  ipcMain.handle(c.openIssue, async (_e, baslik: unknown, govde: unknown) => {
    if (typeof baslik !== 'string' || typeof govde !== 'string' || baslik.length > 300 || govde.length > MAKS_RAPOR) throw new Error('Geçersiz sorun bildirimi')
    await shell.openExternal(sorunAdresi(baslik, govde))
  })
}
