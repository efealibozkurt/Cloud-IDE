import { BrowserWindow, dialog, ipcMain, WebContents } from 'electron'
import { ArduinoOperationEvent, ArduinoOperationKind, IPC_CHANNELS } from '@shared/types'
import { ArduinoCliService, OperationCancelledError } from '../services/ArduinoCliService'
import { DeviceLock } from '../services/DeviceLock'

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
  deviceLock: DeviceLock
): void {
  const C = IPC_CHANNELS.arduinoCli

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
    return sonuc.filePaths[0]
  })

  ipcMain.handle(C.setCliPath, (_e, yol: string) => service.setCliPath(yol))
  ipcMain.handle(C.getBoardManagerUrls, () => service.getBoardManagerUrls())
  ipcMain.handle(C.addBoardManagerUrl, (_e, url: string) => service.addBoardManagerUrl(url))
  ipcMain.handle(C.removeBoardManagerUrl, (_e, url: string) => service.removeBoardManagerUrl(url))

  ipcMain.handle(C.updateIndex, (e) =>
    islemOlaylariIleCalistir(e.sender, 'updateIndex', 'update-index', () => service.updateIndex())
  )

  ipcMain.handle(C.listCores, () => service.listCores())
  ipcMain.handle(C.searchCores, (_e, query: string) => service.searchCores(query))

  ipcMain.handle(C.installCore, (e, id: string, operationId: string) =>
    islemOlaylariIleCalistir(e.sender, 'installCore', operationId, () =>
      service.installCore(id, operationId, (satir) =>
        e.sender.send(C.onOperationEvent, {
          operationId,
          kind: 'installCore',
          phase: 'log',
          message: satir
        } satisfies ArduinoOperationEvent)
      )
    )
  )
  ipcMain.handle(C.uninstallCore, (_e, id: string) => service.uninstallCore(id))

  ipcMain.handle(C.listPorts, () => service.listPorts())
  ipcMain.handle(C.listAllBoards, () => service.listAllBoards())

  ipcMain.handle(C.listLibraries, (_e, force?: boolean) => service.listLibraries(force))
  ipcMain.handle(C.searchLibraries, (_e, query: string) => service.searchLibraries(query))

  ipcMain.handle(C.installLibrary, (e, name: string, version: string | undefined, operationId: string) =>
    islemOlaylariIleCalistir(e.sender, 'installLibrary', operationId, () =>
      service.installLibrary(name, version, operationId, (satir) =>
        e.sender.send(C.onOperationEvent, {
          operationId,
          kind: 'installLibrary',
          phase: 'log',
          message: satir
        } satisfies ArduinoOperationEvent)
      )
    )
  )
  ipcMain.handle(C.uninstallLibrary, (_e, name: string) => service.uninstallLibrary(name))

  ipcMain.handle(C.listExamples, () => service.listExamples())

  ipcMain.handle(C.compile, (e, sketchPath: string, fqbn: string, operationId: string) =>
    mesgulKoruyarakCalistir(e.sender, () =>
      deviceLock.runExclusive(() =>
        islemOlaylariIleCalistir(e.sender, 'compile', operationId, () =>
          service.compile(sketchPath, fqbn, operationId, (satir) =>
            e.sender.send(C.onOperationEvent, {
              operationId,
              kind: 'compile',
              phase: 'log',
              message: satir
            } satisfies ArduinoOperationEvent)
          )
        )
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
  ipcMain.handle(C.upload, (e, sketchPath: string, fqbn: string, port: string, operationId: string) =>
    mesgulKoruyarakCalistir(e.sender, () =>
      deviceLock.runUpload(port, () =>
        islemOlaylariIleCalistir(e.sender, 'upload', operationId, () =>
          service.upload(sketchPath, fqbn, port, operationId, (satir) =>
            e.sender.send(C.onOperationEvent, {
              operationId,
              kind: 'upload',
              phase: 'log',
              message: satir
            } satisfies ArduinoOperationEvent)
          )
        )
      )
    )
  )

  ipcMain.handle(C.cancelOperation, (_e, operationId: string) => service.cancelOperation(operationId))
}
