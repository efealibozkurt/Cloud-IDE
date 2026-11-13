import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS, LineEnding, SerialStatus } from '@shared/types'
import { SerialService } from '../services/SerialService'
import { DeviceLock } from '../services/DeviceLock'
import { bayraksizMetin } from './yolDogrulama'

const SATIR_SONLARI = new Set<string>(['none', 'nl', 'cr', 'nlcr'])

/**
 * SerialService'i IPC'ye bağlar. Gelen veri ve bağlantı durumu değişimi
 * webContents.send ile sürekli renderer'a akıtılır; renderer bunlara
 * abone olup Seri Monitör panelini günceller.
 */
export function serialIpcKaydet(_mainWindow: BrowserWindow, service: SerialService, deviceLock: DeviceLock): void {
  const C = IPC_CHANNELS.serial

  const durumGonder = (): void => {
    const durum: SerialStatus = {
      open: service.isOpen(),
      port: service.aktifPort(),
      baud: service.aktifBaud(),
      portlar: service.acikPortlar(),
      temporarilyClosedForUpload: deviceLock.isTemporarilyClosedForUpload()
    }
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(C.onStatusChanged, durum)
      }
    })
  }

  service.on('status', durumGonder)
  service.on('data', (satir, zamanDamgasi, port) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(C.onData, { data: satir, timestamp: zamanDamgasi, port })
      }
    })
  })

  ipcMain.handle(C.listPorts, () => service.listPorts())
  ipcMain.handle(C.open, (_e, port: unknown, baud: unknown) => {
    if (typeof baud !== 'number' || !Number.isInteger(baud) || baud < 300 || baud > 4_000_000) throw new Error('Baud hızı geçersiz')
    return service.open(bayraksizMetin(port, 'Port', 200), baud)
  })
  ipcMain.handle(C.close, (_e, port?: string) => service.close(typeof port === 'string' ? port : undefined))
  ipcMain.handle(C.write, (_e, data: unknown, lineEnding: LineEnding, port?: string) => {
    if (typeof data !== 'string' || data.length > 100_000) throw new Error('Gönderilecek veri geçersiz')
    if (!SATIR_SONLARI.has(lineEnding)) throw new Error('Satır sonu geçersiz')
    return service.write(data, lineEnding, typeof port === 'string' ? port : undefined)
  })
  ipcMain.handle(C.isOpen, () => service.isOpen())
}
