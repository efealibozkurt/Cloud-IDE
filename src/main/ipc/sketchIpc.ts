import { BrowserWindow, dialog, ipcMain } from 'electron'
import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { basename, dirname, join } from 'path'
import { IPC_CHANNELS } from '@shared/types'
import { SketchService } from '../services/SketchService'
import { SettingsService } from '../services/SettingsService'

/** Yeni sketch'lerin varsayılan olarak oluşturulduğu klasör adı (Belgelerim altında) */
const SKETCHBOOK_KLASOR_ADI = 'Cloud_IDE_Sketches'

function varsayilanSketchbookDizini(documentsDir: string): string {
  const eskiYol = join(documentsDir, 'Dret_IDE_Sketches')
  if (existsSync(eskiYol)) return eskiYol
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

  ipcMain.handle(C.openDialog, async () => {
    // Kullanıcı doğal olarak .ino dosyasını seçmek ister (Arduino IDE'nin
    // kendisi de böyle davranır); klasörü seçilen dosyanın konumundan
    // türetiyoruz. Ana .ino, klasörle aynı isimde olmalıdır (Arduino
    // kuralı) — değilse service.openSketch anlaşılır bir hata fırlatır.
    const sonuc = await dialog.showOpenDialog(mainWindow, {
      title: 'Sketch dosyasını seç (.ino)',
      properties: ['openFile'],
      filters: [{ name: 'Arduino Sketch', extensions: ['ino'] }]
    })
    if (sonuc.canceled || sonuc.filePaths.length === 0) return null
    const bilgi = await service.openSketch(dirname(sonuc.filePaths[0]))
    settings.sonAcilanaEkle(bilgi.folderPath)
    return bilgi
  })

  ipcMain.handle(C.saveAsDialog, async (_e, currentFolderPath: string) => {
    const suAnkiAd = basename(currentFolderPath)
    const sonuc = await dialog.showSaveDialog(mainWindow, {
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

  ipcMain.handle(C.openPath, async (_e, folderPath: string) => {
    // Diyalog açmadan, bilinen bir klasör yolunu doğrudan sketch olarak açar
    // (ör. Örnekler menüsünden bir kütüphane/kart örneği seçildiğinde).
    const bilgi = await service.openSketch(folderPath)
    settings.sonAcilanaEkle(bilgi.folderPath)
    return bilgi
  })

  ipcMain.handle(C.readFile, (_e, filePath: string) => service.readFile(filePath))
  ipcMain.handle(C.writeFile, (_e, filePath: string, content: string) => service.writeFile(filePath, content))
  ipcMain.handle(C.listFiles, (_e, folderPath: string) => service.listFiles(folderPath))
  ipcMain.handle(C.addFile, (_e, folderPath: string, fileName: string) => service.addFile(folderPath, fileName))
  ipcMain.handle(C.deleteFile, (_e, filePath: string) => service.deleteFile(filePath))
  ipcMain.handle(C.renameFile, async (_e, filePath: string, newName: string) => {
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
