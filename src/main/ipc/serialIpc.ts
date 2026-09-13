import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS, LineEnding, SerialStatus } from '@shared/types'
import { SerialService } from '../services/SerialService'
import { DeviceLock } from '../services/DeviceLock'

/**
 * SerialService'i IPC'ye bağlar. Gelen veri ve bağlantı durumu değişimi
 * webContents.send ile sürekli renderer'a akıtılır; renderer bunlara
 * abone olup Seri Monitör panelini günceller.
 */
export function serialIpcKaydet(mainWindow: BrowserWindow, service: SerialService, deviceLock: DeviceLock): void {
  const C = IPC_CHANNELS.serial

  const durumGonder = (): void => {
    if (mainWindow.isDestroyed()) return
    const durum: SerialStatus = {
      open: service.isOpen(),
      port: service.aktifPort(),
      baud: service.aktifBaud(),
      temporarilyClosedForUpload: deviceLock.isTemporarilyClosedForUpload()
    }
    mainWindow.webContents.send(C.onStatusChanged, durum)
  }

  service.on('status', durumGonder)
  service.on('data', (satir, zamanDamgasi) => {
    if (mainWindow.isDestroyed()) return
    mainWindow.webContents.send(C.onData, { data: satir, timestamp: zamanDamgasi })
  })

  ipcMain.handle(C.listPorts, () => service.listPorts())
  ipcMain.handle(C.open, (_e, port: string, baud: number) => service.open(port, baud))
  ipcMain.handle(C.close, () => service.close())
  ipcMain.handle(C.write, (_e, data: string, lineEnding: LineEnding) => service.write(data, lineEnding))
  ipcMain.handle(C.isOpen, () => service.isOpen())
}
