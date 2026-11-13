import { ipcMain } from 'electron'
import { IPC_CHANNELS, type ChatSession, type AIProviderId } from '@shared/types'
import { ChatService } from '../services/ChatService'
import type { ChatCompactionService } from '../services/ChatCompactionService'

/** ChatService ve sohbet özetlemeyi IPC'ye bağlayan ince sarmalayıcı katman */
export function chatIpcKaydet(
  service: ChatService,
  compaction: ChatCompactionService,
  modelListele: (provider: AIProviderId) => Promise<string[]>
): void {
  const C = IPC_CHANNELS.chat

  ipcMain.handle(C.getSessions, (_e, sketchPath: string) => service.getSessions(sketchPath))
  ipcMain.handle(C.getSession, (_e, sessionId: string) => service.getSession(sessionId))
  ipcMain.handle(C.createSession, (_e, sketchPath: string, sketchName: string, baslik?: string) =>
    service.createSession(sketchPath, sketchName, baslik)
  )
  ipcMain.handle(C.saveSession, (_e, session: ChatSession) => service.saveSession(session))
  ipcMain.handle(C.deleteSession, (_e, sessionId: string) => service.deleteSession(sessionId))
  ipcMain.handle(C.renameSession, (_e, sessionId: string, yeniBaslik: string) =>
    service.renameSession(sessionId, yeniBaslik)
  )
  ipcMain.handle(C.clearSessions, (_e, sketchPath: string) => service.clearSessions(sketchPath))
  ipcMain.handle(C.migrateSessions, (_e, oldPath: string, newPath: string, newName: string) =>
    service.migrateSessions(oldPath, newPath, newName)
  )
  ipcMain.handle(C.getProviderModels, (_e, provider: AIProviderId) =>
    modelListele(provider)
  )
  ipcMain.handle(
    C.compactSession,
    async (_e, params: { sessionId: string; provider: AIProviderId; model?: string }) => {
      const session = await service.getSession(params.sessionId)
      if (!session) {
        return { success: false, error: 'Oturum bulunamadı.' }
      }
      const result = await compaction.compactChatSession(session, params.provider, params.model)
      if (result.success && result.session) {
        await service.saveSession(result.session)
      }
      return result
    }
  )
  ipcMain.handle(
    C.generateTitle,
    async (_e, params: { sessionId: string; provider: AIProviderId; model?: string }): Promise<string | null> => {
      if (!params || typeof params.sessionId !== 'string') return null
      const session = await service.getSession(params.sessionId)
      if (!session || session.mesajlar.length < 2) return null
      const baslik = await compaction.baslikUret(session.mesajlar, params.provider, params.model)
      if (!baslik) return null
      await service.renameSession(session.id, baslik)
      return baslik
    }
  )
}

