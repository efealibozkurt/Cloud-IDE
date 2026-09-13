import { ipcMain } from 'electron'
import { IPC_CHANNELS, type CustomSkill, type SkillsInfoResult } from '@shared/types'
import type { RagService } from '../services/RagService'
import type { BoardSkillEngine, BoardContext } from '../services/BoardSkillEngine'
import type { CustomSkillService } from '../services/CustomSkillService'

export function skillsIpcKaydet(
  ragService: RagService,
  boardSkillEngine: BoardSkillEngine,
  customSkillService: CustomSkillService
): void {
  const C = IPC_CHANNELS.skills

  ipcMain.handle(C.getSkillsInfo, async (_e, boardContext?: BoardContext): Promise<SkillsInfoResult> => {
    const rag = ragService.getStats()
    const boardProfiles = boardSkillEngine.getAllBoardProfiles()
    const activeBoardFamily = boardSkillEngine.detectBoardFamily(boardContext)
    const chunks = ragService.listChunks()

    return {
      rag,
      boardProfiles,
      activeBoardFamily,
      chunks
    }
  })

  ipcMain.handle(C.listCustomSkills, async (): Promise<CustomSkill[]> => {
    return await customSkillService.list()
  })

  ipcMain.handle(
    C.addCustomSkill,
    async (_e, skill: Omit<CustomSkill, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomSkill> => {
      const added = await customSkillService.add(skill)
      // RAG indeksine de ekle
      await ragService.addCustomSkillChunk(added)
      return added
    }
  )

  ipcMain.handle(C.deleteCustomSkill, async (_e, id: string): Promise<boolean> => {
    const deleted = await customSkillService.delete(id)
    if (deleted) {
      await ragService.removeCustomSkillChunk(id)
    }
    return deleted
  })

  ipcMain.handle(C.reindexRag, async (): Promise<{ newChunks: number; totalChunks: number }> => {
    const newChunks = await ragService.indexInstalledExamples(40)
    return {
      newChunks,
      totalChunks: ragService.getChunkCount()
    }
  })

  ipcMain.handle(C.getSkillsDirectory, async (): Promise<string> => {
    return customSkillService.getSkillsDirectory()
  })

  ipcMain.handle(C.openSkillsFolder, async (): Promise<boolean> => {
    return await customSkillService.openSkillsFolder()
  })

  ipcMain.handle(C.saveBoardModel, async (_e, family: string, model: any): Promise<boolean> => {
    return await boardSkillEngine.saveBoardModel(family, model)
  })

  ipcMain.handle(C.addBoardModel, async (_e, family: string, model: any): Promise<boolean> => {
    return await boardSkillEngine.addBoardModel(family, model)
  })

  ipcMain.handle(C.deleteBoardModel, async (_e, family: string, modelId: string): Promise<boolean> => {
    return await boardSkillEngine.deleteBoardModel(family, modelId)
  })

  ipcMain.handle(C.resetBoardModel, async (_e, family: string, modelId?: string): Promise<boolean> => {
    return await boardSkillEngine.resetBoardModel(family, modelId)
  })
}
