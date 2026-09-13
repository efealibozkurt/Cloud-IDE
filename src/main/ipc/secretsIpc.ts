import { ipcMain } from 'electron'
import { AIProviderId, IPC_CHANNELS } from '@shared/types'
import { SecretsService } from '../services/SecretsService'

/** SecretsService'i IPC'ye bağlayan ince katman */
export function secretsIpcKaydet(service: SecretsService): void {
  const C = IPC_CHANNELS.secrets

  ipcMain.handle(C.setApiKey, (_e, provider: AIProviderId, apiKey: string) => service.setApiKey(provider, apiKey))
  ipcMain.handle(C.clearApiKey, (_e, provider: AIProviderId) => service.clearApiKey(provider))
  ipcMain.handle(C.getConfiguredProviders, () => service.getConfiguredProviders())
}
