import { BrowserWindow, dialog, ipcMain } from 'electron'
import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { basename, dirname, join } from 'path'
import { IPC_CHANNELS } from '@shared/types'
import { SketchService } from '../services/SketchService'
import { SettingsService } from '../services/SettingsService'
import { mutlakYol, okunabilirDosya, yazilabilirDosya } from './yolDogrulama'

/** Yeni sketch'lerin varsayılan olarak oluşturulduğu klasör adı (Belgelerim altında) */
const SKETCHBOOK_KLASOR_ADI = 'Cloud_IDE_Sketches'

export function varsayilanSketchbookDizini(documentsDir: string): string {
  return join(documentsDir, SKETCHBOOK_KLASOR_ADI)
}

/** Arduino IDE geleneğine benzer otomatik isim üretir: sketch_20260802a, çakışırsa b, c... */
function otomatikIsimUret(sketchbookDir: string): string {
  const bugun = new Date()
  const tarihEtiketi = `${bugun.getFullYear()}${String(bugun.getMonth() + 1).padStart(2, '0')}${String(
    bugun.getDate()
  ).padStart(2, '0')}`
  for (let i = 0; i < 26; i++) {
    const harf = String.fromCharCode('a'.charCodeAt(0) + i)
    const aday = `sketch_${tarihEtiketi}${harf}`
    if (!existsSync(join(sketchbookDir, aday))) return aday
  }
  return `sketch_${Date.now()}`
}

const initialSketchPathMap = new Map<number, string>()

export function setPendingInitialSketchPath(webContentsId: number, sketchPath: string): void {
  initialSketchPathMap.set(webContentsId, sketchPath)
}

/**
 * SketchService'i IPC'ye bağlar. Dosya diyalogları (klasör seç, farklı
 * kaydet) burada açılır; gerçek dosya sistemi işlemleri SketchService'e
 * bırakılır ki servis, diyalog gerektirmeden de (ör. ileride AI agent
 * tarafından) çağrılabilsin.
 */
export function sketchIpcKaydet(
  mainWindow: BrowserWindow,
  documentsDir: string,
  service: SketchService,
  settings: SettingsService
): void {
  const C = IPC_CHANNELS.sketch
  const sketchbookDir = varsayilanSketchbookDizini(documentsDir)

  ipcMain.handle(C.createNew, async (_e, name?: string) => {
    await mkdir(sketchbookDir, { recursive: true })
    const guvenliAd = name?.trim() || otomatikIsimUret(sketchbookDir)
    const bilgi = await service.createNew(sketchbookDir, guvenliAd)
    settings.sonAcilanaEkle(bilgi.folderPath)
    return bilgi
  })

  ipcMain.handle(C.createFromTemplate, async (_e, name: unknown, code: unknown) => {
    if (typeof name !== 'string' || typeof code !== 'string' || code.length > 200_000) throw new Error('Geçersiz şablon verisi')
    await mkdir(sketchbookDir, { recursive: true })
    const taban = name.trim() || otomatikIsimUret(sketchbookDir)
    let ad = taban
    for (let i = 2; existsSync(join(sketchbookDir, ad)); i++) ad = `${taban}_${i}`
    const bilgi = await service.createNew(sketchbookDir, ad)
    await service.writeFile(join(bilgi.folderPath, `${basename(bilgi.folderPath)}.ino`), code)
    settings.sonAcilanaEkle(bilgi.folderPath)
    return service.openSketch(bilgi.folderPath)
  })

  ipcMain.handle(C.createSiblingSketch, async (_e, baseFolderPath: unknown, sketchName: string, initialCode?: string) => {
    const bilgi = await service.createSiblingSketch(mutlakYol(baseFolderPath, 'Klasör yolu'), sketchName, initialCode)
    settings.sonAcilanaEkle(bilgi.folderPath)
    return bilgi
  })

  ipcMain.handle(C.getInitialSketchPath, (e) => {
    const yol = initialSketchPathMap.get(e.sender.id)
    if (yol) {
      initialSketchPathMap.delete(e.sender.id)
      return yol
    }
    return null
  })

  ipcMain.handle(C.openDialog, async (e) => {
    // Kullanıcı doğal olarak .ino dosyasını seçmek ister (Arduino IDE'nin
    // kendisi de böyle davranır); klasörü seçilen dosyanın konumundan
    // türetiyoruz. Ana .ino, klasörle aynı isimde olmalıdır (Arduino
    // kuralı) — değilse service.openSketch anlaşılır bir hata fırlatır.
    const hedefPencere = BrowserWindow.fromWebContents(e.sender) || mainWindow
    const sonuc = await dialog.showOpenDialog(hedefPencere, {
      title: 'Sketch dosyasını seç (.ino)',
      properties: ['openFile'],
      filters: [{ name: 'Arduino Sketch', extensions: ['ino'] }]
    })
    if (sonuc.canceled || sonuc.filePaths.length === 0) return null
    const bilgi = await service.openSketch(dirname(sonuc.filePaths[0]))
    settings.sonAcilanaEkle(bilgi.folderPath)
    return bilgi
  })

  ipcMain.handle(C.saveAsDialog, async (e, currentFolderPath: string) => {
    const suAnkiAd = basename(currentFolderPath)
    const hedefPencere = BrowserWindow.fromWebContents(e.sender) || mainWindow
    const sonuc = await dialog.showSaveDialog(hedefPencere, {
      title: "Sketch'i farklı kaydet",
      defaultPath: join(sketchbookDir, suAnkiAd, `${suAnkiAd}.ino`),
      filters: [{ name: 'Arduino Sketch', extensions: ['ino'] }]
    })
    if (sonuc.canceled || !sonuc.filePath) return null
    const hedefParent = dirname(sonuc.filePath)
    const yeniAd = basename(sonuc.filePath, '.ino')
    const bilgi = await service.saveAs(currentFolderPath, hedefParent, yeniAd)
    settings.sonAcilanaEkle(bilgi.folderPath)
    return bilgi
  })

  ipcMain.handle(C.openPath, async (_e, folderPath: unknown) => {
    // Diyalog açmadan, bilinen bir klasör yolunu doğrudan sketch olarak açar
    // (ör. Örnekler menüsünden bir kütüphane/kart örneği seçildiğinde).
    const bilgi = await service.openSketch(mutlakYol(folderPath, 'Klasör yolu'))
    settings.sonAcilanaEkle(bilgi.folderPath)
    return bilgi
  })

  ipcMain.handle(C.readFile, (_e, filePath: unknown) => service.readFile(okunabilirDosya(filePath)))
  ipcMain.handle(C.writeFile, (_e, filePath: unknown, content: unknown) => {
    if (typeof content !== 'string' || content.length > 20_000_000) throw new Error('Geçersiz dosya içeriği')
    return service.writeFile(yazilabilirDosya(filePath), content)
  })
  ipcMain.handle(C.listFiles, (_e, folderPath: unknown) => service.listFiles(mutlakYol(folderPath, 'Klasör yolu')))
  ipcMain.handle(C.addFile, (_e, folderPath: unknown, fileName: string) => service.addFile(mutlakYol(folderPath, 'Klasör yolu'), fileName))
  ipcMain.handle(C.deleteFile, (_e, filePath: unknown) => service.deleteFile(yazilabilirDosya(filePath)))
  ipcMain.handle(C.renameFile, async (_e, filePathHam: unknown, newName: string) => {
    const filePath = yazilabilirDosya(filePathHam)
    const eskiKlasor = dirname(filePath)
    const sonuc = await service.renameFile(filePath, newName)
    const yeniKlasor = dirname(sonuc.path)
    if (sonuc.isMainFile && eskiKlasor !== yeniKlasor) {
      settings.eskiSketchYolunuGuncelle(eskiKlasor, yeniKlasor)
    }
    return sonuc
  })
  ipcMain.handle(C.getRecent, () => settings.get('recentSketches'))

  ipcMain.handle(C.getLastOpened, async () => {
    const sonYol = settings.get('lastOpenedSketch')
    if (sonYol && existsSync(sonYol)) {
      try {
        return await service.openSketch(sonYol)
      } catch {
        // Hata durumunda son kullanılanlara veya yeni sketch'e düş
      }
    }

    // Son sketch bulunamadıysa geçmişteki mevcut sketch'leri dene
    const recent = settings.get('recentSketches') || []
    for (const yol of recent) {
      if (yol && existsSync(yol)) {
        try {
          const bilgi = await service.openSketch(yol)
          settings.sonAcilanaEkle(bilgi.folderPath)
          return bilgi
        } catch {
          // Bir sonraki adaya geç
        }
      }
    }

    // Hiçbir sketch yoksa otomatik yeni bir başlangıç sketch'i oluştur
    try {
      await mkdir(sketchbookDir, { recursive: true })
      const guvenliAd = otomatikIsimUret(sketchbookDir)
      const bilgi = await service.createNew(sketchbookDir, guvenliAd)
      settings.sonAcilanaEkle(bilgi.folderPath)
      return bilgi
    } catch {
      return null
    }
  })
}
