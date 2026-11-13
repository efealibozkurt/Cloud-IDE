import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { ArduinoCliService } from './ArduinoCliService'
import type { BoardContext } from './BoardSkillEngine'
import type { CustomSkill, RagStatusInfo, RagChunkSummary } from '@shared/types'
import { Bm25Dizini, kodTanimlayicilari, rrfBirlestir } from './knowledge/bm25'
import { icCarpim, vektorleriAc, vektorleriPaketle } from './knowledge/vectorStore'
import { anahtarKelimeleriOku, apiOzetiniParcala, basliktanApiCikar, type KutuphaneApiOzeti } from './knowledge/libraryApi'

const MODEL_ADI = 'Xenova/multilingual-e5-small'
const VEKTOR_BOYUTU = 384
const STORE_SURUMU = 2
/**
 * e5-small'da kosinüs değerleri sıkışıktır: ilgili sorgularda en iyi sonuç 0,83–0,90, ilgisiz sorgularda
 * (hava durumu, tarif, denklem…) 0,79–0,84 çıkar (14 ilgili + 6 ilgisiz sorguyla ölçüldü). Bu yüzden tek bir eşik
 * yetmez: KESIN üstü tek başına kabul edilir; GEVSEK ile KESIN arası yalnızca sözcük araması da destekliyorsa.
 */
const ANLAMSAL_KESIN = 0.855
const ANLAMSAL_GEVSEK = 0.82
const BM25_MIN_SKOR = 0.8

/** Parçanın kaynağı; aramada kaynağa göre süzmek için kullanılır */
export type RagKind = 'snippet' | 'example' | 'library' | 'skill'

export interface RagAramaSecenekleri {
  kinds?: RagKind[]
}

export interface RagChunk {
  id: string
  sourceFile: string
  sourceOwner: string
  title: string
  content: string
  boardFamily?: 'deneyap' | 'esp32' | 'avr' | 'rp2040' | 'stm32' | 'general'
  mtime: number
  embedding?: Float32Array
  isCustom?: boolean
  kind?: RagKind
}

export interface RagSearchResult {
  chunk: RagChunk
  score: number
}

interface RagStoreMeta {
  version: number
  model?: string
  dim?: number
  updatedAt?: string
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
  private vektorPath: string
  private isIndexing = false
  private bekleyenIndeks: { ornek?: number; kutuphane?: number } | null = null
  private embedding = false
  private depoHazir: Promise<void>
  private bm25: Bm25Dizini | null = null

  constructor(private arduinoCliService?: ArduinoCliService) {
    let klasor: string
    try {
      klasor = app.getPath('userData')
    } catch {
      klasor = process.cwd()
    }
    this.storePath = join(klasor, 'rag_store.json')
    this.vektorPath = join(klasor, 'rag_vectors.bin')
    // Depo model yüklemesinden bağımsız okunur: model yüklenemese de BM25 araması çalışır
    this.depoHazir = this.loadStore()
  }

  /** Xenova/multilingual-e5-small modelini ihtiyaç anında yükler. */
  async ensureModelLoaded(): Promise<boolean> {
    if (this.extractor) return true
    if (this.initPromise) {
      await this.initPromise
      return !!this.extractor
    }

    this.initPromise = (async () => {
      try {
        console.log('[RagService] multilingual-e5-small modeli yükleniyor...')
        const { pipeline, env } = await import('@xenova/transformers')
        try {
          env.cacheDir = join(app.getPath('userData'), 'models')
        } catch {
          // varsayılan önbellek
        }
        this.extractor = await pipeline('feature-extraction', MODEL_ADI, { quantized: true })
        console.log('[RagService] multilingual-e5-small başarıyla yüklendi.')
        void this.eksikVektorleriHesapla()
      } catch (err) {
        console.warn('[RagService] Model yüklenirken hata oluştu:', err)
        this.extractor = null
        // Sonraki çağrıda yeniden denenebilsin
        this.initPromise = null
      }
    })()

    await this.initPromise
    return !!this.extractor
  }

  /** Normalize edilmiş embedding vektörü üretir; model yoksa null döner. */
  private async embedText(text: string, type: 'query' | 'passage'): Promise<Float32Array | null> {
    const ready = await this.ensureModelLoaded()
    if (!ready || !this.extractor) return null
    try {
      const output = await this.extractor(`${type}: ${text.trim().slice(0, 2000)}`, { pooling: 'mean', normalize: true })
      return Float32Array.from(output.data as ArrayLike<number>)
    } catch (err) {
      console.warn('[RagService] Embedding hesaplama hatası:', err)
      return null
    }
  }

  // ── Depo ──

  private async loadStore(): Promise<void> {
    try {
      const ham = JSON.parse(await fs.readFile(this.storePath, 'utf-8')) as RagStoreMeta & {
        chunks: Array<RagChunk & { embedding?: number[]; embIdx?: number }>
      }
      if (Array.isArray(ham.chunks)) {
        this.chunks = ham.chunks.map((c) => {
          const { embedding: _e, embIdx: _i, ...diger } = c
          return diger as RagChunk
        })
        const surum = ham.version ?? 1
        if (surum >= 2 && ham.model === MODEL_ADI && ham.dim === VEKTOR_BOYUTU) {
          try {
            const vekt = vektorleriAc(await fs.readFile(this.vektorPath), ham.dim)
            ham.chunks.forEach((c, i) => {
              if (typeof c.embIdx === 'number' && vekt[c.embIdx]) this.chunks[i].embedding = vekt[c.embIdx]
            })
          } catch (err) {
            console.warn('[RagService] Vektör dosyası okunamadı, yeniden hesaplanacak:', err)
          }
        } else if (surum === 1) {
          // Eski biçim: vektörler JSON içindeydi
          ham.chunks.forEach((c, i) => {
            if (Array.isArray(c.embedding) && c.embedding.length === VEKTOR_BOYUTU) {
              this.chunks[i].embedding = Float32Array.from(c.embedding)
            }
          })
        }
        this.chunks.forEach((c) => {
          c.kind = c.kind ?? this.tahminEtKind(c)
        })
        this.bm25 = null
        console.log(`[RagService] Depodan ${this.chunks.length} parça yüklendi (${this.chunks.filter((c) => c.embedding).length} vektörlü).`)
        this.cekirdekEksikleriniEkle()
        return
      }
    } catch {
      // Dosya yok veya bozuk: çekirdek parçalarla başla
    }
    this.chunks = []
    this.cekirdekEksikleriniEkle()
  }

  private tahminEtKind(c: RagChunk): RagKind {
    if (c.isCustom) return 'skill'
    if (c.id.startsWith('core_snippet_')) return 'snippet'
    if (c.id.startsWith('lib_')) return 'library'
    return 'example'
  }

  /** Hazır donanım parçalarından depoda olmayanları (vektörsüz) ekler. */
  private cekirdekEksikleriniEkle(): void {
    HAZIR_DONANIM_SNIPPETLERI.forEach((item, idx) => {
      const id = `core_snippet_${idx}`
      if (this.chunks.some((c) => c.id === id)) return
      this.chunks.push({ id, ...item, kind: 'snippet', mtime: Date.now() })
      this.bm25 = null
    })
  }

  private async saveStore(): Promise<void> {
    try {
      const vektorlu = this.chunks.filter((c) => c.embedding)
      const meta = {
        version: STORE_SURUMU,
        model: MODEL_ADI,
        dim: VEKTOR_BOYUTU,
        updatedAt: new Date().toISOString(),
        chunks: this.chunks.map((c) => {
          const { embedding, ...diger } = c
          return embedding ? { ...diger, embIdx: vektorlu.indexOf(c) } : diger
        })
      }
      const bin = vektorleriPaketle(vektorlu.map((c) => c.embedding as Float32Array), VEKTOR_BOYUTU)
      // Atomik yazım: yarım kalan dosya depoyu bozmasın
      await fs.writeFile(`${this.vektorPath}.tmp`, bin)
      await fs.writeFile(`${this.storePath}.tmp`, JSON.stringify(meta), 'utf-8')
      await fs.rename(`${this.vektorPath}.tmp`, this.vektorPath)
      await fs.rename(`${this.storePath}.tmp`, this.storePath)
    } catch (err) {
      console.warn('[RagService] Depo diske yazılırken hata:', err)
    }
  }

  /** Vektörü olmayan parçalar için gömme hesaplar (model yüklendikten sonra arka planda). */
  private async eksikVektorleriHesapla(): Promise<void> {
    if (this.embedding) return
    this.embedding = true
    try {
      await this.depoHazir
      let degisti = false
      for (const c of this.chunks) {
        if (c.embedding) continue
        const v = await this.embedText(`${c.title}\n${c.content}`, 'passage')
        if (!v) break
        c.embedding = v
        degisti = true
        await new Promise((r) => setTimeout(r, 5))
      }
      if (degisti) await this.saveStore()
    } finally {
      this.embedding = false
    }
  }

  // ── Arama ──

  private bm25Dizini(): Bm25Dizini {
    if (!this.bm25) this.bm25 = new Bm25Dizini(this.chunks.map((c) => `${c.title}\n${c.sourceOwner}\n${kodTanimlayicilari(c.content)}`))
    return this.bm25
  }

  private kartAilesi(ctx?: BoardContext): RagChunk['boardFamily'] | undefined {
    const fqbn = (ctx?.fqbn || '').toLowerCase()
    const ad = (ctx?.name || '').toLowerCase()
    if (fqbn.includes('deneyap') || ad.includes('deneyap')) return 'deneyap'
    if (fqbn.includes('esp32') || ad.includes('esp32')) return 'esp32'
    if (fqbn.includes('avr') || ad.includes('uno') || ad.includes('nano')) return 'avr'
    if (fqbn.includes('rp2040') || ad.includes('pico')) return 'rp2040'
    if (fqbn.includes('stm32')) return 'stm32'
    return undefined
  }

  /**
   * Hibrit arama: anlamsal (e5 kosinüs) ve sözcük tabanlı (BM25) sıralamalar RRF ile birleştirilir.
   * Model yüklenemezse yalnızca BM25 ile çalışmaya devam eder.
   */
  async search(query: string, boardContext?: BoardContext, topK = 5, secenekler?: RagAramaSecenekleri): Promise<RagSearchResult[]> {
    if (!query || query.trim().length < 2) return []
    await this.depoHazir
    if (this.chunks.length === 0) return []

    const izinli = (c: RagChunk): boolean => !secenekler?.kinds || secenekler.kinds.includes(c.kind ?? 'example')

    // 1) Sözcük sırası
    const sozcuk = this.bm25Dizini()
      .ara(query, 30)
      .filter((r) => izinli(this.chunks[r.indeks]))
    const enBm = sozcuk[0]?.skor ?? 0
    const bm25Idx = enBm >= BM25_MIN_SKOR ? sozcuk.filter((r) => r.skor >= enBm * 0.35).map((r) => r.indeks) : []
    const bm25Kumesi = new Set(bm25Idx)

    // 2) Anlamsal sıra (kesin eşik, ya da sözcük desteğiyle gevşek eşik)
    const sorguVektoru = await this.embedText(query, 'query')
    let anlamsal: number[] = []
    if (sorguVektoru) {
      const puanlar = this.chunks
        .map((c, i) => ({ i, cos: c.embedding && izinli(c) ? icCarpim(sorguVektoru, c.embedding) : -1 }))
        .filter((x) => x.cos >= ANLAMSAL_KESIN || (x.cos >= ANLAMSAL_GEVSEK && bm25Kumesi.has(x.i)))
        .sort((a, b) => b.cos - a.cos)
      const en = puanlar[0]?.cos ?? 0
      anlamsal = puanlar.filter((x) => x.cos >= en - 0.12).slice(0, 20).map((x) => x.i)
    }

    if (anlamsal.length === 0 && bm25Idx.length === 0) return []

    // 3) Birleştir + kart ailesi ayarı
    const aile = this.kartAilesi(boardContext)
    const birlesik = rrfBirlestir([anlamsal, bm25Idx]).map((r) => {
      const c = this.chunks[r.indeks]
      let skor = r.skor
      if (aile && c.boardFamily && c.boardFamily !== 'general') skor *= c.boardFamily === aile ? 1.25 : 0.8
      return { chunk: c, score: skor }
    })
    birlesik.sort((a, b) => b.score - a.score)
    return birlesik.slice(0, topK)
  }

  // ── İndeksleme ──

  /**
   * Kurulu kütüphane örneklerini arka planda indeksler. Başka bir indeksleme sürüyorsa istek
   * kuyruğa alınır ve mevcut iş bitince çalıştırılır.
   */
  async indexInstalledExamples(maxExamples = 30): Promise<number> {
    return this.indeksle({ ornek: maxExamples })
  }

  /** Kurulu kütüphanelerin başlık dosyalarından API özetleri çıkarıp indeksler. */
  async indexLibraryApis(maxLibraries = 40): Promise<number> {
    return this.indeksle({ kutuphane: maxLibraries })
  }

  private async indeksle(istek: { ornek?: number; kutuphane?: number }): Promise<number> {
    await this.depoHazir
    if (!this.arduinoCliService) return 0
    if (this.isIndexing) {
      this.bekleyenIndeks = {
        ornek: Math.max(this.bekleyenIndeks?.ornek ?? 0, istek.ornek ?? 0) || undefined,
        kutuphane: Math.max(this.bekleyenIndeks?.kutuphane ?? 0, istek.kutuphane ?? 0) || undefined
      }
      return 0
    }
    this.isIndexing = true
    let eklenen = 0
    try {
      if (istek.ornek) eklenen += await this.ornekleriIndeksle(istek.ornek)
      if (istek.kutuphane) eklenen += await this.kutuphaneleriIndeksle(istek.kutuphane)
      if (eklenen > 0) {
        this.bm25 = null
        await this.saveStore()
        console.log(`[RagService] İndeksleme tamamlandı: ${eklenen} yeni parça, toplam ${this.chunks.length}.`)
      }
    } catch (err) {
      console.warn('[RagService] İndeksleme sırasında hata:', err)
    } finally {
      this.isIndexing = false
    }
    const siradaki = this.bekleyenIndeks
    this.bekleyenIndeks = null
    if (siradaki) eklenen += await this.indeksle(siradaki)
    return eklenen
  }

  private async parcaEkle(c: RagChunk): Promise<void> {
    c.embedding = (await this.embedText(`${c.title}\n${c.content}`, 'passage')) ?? undefined
    const idx = this.chunks.findIndex((x) => x.id === c.id)
    if (idx >= 0) this.chunks[idx] = c
    else this.chunks.push(c)
    this.bm25 = null
    await new Promise((r) => setTimeout(r, 10))
  }

  private async ornekleriIndeksle(maxExamples: number): Promise<number> {
    const gruplar = await this.arduinoCliService!.listExamples()
    const mevcutMtime = new Map<string, number>()
    for (const c of this.chunks) if (c.kind === 'example') mevcutMtime.set(c.sourceFile, c.mtime)

    let islenen = 0
    let eklenen = 0
    for (const grup of gruplar) {
      if (islenen >= maxExamples) break
      const sahip = grup.ownerName
      const kucuk = sahip.toLowerCase()
      const aile: RagChunk['boardFamily'] = kucuk.includes('deneyap')
        ? 'deneyap'
        : kucuk.includes('esp32')
        ? 'esp32'
        : kucuk.includes('avr')
        ? 'avr'
        : 'general'

      for (const ornek of grup.examples) {
        if (islenen >= maxExamples) break
        try {
          const ino = (await fs.readdir(ornek.folderPath)).find((d) => d.endsWith('.ino'))
          if (!ino) continue
          const tamYol = join(ornek.folderPath, ino)
          const st = await fs.stat(tamYol)
          if (mevcutMtime.get(tamYol) === st.mtimeMs) {
            islenen++
            continue
          }
          const kod = await fs.readFile(tamYol, 'utf-8')
          for (const c of this.inoParcala(tamYol, sahip, ornek.name, kod, aile, st.mtimeMs)) {
            await this.parcaEkle(c)
            eklenen++
          }
          islenen++
        } catch {
          // tekil dosya hatası es geçilir
        }
      }
    }
    return eklenen
  }

  private async kutuphaneleriIndeksle(maxLibraries: number): Promise<number> {
    const kutuphaneler = await this.arduinoCliService!.listLibraries()
    let eklenen = 0
    let islenen = 0
    for (const kut of kutuphaneler) {
      if (islenen >= maxLibraries) break
      const onek = `lib_${kut.name}@${kut.version}_`
      if (this.chunks.some((c) => c.id.startsWith(onek))) {
        islenen++
        continue
      }
      try {
        const ozet = await this.kutuphaneApiOzeti(kut.installDir, kut.name)
        if (!ozet) continue
        // Aynı kütüphanenin eski sürüm parçalarını temizle
        this.chunks = this.chunks.filter((c) => !c.id.startsWith(`lib_${kut.name}@`))
        const parcalar = apiOzetiniParcala(ozet)
        for (const [i, metin] of parcalar.entries()) {
          await this.parcaEkle({
            id: `${onek}${i}`,
            sourceFile: kut.installDir,
            sourceOwner: `Kütüphane: ${kut.name} ${kut.version}`,
            title: `${kut.name} kütüphanesi API (${i + 1}/${parcalar.length})`,
            content: `#include <${ozet.baslikAdi}>\n${metin}`,
            boardFamily: 'general',
            kind: 'library',
            mtime: Date.now()
          })
          eklenen++
        }
        islenen++
      } catch {
        // tekil kütüphane hatası es geçilir
      }
    }
    return eklenen
  }

  private async kutuphaneApiOzeti(kutDizini: string, ad: string): Promise<(KutuphaneApiOzeti & { baslikAdi: string }) | null> {
    const adaylar = [join(kutDizini, 'src'), kutDizini]
    for (const dizin of adaylar) {
      let dosyalar: string[]
      try {
        dosyalar = (await fs.readdir(dizin)).filter((d) => /\.(h|hpp)$/i.test(d))
      } catch {
        continue
      }
      if (dosyalar.length === 0) continue
      const kisa = ad.toLowerCase().replace(/[^a-z0-9]/g, '')
      const oncelik = (d: string): number => (d.toLowerCase().replace(/[^a-z0-9.]/g, '').startsWith(kisa) ? 0 : 1)
      dosyalar.sort((a, b) => oncelik(a) - oncelik(b) || a.localeCompare(b))

      const birlesik: KutuphaneApiOzeti = { siniflar: [], fonksiyonlar: [], sabitler: [] }
      for (const d of dosyalar.slice(0, 4)) {
        const o = basliktanApiCikar(await fs.readFile(join(dizin, d), 'utf-8'))
        birlesik.siniflar.push(...o.siniflar)
        birlesik.fonksiyonlar.push(...o.fonksiyonlar)
        birlesik.sabitler.push(...o.sabitler)
      }
      if (birlesik.fonksiyonlar.length === 0 && birlesik.siniflar.length === 0) {
        try {
          birlesik.fonksiyonlar.push(...anahtarKelimeleriOku(await fs.readFile(join(kutDizini, 'keywords.txt'), 'utf-8')))
        } catch {
          return null
        }
      }
      if (birlesik.fonksiyonlar.length === 0 && birlesik.siniflar.length === 0) return null
      birlesik.fonksiyonlar = birlesik.fonksiyonlar.slice(0, 140)
      return { ...birlesik, baslikAdi: dosyalar[0] }
    }
    return null
  }

  /** Bir .ino dosyasını anlamlı parçalara böler (kısa dosya tek parça; uzun dosya setup/loop blokları). */
  private inoParcala(
    dosya: string,
    sahip: string,
    ornekAdi: string,
    kod: string,
    aile: RagChunk['boardFamily'],
    mtime: number
  ): RagChunk[] {
    const satirlar = kod.split('\n')
    const temel = { sourceFile: dosya, sourceOwner: sahip, boardFamily: aile, kind: 'example' as const, mtime }
    if (satirlar.length <= 60) {
      return [{ ...temel, id: `${dosya}_full`, title: `${sahip} / ${ornekAdi} (Tam Örnek Kod)`, content: satirlar.slice(0, 55).join('\n').trim() }]
    }

    // Üst bilgi: ilk fonksiyondan önceki #include/#define/global tanımlar
    let ilkFonksiyon = satirlar.findIndex((s) => /^\s*(?:void|int|float|bool|double|long|char|String)\s+\w+\s*\(/.test(s))
    if (ilkFonksiyon < 0) ilkFonksiyon = Math.min(satirlar.length, 15)
    const ust = satirlar.slice(0, ilkFonksiyon).filter((s) => {
      const t = s.trim()
      return t && !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*')
    })
    const ustMetin = ust.slice(0, 15).join('\n')

    const blokAl = (baslangicDeseni: RegExp): string | null => {
      const bas = satirlar.findIndex((s) => baslangicDeseni.test(s))
      if (bas < 0) return null
      let derinlik = 0
      let basladi = false
      const blok: string[] = []
      for (let i = bas; i < satirlar.length && blok.length < 45; i++) {
        blok.push(satirlar[i])
        for (const ch of satirlar[i]) {
          if (ch === '{') {
            derinlik++
            basladi = true
          } else if (ch === '}') derinlik--
        }
        if (basladi && derinlik <= 0) break
      }
      return blok.join('\n')
    }

    const sonuc: RagChunk[] = []
    const setup = blokAl(/^\s*void\s+setup\s*\(/)
    const loop = blokAl(/^\s*void\s+loop\s*\(/)
    if (setup) sonuc.push({ ...temel, id: `${dosya}_setup`, title: `${sahip} / ${ornekAdi} (setup: başlatma)`, content: `${ustMetin}\n\n${setup}`.trim() })
    if (loop) sonuc.push({ ...temel, id: `${dosya}_loop`, title: `${sahip} / ${ornekAdi} (loop: ana döngü)`, content: loop.trim() })
    if (sonuc.length === 0) sonuc.push({ ...temel, id: `${dosya}_full`, title: `${sahip} / ${ornekAdi}`, content: satirlar.slice(0, 55).join('\n').trim() })
    return sonuc
  }

  // ── Okuma / yönetim ──

  getChunkCount(): number {
    return this.chunks.length
  }

  getStats(): RagStatusInfo {
    return {
      modelLoaded: !!this.extractor,
      modelName: 'Xenova/multilingual-e5-small (INT8)',
      totalChunks: this.chunks.length,
      isIndexing: this.isIndexing,
      storePath: this.storePath
    }
  }

  listChunks(query?: string, boardFamily?: string): RagChunkSummary[] {
    let filtered = this.chunks
    if (boardFamily && boardFamily !== 'all') {
      const hedef = boardFamily.toLowerCase()
      filtered = filtered.filter((c) => (c.boardFamily || 'general').toLowerCase() === hedef)
    }
    if (query && query.trim()) {
      const q = query.toLowerCase().trim()
      filtered = filtered.filter(
        (c) => c.title.toLowerCase().includes(q) || c.sourceOwner.toLowerCase().includes(q) || c.content.toLowerCase().includes(q)
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

  private beceriParcasi(skill: CustomSkill): RagChunk {
    return {
      id: `custom_${skill.id}`,
      sourceFile: 'custom_skill',
      sourceOwner: 'Özel Beceri (Kullanıcı)',
      title: skill.title,
      content: skill.content,
      boardFamily: (skill.boardFamily || 'general') as RagChunk['boardFamily'],
      kind: 'skill',
      mtime: skill.updatedAt || Date.now(),
      isCustom: true
    }
  }

  async addCustomSkillChunk(skill: CustomSkill): Promise<void> {
    await this.depoHazir
    await this.parcaEkle(this.beceriParcasi(skill))
    await this.saveStore()
  }

  async removeCustomSkillChunk(skillId: string): Promise<void> {
    await this.depoHazir
    const onceki = this.chunks.length
    this.chunks = this.chunks.filter((c) => c.id !== `custom_${skillId}`)
    if (this.chunks.length !== onceki) {
      this.bm25 = null
      await this.saveStore()
    }
  }

  /** Özel becerileri depoyla eşitler: eksikleri ekler, silinmiş olanları kaldırır. */
  async syncCustomSkills(skills: CustomSkill[]): Promise<void> {
    await this.depoHazir
    const kimlikler = new Set(skills.map((s) => `custom_${s.id}`))
    const onceki = this.chunks.length
    this.chunks = this.chunks.filter((c) => !c.isCustom || kimlikler.has(c.id))
    let degisti = this.chunks.length !== onceki
    for (const skill of skills) {
      if (!this.chunks.some((c) => c.id === `custom_${skill.id}`)) {
        await this.parcaEkle(this.beceriParcasi(skill))
        degisti = true
      }
    }
    if (degisti) {
      this.bm25 = null
      await this.saveStore()
    }
  }
}
