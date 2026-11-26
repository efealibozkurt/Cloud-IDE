import { ipcMain } from 'electron'
import { IPC_CHANNELS, providersLosingKey, type CustomAIProvider } from '@shared/types'
import type { SecretsService } from '../services/SecretsService'
import { SettingsService } from '../services/SettingsService'
import { ayarDegeriniDogrula } from './settingsValidation'

/** SettingsService'i (electron-store) IPC'ye bağlayan ince katman */
export function settingsIpcKaydet(service: SettingsService, secrets: SecretsService): void {
  const C = IPC_CHANNELS.settings

  ipcMain.handle(C.get, () => service.getAll())
  // Genel (correlated) union tipi IPC sınırında derleyiciye kanıtlanamadığı
  // için burada bilinçli olarak gevşetiliyor; gerçek tip güvenliği preload
  // katmanındaki SettingsAPI.set<K> imzasıyla renderer tarafında sağlanır.
  ipcMain.handle(C.set, (_e, key: unknown, value: unknown) => {
    ayarDegeriniDogrula(key, value)
    // Anahtar, ait olduğu sunucudan başka bir yere gönderilmesin
    if (key === 'customAiProviders') {
      const eski = service.get('customAiProviders') ?? []
      for (const id of providersLosingKey(eski, value as CustomAIProvider[])) secrets.clearApiKey(id)
    }
    return service.set(key, value as never)
  })
}
