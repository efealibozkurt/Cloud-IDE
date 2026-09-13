import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { ArduinoCliService } from './ArduinoCliService'
import type { BoardContext } from './BoardSkillEngine'
import type { CustomSkill, RagStatusInfo, RagChunkSummary } from '@shared/types'

export interface RagChunk {
  id: string
  sourceFile: string
  sourceOwner: string
  title: string
  content: string
  boardFamily?: 'deneyap' | 'esp32' | 'avr' | 'rp2040' | 'stm32' | 'general'
  mtime: number
  embedding?: number[]
  isCustom?: boolean
}

export interface RagSearchResult {
  chunk: RagChunk
  score: number
}

interface RagStoreData {
  version: number
  updatedAt: string
  chunks: RagChunk[]
}

/**
 * Gömülü sistem çekirdek API'leri için hazır altın-standart API referans parçacıkları.
 * İlk kurulumda veya kütüphane taranmadan önce bile RAG motoruna anında yüksek doğruluk sağlar.
 */
const HAZIR_DONANIM_SNIPPETLERI: Omit<RagChunk, 'id' | 'mtime'>[] = [
  {
    sourceFile: 'deneyap_imu_core.h',
    sourceOwner: 'Deneyap Core',
    title: 'Deneyap Kart Dahili 6-Eksen IMU (LSM6DSM) İvmeölçer ve Jiroskop Kullanımı',
    boardFamily: 'deneyap',
    content: `// Deneyap Dahili IMU Sensör Okuma
#include <deneyap.h>
void setup() {
  Serial.begin(115200);
  if (!IMU.begin()) { Serial.println("IMU baslatilamadi!"); while(1); }
}
void loop() {
  float ax = IMU.readFloatAccelX();
  float ay = IMU.readFloatAccelY();
  float az = IMU.readFloatAccelZ();
  float gx = IMU.readFloatGyroX();
  float gy = IMU.readFloatGyroY();
  float gz = IMU.readFloatGyroZ();
  delay(100);
}`
  },
  {
    sourceFile: 'deneyap_rgb_builtin.h',
    sourceOwner: 'Deneyap Core',
    title: 'Deneyap Dahili RGB LED ve Buton (GPKEY) Kullanımı',
    boardFamily: 'deneyap',
    content: `// Deneyap Dahili RGB LED ve GPKEY Buton
#include <deneyap.h>
void setup() {
  pinMode(GPKEY, INPUT);
  // Deneyap Dahili RGB LED kontrolü
  pinMode(D_RGB, OUTPUT);
}
void loop() {
  int butonDurum = digitalRead(GPKEY);
  if (butonDurum == LOW) { // Butona basildi
    digitalWrite(D_RGB, HIGH);
  } else {
    digitalWrite(D_RGB, LOW);
  }
}`
  },
  {
    sourceFile: 'esp32_preferences.h',
    sourceOwner: 'ESP32 Core',
    title: 'ESP32 Kalıcı Hafıza (Preferences / Flash EEPROM Alternatifi)',
    boardFamily: 'esp32',
    content: `// ESP32 Flash Hafızaya Değişken Kaydetme ve Okuma
#include <Preferences.h>
Preferences preferences;
void setup() {
  Serial.begin(115200);
  preferences.begin("ayar-depo", false); // Read-write modu
  preferences.putInt("sayac", 42);
  preferences.putString("wifi_ad", "Agim");
  int val = preferences.getInt("sayac", 0);
  preferences.end();
}`
  },
  {
    sourceFile: 'esp32_wifi_webserver.h',
    sourceOwner: 'ESP32 Core',
    title: 'ESP32 Wi-Fi Bağlantısı ve Basit Web Sunucu Kurulumu',
    boardFamily: 'esp32',
    content: `// ESP32 Wi-Fi ve Web Sunucusu
#include <WiFi.h>
#include <WebServer.h>
const char* ssid = "WIFI_ADI";
const char* password = "SIFRE";
WebServer server(80);
void handleRoot() {
  server.send(200, "text/html", "<h1>ESP32 Cloud IDE Sunucu</h1>");
}
void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
  server.on("/", handleRoot);
  server.begin();
}
void loop() {
  server.handleClient();
}`
  },
  {
    sourceFile: 'esp32_ledc_pwm.h',
    sourceOwner: 'ESP32 Core',
    title: 'ESP32 Donanımsal PWM Kontrolü (analogWrite yerine LEDC)',
    boardFamily: 'esp32',
    content: `// ESP32 LEDC PWM (analogWrite yerine modern API)
const int pwmPin = 18;
const int frekans = 5000;
const int cozunurluk = 8; // 0 - 255 arasi
void setup() {
  // ESP32 Arduino Core 3.x modern API
  ledcAttach(pwmPin, frekans, cozunurluk);
}
void loop() {
  ledcWrite(pwmPin, 128); // %50 Duty Cycle
  delay(1000);
}`
  },
  {
    sourceFile: 'avr_flash_ram_opt.h',
    sourceOwner: 'Arduino AVR Core',
    title: 'Arduino Uno/Nano RAM Tasarrufu ve F() Makrosu Kullanımı',
    boardFamily: 'avr',
    content: `// Arduino Uno/Nano 2KB RAM tasarrufu için F() makrosu
void setup() {
  Serial.begin(9600);
  // Sabit metinleri SRAM yerine Flash (PROGMEM) hafızaya yazar
  Serial.println(F("Bu metin 2KB SRAM'den yemez, Flash hafızadan okunur."));
}`
  }
]

export class RagService {
  private extractor: any = null
  private initPromise: Promise<void> | null = null
  private chunks: RagChunk[] = []
  private storePath: string
  private isIndexing = false

  constructor(private arduinoCliService?: ArduinoCliService) {
    try {
      this.storePath = join(app.getPath('userData'), 'rag_store.json')
    } catch {
      this.storePath = join(process.cwd(), 'rag_store.json')
    }
  }

  /**
   * Xenova/multilingual-e5-small modelini lazy (ihtiyaç anında) yükler.
   */
  async ensureModelLoaded(): Promise<boolean> {
    if (this.extractor) return true
    if (this.initPromise) {
      await this.initPromise
      return !!this.extractor
    }

    this.initPromise = (async () => {
      try {
        console.log('[RagService] multilingual-e5-small modeli yükleniyor...')
        // Dynamic import: ESM uyumluluğu için
        const { pipeline, env } = await import('@xenova/transformers')

        try {
          env.cacheDir = join(app.getPath('userData'), 'models')
        } catch {
          // Fallback
        }

        // Quantized INT8 modeli: ~118 MB, CPU üzerinde son derece hızlı
        this.extractor = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', {
          quantized: true
        })

        console.log('[RagService] multilingual-e5-small başarıyla yüklendi.')
        await this.loadStore()
      } catch (err) {
        console.warn('[RagService] Model yüklenirken hata oluştu:', err)
        this.extractor = null
      }
    })()

    await this.initPromise
    return !!this.extractor
  }

  /**
   * Verilen metin için normalize edilmiş embedding vektörü üretir.
   */
  private async embedText(text: string, type: 'query' | 'passage'): Promise<number[] | null> {
    const ready = await this.ensureModelLoaded()
    if (!ready || !this.extractor) return null

    try {
      // E5 formatı: sorgular için "query: ...", dokümanlar için "passage: ..."
      const prefixed = `${type}: ${text.trim()}`
      const output = await this.extractor(prefixed, {
        pooling: 'mean',
        normalize: true
      })
      return Array.from(output.data) as number[]
    } catch (err) {
      console.warn('[RagService] Embedding hesaplama hatası:', err)
      return null
    }
  }

  /**
   * İki normalize vektör arasındaki kosinüs benzerliğini (Cosine Similarity / Dot Product) hesaplar.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    let dot = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
    }
    return dot
  }

  /**
   * Kalıcı depodaki parçaları diskten okur; yoksa hazır altın standart parçacıklarla başlatır.
   */
  private async loadStore(): Promise<void> {
    try {
      const dataStr = await fs.readFile(this.storePath, 'utf-8')
      const parsed = JSON.parse(dataStr) as RagStoreData
      if (parsed && Array.isArray(parsed.chunks)) {
        this.chunks = parsed.chunks
        console.log(`[RagService] Önbellekten ${this.chunks.length} RAG parçası yüklendi.`)
        return
      }
    } catch {
      // Dosya yoksa veya bozuksa
    }

    // Hazır snippet'leri yükle ve embed et
    await this.bootstrapCoreSnippets()
  }

  /**
   * Hazır donanım snippet'lerini vektörleştirip depolar.
   */
  private async bootstrapCoreSnippets(): Promise<void> {
    console.log('[RagService] Hazır çekirdek snippet parçacıkları hazırlanıyor...')
    this.chunks = []

    for (const [idx, item] of HAZIR_DONANIM_SNIPPETLERI.entries()) {
      const chunk: RagChunk = {
        id: `core_snippet_${idx}`,
        sourceFile: item.sourceFile,
        sourceOwner: item.sourceOwner,
        title: item.title,
        boardFamily: item.boardFamily,
        content: item.content,
        mtime: Date.now()
      }

      // Parça metnini başlık + içerik olarak embed et
      const textToEmbed = `${chunk.title}\n${chunk.content}`
      const vec = await this.embedText(textToEmbed, 'passage')
      if (vec) {
        chunk.embedding = vec
        this.chunks.push(chunk)
      }
    }

    await this.saveStore()
  }

  /**
   * Depoyu diske kaydeder.
   */
  private async saveStore(): Promise<void> {
    try {
      const storeData: RagStoreData = {
        version: 1,
        updatedAt: new Date().toISOString(),
        chunks: this.chunks
      }
      await fs.writeFile(this.storePath, JSON.stringify(storeData, null, 2), 'utf-8')
    } catch (err) {
      console.warn('[RagService] Depo diske yazılırken hata:', err)
    }
  }

  /**
   * Kullanıcının sorusuna veya promptuna göre en alakalı RAG referans kodlarını arar.
   */
  async search(query: string, boardContext?: BoardContext, topK = 2): Promise<RagSearchResult[]> {
    if (!query || query.trim().length < 2) return []

    const queryVec = await this.embedText(query, 'query')
    if (!queryVec || this.chunks.length === 0) return []

    const fqbn = (boardContext?.fqbn || '').toLowerCase()
    const boardName = (boardContext?.name || '').toLowerCase()

    let targetFamily: 'deneyap' | 'esp32' | 'avr' | 'rp2040' | 'stm32' | undefined
    if (fqbn.includes('deneyap') || boardName.includes('deneyap')) targetFamily = 'deneyap'
    else if (fqbn.includes('esp32') || boardName.includes('esp32')) targetFamily = 'esp32'
    else if (fqbn.includes('avr') || boardName.includes('uno') || boardName.includes('nano')) targetFamily = 'avr'
    else if (fqbn.includes('rp2040') || boardName.includes('pico')) targetFamily = 'rp2040'
    else if (fqbn.includes('stm32')) targetFamily = 'stm32'

    const sonuclar: RagSearchResult[] = []

    for (const chunk of this.chunks) {
      if (!chunk.embedding) continue

      let score = this.cosineSimilarity(queryVec, chunk.embedding)

      // Kart ailesi uyumu için hafif pozitif boost
      if (targetFamily && chunk.boardFamily) {
        if (chunk.boardFamily === targetFamily) {
          score += 0.08 // Hedef kart ailesiyle tam eşleşen kodlara öncelik ver
        } else if (chunk.boardFamily !== 'general') {
          score -= 0.05 // Farklı spesifik bir kart ailesiyse hafif düşür
        }
      }

      sonuclar.push({ chunk, score })
    }

    // Skora göre sırala
    sonuclar.sort((a, b) => b.score - a.score)

    // En alakalı ilk topK sonucu filtrele (belirli bir benzerlik eşiğinin üzerindekiler)
    return sonuclar.filter((s) => s.score >= 0.60).slice(0, topK)
  }

  /**
   * Kurulu kütüphanelerden ve çekirdek örneklerinden arka planda RAG indeksleme yapar.
   * UI donmalarını engellemek için parça parça işler.
   */
  async indexInstalledExamples(maxExamples = 30): Promise<number> {
    if (!this.arduinoCliService || this.isIndexing) return 0
    this.isIndexing = true

    console.log('[RagService] Kurulu örnek kodlar taranıyor ve indeksleniyor...')
    let eklenenSayisi = 0

    try {
      const gruplar = await this.arduinoCliService.listExamples()
      let islenenDosyaSayisi = 0

      for (const grup of gruplar) {
        if (islenenDosyaSayisi >= maxExamples) break

        const ownerName = grup.ownerName

        let family: 'deneyap' | 'esp32' | 'avr' | 'rp2040' | 'stm32' | 'general' = 'general'
        const lowerOwner = ownerName.toLowerCase()
        if (lowerOwner.includes('deneyap')) family = 'deneyap'
        else if (lowerOwner.includes('esp32')) family = 'esp32'
        else if (lowerOwner.includes('avr')) family = 'avr'

        for (const ornek of grup.examples) {
          if (islenenDosyaSayisi >= maxExamples) break

          try {
            const dosyalar = await fs.readdir(ornek.folderPath)
            const inoDosyasi = dosyalar.find((d) => d.endsWith('.ino'))
            if (!inoDosyasi) continue

            const tamYol = join(ornek.folderPath, inoDosyasi)
            const stats = await fs.stat(tamYol)

            // Zaten aynı mtime ile indekslenmiş mi?
            const mevcut = this.chunks.find((c) => c.sourceFile === tamYol && c.mtime === stats.mtimeMs)
            if (mevcut) continue

            const icerik = await fs.readFile(tamYol, 'utf-8')
            const chunks = this.chunkInoFile(tamYol, ownerName, ornek.name, icerik, family, stats.mtimeMs)

            for (const c of chunks) {
              const textToEmbed = `${c.title}\n${c.content}`
              const vec = await this.embedText(textToEmbed, 'passage')
              if (vec) {
                c.embedding = vec
                // Varsa eskisini güncelle veya yenisini ekle
                const idx = this.chunks.findIndex((x) => x.id === c.id)
                if (idx >= 0) this.chunks[idx] = c
                else this.chunks.push(c)
                eklenenSayisi++
              }
              // CPU'yu rahatlatmak için kısa nefes payı
              await new Promise((resolve) => setTimeout(resolve, 10))
            }

            islenenDosyaSayisi++
          } catch {
            // Tekil dosya hatası es geçilir
          }
        }
      }

      if (eklenenSayisi > 0) {
        await this.saveStore()
        console.log(`[RagService] İndeksleme tamamlandı. ${eklenenSayisi} yeni parça eklendi. Toplam parça: ${this.chunks.length}`)
      }
    } catch (err) {
      console.warn('[RagService] İndeksleme sırasında hata:', err)
    } finally {
      this.isIndexing = false
    }

    return eklenenSayisi
  }

  /**
   * Bir Arduino .ino dosyasını fonksiyonel bloklarına (setup, loop, fonksiyonlar) parçalar.
   */
  private chunkInoFile(
    filePath: string,
    owner: string,
    exampleName: string,
    code: string,
    family: 'deneyap' | 'esp32' | 'avr' | 'rp2040' | 'stm32' | 'general',
    mtime: number
  ): RagChunk[] {
    const lines = code.split('\n')
    const chunks: RagChunk[] = []

    // Dosya kısaysa (60 satırdan az) tek parça al
    if (lines.length <= 60) {
      const cleanContent = lines.slice(0, 50).join('\n').trim()
      chunks.push({
        id: `${filePath}_full`,
        sourceFile: filePath,
        sourceOwner: owner,
        title: `${owner} / ${exampleName} (Tam Örnek Kod)`,
        content: cleanContent,
        boardFamily: family,
        mtime
      })
      return chunks
    }

    // Büyük dosyalarda: Başlık tanımları + setup + loop fonksiyon bloklarını ayır
    const headerLines: string[] = []
    let currentBlock: string[] = []
    let currentTitle = ''
    let insideFunction = false

    for (const line of lines) {
      const trimmed = line.trim()

      if (!insideFunction && (trimmed.startsWith('#include') || trimmed.startsWith('#define') || trimmed.includes('const ') || (trimmed.includes(';') && !trimmed.startsWith('//')))) {
        headerLines.push(line)
        continue
      }

      if (trimmed.startsWith('void setup(')) {
        insideFunction = true
        currentTitle = `${owner} - ${exampleName} (setup / Başlatma Mantığı)`
        currentBlock = [line]
        continue
      }

      if (trimmed.startsWith('void loop(')) {
        // Önceki setup bloğu varsa bitir ve kaydet
        if (currentBlock.length > 0) {
          chunks.push({
            id: `${filePath}_setup`,
            sourceFile: filePath,
            sourceOwner: owner,
            title: currentTitle || `${owner} - ${exampleName} (setup)`,
            content: (headerLines.slice(0, 15).join('\n') + '\n\n' + currentBlock.slice(0, 35).join('\n')).trim(),
            boardFamily: family,
            mtime
          })
        }
        insideFunction = true
        currentTitle = `${owner} - ${exampleName} (loop / Döngü ve Sensör İşlemleri)`
        currentBlock = [line]
        continue
      }

      if (insideFunction) {
        currentBlock.push(line)
        if (currentBlock.length >= 40) {
          // Çok uzadıysa kes
          insideFunction = false
        }
      }
    }

    if (currentBlock.length > 0) {
      chunks.push({
        id: `${filePath}_loop`,
        sourceFile: filePath,
        sourceOwner: owner,
        title: currentTitle || `${owner} - ${exampleName} (Fonksiyonel Blok)`,
        content: currentBlock.slice(0, 40).join('\n').trim(),
        boardFamily: family,
        mtime
      })
    }

    return chunks.slice(0, 2)
  }

  /**
   * İndeksteki toplam parça sayısını döner.
   */
  getChunkCount(): number {
    return this.chunks.length
  }

  /**
   * RAG modelinin ve depolamanın güncel durumunu döner.
   */
  getStats(): RagStatusInfo {
    return {
      modelLoaded: !!this.extractor,
      modelName: 'Xenova/multilingual-e5-small (INT8)',
      totalChunks: this.chunks.length,
      isIndexing: this.isIndexing,
      storePath: this.storePath
    }
  }

  /**
   * İndekslenmiş RAG parçalarını sorgu veya kart ailesine göre listeler.
   */
  listChunks(query?: string, boardFamily?: string): RagChunkSummary[] {
    let filtered = this.chunks

    if (boardFamily && boardFamily !== 'all') {
      const target = boardFamily.toLowerCase()
      filtered = filtered.filter((c) => (c.boardFamily || 'general').toLowerCase() === target)
    }

    if (query && query.trim()) {
      const q = query.toLowerCase().trim()
      filtered = filtered.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.sourceOwner.toLowerCase().includes(q) ||
          c.content.toLowerCase().includes(q)
      )
    }

    return filtered.map((c) => ({
      id: c.id,
      title: c.title,
      sourceOwner: c.sourceOwner,
      sourceFile: c.sourceFile,
      boardFamily: c.boardFamily,
      content: c.content,
      isCustom: c.isCustom
    }))
  }

  /**
   * Kullanıcının eklediği özel beceriyi embedding üretip RAG indeksine kaydeder.
   */
  async addCustomSkillChunk(skill: CustomSkill): Promise<void> {
    const chunkId = `custom_${skill.id}`
    const chunk: RagChunk = {
      id: chunkId,
      sourceFile: 'custom_skill',
      sourceOwner: 'Özel Beceri (Kullanıcı)',
      title: skill.title,
      content: skill.content,
      boardFamily: (skill.boardFamily || 'general') as any,
      mtime: skill.updatedAt || Date.now(),
      isCustom: true
    }

    const textToEmbed = `${skill.title}\n${skill.content}`
    const vec = await this.embedText(textToEmbed, 'passage')
    if (vec) {
      chunk.embedding = vec
    }

    const idx = this.chunks.findIndex((c) => c.id === chunkId)
    if (idx >= 0) {
      this.chunks[idx] = chunk
    } else {
      this.chunks.unshift(chunk)
    }

    await this.saveStore()
  }

  /**
   * Özel beceriyi RAG indeksinden kaldırır.
   */
  async removeCustomSkillChunk(skillId: string): Promise<void> {
    const chunkId = `custom_${skillId}`
    const initialLen = this.chunks.length
    this.chunks = this.chunks.filter((c) => c.id !== chunkId)
    if (this.chunks.length !== initialLen) {
      await this.saveStore()
    }
  }

  /**
   * Özel becerileri RAG deposuyla senkronize eder.
   */
  async syncCustomSkills(skills: CustomSkill[]): Promise<void> {
    for (const skill of skills) {
      const chunkId = `custom_${skill.id}`
      const existing = this.chunks.find((c) => c.id === chunkId)
      if (!existing) {
        await this.addCustomSkillChunk(skill)
      }
    }
  }
}
