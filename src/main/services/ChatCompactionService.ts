import type { AIProviderId, ChatMessage, ChatSession } from '@shared/types'
import type { SecretsService } from './SecretsService'
import type { SettingsService } from './SettingsService'
import { resolveProvider, streamChat } from './agent/providers'

const SUMMARIZER_PROMPT = `Sen gömülü sistemler, C/C++ ve Arduino projeleri için uzman bir teknik bağlam ve hafıza özetleyicisisin.
Görevin: Verilen geçmiş konuşmaları dikkatle analiz ederek, gelecekteki kodlama turlarında yapay zekânın hatırlaması gereken tüm kritik teknik kararları yoğun, net ve yüksek kaliteli bir Markdown hafıza özeti olarak çıkarmaktır.

MUTLAKA KORUNMASI GEREKENLER (Bulunuyorsa):
1. 🎯 Proje Hedefi: Kullanıcının ne yapmak istediği ve projenin ana amacı.
2. 🔌 Donanım ve Kart: Seçilen mikrodenetleyici (ESP32, STM32, Arduino Uno vb.), kart modeli ve pinout özellikleri.
3. 📌 Pin Haritası ve Bağlantılar: Belirlenen tüm pinler (örn. DHT22 -> GPIO 4, I2C SDA/SCL, Röle pini vb.).
4. 📚 Kütüphaneler ve Protokoller: Kullanılan kütüphaneler (#include), haberleşme protokolleri (ESP-NOW, MQTT, BLE, I2C, SPI vb.).
5. ⚙️ Mimari Kararlar ve Durum: Verici/Alıcı ayrımı, dosya adları, çözülmüş kritik hatalar ve şu anki çalışma durumu.

KURALLAR:
- Kod bloklarını asla uzun uzun tekrarlama! Sadece yapılan işi veya fonksiyon adını yaz.
- Kısa, net maddeler (bullet points) ve kalın başlıklar kullan.
- Selamlaşma, dolgu cümlesi veya nezaket kalıpları yazma, doğrudan teknik özeti ver.`

const BASLIK_ISTEMI = `Bir Arduino/gömülü sistem sohbeti için başlık yaz.
Kurallar:
- 3 ile 6 kelime, Türkçe, cümle düzeninde (ilk harf büyük).
- Konuyu somut söyle: kullanılan kart, sensör/kütüphane veya yapılan iş (örn. "DHT22 ile sıcaklık okuma", "ESP32 Wi-Fi web sunucusu").
- Sadece başlığı yaz. Tırnak, nokta, emoji, markdown ve açıklama kullanma.`

/** Modelin çıktısını tek satırlık, temiz bir başlığa çevirir; kullanışsızsa null döner. */
export function baslikTemizle(ham: string): string | null {
  let b = ham
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .split('\n')
    .map((x) => x.trim())
    .find((x) => x.length > 0)
  if (!b) return null
  b = b
    .replace(/^(başlık|baslik|title)\s*[:：-]\s*/i, '')
    .replace(/^[#*>\-\s"'“”‘’`]+/, '')
    .replace(/[*"'“”‘’`]+$/g, '')
    .replace(/[.!:;,\s]+$/, '')
    .trim()
  if (b.length < 3) return null
  if (b.length > 60) b = b.slice(0, 58).trimEnd() + '…'
  return b
}

/** Uzun sohbet geçmişini AI ile özetleyerek bağlam penceresinden yer açar. */
export class ChatCompactionService {
  constructor(
    private secrets: SecretsService,
    private settings: SettingsService
  ) {}

  private cleanBloatFromMessage(text: string): string {
    if (!text) return ''

    let cleaned = text

    // 1. <editor_action>...</editor_action> etiketini yakala ve tek satıra indir
    cleaned = cleaned.replace(
      /<editor_action[^>]*(?:filename="([^"]*)")?[^>]*summary="([^"]*)"[^>]*>[\s\S]*?<\/editor_action>/gi,
      (_match, filename, summary) => `[Editör Eylemi: ${filename ? filename + ' - ' : ''}${summary}]`
    )
    cleaned = cleaned.replace(
      /<editor_action[^>]*(?:summary="([^"]*)")?[^>]*filename="([^"]*)"[^>]*>[\s\S]*?<\/editor_action>/gi,
      (_match, summary, filename) => `[Editör Eylemi: ${filename ? filename + ' - ' : ''}${summary || 'Dosya oluşturuldu'}]`
    )
    cleaned = cleaned.replace(
      /<editor_action[^>]*type="([^"]*)"[^>]*>[\s\S]*?<\/editor_action>/gi,
      (_match, type) => `[Editör Eylemi: ${type} uygulandı]`
    )
    cleaned = cleaned.replace(/<editor_action[\s\S]*?<\/editor_action>/gi, '[Editör Eylemi: Kod uygulandı]')

    // 2. 5 satırdan uzun C++ veya Markdown kod bloklarını sıkıştır
    cleaned = cleaned.replace(/```(?:cpp|c|arduino)?\n([\s\S]*?)```/gi, (match, code) => {
      const lineCount = code.split('\n').length
      if (lineCount > 5) {
        return `[C++ Kod Bloğu: ${lineCount} satır - güncel dosya bağlamında mevcuttur]`
      }
      return match
    })

    return cleaned
  }

  private generateAlgorithmicSummary(messages: Array<{ rol: string; metin: string }>): string {
    const lines: string[] = []
    for (const m of messages) {
      const roleLabel = m.rol === 'kullanici' ? 'Kullanıcı' : 'Cloud AI'
      let ozet = m.metin
        .replace(/<explanation>|<\/explanation>/gi, '')
        .replace(/\n+/g, ' ')
        .trim()
      if (ozet.length > 200) {
        ozet = ozet.slice(0, 197) + '...'
      }
      if (ozet) {
        lines.push(`• **${roleLabel}:** ${ozet}`)
      }
    }
    return lines.join('\n')
  }

  async summarizeMessagesWithAi(
    messages: Array<{ rol: 'kullanici' | 'asistan' | 'sistem'; metin: string }>,
    provider: AIProviderId,
    model?: string
  ): Promise<string> {
    const temiz = messages.map((m) => ({ rol: m.rol, metin: this.cleanBloatFromMessage(m.metin) }))
    try {
      const formatli = temiz
        .map((m) => `[${m.rol === 'kullanici' ? 'Kullanıcı' : 'Cloud AI'}]:\n${m.metin}`)
        .join('\n\n---\n\n')
      const p = resolveProvider(provider, model, this.secrets, this.settings)
      const ac = new AbortController()
      const zamanlayici = setTimeout(() => ac.abort(), p.isLocal ? 120_000 : 45_000)
      let cikti = ''
      try {
        for await (const ev of streamChat(
          p,
          {
            system: SUMMARIZER_PROMPT,
            messages: [
              {
                role: 'user',
                content: `Aşağıdaki geçmiş konuşma akışını dikkatle incele. Seçilen donanım kartını, pin bağlantılarını, kütüphaneleri, mimari kararları ve proje durumunu eksiksiz özetle:

${formatli.slice(0, p.isLocal ? 12000 : 60000)}`
              }
            ],
            maxTokens: 1500,
            temperature: 0.2,
            numCtx: 8192
          },
          ac.signal
        )) {
          if (ev.type === 'text') cikti += ev.delta
        }
      } finally {
        clearTimeout(zamanlayici)
      }
      if (cikti.trim().length > 20) return cikti.trim()
    } catch (err) {
      console.warn('[ChatCompaction] AI ile özetleme başarısız oldu, algoritmik özete dönülüyor:', err)
    }
    return this.generateAlgorithmicSummary(temiz)
  }

  async compactChatSession(
    session: ChatSession,
    provider: AIProviderId,
    model?: string
  ): Promise<{ success: boolean; session?: ChatSession; error?: string }> {
    if (!session || !session.mesajlar || session.mesajlar.length <= 4) {
      return {
        success: false,
        error: 'Sohbet geçmişi henüz çok kısa (4 mesaj veya daha az). Özetlemeye gerek yok.'
      }
    }

    const RECENT_COUNT = Math.min(6, Math.max(4, session.mesajlar.length <= 6 ? 2 : 4))
    const olderMessages = session.mesajlar.slice(0, session.mesajlar.length - RECENT_COUNT)
    const recentMessages = session.mesajlar.slice(session.mesajlar.length - RECENT_COUNT)

    if (olderMessages.length === 0) {
      return {
        success: false,
        error: 'Özetlenecek yeterli eski mesaj bulunmuyor.'
      }
    }

    const aiSummary = await this.summarizeMessagesWithAi(
      olderMessages.map((m) => ({ rol: m.rol, metin: m.metin })),
      provider,
      model
    )

    const summaryMessage: ChatMessage = {
      id: 'msg_summary_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now(),
      rol: 'asistan',
      metin: `### 🧠 AI Bağlam ve Hafıza Özeti\n*Önceki konuşmalar bağlam optimizasyonu ve donanım kararlarının korunması için AI tarafından özetlendi:*\n\n${aiSummary}`,
      timestamp: Date.now(),
      isCompactedSummary: true
    }

    const updatedSession: ChatSession = {
      ...session,
      guncellemeTarihi: Date.now(),
      mesajlar: [summaryMessage, ...recentMessages]
    }

    return {
      success: true,
      session: updatedSession
    }
  }

  /**
   * Sohbetin ilk mesajı ve yanıtından kısa, anlamlı bir başlık üretir. Yapay zekâ yanıt
   * vermezse ya da çıktı kullanışsızsa null döner; çağıran taraf mevcut başlığı korur.
   */
  async baslikUret(
    mesajlar: Array<{ rol: string; metin: string }>,
    provider: AIProviderId,
    model?: string
  ): Promise<string | null> {
    const ilkKullanici = mesajlar.find((m) => m.rol === 'kullanici')?.metin ?? ''
    if (!ilkKullanici.trim()) return null
    const ilkYanit = mesajlar.find((m) => m.rol === 'asistan' && !m.metin.startsWith('###'))?.metin ?? ''

    const kisalt = (t: string, n: number): string => (t.length > n ? t.slice(0, n) + '…' : t)
    const icerik =
      `Kullanıcının ilk isteği:\n${kisalt(ilkKullanici.replace(/```[\s\S]*?```/g, '[kod]'), 600)}` +
      (ilkYanit ? `\n\nAsistanın yanıtı:\n${kisalt(this.cleanBloatFromMessage(ilkYanit), 600)}` : '')

    try {
      const p = resolveProvider(provider, model, this.secrets, this.settings)
      const ac = new AbortController()
      const zamanlayici = setTimeout(() => ac.abort(), p.isLocal ? 45_000 : 20_000)
      let cikti = ''
      try {
        for await (const ev of streamChat(
          p,
          {
            system: BASLIK_ISTEMI,
            messages: [{ role: 'user', content: icerik }],
            maxTokens: 200,
            temperature: 0.3,
            reasoningEffort: 'low',
            numCtx: 4096
          },
          ac.signal
        )) {
          if (ev.type === 'text') cikti += ev.delta
        }
      } finally {
        clearTimeout(zamanlayici)
      }
      return baslikTemizle(cikti)
    } catch (err) {
      console.warn('[ChatCompaction] Başlık üretilemedi:', err)
      return null
    }
  }
}
