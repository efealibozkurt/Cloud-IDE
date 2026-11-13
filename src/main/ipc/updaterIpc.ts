import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { UpdateService } from '../services/UpdateService'

export function updaterIpcKaydet(servis: UpdateService): void {
  const c = IPC_CHANNELS.updater
  ipcMain.handle(c.getStatus, () => servis.getStatus())
  ipcMain.handle(c.check, () => servis.denetle())
  ipcMain.handle(c.download, () => servis.indir())
  ipcMain.handle(c.install, () => servis.kurVeYenidenBaslat())
  ipcMain.handle(c.openReleases, () => servis.surumlerSayfasiniAc())
}
