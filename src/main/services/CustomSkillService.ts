import { promises as fs } from 'fs'
import { join, basename } from 'path'
import { shell } from 'electron'
import type { CustomSkill } from '@shared/types'

export class CustomSkillService {
  private skillsDir: string
  private oldJsonPath: string
  private skills: CustomSkill[] = []
  private initialized = false

  constructor(userDataPath: string) {
    this.skillsDir = join(userDataPath, 'skills')
    this.oldJsonPath = join(userDataPath, 'custom_skills.json')
  }

  /**
   * Beceriler klasörünün dosya sistemi yolunu döner.
   */
  getSkillsDirectory(): string {
    return this.skillsDir
  }

  /**
   * Beceriler klasörünü Windows Dosya Gezgini'nde (Explorer) açar.
   */
  async openSkillsFolder(): Promise<boolean> {
    await this.ensureInitialized()
    const result = await shell.openPath(this.skillsDir)
    return result === '' // Boş string başarı anlamına gelir
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    try {
      await fs.mkdir(this.skillsDir, { recursive: true })

      // 1. Eski JSON varsa .md dosyalarına göç et (migration)
      await this.migrateOldJsonIfExists()

      // 2. Klasör tamamen boşsa başlangıç örnek .md becerilerini oluştur
      const files = await fs.readdir(this.skillsDir)
      const mdFiles = files.filter((f) => f.toLowerCase().endsWith('.md'))
      if (mdFiles.length === 0) {
        await this.seedDefaultMarkdownSkills()
      }
    } catch (err) {
      console.warn('[CustomSkillService] Başlatma uyarısı:', err)
    }
  }

  private async migrateOldJsonIfExists(): Promise<void> {
    try {
      const data = await fs.readFile(this.oldJsonPath, 'utf-8')
      const parsed = JSON.parse(data)
      if (Array.isArray(parsed) && parsed.length > 0) {
        for (const s of parsed) {
          if (s.title && s.content) {
            await this.writeSkillToFile(s)
          }
        }
        // Eski dosyayı yedekle
        await fs.rename(this.oldJsonPath, this.oldJsonPath + '.bak').catch(() => {})
      }
    } catch {
      // JSON dosyası yok, normal durum
    }
  }

  private async seedDefaultMarkdownSkills(): Promise<void> {
    const defaultSkills: Array<Omit<CustomSkill, 'id' | 'createdAt' | 'updatedAt' | 'filePath' | 'fileName'>> = [
      {
        title: 'Deneyap Kart Dahili IMU (LSM6DSM) Okuma',
        boardFamily: 'deneyap',
        type: 'snippet',
        description: 'Deneyap Kart dahili 6-eksenli ivmeölçer ve jiroskop sensörünü I2C üzerinden okur.',
        content: `// Deneyap Kart dahili 6-eksenli hareket sensöründen ivme ve jiroskop okuma
#include <deneyap.h>

void setup() {
  Serial.begin(115200);
  delay(1000);

  if (!IMU.begin()) {
    Serial.println("LSM6DSM IMU sensoru baslatilamadi!");
    while (1);
  }
  Serial.println("LSM6DSM IMU basariyla hazirlandi.");
}

void loop() {
  float ax, ay, az;
  float gx, gy, gz;

  if (IMU.readAcceleration(ax, ay, az) && IMU.readGyroscope(gx, gy, gz)) {
    Serial.printf("Ivme [G]: X=%.2f Y=%.2f Z=%.2f | Jiro [dps]: X=%.2f Y=%.2f Z=%.2f\\n",
                  ax, ay, az, gx, gy, gz);
  }
  delay(100);
}`
      },
      {
        title: 'ESP32 AsyncWebServer & JSON Telemetri API',
        boardFamily: 'esp32',
        type: 'snippet',
        description: 'ESP32 ile WiFi ağına bağlanıp asenkron HTTP sunucusu açan ve JSON veri dönen şablon.',
        content: `// ESP32 Asenkron HTTP Web & JSON API Sunucusu
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>

const char* ssid = "WIFI_AGINIZ";
const char* password = "SIFRENIZ";

AsyncWebServer server(80);

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\\nWiFi Baglandi! IP: %s\\n", WiFi.localIP().toString().c_str());

  server.on("/api/telemetri", HTTP_GET, [](AsyncWebServerRequest *request) {
    StaticJsonDocument<200> doc;
    doc["uptime_ms"] = millis();
    doc["heap_free"] = ESP.getFreeHeap();
    doc["status"] = "OK";

    String response;
    serializeJson(doc, response);
    request->send(200, "application/json", response);
  });

  server.begin();
}

void loop() {
  // Asenkron mimaride loop bloklanmaz
  delay(1000);
}`
      },
      {
        title: 'AVR Timer1 1Hz Donanımsal Kesme (CTC)',
        boardFamily: 'avr',
        type: 'snippet',
        description: 'ATmega328P / Arduino Uno üzerinde delay() kullanmadan 1 saniyelik kesin donanım kesmesi üretir.',
        content: `// ATmega328P Timer1 CTC Donanimsal Zaman Kesmesi (1 Hz)
#include <avr/io.h>
#include <avr/interrupt.h>

const int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
  cli(); // Tum kesmeleri durdur

  TCCR1A = 0;
  TCCR1B = 0;
  TCNT1  = 0;

  // 16MHz / (1024 prescaler * 1Hz) - 1 = 15624
  OCR1A = 15624;
  TCCR1B |= (1 << WGM12);               // CTC modu aktif
  TCCR1B |= (1 << CS12) | (1 << CS10);  // 1024 prescaler
  TIMSK1 |= (1 << OCIE1A);              // Timer1 Karsilastirma A kesmesi

  sei(); // Kesmeleri ac
}

ISR(TIMER1_COMPA_vect) {
  // Her 1 saniyede kesin olarak donanim tarafindan cagrilir
  digitalWrite(ledPin, !digitalRead(ledPin));
}

void loop() {
  // Ana dongu kesintiye ugramadan serbestce calisir
}`
      },
      {
        title: 'RP2040 Pico Çift Çekirdek (Core0 + Core1)',
        boardFamily: 'rp2040',
        type: 'snippet',
        description: 'Raspberry Pi Pico RP2040 iki Cortex-M0+ çekirdeğini eşzamanlı ve bağımsız koşturma.',
        content: `// Raspberry Pi Pico RP2040 Cift Cekirdek Uygulamasi
#include <Arduino.h>

// Core 1 (Ikinci Cekirdek) bagimsiz kurulum ve dongusu
void setup1() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("RP2040 Cekirdek 1 baslatildi.");
}

void loop1() {
  // Ikinci cekirdekte sensor okuma / agir hesaplama
  Serial.printf("[Core 1] Zaman: %lu ms\\n", millis());
  delay(2000);
}

// Core 0 (Birinci Cekirdek)
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  // Birinci cekirdekte hizli LED ve kullanici arayuzu
  digitalWrite(LED_BUILTIN, HIGH);
  delay(200);
  digitalWrite(LED_BUILTIN, LOW);
  delay(200);
}`
      },
      {
        title: 'Gömülü C++ Bellek Güvenliği ve Heap Koruması',
        boardFamily: 'general',
        type: 'rule',
        description: 'Dinamik bellek parçalanmasını (heap fragmentation) önlemek için LLM mimari davranış kuralı.',
        content: `Gömülü sistemlerde (özellikle AVR ve sınırlı RAM'e sahip MCU'larda) dinamik bellek tahsisinden kaçın:
1. String sınıfı yerine daima const char* veya char[] tamponları ve snprintf kullan.
2. malloc/free veya new/delete döngü içinde asla kullanılmamalıdır; statik veya constexpr bellek tahsis edilmelidir.
3. Pin numaraları ve sabit parametreler için #define veya constexpr uint8_t tercih edilmelidir; fazladan RAM harcayan int pin = ... tanımlamaları kullanılmamalıdır.
4. Serial yazdırmalarda sabit metinler için flash bellek tasarrufu sağlayan F("...") makrosu kullanılmalıdır.`
      }
    ]

    for (const skill of defaultSkills) {
      await this.writeSkillToFile(skill)
    }
  }

  /**
   * .md dosyasını diske yazar.
   */
  private async writeSkillToFile(skill: Partial<CustomSkill>): Promise<CustomSkill> {
    const now = Date.now()
    const id = skill.id || 'skill_' + Math.random().toString(36).slice(2, 9) + '_' + now
    const title = (skill.title || 'İsimsiz Beceri').trim()
    const boardFamily = skill.boardFamily || 'general'
    const type = skill.type || 'snippet'
    const description = skill.description || ''
    const content = (skill.content || '').trim()
    const createdAt = skill.createdAt || now
    const updatedAt = now

    // Temiz slug üret
    const slug = title
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'skill'

    let fileName = `${slug}.md`
    let fullPath = join(this.skillsDir, fileName)

    // Aynı isimde dosya varsa ve id farklıysa benzersiz yap
    let counter = 1
    while (true) {
      try {
        const existing = await fs.readFile(fullPath, 'utf-8')
        if (existing.includes(`id: ${id}`) || existing.includes(`id: "${id}"`)) {
          break // Kendi dosyamız, üzerine yazacağız
        }
        // Başka bir dosya aynı ada sahip, sayaç ekle
        fileName = `${slug}-${counter}.md`
        fullPath = join(this.skillsDir, fileName)
        counter++
      } catch {
        // Dosya henüz yok, bu ismi kullanabiliriz
        break
      }
    }

    const frontmatter = [
      '---',
      `id: "${id}"`,
      `title: "${title.replace(/"/g, '\\"')}"`,
      `boardFamily: "${boardFamily}"`,
      `type: "${type}"`,
      description ? `description: "${description.replace(/"/g, '\\"')}"` : null,
      `createdAt: ${createdAt}`,
      `updatedAt: ${updatedAt}`,
      '---',
      '',
      content,
      ''
    ]
      .filter((line) => line !== null)
      .join('\n')

    await fs.writeFile(fullPath, frontmatter, 'utf-8')

    return {
      id,
      title,
      boardFamily,
      type,
      description,
      content,
      fileName,
      filePath: fullPath,
      createdAt,
      updatedAt
    }
  }

  /**
   * Klasördeki tüm .md dosyalarını okuyarak beceri listesini günceller.
   */
  async list(): Promise<CustomSkill[]> {
    await this.ensureInitialized()

    try {
      const files = await fs.readdir(this.skillsDir)
      const mdFiles = files.filter((f) => f.toLowerCase().endsWith('.md'))
      const loaded: CustomSkill[] = []

      for (const fileName of mdFiles) {
        const fullPath = join(this.skillsDir, fileName)
        try {
          const raw = await fs.readFile(fullPath, 'utf-8')
          const skill = this.parseMarkdownSkill(raw, fileName, fullPath)
          if (skill) {
            loaded.push(skill)
          }
        } catch (err) {
          console.warn(`[CustomSkillService] ${fileName} okunamadı:`, err)
        }
      }

      // Güncellenme tarihine göre yeniden eskiye sırala
      loaded.sort((a, b) => b.updatedAt - a.updatedAt)
      this.skills = loaded
      return [...this.skills]
    } catch (err) {
      console.warn('[CustomSkillService] Beceriler listelenemedi:', err)
      return [...this.skills]
    }
  }

  /**
   * Tek bir .md dosyasını parse eder.
   */
  private parseMarkdownSkill(raw: string, fileName: string, fullPath: string): CustomSkill | null {
    const trimmed = raw.trim()
    if (!trimmed) return null

    // YAML Frontmatter Regex
    const fmMatch = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)

    let id = ''
    let title = ''
    let boardFamily = 'general'
    let type: 'snippet' | 'rule' = 'snippet'
    let description = ''
    let createdAt = Date.now()
    let updatedAt = Date.now()
    let content = ''

    if (fmMatch) {
      const fmContent = fmMatch[1]
      content = fmMatch[2].trim()

      for (const line of fmContent.split('\n')) {
        const idx = line.indexOf(':')
        if (idx > -1) {
          const key = line.slice(0, idx).trim()
          let val = line.slice(idx + 1).trim()
          // Tırnakları kaldır
          val = val.replace(/^["']|["']$/g, '').replace(/\\"/g, '"')

          if (key === 'id') id = val
          else if (key === 'title') title = val
          else if (key === 'boardFamily') boardFamily = val
          else if (key === 'type' && (val === 'snippet' || val === 'rule')) type = val
          else if (key === 'description') description = val
          else if (key === 'createdAt') createdAt = parseInt(val, 10) || createdAt
          else if (key === 'updatedAt') updatedAt = parseInt(val, 10) || updatedAt
        }
      }
    } else {
      // Frontmatter yoksa, kullanıcının doğrudan yazdığı ham .md dosyası
      content = trimmed
      const firstLine = trimmed.split('\n')[0].trim()
      if (firstLine.startsWith('# ')) {
        title = firstLine.replace(/^#+\s*/, '')
      } else {
        title = basename(fileName, '.md')
      }

      // Snippet mi kural mı tahmin et
      if (content.includes('void setup') || content.includes('#include') || content.includes('void loop')) {
        type = 'snippet'
      } else {
        type = 'rule'
      }
    }

    if (!title) {
      title = basename(fileName, '.md')
    }
    if (!id) {
      id = 'skill_' + basename(fileName, '.md')
    }

    return {
      id,
      title,
      boardFamily,
      type,
      description,
      content,
      fileName,
      filePath: fullPath,
      createdAt,
      updatedAt
    }
  }

  async add(skill: Omit<CustomSkill, 'id' | 'createdAt' | 'updatedAt' | 'filePath' | 'fileName'>): Promise<CustomSkill> {
    await this.ensureInitialized()
    const saved = await this.writeSkillToFile(skill)
    // Listeyi güncelle
    await this.list()
    return saved
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureInitialized()
    const target = this.skills.find((s) => s.id === id)
    if (!target) return false

    try {
      if (target.filePath) {
        await fs.unlink(target.filePath)
      } else {
        // Dosya adı üzerinden dene
        const files = await fs.readdir(this.skillsDir)
        for (const file of files) {
          const full = join(this.skillsDir, file)
          const data = await fs.readFile(full, 'utf-8').catch(() => '')
          if (data.includes(`id: "${id}"`) || data.includes(`id: ${id}`)) {
            await fs.unlink(full)
            break
          }
        }
      }
      this.skills = this.skills.filter((s) => s.id !== id)
      return true
    } catch (err) {
      console.warn(`[CustomSkillService] Beceri silinemedi (${id}):`, err)
      return false
    }
  }

  /**
   * Hedef kart ailesiyle eşleşen tüm 'rule' tipindeki özel kuralları metin listesi olarak döner.
   */
  async getCustomRules(targetFamily?: string): Promise<string[]> {
    await this.ensureInitialized()
    await this.list()
    const normTarget = (targetFamily || 'general').toLowerCase()
    return this.skills
      .filter((s) => s.type === 'rule' && (s.boardFamily === 'general' || s.boardFamily.toLowerCase() === normTarget))
      .map((s) => `[Özel Kural: ${s.title}]\n${s.content}`)
  }
}
