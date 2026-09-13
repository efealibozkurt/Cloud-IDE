import { ipcMain } from 'electron'
import { IPC_CHANNELS, type ChatSession, type SendAiMessageParams, type AIProviderId } from '@shared/types'
import { ChatService } from '../services/ChatService'
import { LlmService } from '../services/LlmService'

/** ChatService ve LlmService'i IPC'ye bağlayan ince sarmalayıcı katman */
export function chatIpcKaydet(service: ChatService, llmService: LlmService): void {
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
  ipcMain.handle(C.sendAiMessage, (_e, params: SendAiMessageParams) => llmService.sendMessage(params))
  ipcMain.handle(C.sendAiMessageStream, (event, params: SendAiMessageParams) => {
    const streamId = params.streamId || 'stream_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now()
    const sender = event.sender

    void llmService.sendMessageStream({ ...params, streamId }, (chunkEvent) => {
      if (!sender.isDestroyed()) {
        sender.send(C.onStreamChunk, chunkEvent)
      }
    })

    return streamId
  })
  ipcMain.handle(C.getProviderModels, (_e, provider: AIProviderId) => llmService.getModels(provider))
  ipcMain.handle(
    C.compactSession,
    async (_e, params: { sessionId: string; provider: AIProviderId; model?: string }) => {
      const session = await service.getSession(params.sessionId)
      if (!session) {
        return { success: false, error: 'Oturum bulunamadı.' }
      }
      const result = await llmService.compactChatSession(session, params.provider, params.model)
      if (result.success && result.session) {
        await service.saveSession(result.session)
      }
      return result
    }
  )
}

