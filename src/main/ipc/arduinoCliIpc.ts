import { BrowserWindow, dialog, ipcMain, WebContents } from 'electron'
import { ArduinoOperationEvent, ArduinoOperationKind, CompileResult, IPC_CHANNELS } from '@shared/types'
import { ArduinoCliService, OperationCancelledError } from '../services/ArduinoCliService'
import { DeviceLock } from '../services/DeviceLock'
import type { HistoryService } from '../services/HistoryService'
import type { KutuphaneSembolServisi } from '../services/KutuphaneSembolServisi'
import type { SettingsService } from '../services/SettingsService'
import { derlemeyiGecmiseIsle } from '../services/derlemeGecmisi'
import { bayraksizMetin, httpAdresi, istegeBagliBayraksiz, mutlakYol } from './yolDogrulama'

/** Kullanıcının "Gözat" diyaloğundan seçtiği son arduino-cli yolu; setCliPath yalnızca bunu kabul eder */
let sonSecilenCliYolu: string | null = null

/** Bir işlemin başladığını/bittiğini/başarısız ya da iptal olduğunu renderer'a bildirir */
async function islemOlaylariIleCalistir<T>(
  gonderici: WebContents,
  kind: ArduinoOperationKind,
  operationId: string,
  gorev: () => Promise<T>
): Promise<T> {
  const olayGonder = (olay: Omit<ArduinoOperationEvent, 'operationId' | 'kind'>): void => {
    gonderici.send(IPC_CHANNELS.arduinoCli.onOperationEvent, { operationId, kind, ...olay } satisfies ArduinoOperationEvent)
  }
  olayGonder({ phase: 'basladi' })
  try {
    const sonuc = await gorev()
    olayGonder({ phase: 'tamamlandi' })
    return sonuc
  } catch (hata) {
    if (hata instanceof OperationCancelledError) {
      olayGonder({ phase: 'iptalEdildi' })
    } else {
      olayGonder({ phase: 'basarisiz', message: hata instanceof Error ? hata.message : String(hata) })
    }
    throw hata
  }
}

/** Üst çubuktaki Derle/Yükle düğmelerinin meşgul durumunu renderer'a bildirir */
async function mesgulKoruyarakCalistir<T>(gonderici: WebContents, gorev: () => Promise<T>): Promise<T> {
  gonderici.send(IPC_CHANNELS.arduinoCli.onBusyChanged, true)
  try {
    return await gorev()
  } finally {
    gonderici.send(IPC_CHANNELS.arduinoCli.onBusyChanged, false)
  }
}

/**
 * ArduinoCliService'i IPC'ye bağlayan ince sarmalayıcı katman. Burada iş
 * mantığı YOKTUR; sadece servis metodlarını çağırıp sonucu döner ve uzun
 * süren işlemlerde ilerleme olaylarını webContents.send ile stream eder.
 */
export function arduinoCliIpcKaydet(
  mainWindow: BrowserWindow,
  service: ArduinoCliService,
  deviceLock: DeviceLock,
  gecmis?: { history: HistoryService; settings: SettingsService; kutuphaneSembolleri?: KutuphaneSembolServisi }
): void {
  const C = IPC_CHANNELS.arduinoCli

  const derlemeyiKaydet = async (sketchPath: string, fqbn: string, sonuc: CompileResult): Promise<void> => {
    if (gecmis) await derlemeyiGecmiseIsle(gecmis.history, gecmis.settings, sketchPath, fqbn, sonuc)
  }

  ipcMain.handle(C.getStatus, () => service.getStatus())

  ipcMain.handle(C.browseForCliPath, async () => {
    const sonuc = await dialog.showOpenDialog(mainWindow, {
      title: 'arduino-cli çalıştırılabilir dosyasını seç',
      properties: ['openFile'],
      filters:
        process.platform === 'win32'
          ? [{ name: 'Çalıştırılabilir dosya', extensions: ['exe'] }]
          : [{ name: 'Tüm dosyalar', extensions: ['*'] }]
    })
    if (sonuc.canceled || sonuc.filePaths.length === 0) return null
    sonSecilenCliYolu = sonuc.filePaths[0]
    return sonuc.filePaths[0]
  })

  // Çalıştırılabilir yol yalnızca kullanıcının diyalogdan seçtiği dosya olabilir (renderer keyfi .exe veremez)
  ipcMain.handle(C.setCliPath, (_e, yol: unknown) => {
    if (typeof yol !== 'string' || !sonSecilenCliYolu || yol !== sonSecilenCliYolu) {
      throw new Error('arduino-cli yolu yalnızca "Gözat" ile seçilebilir')
    }
    return service.setCliPath(yol)
  })
  ipcMain.handle(C.getBoardManagerUrls, () => service.getBoardManagerUrls())
  ipcMain.handle(C.addBoardManagerUrl, (_e, url: unknown) => service.addBoardManagerUrl(httpAdresi(url, 'Kart yöneticisi adresi')))
  ipcMain.handle(C.removeBoardManagerUrl, (_e, url: unknown) => service.removeBoardManagerUrl(bayraksizMetin(url, 'Adres', 2000)))

  ipcMain.handle(C.updateIndex, (e) =>
    islemOlaylariIleCalistir(e.sender, 'updateIndex', 'update-index', () => service.updateIndex())
  )

  ipcMain.handle(C.listCores, () => service.listCores())
  ipcMain.handle(C.searchCores, (_e, query: unknown) => service.searchCores(bayraksizMetin(query, 'Arama')))

  ipcMain.handle(C.installCore, (e, id: unknown, operationId: string) =>
    islemOlaylariIleCalistir(e.sender, 'installCore', operationId, () =>
      service.installCore(bayraksizMetin(id, 'Paket kimliği'), operationId, (satir) =>
        e.sender.send(C.onOperationEvent, {
          operationId,
          kind: 'installCore',
          phase: 'log',
          message: satir
        } satisfies ArduinoOperationEvent)
      )
    )
  )
  ipcMain.handle(C.uninstallCore, (_e, id: unknown) => service.uninstallCore(bayraksizMetin(id, 'Paket kimliği')))

  ipcMain.handle(C.listPorts, () => service.listPorts())
  ipcMain.handle(C.listAllBoards, () => service.listAllBoards())

  ipcMain.handle(C.listLibraries, (_e, force?: boolean) => service.listLibraries(force))
  ipcMain.handle(C.getLibrarySymbols, (_e, force?: unknown) =>
    gecmis?.kutuphaneSembolleri
      ? gecmis.kutuphaneSembolleri.sembolleriGetir(force === true)
      : { olusturulmaZamani: Date.now(), kutuphaneler: [] }
  )
  ipcMain.handle(C.searchLibraries, (_e, query: unknown) => service.searchLibraries(bayraksizMetin(query, 'Arama')))

  ipcMain.handle(C.installLibrary, (e, name: unknown, version: unknown, operationId: string) =>
    islemOlaylariIleCalistir(e.sender, 'installLibrary', operationId, async () => {
      await service.installLibrary(
        bayraksizMetin(name, 'Kütüphane adı'),
        istegeBagliBayraksiz(version, 'Sürüm'),
        operationId,
        (satir) =>
          e.sender.send(C.onOperationEvent, {
            operationId,
            kind: 'installLibrary',
            phase: 'log',
            message: satir
          } satisfies ArduinoOperationEvent)
      )
      gecmis?.kutuphaneSembolleri?.onbellegiTemizle()
    })
  )
  ipcMain.handle(C.getBoardOptions, (_e, fqbn: unknown) => service.kartSecenekleri(bayraksizMetin(fqbn, 'Kart kimliği')))
  ipcMain.handle(C.listUpdatableLibraries, (_e, force?: boolean) => service.guncellenebilirKutuphaneler(force === true))
  ipcMain.handle(C.suggestLibrary, (_e, header: unknown) => service.kutuphaneOner(bayraksizMetin(header, 'Başlık')))
  ipcMain.handle(C.uninstallLibrary, async (_e, name: unknown) => {
    await service.uninstallLibrary(bayraksizMetin(name, 'Kütüphane adı'))
    gecmis?.kutuphaneSembolleri?.onbellegiTemizle()
  })

  ipcMain.handle(C.listExamples, () => service.listExamples())

  ipcMain.handle(C.compile, (e, sketchPathHam: unknown, fqbnHam: unknown, operationId: string) =>
    mesgulKoruyarakCalistir(e.sender, () =>
      deviceLock.runExclusive(() =>
        islemOlaylariIleCalistir(e.sender, 'compile', operationId, () => {
          const sketchPath = mutlakYol(sketchPathHam, 'Sketch yolu')
          const fqbn = bayraksizMetin(fqbnHam, 'Kart kimliği')
          return service
            .compile(sketchPath, fqbn, operationId, (satir) =>
              e.sender.send(C.onOperationEvent, {
                operationId,
                kind: 'compile',
                phase: 'log',
                message: satir
              } satisfies ArduinoOperationEvent)
            )
            .then(async (sonuc) => {
              await derlemeyiKaydet(sketchPath, fqbn, sonuc)
              return sonuc
            })
        })
      )
    )
  )

  // Not: arduino-cli'nin upload komutu kendi başına ASLA derlemez (yalnızca
  // önceden derlenmiş binary arar, bulamazsa "Compiled sketch not found"
  // hatasıyla başarısız olur — ölçülerek doğrulandı). "Yükle"nin her zaman
  // taze bir derlemeyle başlaması gerekliliği burada DEĞİL, renderer'daki
  // `uploadActive()` içinde sağlanır (önce ayrı bir `compile` çağrısı,
  // başarılıysa bu `upload` çağrısı): böylece derleme adımı bu servisin
  // mutex'ini/port kilidini hiç tutmaz, yalnızca asıl flash adımı sırasında
  // seri port kapatılır.
  ipcMain.handle(C.upload, (e, sketchPathHam: unknown, fqbnHam: unknown, portHam: unknown, operationId: string) => {
    const sketchPath = mutlakYol(sketchPathHam, 'Sketch yolu')
    const fqbn = bayraksizMetin(fqbnHam, 'Kart kimliği')
    const port = bayraksizMetin(portHam, 'Port', 200)
    return mesgulKoruyarakCalistir(e.sender, () =>
      deviceLock.runUpload(port, () =>
        islemOlaylariIleCalistir(e.sender, 'upload', operationId, () =>
          service
            .upload(sketchPath, fqbn, port, operationId, (satir) =>
              e.sender.send(C.onOperationEvent, {
                operationId,
                kind: 'upload',
                phase: 'log',
                message: satir
              } satisfies ArduinoOperationEvent)
            )
            .then(async (sonuc) => {
              if (sonuc.success) {
                await gecmis?.history.yuklemeIsaretle(sketchPath).catch((h) => console.warn('[geçmiş] yükleme işareti yazılamadı:', h instanceof Error ? h.message : h))
              }
              return sonuc
            })
        )
      )
    )
  })

  ipcMain.handle(C.cancelOperation, (_e, operationId: string) => service.cancelOperation(operationId))
}
