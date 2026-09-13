import { ipcMain } from 'electron'
import { AppSettings, IPC_CHANNELS } from '@shared/types'
import { SettingsService } from '../services/SettingsService'

/** SettingsService'i (electron-store) IPC'ye bağlayan ince katman */
export function settingsIpcKaydet(service: SettingsService): void {
  const C = IPC_CHANNELS.settings

  ipcMain.handle(C.get, () => service.getAll())
  // Genel (correlated) union tipi IPC sınırında derleyiciye kanıtlanamadığı
  // için burada bilinçli olarak gevşetiliyor; gerçek tip güvenliği preload
  // katmanındaki SettingsAPI.set<K> imzasıyla renderer tarafında sağlanır.
  ipcMain.handle(C.set, (_e, key: keyof AppSettings, value: unknown) => service.set(key, value as never))
}
