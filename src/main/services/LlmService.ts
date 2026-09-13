import type { AIProviderId, ReasoningEffort, SendAiMessageParams, SendAiMessageResult, StreamChunkEvent, ChatMessage, ChatSession } from '@shared/types'
import { SecretsService } from './SecretsService'
import type { ArduinoCliService } from './ArduinoCliService'
import { BoardSkillEngine } from './BoardSkillEngine'
import { RagService } from './RagService'
import type { CustomSkillService } from './CustomSkillService'

/** Her sağlayıcı için varsayılan / çevrimdışı fallback model listeleri */
const FALLBACK_MODELLER: Record<AIProviderId, string[]> = {
  gemini: [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash-thinking-exp-01-21',
    'gemini-2.5-flash'
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'o1',
    'o1-mini',
    'o3-mini',
    'gpt-4-turbo'
  ],
  anthropic: [
    'claude-3-7-sonnet-latest',
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest',
    'claude-3-opus-latest',
    'claude-3-5-sonnet-20241022'
  ],
  deepseek: [
    'deepseek-chat',
    'deepseek-reasoner'
  ],
  kimi: [
    'kimi-k3',
    'kimi-k2.5',
    'kimi-latest',
    'kimi-k2-instruct',
    'kimi-k2.7-code',
    'moonshot-v1-auto',
    'moonshot-v1-128k',
    'moonshot-v1-32k',
    'moonshot-v1-8k'
  ],
  nvidia: [
    'moonshotai/kimi-k3',
    'meta/llama-3.3-70b-instruct',
    'deepseek-ai/deepseek-r1',
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'qwen/qwen2.5-coder-32b-instruct',
    'meta/llama-3.1-70b-instruct',
    'mistralai/mistral-large-2-instruct'
  ],
  lmstudio: [
    'local-model'
  ]
}

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

const SISTEM_PROMPTU = `Sen Cloud IDE'nin akıllı gömülü sistemler ve Arduino uzmanı yapay zekâ asistanı Cloud AI'sın.
Arduino, ESP32, ESP8266, Deneyap Kart, RP2040, STM32 ve C/C++ gömülü yazılım geliştirme konularında derin uzmanlığa sahipsin.

════════════════════════════════════════════════════════
ÖNEMLİ MİMARİ VE YANIT PROTOKOLÜ (AGENT SİSTEMİ):
════════════════════════════════════════════════════════
Sen kullanıcıyla doğrudan pair-programming yapan akıllı bir AI Agent'sın. Kod ve sohbet ayrımını temiz tutmak için yanıtlarını MUTLAKA aşağıdaki etiket yapısına göre biçimlendir:

1. AÇIKLAMA VE SOHBET KISMI:
Her yanıtında ne yaptığını, yapılan değişikliğin teknik gerekçesini, donanım/pin bağlantılarını veya sorunun cevabını <explanation>...</explanation> etiketi içine yaz.
- Burada zengin Markdown (başlıklar, listeler, kalın yazılar, inline kodlar vb.) serbestçe kullanılır.
- DİKKAT: Editöre uygulanacak kod bloklarını ASLA <explanation> içine yığma! Chat alanı salt açıklama, rehberlik ve analiz içindir.

2. EDİTÖR EYLEMİ (KOD UYGULAMA) KISMI:
Eğer kullanıcının isteği editörde bir kod yazmayı veya düzeltmeyi gerektiriyorsa, bunu <editor_action> etiketi içine koy:

DURUM A: Kullanıcı bir kod parçası SEÇTİYSE ve bu seçimi düzeltmeni/geliştirmeni istiyorsa:
<editor_action type="replace_selection" summary="Seçili kod için yapılan işlemin kısa özeti">
\`\`\`cpp
// DİKKAT: Buraya SADECE VE SADECE kullanıcının seçtiği satırların yerine geçecek kodu yaz!
// Dosyanın tamamını veya seçimin dışındaki fonksiyonları (örn. void setup(), void loop()) ASLA tekrarlama!
// Seçili satırların dosyadaki girintilemesine (indentation) ve parantez dengesine harfiyen uy.
\`\`\`
</editor_action>

DURUM B: Kullanıcı aktif dosyayı veya projedeki belirli/farklı bir dosyayı yeniden yazmanı/güncellemeni istediyse (veya seçim yapmadan yeni bir kod istediyse):
- Eğer şu anda açık olan AKTİF DOSYAYI güncelliyorsan:
<editor_action type="replace_file" summary="Tüm dosya güncellendi">
\`\`\`cpp
// Dosyanın derlenebilir eksiksiz hali
\`\`\`
</editor_action>

- Eğer projedeki FARKLI veya BELİRLİ BİR DOSYAYI güncelliyorsan (örneğin alici.ino, verici.ino, config.h vb.):
<editor_action type="replace_file" filename="alici.ino" summary="alici.ino dosyası güncellendi">
\`\`\`cpp
// Hedef dosyanın derlenebilir eksiksiz hali
\`\`\`
</editor_action>
(ÖNEMLİ KURAL: Aktif açık dosyadan farklı bir dosyayı veya spesifik bir dosyayı güncellerken MUTLAKA filename="hedef_dosya.ino" niteliğini ekle ki sistem değişikliği doğru dosyaya uygulasın!)

DURUM C: ÇOKLU DOSYA VEYA YENİ DOSYA GEREKTİREN DURUMLAR (OTONOM MİMARİ KARAR VE BAŞLIK DEĞİŞTİRME):
Proje gereksinimlerine göre birden fazla bağımsız parçaya (örn. Alıcı ve Verici) veya modüler dosyalara ihtiyaç duyulduğunda BU KARARI SEN VERİRSİN.
Örnek Senaryolar:
- Alıcı ve Verici (Transmitter & Receiver) gerektiren haberleşme projeleri (ESP-NOW, NRF24L01, LoRa, Bluetooth, 433MHz vb.)
- İstemci ve Sunucu (Client & Server / WebServer) mimarileri
- Projeyi modüler tutmak için gereken kütüphane, başlık veya konfigürasyon dosyaları (örn. config.h, pin_map.h, sensor.h, verici.h, alici.h, verici.ino vb.)

BU TÜR ÇOKLU BİLEŞEN DURUMLARINDA UYULMASI ŞART OLAN KURALLAR:
1. VAR OLAN DOSYAYI MUTLAKA KODLA DOLDUR (ASLA BOŞ VEYA DEĞİŞTİRİLMEMİŞ BIRAKMA):
   - Çoklu dosya üretirken ilk bileşenin kodunu (örneğin Verici) MUTLAKA var olan aktif dosyaya yaz (<editor_action type="replace_file" ...>).
   - İkinci bileşeni (örneğin Alıcı) yeni dosya olarak oluştur (<editor_action type="create_file" filename="alici.ino" ...>).
   - Asla sadece yeni dosya oluşturup var olan dosyayı eski/boş haliyle bırakma! İki parçanın da kodu eksiksiz ve hazır olmalıdır.

2. VAR OLAN DOSYANIN BAŞLIĞINI / ADINI DEĞİŞTİRME (KARIŞIKLIK OLMAMASI İÇİN):
   - Eğer projedeki mevcut dosya genel bir ada sahipse (örneğin "sketch_20260903a.ino", "sketch_mar11a.ino" veya belirsiz bir isimdeyse), karışıklık olmaması için bu dosyanın adını amaca uygun olacak şekilde DEĞİŞTİREBİLİRSİN.
   - Dosya adını değiştirmek için <editor_action type="replace_file" rename="verici.ino" summary="..."> etiketine rename="yeni_ad.ino" niteliğini ekle.
   - Editör, Arduino CLI kurallarına uygun olarak sketch klasörünü ve ana dosyayı otomatik olarak bu yeni ada güncelleyecektir.
   - Örnek:
     <editor_action type="replace_file" rename="verici.ino" summary="Mevcut dosya verici.ino olarak adlandırıldı ve Verici kodu uygulandı">
     \`\`\`cpp
     // Verici kodu...
     \`\`\`
     </editor_action>
     <editor_action type="create_file" filename="alici.ino" summary="Alıcı kodu için alici.ino dosyası oluşturuldu">
     \`\`\`cpp
     // Alıcı kodu...
     \`\`\`
     </editor_action>

3. KODLARIN EN BAŞINA BELİRGİN BAŞLIK YORUMU EKLE:
   - Karışıklığı tamamen önlemek için her dosyanın 1. satırına büyük, net bir başlık koy:
     // ==========================================
     // PROJE BİLEŞENİ: VERİCİ (TRANSMITTER)
     // DOSYA: verici.ino
     // ==========================================
     ve diğer dosya için:
     // ==========================================
     // PROJE BİLEŞENİ: ALICI (RECEIVER)
     // DOSYA: alici.ino
     // ==========================================

4. AÇIKLAMA (<explanation>):
   - Hangi dosyanın ne amaçla adlandırıldığını, yeni açılan dosyanın işlevini ve iki parçanın (örneğin Alıcı ve Verici kartlarının) donanım pinlerini ve nasıl yükleneceğini açıkça izah et.

DURUM D: Kullanıcı sadece soru sorduysa, analiz veya bilgi istediyse:
<editor_action> bloğu KULLANMA! Sadece <explanation> etiketiyle yanıt ver. Editöre gereksiz yere dokunma.

3. KOD KALİTESİ VE DERLENEBİLİRLİK:
- Kodun seçili hedef kart mimarisine ve arduino-cli standartlarına tam uyumlu, modern ve hatasız C++ olmasına özen göster.
- Seçili kartın voltaj seviyelerine (3.3V vs 5V), bellek limitlerine ve pin kısıtlarına mutlaka dikkat et.`

function getReasoningDirective(effort?: ReasoningEffort): string {
  if (effort === 'low') {
    return `\n\n════════════════════════════════════════════════════════
[MUHAKEME DÜZEYİ: DÜŞÜK (HIZLI & ÖZLÜ)]
- Açıklamaları minimumda tut. Doğrudan net ve çalışan C++ çözümüne odaklan.
- Fazla teorik anlatımdan kaçın, en hızlı şekilde derlenebilir çözümü sun.`
  }
  if (effort === 'high') {
    return `\n\n════════════════════════════════════════════════════════
[MUHAKEME DÜZEYİ: YÜKSEK (DERİN MİMARİ & DONANIM ANALİZİ)]
- Sorunu ve donanım mimarisini en ince detayına kadar titizlikle analiz et.
- Mikrodenetleyicinin saat frekansı, kesme (interrupt) çakışmaları, SRAM/Flash bellek tüketimi, lojik voltaj seviyeleri ve olası edge-case durumlarını derinlemesine değerlendirerek en sağlam ve hatasız mimariyi üret.`
  }
  return `\n\n════════════════════════════════════════════════════════
[MUHAKEME DÜZEYİ: ORTA (DENGELİ)]
- Standart derinlikte analiz yap. Gerekli pin ve donanım açıklamalarını dengeli ve anlaşılır şekilde açıkla.`
}

export class LlmService {
  private boardSkillEngine: BoardSkillEngine
  private ragService: RagService
  private kimiBaseUrl = 'https://api.moonshot.ai/v1'

  constructor(
    private secretsService: SecretsService,
    private arduinoCliService?: ArduinoCliService,
    ragService?: RagService,
    private customSkillService?: CustomSkillService,
    private userDataPath?: string
  ) {
    this.ragService = ragService || new RagService(this.arduinoCliService)
    this.boardSkillEngine = new BoardSkillEngine(
      this.arduinoCliService,
      this.ragService,
      this.customSkillService,
      this.userDataPath
    )
  }

  /**
   * RAG servisine doğrudan erişim sağlar.
   */
  getRagService(): RagService {
    return this.ragService
  }

  /**
   * Kart becerileri motoruna doğrudan erişim sağlar.
   */
  getBoardSkillEngine(): BoardSkillEngine {
    return this.boardSkillEngine
  }

  /**
   * Sağlayıcının API'sine bağlanarak güncel modelleri dinamik olarak çeker.
   * API yanıt vermezse veya anahtar yoksa güncel fallback modelleri döner.
   */
  async getModels(provider: AIProviderId): Promise<string[]> {
    const fallback = FALLBACK_MODELLER[provider] ?? ['default']
    const apiKey = this.secretsService.getDecryptedApiKey(provider)

    // LM Studio için API anahtarı boş olsa bile yerel sunucu taranabilir
    if (!apiKey && provider !== 'lmstudio') {
      return fallback
    }

    try {
      if (provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        const res = await fetch(url, { method: 'GET' })
        if (!res.ok) return fallback
        const data = (await res.json()) as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> }
        if (data.models && Array.isArray(data.models)) {
          const modeller = data.models
            .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('gemini'))
            .map((m) => m.name.replace('models/', ''))
          return modeller.length > 0 ? modeller : fallback
        }
      } else if (provider === 'openai') {
        const url = 'https://api.openai.com/v1/models'
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${apiKey}` }
        })
        if (!res.ok) return fallback
        const data = (await res.json()) as { data?: Array<{ id: string }> }
        if (data.data && Array.isArray(data.data)) {
          const modeller = data.data
            .map((m) => m.id)
            .filter((id) => id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3'))
            .sort()
          return modeller.length > 0 ? modeller : fallback
        }
      } else if (provider === 'anthropic') {
        try {
          const url = 'https://api.anthropic.com/v1/models'
          const res = await fetch(url, {
            headers: {
              'x-api-key': apiKey!,
              'anthropic-version': '2023-06-01'
            }
          })
          if (res.ok) {
            const data = (await res.json()) as { data?: Array<{ id: string }> }
            if (data.data && Array.isArray(data.data)) {
              const modeller = data.data.map((m) => m.id)
              if (modeller.length > 0) return modeller
            }
          }
        } catch {
          // Anthropic models endpoint yoksa fallback döner
        }
        return fallback
      } else if (provider === 'deepseek') {
        const url = 'https://api.deepseek.com/models'
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${apiKey}` }
        })
        if (!res.ok) return fallback
        const data = (await res.json()) as { data?: Array<{ id: string }> }
        if (data.data && Array.isArray(data.data)) {
          const modeller = data.data.map((m) => m.id)
          return modeller.length > 0 ? modeller : fallback
        }
      } else if (provider === 'kimi') {
        const cleanKey = apiKey!.trim()
        const candidateEndpoints = [
          'https://api.moonshot.ai/v1',
          'https://api.moonshot.cn/v1'
        ]

        for (const baseUrl of candidateEndpoints) {
          try {
            const res = await fetch(`${baseUrl}/models`, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${cleanKey}`,
                Accept: 'application/json'
              }
            })
            if (res.ok) {
              const data = (await res.json()) as { data?: Array<{ id: string }> }
              if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                this.kimiBaseUrl = baseUrl
                const modeller = data.data.map((m) => m.id)
                console.log(`[LlmService] Kimi modelleri başarıyla çekildi (${baseUrl}):`, modeller)
                return modeller
              }
            } else {
              console.warn(`[LlmService] Kimi (${baseUrl}) model listesi HTTP ${res.status}`)
            }
          } catch (netErr) {
            console.warn(`[LlmService] Kimi (${baseUrl}) bağlantı hatası:`, netErr)
          }
        }
        return fallback
      } else if (provider === 'nvidia') {
        const url = 'https://integrate.api.nvidia.com/v1/models'
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json'
          }
        })
        if (!res.ok) return fallback
        const data = (await res.json()) as { data?: Array<{ id: string }> }
        if (data.data && Array.isArray(data.data)) {
          const modeller = data.data.map((m) => m.id).sort()
          return modeller.length > 0 ? modeller : fallback
        }
      } else if (provider === 'lmstudio') {
        const url = 'http://127.0.0.1:1234/v1/models'
        const res = await fetch(url, {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
        })
        if (!res.ok) return fallback
        const data = (await res.json()) as { data?: Array<{ id: string }> }
        if (data.data && Array.isArray(data.data)) {
          const modeller = data.data.map((m) => m.id)
          return modeller.length > 0 ? modeller : fallback
        }
      }
    } catch (err) {
      console.warn(`[LlmService] ${provider} modelleri listelenirken hata oluştu, fallback kullanılıyor:`, err)
    }

    return fallback
  }

  /**
   * Aktif kod bağlamı, donanım becerileri, RAG örnekleri ve muhakeme düzeyine göre zengin sistem promptunu oluşturur.
   */
  async buildSystemPrompt(params: SendAiMessageParams): Promise<string> {
    const { messages, activeCodeContext, reasoningEffort } = params
    let zenginSistemPromptu = SISTEM_PROMPTU

    // Muhakeme Düzeyi Talimatı
    zenginSistemPromptu += getReasoningDirective(reasoningEffort)

    if (activeCodeContext) {
      // 1. Kart donanım beceri profili (Skills) ve kullanıcı kuralları
      const boardProfile = await this.boardSkillEngine.getBoardSkillProfile(activeCodeContext.boardContext)
      zenginSistemPromptu += `\n\n════════════════════════════════════════════════════════\n${boardProfile}\n════════════════════════════════════════════════════════\n`

      // 2. İlgili resmi örnek kodları tara ve ekle
      const sonKullaniciMesaji = messages.filter((m) => m.rol === 'kullanici').pop()?.metin || ''
      const ornekKodlar = await this.boardSkillEngine.getRelevantExamplesContext(
        sonKullaniciMesaji,
        activeCodeContext.boardContext
      )
      if (ornekKodlar) {
        zenginSistemPromptu += ornekKodlar
      }

      // 3. Dosya ve seçim bağlamı
      zenginSistemPromptu += `\n════════════════════════════════════════════════════════\nAKTİF DOSYA: ${activeCodeContext.fileName}\nTam Yol: ${activeCodeContext.filePath}\n`

      if (activeCodeContext.projectFiles && activeCodeContext.projectFiles.length > 0) {
        const dosyaListesi = activeCodeContext.projectFiles
          .map((f) => `- ${f.name}${f.isMainFile ? ' (Ana Dosya)' : ''}`)
          .join('\n')
        zenginSistemPromptu += `PROJEDEKİ MEVCUT DOSYALAR:\n${dosyaListesi}\n`

        const digerDosyalar = activeCodeContext.projectFiles.filter(
          (f) => f.name.toLowerCase() !== activeCodeContext.fileName.toLowerCase() && f.content
        )
        if (digerDosyalar.length > 0) {
          zenginSistemPromptu += `\nPROJEDEKİ DİĞER DOSYALAR VE MEVCUT İÇERİKLERİ:\n`
          for (const d of digerDosyalar) {
            zenginSistemPromptu += `--- DOSYA: ${d.name} ---\n\`\`\`cpp\n${d.content!.slice(0, 10000)}\n\`\`\`\n`
          }
        }
      }

      if (activeCodeContext.selectedCode && activeCodeContext.selectionRange) {
        zenginSistemPromptu += `\nKULLANICININ SEÇTİĞİ ALAN: Satır ${activeCodeContext.selectionRange.startLine} ile ${activeCodeContext.selectionRange.endLine} arası
Seçili Kod:
\`\`\`cpp
${activeCodeContext.selectedCode}
\`\`\`
ÖNEMLİ KURAL: Kullanıcı bu spesifik satırları seçti.
Aşağıda dosyanın TAM İÇERİĞİ yer almaktadır.
Dosyadaki değişkenlere, pin tanımlarına ve çevreleyen fonksiyonlara bakarak:
- Yalnızca bu seçili satırların yerine geçecek kodu <editor_action type="replace_selection" summary="..."> içinde üret.
- Dışarıdaki fonksiyonları (örn. void setup, void loop) TEKRARLAMA!
- Kodun yapısını, girintisini ve parantez dengesini asla bozma!\n`
      } else if (activeCodeContext.selectedCode) {
        zenginSistemPromptu += `\nKullanıcının seçtiği ve üzerinde işlem yapmak istediği kod parçası:\n\`\`\`cpp\n${activeCodeContext.selectedCode}\n\`\`\`\n`
      }

      // Dosyanın tamamı HER ZAMAN eklenir (böylece AI değişkenleri ve fonksiyon yapısını görür)
      if (activeCodeContext.content) {
        zenginSistemPromptu += `\nAÇIK DOSYANIN TAMAMI (MİMARİYİ GÖRMEK VE KORUMAK İÇİN REFERANS):\n\`\`\`cpp\n${activeCodeContext.content.slice(0, 16000)}\n\`\`\`\n════════════════════════════════════════════════════════\n`
      }
    }

    return zenginSistemPromptu
  }

  /**
   * Eski bir mesajdaki devasa kod bloklarını ve <editor_action> etiketlerini
   * anlam kaybı olmadan tek satırlık sembolik özetlere indirger.
   */
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

  /**
   * Belirtilen AI sağlayıcısına doğrudan istek atar (Non-streaming).
   */
  private async callProviderDirect(
    provider: AIProviderId,
    model: string,
    apiKey: string,
    systemPrompt: string,
    messages: SendAiMessageParams['messages'],
    reasoningEffort?: ReasoningEffort
  ): Promise<SendAiMessageResult> {
    if (provider === 'gemini') {
      return await this.callGemini(apiKey, model, systemPrompt, messages, reasoningEffort)
    } else if (provider === 'anthropic') {
      return await this.callAnthropic(apiKey, model, systemPrompt, messages)
    } else if (provider === 'lmstudio') {
      return await this.callOpenAiCompatible(
        'http://127.0.0.1:1234/v1/chat/completions',
        apiKey || 'lm-studio',
        model,
        systemPrompt,
        messages,
        'LM Studio',
        reasoningEffort
      )
    } else if (provider === 'deepseek') {
      return await this.callOpenAiCompatible(
        'https://api.deepseek.com/v1/chat/completions',
        apiKey,
        model,
        systemPrompt,
        messages,
        'DeepSeek',
        reasoningEffort
      )
    } else if (provider === 'kimi') {
      const primaryUrl = `${this.kimiBaseUrl}/chat/completions`
      const secondaryUrl = this.kimiBaseUrl.includes('moonshot.ai')
        ? 'https://api.moonshot.cn/v1/chat/completions'
        : 'https://api.moonshot.ai/v1/chat/completions'
      try {
        const res = await this.callOpenAiCompatible(
          primaryUrl,
          apiKey,
          model,
          systemPrompt,
          messages,
          'Kimi AI',
          reasoningEffort,
          { temperature: 1 }
        )
        if (res.success) return res
        if (
          res.error?.includes('401') ||
          res.error?.includes('403') ||
          res.error?.includes('fetch') ||
          res.error?.includes('ENOTFOUND')
        ) {
          const secRes = await this.callOpenAiCompatible(
            secondaryUrl,
            apiKey,
            model,
            systemPrompt,
            messages,
            'Kimi AI',
            reasoningEffort,
            { temperature: 1 }
          )
          if (secRes.success) {
            this.kimiBaseUrl = this.kimiBaseUrl.includes('moonshot.ai')
              ? 'https://api.moonshot.cn/v1'
              : 'https://api.moonshot.ai/v1'
            return secRes
          }
        }
        return res
      } catch (kimiErr: any) {
        const isAuthOrNetwork =
          kimiErr?.message?.includes('401') ||
          kimiErr?.message?.includes('403') ||
          kimiErr?.message?.includes('fetch') ||
          kimiErr?.message?.includes('ENOTFOUND')
        if (isAuthOrNetwork) {
          return await this.callOpenAiCompatible(
            secondaryUrl,
            apiKey,
            model,
            systemPrompt,
            messages,
            'Kimi AI',
            reasoningEffort,
            { temperature: 1 }
          )
        }
        throw kimiErr
      }
    } else if (provider === 'nvidia') {
      return await this.callOpenAiCompatible(
        'https://integrate.api.nvidia.com/v1/chat/completions',
        apiKey,
        model,
        systemPrompt,
        messages,
        'NVIDIA Build',
        reasoningEffort,
        { max_tokens: 8192 }
      )
    } else {
      // openai
      return await this.callOpenAiCompatible(
        'https://api.openai.com/v1/chat/completions',
        apiKey,
        model,
        systemPrompt,
        messages,
        'OpenAI',
        reasoningEffort
      )
    }
  }

  /**
   * AI çağrısı yapılamadığında veya hata aldığında kullanılan deterministik / algoritmik özetleyici.
   */
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

  /**
   * Geçmiş konuşmaları analiz ederek AI ile teknik ve kaliteli bir hafıza özeti üretir.
   * Herhangi bir ağ hatasında veya kota aşımında algoritmik özete geri düşer (fallback).
   */
  async summarizeMessagesWithAi(
    messages: Array<{ rol: 'kullanici' | 'asistan' | 'sistem'; metin: string }>,
    provider: AIProviderId,
    model?: string
  ): Promise<string> {
    const cleanedMessages = messages.map((m) => ({
      rol: m.rol,
      metin: this.cleanBloatFromMessage(m.metin)
    }))

    const apiKey = this.secretsService.getDecryptedApiKey(provider)
    const secilenModel = model || FALLBACK_MODELLER[provider]?.[0] || 'default'

    if (!apiKey && provider !== 'lmstudio') {
      return this.generateAlgorithmicSummary(cleanedMessages)
    }

    try {
      const formattedTranscript = cleanedMessages
        .map((m) => {
          const sender = m.rol === 'kullanici' ? 'Kullanıcı' : 'Cloud AI'
          return `[${sender}]:\n${m.metin}`
        })
        .join('\n\n---\n\n')

      const promptMessages: SendAiMessageParams['messages'] = [
        {
          rol: 'kullanici',
          metin: `Aşağıdaki geçmiş konuşma akışını dikkatle incele. Seçilen donanım kartını, pin bağlantılarını, kütüphaneleri, mimari kararları ve proje durumunu eksiksiz özetle:\n\n${formattedTranscript}`
        }
      ]

      const res = await this.callProviderDirect(
        provider,
        secilenModel,
        apiKey || '',
        SUMMARIZER_PROMPT,
        promptMessages,
        'low'
      )

      if (res.success && res.replyText && res.replyText.trim().length > 20) {
        return res.replyText.trim()
      }
    } catch (err) {
      console.warn('[LlmService] AI ile özetleme başarısız oldu, algoritmik özete dönülüyor:', err)
    }

    return this.generateAlgorithmicSummary(cleanedMessages)
  }

  /**
   * Bir ChatSession'ın geçmiş mesajlarını analiz eder; son RECENT_COUNT mesajı (son 4-6) korur,
   * önceki tüm mesajları AI ile özetleyip tek bir hafıza özet mesajına dönüştürür.
   */
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
   * Sohbet geçmişini analiz eder; eski mesajlardaki şişirici kod bloklarını temizler,
   * kayan pencere (sliding window) ve hafıza özeti uygulayarak LLM'e gidecek optimize
   * mesaj listesini üretir. Kullanıcı arayüzündeki mesajları kesinlikle etkilemez.
   */
  async compactMessagesForLlm(
    messages: SendAiMessageParams['messages'],
    forceCompaction?: boolean,
    provider?: AIProviderId,
    model?: string
  ): Promise<SendAiMessageParams['messages']> {
    // Sıkıştırma yalnızca kullanıcı manuel tetiklediyse veya bağlam doluluk eşiği (%70+) aşıldıysa devreye girer
    if (!forceCompaction) {
      return messages
    }

    if (!messages || messages.length <= 4) {
      return messages
    }

    // En güncel son 6 mesajı (son 3 kullanıcı-asistan döngüsü) dokunulmadan koru
    const RECENT_COUNT = 6
    if (messages.length <= RECENT_COUNT) {
      return messages.map((msg, idx) => {
        // En güncel son 2 mesaja kesinlikle dokunma
        if (idx >= messages.length - 2) return msg
        return {
          rol: msg.rol,
          metin: this.cleanBloatFromMessage(msg.metin)
        }
      })
    }

    // 6'dan fazla mesaj var: Kayan pencere ve hafıza sıkıştırması uygula
    const olderMessages = messages.slice(0, messages.length - RECENT_COUNT)
    const recentMessages = messages.slice(messages.length - RECENT_COUNT)

    let summaryText = ''
    if (provider) {
      summaryText = await this.summarizeMessagesWithAi(olderMessages, provider, model)
    } else {
      summaryText = this.generateAlgorithmicSummary(
        olderMessages.map((m) => ({ rol: m.rol, metin: this.cleanBloatFromMessage(m.metin) }))
      )
    }

    const summaryMessage = {
      rol: 'kullanici' as const,
      metin: `[Önceki Konuşmaların Hafıza Özeti (Bağlam Tasarrufu İçin Sıkıştırıldı)]:\n${summaryText}`
    }

    const ackAssistantMessage = {
      rol: 'asistan' as const,
      metin: '<explanation>Önceki konuşma bağlamını, donanım pinlerini ve mimari kararları hafızamda tutuyorum. Talebinizle devam edebiliriz.</explanation>'
    }

    return [summaryMessage, ackAssistantMessage, ...recentMessages]
  }

  /**
   * Sağlayıcıya isteği gönderir ve yanıt metnini döner (Tek seferlik / Non-streaming).
   */
  async sendMessage(params: SendAiMessageParams): Promise<SendAiMessageResult> {
    const { provider, model, messages } = params
    const apiKey = this.secretsService.getDecryptedApiKey(provider)

    if (!apiKey && provider !== 'lmstudio') {
      return {
        success: false,
        error: `${provider.toUpperCase()} API anahtarınız henüz ayarlanmamış. Lütfen sağ üstteki ayarlar (dişli) ikonundan bir API anahtarı ekleyin.`
      }
    }

    const secilenModel = model || FALLBACK_MODELLER[provider]?.[0] || 'default'
    const zenginSistemPromptu = await this.buildSystemPrompt(params)
    const optimizeMesajlar = await this.compactMessagesForLlm(messages, params.forceCompaction, provider, secilenModel)

    try {
      return await this.callProviderDirect(
        provider,
        secilenModel,
        apiKey || '',
        zenginSistemPromptu,
        optimizeMesajlar,
        params.reasoningEffort
      )
    } catch (err: any) {
      console.error(`[LlmService] ${provider} (${secilenModel}) çağrısı sırasında hata:`, err)
      const errMsg = String(err?.message || '')
      const isHighDemand = errMsg.toLowerCase().includes('high demand') || errMsg.includes('503')
      const friendlyError = isHighDemand
        ? `Seçili '${secilenModel}' modeli şu anda sunucu tarafında aşırı talep/yoğunluk yaşıyor (High Demand / 503). Lütfen birkaç saniye sonra tekrar deneyin veya farklı bir model seçin.`
        : `Model bağlantısı başarısız: ${errMsg || 'Bilinmeyen bir hata oluştu.'}`
      return {
        success: false,
        error: friendlyError
      }
    }
  }

  /**
   * Sağlayıcıya isteği gönderir ve yanıtı anlık olarak SSE (Server-Sent Events) ile stream eder.
   */
  async sendMessageStream(
    params: SendAiMessageParams,
    onChunk: (event: StreamChunkEvent) => void
  ): Promise<SendAiMessageResult> {
    const { provider, model, messages, streamId = 'stream_' + Date.now() } = params
    const apiKey = this.secretsService.getDecryptedApiKey(provider)

    if (!apiKey && provider !== 'lmstudio') {
      const errorMsg = `${provider.toUpperCase()} API anahtarınız henüz ayarlanmamış. Lütfen sağ üstteki ayarlar (dişli) ikonundan bir API anahtarı ekleyin.`
      onChunk({ streamId, chunk: '', done: true, error: errorMsg })
      return { success: false, error: errorMsg }
    }

    const secilenModel = model || FALLBACK_MODELLER[provider]?.[0] || 'default'
    let fullText = ''
    try {
      const zenginSistemPromptu = await this.buildSystemPrompt(params)
      const optimizeMesajlar = await this.compactMessagesForLlm(messages, params.forceCompaction, provider, secilenModel)
      if (provider === 'gemini') {
        fullText = await this.callGeminiStream(apiKey!, secilenModel, zenginSistemPromptu, optimizeMesajlar, streamId, onChunk, params.reasoningEffort)
      } else if (provider === 'anthropic') {
        fullText = await this.callAnthropicStream(apiKey!, secilenModel, zenginSistemPromptu, optimizeMesajlar, streamId, onChunk)
      } else if (provider === 'lmstudio') {
        fullText = await this.callOpenAiCompatibleStream('http://127.0.0.1:1234/v1/chat/completions', apiKey || 'lm-studio', secilenModel, zenginSistemPromptu, optimizeMesajlar, 'LM Studio', streamId, onChunk, params.reasoningEffort)
      } else if (provider === 'deepseek') {
        fullText = await this.callOpenAiCompatibleStream('https://api.deepseek.com/v1/chat/completions', apiKey!, secilenModel, zenginSistemPromptu, optimizeMesajlar, 'DeepSeek', streamId, onChunk, params.reasoningEffort)
      } else if (provider === 'kimi') {
        const primaryUrl = `${this.kimiBaseUrl}/chat/completions`
        const secondaryUrl = this.kimiBaseUrl.includes('moonshot.ai')
          ? 'https://api.moonshot.cn/v1/chat/completions'
          : 'https://api.moonshot.ai/v1/chat/completions'
        try {
          fullText = await this.callOpenAiCompatibleStream(primaryUrl, apiKey!, secilenModel, zenginSistemPromptu, optimizeMesajlar, 'Kimi AI', streamId, onChunk, params.reasoningEffort, { temperature: 1 })
        } catch (kimiErr: any) {
          const isAuthOrNetwork =
            kimiErr?.message?.includes('401') ||
            kimiErr?.message?.includes('403') ||
            kimiErr?.message?.includes('fetch') ||
            kimiErr?.message?.includes('ENOTFOUND')
          if (isAuthOrNetwork) {
            console.warn(`[LlmService] Kimi primary URL (${primaryUrl}) bağlantı/auth hatası, alternatif deneniyor:`, kimiErr)
            try {
              fullText = await this.callOpenAiCompatibleStream(secondaryUrl, apiKey!, secilenModel, zenginSistemPromptu, optimizeMesajlar, 'Kimi AI', streamId, onChunk, params.reasoningEffort, { temperature: 1 })
              this.kimiBaseUrl = this.kimiBaseUrl.includes('moonshot.ai') ? 'https://api.moonshot.cn/v1' : 'https://api.moonshot.ai/v1'
            } catch {
              throw kimiErr
            }
          } else {
            throw kimiErr
          }
        }
      } else if (provider === 'nvidia') {
        fullText = await this.callOpenAiCompatibleStream(
          'https://integrate.api.nvidia.com/v1/chat/completions',
          apiKey!,
          secilenModel,
          zenginSistemPromptu,
          optimizeMesajlar,
          'NVIDIA Build',
          streamId,
          onChunk,
          params.reasoningEffort,
          { max_tokens: 8192 }
        )
      } else {
        // openai
        fullText = await this.callOpenAiCompatibleStream('https://api.openai.com/v1/chat/completions', apiKey!, secilenModel, zenginSistemPromptu, optimizeMesajlar, 'OpenAI', streamId, onChunk, params.reasoningEffort)
      }

      return { success: true, replyText: fullText }
    } catch (err: any) {
      console.warn(`[LlmService] ${provider} (${secilenModel}) stream çağrısında hata:`, err)

      const errMsg = String(err?.message || '')
      const isHighDemand = errMsg.toLowerCase().includes('high demand') || errMsg.includes('503')

      let friendlyError = errMsg
      if (isHighDemand) {
        friendlyError = `Seçili '${secilenModel}' modeli şu anda sunucu tarafında aşırı talep/yoğunluk yaşıyor (High Demand / 503). Lütfen birkaç saniye sonra tekrar deneyin veya model seçiciden dilediğiniz farklı bir modeli seçin.`
        // Yoğunluk hatasında başka modele kafamıza göre geçmiyoruz, doğrudan kullanıcıya uyarı veriyoruz
        onChunk({ streamId, chunk: '', done: true, error: friendlyError })
        return { success: false, error: friendlyError }
      }

      // Diğer beklenmeyen stream kopmalarında tek seferlik non-streaming dene
      try {
        const fallbackRes = await this.sendMessage(params)
        if (fallbackRes.success && fallbackRes.replyText) {
          onChunk({ streamId, chunk: fallbackRes.replyText, done: true })
          return fallbackRes
        }
        onChunk({ streamId, chunk: '', done: true, error: fallbackRes.error || friendlyError })
        return fallbackRes
      } catch (fallbackErr: any) {
        const errorMsg = `Bağlantı hatası: ${friendlyError || fallbackErr?.message || 'Yapay zekâ yanıt üretemedi.'}`
        onChunk({ streamId, chunk: '', done: true, error: errorMsg })
        return { success: false, error: errorMsg }
      }
    }
  }

  private async callGemini(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: SendAiMessageParams['messages'],
    reasoningEffort?: ReasoningEffort
  ): Promise<SendAiMessageResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const contents = messages.map((m) => ({
      role: m.rol === 'asistan' ? 'model' : 'user',
      parts: [{ text: m.metin }]
    }))

    const temp = reasoningEffort === 'low' ? 0.1 : reasoningEffort === 'high' ? 0.5 : 0.3
    const body: Record<string, any> = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: temp
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({})) as any
      const errMsg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`
      return { success: false, error: `Google Gemini Hatası: ${errMsg}` }
    }

    const data = (await res.json()) as any
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      return { success: false, error: 'Gemini boş bir yanıt döndürdü.' }
    }

    return { success: true, replyText: text }
  }

  private async callGeminiStream(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: SendAiMessageParams['messages'],
    streamId: string,
    onChunk: (event: StreamChunkEvent) => void,
    reasoningEffort?: ReasoningEffort
  ): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`

    const contents = messages.map((m) => ({
      role: m.rol === 'asistan' ? 'model' : 'user',
      parts: [{ text: m.metin }]
    }))

    const temp = reasoningEffort === 'low' ? 0.1 : reasoningEffort === 'high' ? 0.5 : 0.3
    const body: Record<string, any> = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: temp
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({})) as any
      throw new Error(errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`)
    }

    return await readSseStream(res, streamId, onChunk, (json) => ({
      text: json?.candidates?.[0]?.content?.parts?.[0]?.text
    }))
  }

  private async callAnthropic(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: SendAiMessageParams['messages']
  ): Promise<SendAiMessageResult> {
    const url = 'https://api.anthropic.com/v1/messages'

    const anthropicMessages = messages
      .filter((m) => m.rol !== 'sistem')
      .map((m) => ({
        role: m.rol === 'asistan' ? 'assistant' : 'user',
        content: m.metin
      }))

    const body = {
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: anthropicMessages
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({})) as any
      const errMsg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`
      return { success: false, error: `Anthropic Hatası: ${errMsg}` }
    }

    const data = (await res.json()) as any
    const text = data?.content?.[0]?.text
    if (!text) {
      return { success: false, error: 'Anthropic boş bir yanıt döndürdü.' }
    }

    return { success: true, replyText: text }
  }

  private async callAnthropicStream(
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: SendAiMessageParams['messages'],
    streamId: string,
    onChunk: (event: StreamChunkEvent) => void
  ): Promise<string> {
    const url = 'https://api.anthropic.com/v1/messages'

    const anthropicMessages = messages
      .filter((m) => m.rol !== 'sistem')
      .map((m) => ({
        role: m.rol === 'asistan' ? 'assistant' : 'user',
        content: m.metin
      }))

    const body = {
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: anthropicMessages,
      stream: true
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({})) as any
      throw new Error(errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`)
    }

    return await readSseStream(res, streamId, onChunk, (json) => {
      if (json.type === 'content_block_delta') {
        return { text: json.delta?.text }
      }
      return {}
    })
  }

  private async callOpenAiCompatible(
    url: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: SendAiMessageParams['messages'],
    providerTitle: string,
    reasoningEffort?: ReasoningEffort,
    extraBody?: Record<string, any>
  ): Promise<SendAiMessageResult> {
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.rol === 'asistan' ? 'assistant' : 'user',
        content: m.metin
      }))
    ]

    const temp = reasoningEffort === 'low' ? 0.1 : reasoningEffort === 'high' ? 0.5 : 0.3
    const body: Record<string, any> = {
      model,
      messages: formattedMessages,
      temperature: temp,
      ...extraBody
    }

    if (providerTitle === 'Kimi AI' || model.startsWith('kimi') || model.startsWith('moonshot')) {
      body.temperature = 1
    } else if (model.startsWith('o1') || model.startsWith('o3')) {
      delete body.temperature
    }

    if (reasoningEffort && (model.startsWith('o1') || model.startsWith('o3'))) {
      body.reasoning_effort = reasoningEffort
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({})) as any
      const errMsg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`
      return { success: false, error: `${providerTitle} Hatası: ${errMsg}` }
    }

    const data = (await res.json()) as any
    const text = data?.choices?.[0]?.message?.content
    if (!text) {
      return { success: false, error: `${providerTitle} boş bir yanıt döndürdü.` }
    }

    return { success: true, replyText: text }
  }

  private async callOpenAiCompatibleStream(
    url: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: SendAiMessageParams['messages'],
    providerTitle: string,
    streamId: string,
    onChunk: (event: StreamChunkEvent) => void,
    reasoningEffort?: ReasoningEffort,
    extraBody?: Record<string, any>
  ): Promise<string> {
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.rol === 'asistan' ? 'assistant' : 'user',
        content: m.metin
      }))
    ]

    const temp = reasoningEffort === 'low' ? 0.1 : reasoningEffort === 'high' ? 0.5 : 0.3
    const body: Record<string, any> = {
      model,
      messages: formattedMessages,
      temperature: temp,
      stream: true,
      ...extraBody
    }

    if (providerTitle === 'Kimi AI' || model.startsWith('kimi') || model.startsWith('moonshot')) {
      body.temperature = 1
    } else if (model.startsWith('o1') || model.startsWith('o3')) {
      delete body.temperature
    }

    if (reasoningEffort && (model.startsWith('o1') || model.startsWith('o3'))) {
      body.reasoning_effort = reasoningEffort
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream'
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({})) as any
      throw new Error(`${providerTitle} Hatası: ${errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`}`)
    }

    return await readSseStream(res, streamId, onChunk, (json) => ({
      text: json?.choices?.[0]?.delta?.content,
      reasoning: json?.choices?.[0]?.delta?.reasoning_content
    }))
  }
}

/**
 * Server-Sent Events akışını okur, UTF-8 çok baytlı Türkçe karakterlerin bölünmesini
 * engelleyerek onChunk ile renderer'a aktarır.
 */
async function readSseStream(
  response: Response,
  streamId: string,
  onChunk: (event: StreamChunkEvent) => void,
  extractText: (json: any) => { text?: string; reasoning?: string }
): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Sunucu akış (stream) yanıtı boş döndü.')

  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith(':')) continue
      if (trimmed === 'data: [DONE]') continue

      if (trimmed.startsWith('data:')) {
        const jsonStr = trimmed.slice(5).trim()
        try {
          const parsed = JSON.parse(jsonStr)
          const { text, reasoning } = extractText(parsed)
          if (text) {
            fullText += text
            onChunk({ streamId, chunk: text, reasoningChunk: reasoning, done: false })
          } else if (reasoning) {
            onChunk({ streamId, chunk: '', reasoningChunk: reasoning, done: false })
          }
        } catch {
          // JSON parse hatası yok sayılır
        }
      }
    }
  }

  const finalChunk = decoder.decode()
  if (finalChunk && finalChunk.trim().startsWith('data:')) {
    try {
      const parsed = JSON.parse(finalChunk.trim().slice(5).trim())
      const { text, reasoning } = extractText(parsed)
      if (text) {
        fullText += text
        onChunk({ streamId, chunk: text, reasoningChunk: reasoning, done: false })
      }
    } catch {}
  }

  onChunk({ streamId, chunk: '', done: true })
  return fullText
}
