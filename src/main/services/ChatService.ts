import { promises as fs } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import type { ChatSession, ChatSessionSummary } from '@shared/types'

/**
 * Dosya yolunu normalize eder: ayraçları '/' yapar, baştaki/sondaki boşlukları
 * temizler ve Windows dosya sistemi için küçük harfe çevirir.
 */
function normalizePath(p: string): string {
  return p.trim().replace(/\\/g, '/').toLowerCase()
}

/**
 * Proje / sketch bazlı AI sohbet oturumlarını disk üzerinde saklayan ve
 * yöneten servis. Her sketch'in oturumları `%APPDATA%/dret-ide/chats/<hash>.json`
 * dosyasında izole olarak tutulur. Böylece farklı bir sketch açıldığında diğer
 * projelerin sohbet geçmişi asla karışmaz.
 */
export class ChatService {
  private chatsDir: string

  constructor(userDataPath: string) {
    this.chatsDir = join(userDataPath, 'chats')
  }

  private getFilePathForSketch(sketchPath: string): string {
    const norm = normalizePath(sketchPath)
    const hash = createHash('sha256').update(norm).digest('hex').slice(0, 20)
    return join(this.chatsDir, `${hash}.json`)
  }

  private async ensureChatsDir(): Promise<void> {
    try {
      await fs.mkdir(this.chatsDir, { recursive: true })
    } catch {
      // Dizin zaten varsa hata vermez
    }
  }

  private async readSessionsForFile(filePath: string): Promise<ChatSession[]> {
    try {
      const data = await fs.readFile(filePath, 'utf-8')
      const sessions = JSON.parse(data) as ChatSession[]
      return Array.isArray(sessions) ? sessions : []
    } catch {
      return []
    }
  }

  private async writeSessionsForFile(filePath: string, sessions: ChatSession[]): Promise<void> {
    await this.ensureChatsDir()
    await fs.writeFile(filePath, JSON.stringify(sessions, null, 2), 'utf-8')
  }

  /**
   * Belirtilen sketch'e ait tüm sohbet oturumlarının özetini döner.
   * Son güncellenen oturum en başta yer alır.
   */
  async getSessions(sketchPath: string): Promise<ChatSessionSummary[]> {
    if (!sketchPath) return []
    const filePath = this.getFilePathForSketch(sketchPath)
    const sessions = await this.readSessionsForFile(filePath)

    return sessions
      .sort((a, b) => b.guncellemeTarihi - a.guncellemeTarihi)
      .map((s) => {
        const sonMesajObj = s.mesajlar[s.mesajlar.length - 1]
        let sonMesaj = sonMesajObj ? sonMesajObj.metin.replace(/```[\s\S]*?```/g, '[Kod]').trim() : undefined
        if (sonMesaj && sonMesaj.length > 80) {
          sonMesaj = sonMesaj.slice(0, 77) + '...'
        }
        return {
          id: s.id,
          sketchPath: s.sketchPath,
          sketchName: s.sketchName,
          baslik: s.baslik,
          olusturmaTarihi: s.olusturmaTarihi,
          guncellemeTarihi: s.guncellemeTarihi,
          mesajSayisi: s.mesajlar.length,
          sonMesaj
        }
      })
  }

  /**
   * Belirli bir oturumu ID'sine göre arar ve döner.
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    if (!sessionId) return null
    await this.ensureChatsDir()
    try {
      const files = await fs.readdir(this.chatsDir)
      for (const file of files) {
        if (!file.endsWith('.json')) continue
        const filePath = join(this.chatsDir, file)
        const sessions = await this.readSessionsForFile(filePath)
        const match = sessions.find((s) => s.id === sessionId)
        if (match) return match
      }
    } catch {
      // Hata durumunda null döner
    }
    return null
  }

  /**
   * Yeni bir sohbet oturumu oluşturur ve kaydeder.
   */
  async createSession(sketchPath: string, sketchName: string, baslik?: string): Promise<ChatSession> {
    const simdi = Date.now()
    const yeniOturum: ChatSession = {
      id: 'chat_' + Math.random().toString(36).slice(2, 10) + '_' + simdi,
      sketchPath,
      sketchName: sketchName || 'Sketch',
      baslik: baslik?.trim() || 'Yeni Sohbet',
      olusturmaTarihi: simdi,
      guncellemeTarihi: simdi,
      mesajlar: []
    }

    const filePath = this.getFilePathForSketch(sketchPath)
    const sessions = await this.readSessionsForFile(filePath)
    sessions.unshift(yeniOturum)
    await this.writeSessionsForFile(filePath, sessions)

    return yeniOturum
  }

  /**
   * Mevcut bir oturumu kaydeder veya günceller.
   */
  async saveSession(session: ChatSession): Promise<void> {
    if (!session || !session.sketchPath || !session.id) return
    const filePath = this.getFilePathForSketch(session.sketchPath)
    const sessions = await this.readSessionsForFile(filePath)

    const index = sessions.findIndex((s) => s.id === session.id)
    session.guncellemeTarihi = Date.now()

    if (index >= 0) {
      sessions[index] = session
    } else {
      sessions.unshift(session)
    }

    await this.writeSessionsForFile(filePath, sessions)
  }

  /**
   * Bir oturumu ID'sine göre siler.
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!sessionId) return
    await this.ensureChatsDir()
    try {
      const files = await fs.readdir(this.chatsDir)
      for (const file of files) {
        if (!file.endsWith('.json')) continue
        const filePath = join(this.chatsDir, file)
        const sessions = await this.readSessionsForFile(filePath)
        const filtered = sessions.filter((s) => s.id !== sessionId)
        if (filtered.length !== sessions.length) {
          await this.writeSessionsForFile(filePath, filtered)
          break
        }
      }
    } catch {
      // Hata yok sayılır
    }
  }

  /**
   * Bir oturumun başlığını günceller.
   */
  async renameSession(sessionId: string, yeniBaslik: string): Promise<void> {
    if (!sessionId || !yeniBaslik.trim()) return
    await this.ensureChatsDir()
    try {
      const files = await fs.readdir(this.chatsDir)
      for (const file of files) {
        if (!file.endsWith('.json')) continue
        const filePath = join(this.chatsDir, file)
        const sessions = await this.readSessionsForFile(filePath)
        const session = sessions.find((s) => s.id === sessionId)
        if (session) {
          session.baslik = yeniBaslik.trim()
          session.guncellemeTarihi = Date.now()
          await this.writeSessionsForFile(filePath, sessions)
          break
        }
      }
    } catch {
      // Hata yok sayılır
    }
  }

  /**
   * Bir sketch'e ait tüm oturumları siler.
   */
  async clearSessions(sketchPath: string): Promise<void> {
    if (!sketchPath) return
    const filePath = this.getFilePathForSketch(sketchPath)
    try {
      await fs.unlink(filePath)
    } catch {
      // Dosya zaten yoksa sorun yok
    }
  }

  /**
   * Bir sketch klasörü yeniden adlandırıldığında veya taşındığında,
   * eski klasördeki tüm sohbet oturumlarını yeni klasörün hash dosyasına taşır
   * ve oturumların içindeki sketchPath ve sketchName değerlerini günceller.
   */
  async migrateSessions(oldSketchPath: string, newSketchPath: string, newSketchName: string): Promise<void> {
    if (!oldSketchPath || !newSketchPath) return
    const normOld = normalizePath(oldSketchPath)
    const normNew = normalizePath(newSketchPath)
    if (normOld === normNew) return

    await this.ensureChatsDir()
    const oldFilePath = this.getFilePathForSketch(oldSketchPath)
    const newFilePath = this.getFilePathForSketch(newSketchPath)

    const oldSessions = await this.readSessionsForFile(oldFilePath)
    if (oldSessions.length === 0) return

    const newSessions = await this.readSessionsForFile(newFilePath)

    const updatedOldSessions = oldSessions.map((s) => ({
      ...s,
      sketchPath: newSketchPath,
      sketchName: newSketchName || s.sketchName
    }))

    // Yeni dosyada zaten oturumlar varsa birleştir, yoksa doğrudan eskiyi aktar
    const combined = [
      ...updatedOldSessions,
      ...newSessions.filter((ns) => !updatedOldSessions.some((os) => os.id === ns.id))
    ]
    await this.writeSessionsForFile(newFilePath, combined)

    try {
      await fs.unlink(oldFilePath)
    } catch {
      // Hata yok sayılır
    }
  }
}
