import { BrowserWindow, dialog, ipcMain } from 'electron'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { basename, isAbsolute, resolve } from 'path'
import { IPC_CHANNELS } from '@shared/types'
import type { HistoryService } from '../services/HistoryService'
import type { SettingsService } from '../services/SettingsService'
import { projePaketiniAc, projeyiPaketle } from '../services/ProjePaketi'

/** Renderer'dan gelen yol gerçekten bir sketch klasörü olmalı (içinde .ino bulunur). */
function projeYolu(deger: unknown): string {
  if (typeof deger !== 'string' || deger.length === 0 || deger.length > 600 || !isAbsolute(deger)) {
    throw new Error('Geçersiz proje yolu')
  }
  const yol = resolve(deger)
  if (!existsSync(yol) || !statSync(yol).isDirectory()) throw new Error('Proje klasörü bulunamadı')
  if (!readdirSync(yol).some((ad) => ad.toLowerCase().endsWith('.ino'))) throw new Error('Bu klasör bir Arduino projesi değil')
  return yol
}

function metin(deger: unknown, ad: string, enFazla = 200): string {
  if (typeof deger !== 'string' || deger.length > enFazla) throw new Error(`Geçersiz ${ad}`)
  return deger
}

export function historyIpcKaydet(servis: HistoryService, ayarlar: SettingsService, sketchbookDir: string): void {
  const c = IPC_CHANNELS.history
  ipcMain.handle(c.status, (_e, proje) => servis.status(projeYolu(proje)))
  ipcMain.handle(c.list, (_e, proje, dal) => servis.list(projeYolu(proje), dal === undefined ? undefined : metin(dal, 'dal', 40)))
  ipcMain.handle(c.diff, (_e, proje, a, b) => servis.diff(projeYolu(proje), metin(a, 'sürüm', 40), metin(b, 'sürüm', 40)))
  ipcMain.handle(c.commit, async (_e, proje, mesaj, otomatik) => {
    const yol = projeYolu(proje)
    const m = metin(mesaj, 'mesaj')
    if (otomatik === true) {
      if (ayarlar.get('historyAutoSnapshot') === false) return null
      const sonuc = await servis.commit(yol, m, 'otomatik')
      if (sonuc) await servis.prune(yol, ayarlar.get('historyMaxAuto') ?? 50)
      return sonuc
    }
    return servis.commit(yol, m, 'elle', true)
  })
  ipcMain.handle(c.restore, (_e, proje, id, dosyalar) => {
    if (dosyalar !== undefined && (!Array.isArray(dosyalar) || dosyalar.length > 200)) throw new Error('Geçersiz dosya listesi')
    return servis.restore(
      projeYolu(proje),
      metin(id, 'sürüm', 40),
      dosyalar === undefined ? undefined : dosyalar.map((d: unknown) => metin(d, 'dosya', 120))
    )
  })
  ipcMain.handle(c.tag, (_e, proje, id, ad) => servis.etiketle(projeYolu(proje), metin(id, 'sürüm', 40), metin(ad, 'etiket', 40)))
  ipcMain.handle(c.untag, (_e, proje, ad) => servis.etiketiKaldir(projeYolu(proje), metin(ad, 'etiket', 40)))
  ipcMain.handle(c.createBranch, (_e, proje, ad, id) =>
    servis.dalOlustur(projeYolu(proje), metin(ad, 'dal', 40), id === undefined ? undefined : metin(id, 'sürüm', 40))
  )
  ipcMain.handle(c.checkout, (_e, proje, ad) => servis.dalaGec(projeYolu(proje), metin(ad, 'dal', 40)))
  ipcMain.handle(c.deleteBranch, (_e, proje, ad) => servis.dalSil(projeYolu(proje), metin(ad, 'dal', 40)))

  ipcMain.handle(c.exportPackage, async (e, proje) => {
    const yol = projeYolu(proje)
    const paket = projeyiPaketle(yol)
    const pencere = BrowserWindow.fromWebContents(e.sender)
    const secenekler = {
      title: 'Proje paketini kaydet',
      defaultPath: `${basename(yol)}.zip`,
      filters: [{ name: 'Proje paketi (ZIP)', extensions: ['zip'] }]
    }
    const sonuc = pencere ? await dialog.showSaveDialog(pencere, secenekler) : await dialog.showSaveDialog(secenekler)
    if (sonuc.canceled || !sonuc.filePath) return null
    writeFileSync(sonuc.filePath, paket)
    return sonuc.filePath
  })

  ipcMain.handle(c.importPackage, async (e) => {
    const pencere = BrowserWindow.fromWebContents(e.sender)
    const secenekler = {
      title: 'Proje paketini içe aktar',
      properties: ['openFile' as const],
      filters: [{ name: 'Proje paketi (ZIP)', extensions: ['zip'] }]
    }
    const sonuc = pencere ? await dialog.showOpenDialog(pencere, secenekler) : await dialog.showOpenDialog(secenekler)
    if (sonuc.canceled || sonuc.filePaths.length === 0) return null
    const dosya = sonuc.filePaths[0]
    if (statSync(dosya).size > 200 * 1024 * 1024) throw new Error('Paket çok büyük')
    return projePaketiniAc(readFileSync(dosya), sketchbookDir)
  })
}
