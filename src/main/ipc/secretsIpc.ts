import { ipcMain } from 'electron'
import { AIProviderId, IPC_CHANNELS, isValidProviderId } from '@shared/types'
import { SecretsService } from '../services/SecretsService'

function saglayici(v: unknown): AIProviderId {
  if (!isValidProviderId(v)) throw new Error('Bilinmeyen sağlayıcı')
  return v
}

/** SecretsService'i IPC'ye bağlayan ince katman */
export function secretsIpcKaydet(service: SecretsService): void {
  const C = IPC_CHANNELS.secrets

  ipcMain.handle(C.setApiKey, (_e, provider: unknown, apiKey: unknown) => {
    if (typeof apiKey !== 'string' || apiKey.length > 4096) throw new Error('Anahtar geçersiz')
    return service.setApiKey(saglayici(provider), apiKey)
  })
  ipcMain.handle(C.clearApiKey, (_e, provider: unknown) => service.clearApiKey(saglayici(provider)))
  ipcMain.handle(C.getConfiguredProviders, () => service.getConfiguredProviders())
}
