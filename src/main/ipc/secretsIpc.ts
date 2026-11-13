import { ipcMain } from 'electron'
import { AI_PROVIDERS, AIProviderId, IPC_CHANNELS } from '@shared/types'
import { SecretsService } from '../services/SecretsService'

const SAGLAYICILAR = new Set<string>(AI_PROVIDERS.map((p) => p.id))

function saglayici(v: unknown): AIProviderId {
  if (typeof v !== 'string' || !SAGLAYICILAR.has(v)) throw new Error('Bilinmeyen sağlayıcı')
  return v as AIProviderId
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
