import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import {
  IPC_CHANNELS,
  isValidProviderId,
  type AgentEvent,
  type AgentReply,
  type AgentRunParams,
  type AIProviderId
} from '@shared/types'
import type { AgentService } from '../services/agent/AgentService'

const RUN_ID_DESENI = /^[\w-]{1,80}$/

/** runId → çalıştırmayı başlatan pencerenin webContents kimliği (başka pencerenin run'ına müdahaleyi önler) */
const sahipler = new Map<string, number>()

function sahipMi(e: IpcMainInvokeEvent, runId: unknown): runId is string {
  return typeof runId === 'string' && sahipler.get(runId) === e.sender.id
}

/** Renderer'dan gelen parametreleri doğrular; geçersizse nedenini döndürür. */
function parametreHatasi(p: unknown): string | null {
  if (!p || typeof p !== 'object') return 'Geçersiz agent parametresi'
  const a = p as Partial<AgentRunParams>
  if (typeof a.runId !== 'string' || !RUN_ID_DESENI.test(a.runId)) return 'Geçersiz runId'
  if (!isValidProviderId(a.provider)) return 'Geçersiz sağlayıcı'
  if (typeof a.model !== 'string' || a.model.length === 0 || a.model.length > 200) return 'Geçersiz model'
  if (!Array.isArray(a.messages) || a.messages.length === 0 || a.messages.length > 500) return 'Geçersiz mesaj listesi'
  if (!a.workspace || typeof a.workspace !== 'object' || !Array.isArray(a.workspace.sketchPaths)) {
    return 'Geçersiz çalışma alanı'
  }
  return null
}

/** AgentService'i IPC'ye bağlayan ince katman. Olaylar, çalıştırmayı başlatan pencereye gönderilir. */
export function agentIpcKaydet(service: AgentService): void {
  const C = IPC_CHANNELS.agent

  ipcMain.handle(C.run, (event, params: AgentRunParams) => {
    const sender = event.sender
    const hata = parametreHatasi(params)
    const gonder = (e: AgentEvent): void => {
      if (!sender.isDestroyed()) sender.send(C.onEvent, e)
    }
    const runId = (params as { runId?: string } | undefined)?.runId ?? ''
    if (hata || sahipler.has(params.runId)) {
      gonder({
        runId,
        type: 'done',
        ok: false,
        text: '',
        error: hata ?? 'Bu runId zaten çalışıyor',
        changes: [],
        steps: []
      })
      return
    }

    sahipler.set(params.runId, sender.id)
    // Pencere kapanırsa çalışmayı durdur (arka planda dosya yazmaya devam etmesin)
    const win = BrowserWindow.fromWebContents(sender)
    const kapaninca = (): void => service.abort(params.runId)
    win?.once('closed', kapaninca)

    // Uzun süren çalışma beklenmez; ilerleme olay olarak akar, bitiş `done` olayıyla bildirilir
    void service
      .run(params, gonder)
      .catch((err) => {
        console.error('[agentIpc] Beklenmeyen hata:', err)
        gonder({
          runId: params.runId,
          type: 'done',
          ok: false,
          text: '',
          error: `Beklenmeyen hata: ${(err as Error).message}`,
          changes: [],
          steps: []
        })
      })
      .finally(() => {
        sahipler.delete(params.runId)
        win?.removeListener('closed', kapaninca)
      })
  })

  ipcMain.handle(C.abort, (e, runId: string) => {
    if (sahipMi(e, runId)) service.abort(runId)
  })
  ipcMain.handle(C.reply, (e, runId: string, callId: string, reply: AgentReply) => {
    if (!sahipMi(e, runId) || typeof callId !== 'string' || !reply || typeof reply.approved !== 'boolean') return
    service.reply(runId, callId, {
      approved: reply.approved,
      answer: typeof reply.answer === 'string' ? reply.answer.slice(0, 20000) : undefined
    })
  })
  ipcMain.handle(C.undo, (_e, checkpointId: string) => {
    if (typeof checkpointId !== 'string' || !/^[\w-]{1,80}$/.test(checkpointId)) {
      return { ok: false, error: 'Geçersiz checkpoint kimliği', affectedFolders: [] }
    }
    return service.undo(checkpointId)
  })
  ipcMain.handle(C.testProvider, (_e, provider: AIProviderId, model?: string) => {
    if (!isValidProviderId(provider)) throw new Error('Geçersiz sağlayıcı')
    return service.testProvider(provider, typeof model === 'string' ? model : undefined)
  })
}
