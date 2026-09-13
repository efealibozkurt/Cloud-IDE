import { existsSync } from 'fs'
import { cp, mkdir, readdir, readFile, rename, unlink, writeFile } from 'fs/promises'
import { basename, dirname, extname, join } from 'path'
import { SketchFile, SketchFileKind, SketchInfo } from '@shared/types'

/** Sketch klasörlerinde tanınan kaynak dosya uzantıları */
const GECERLI_UZANTILAR = new Set(['.ino', '.h', '.hpp', '.cpp', '.c'])
/** Sketch'e eklenebilecek dosya türleri (.ino, .h, .hpp, .cpp, .c) */
const EKLENEBILIR_UZANTILAR = new Set(['.ino', '.h', '.hpp', '.cpp', '.c'])
/** Klasör/dosya adlarında izin verilmeyen karakterler (Windows dosya sistemi kısıtları) */
const GECERSIZ_AD_DESENI = /[\\/:*?"<>|]/

function dosyaTuruBelirle(dosyaAdi: string): SketchFileKind {
  const uzanti = extname(dosyaAdi).toLowerCase()
  switch (uzanti) {
    case '.ino':
      return 'ino'
    case '.h':
      return 'h'
    case '.hpp':
      return 'hpp'
    case '.cpp':
      return 'cpp'
    case '.c':
      return 'c'
    default:
      return 'other'
  }
}

function adDogrula(ad: string): string {
  const guvenliAd = ad.trim()
  if (!guvenliAd) {
    throw new Error('İsim boş olamaz')
  }
  if (GECERSIZ_AD_DESENI.test(guvenliAd)) {
    throw new Error('İsim şu karakterleri içeremez: \\ / : * ? " < > |')
  }
  return guvenliAd
}

/**
 * Sketch klasörleri ve içindeki kaynak dosyalar üzerinde çalışan servis.
 * IPC'den tamamen bağımsızdır; dosya diyalogları (aç/farklı kaydet) IPC
 * katmanında açılır, seçilen yol bu servise düz bir string olarak verilir.
 */
export class SketchService {
  /** Yeni bir sketch klasörü + aynı adda .ino dosyası (Türkçe yorumlu iskelet) oluşturur */
  async createNew(parentDir: string, name: string): Promise<SketchInfo> {
    const guvenliAd = adDogrula(name)
    const klasorYolu = join(parentDir, guvenliAd)
    if (existsSync(klasorYolu)) {
      throw new Error('Bu isimde bir klasör zaten var')
    }
    await mkdir(klasorYolu, { recursive: true })

    const iskelet = `// ${guvenliAd}
// Bu dosya Cloud IDE tarafından oluşturuldu.

void setup() {
  // Kart bir kez başlarken (reset/açılış) yalnızca bir kez çalışır.
  Serial.begin(115200);
}

void loop() {
  // Kart açık kaldığı sürece bu fonksiyon tekrar tekrar çalışır.

}
`
    await writeFile(join(klasorYolu, `${guvenliAd}.ino`), iskelet, 'utf8')
    return this.openSketch(klasorYolu)
  }

  /** Bir klasörü sketch olarak açar; klasörle aynı adda .ino dosyası yoksa hata verir */
  async openSketch(folderPath: string): Promise<SketchInfo> {
    const dosyalar = await this.listFiles(folderPath)
    if (!dosyalar.some((d) => d.isMainFile)) {
      throw new Error('Seçilen klasörde klasörle aynı isimde bir .ino dosyası bulunamadı')
    }
    return { folderPath, name: basename(folderPath), files: dosyalar }
  }

  /** Sketch klasöründeki .ino/.h/.hpp/.cpp/.c dosyalarını listeler; ana dosya en başta */
  async listFiles(folderPath: string): Promise<SketchFile[]> {
    const klasorAdi = basename(folderPath)
    const girdiler = await readdir(folderPath, { withFileTypes: true })
    return girdiler
      .filter((g) => g.isFile() && GECERLI_UZANTILAR.has(extname(g.name).toLowerCase()))
      .map((g) => ({
        path: join(folderPath, g.name),
        name: g.name,
        kind: dosyaTuruBelirle(g.name),
        isMainFile: g.name === `${klasorAdi}.ino`
      }))
      .sort((a, b) => {
        if (a.isMainFile !== b.isMainFile) return a.isMainFile ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }

  async readFile(filePath: string): Promise<string> {
    return readFile(filePath, 'utf8')
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await writeFile(filePath, content, 'utf8')
  }

  /** Sketch klasörüne yeni bir başlık/kaynak veya ikincil sketch dosyası ekler */
  async addFile(folderPath: string, fileName: string): Promise<SketchFile> {
    const guvenliAd = adDogrula(fileName)
    const uzanti = extname(guvenliAd).toLowerCase()
    if (!EKLENEBILIR_UZANTILAR.has(uzanti)) {
      throw new Error('Sadece .ino, .h, .hpp, .cpp veya .c uzantılı dosyalar eklenebilir')
    }
    const klasorAdi = basename(folderPath)
    if (guvenliAd.toLowerCase() === `${klasorAdi}.ino`.toLowerCase()) {
      throw new Error('Ana sketch dosyasıyla aynı isimde bir dosya eklenemez')
    }
    const yol = join(folderPath, guvenliAd)
    if (!existsSync(yol)) {
      await writeFile(yol, '', 'utf8')
    }
    return { path: yol, name: guvenliAd, kind: dosyaTuruBelirle(guvenliAd), isMainFile: false }
  }

  /** Ana .ino dosyası hariç bir dosyayı siler (ana dosya sketch'in kimliğidir, silinemez) */
  async deleteFile(filePath: string): Promise<void> {
    const klasorAdi = basename(dirname(filePath))
    if (basename(filePath) === `${klasorAdi}.ino`) {
      throw new Error("Sketch'in ana .ino dosyası silinemez")
    }
    await unlink(filePath)
  }

  /** Bir dosyayı yeniden adlandırır. Eğer ana .ino dosyası ise sketch klasörüyle birlikte uyumlu şekilde günceller. */
  async renameFile(filePath: string, newName: string): Promise<SketchFile> {
    const guvenliAd = adDogrula(newName)
    const klasor = dirname(filePath)
    const klasorAdi = basename(klasor)
    const isMain = basename(filePath).toLowerCase() === `${klasorAdi}.ino`.toLowerCase()

    if (isMain) {
      const yeniKokAd = guvenliAd.replace(/\.ino$/i, '')
      const parentDir = dirname(klasor)
      let sonKokAd = yeniKokAd
      let hedefKlasorYolu = join(parentDir, sonKokAd)
      let sonInoAdi = `${sonKokAd}.ino`
      let tempInoYolu = join(klasor, sonInoAdi)

      if (klasorAdi.toLowerCase() !== sonKokAd.toLowerCase()) {
        let sayac = 1
        while (
          (existsSync(hedefKlasorYolu) && hedefKlasorYolu.toLowerCase() !== klasor.toLowerCase()) ||
          (existsSync(tempInoYolu) && tempInoYolu.toLowerCase() !== filePath.toLowerCase())
        ) {
          sonKokAd = `${yeniKokAd}_${sayac}`
          hedefKlasorYolu = join(parentDir, sonKokAd)
          sonInoAdi = `${sonKokAd}.ino`
          tempInoYolu = join(klasor, sonInoAdi)
          sayac++
        }

        if (filePath.toLowerCase() !== tempInoYolu.toLowerCase()) {
          await rename(filePath, tempInoYolu)
        }
        await rename(klasor, hedefKlasorYolu)
        const sonInoYolu = join(hedefKlasorYolu, sonInoAdi)
        return { path: sonInoYolu, name: sonInoAdi, kind: 'ino', isMainFile: true }
      } else if (klasorAdi !== sonKokAd) {
        // Sadece klasör adında büyük/küçük harf değişimi
        const tempKlasor = join(parentDir, `__temp_${Date.now()}_${sonKokAd}`)
        await rename(klasor, tempKlasor)
        await rename(tempKlasor, hedefKlasorYolu)
        const tempIno = join(hedefKlasorYolu, `${klasorAdi}.ino`)
        const hedefIno = join(hedefKlasorYolu, sonInoAdi)
        if (existsSync(tempIno) && tempIno !== hedefIno) {
          const tempInoFile = join(hedefKlasorYolu, `__temp_${Date.now()}_${sonInoAdi}`)
          await rename(tempIno, tempInoFile)
          await rename(tempInoFile, hedefIno)
        }
        return { path: hedefIno, name: sonInoAdi, kind: 'ino', isMainFile: true }
      } else {
        // Klasör adı birebir aynı, sadece dosya adı uyuşmuyor olabilir
        const beklenenIno = join(klasor, `${klasorAdi}.ino`)
        if (filePath.toLowerCase() !== beklenenIno.toLowerCase()) {
          await rename(filePath, beklenenIno)
          return { path: beklenenIno, name: `${klasorAdi}.ino`, kind: 'ino', isMainFile: true }
        }
        return { path: filePath, name: `${klasorAdi}.ino`, kind: 'ino', isMainFile: true }
      }
    }

    let sonAd = guvenliAd
    let yeniYol = join(klasor, sonAd)
    if (sonAd.toLowerCase() !== basename(filePath).toLowerCase()) {
      let sayac = 1
      const ext = extname(guvenliAd)
      const raw = basename(guvenliAd, ext)
      while (existsSync(yeniYol) && yeniYol.toLowerCase() !== filePath.toLowerCase()) {
        sonAd = `${raw}_${sayac}${ext}`
        yeniYol = join(klasor, sonAd)
        sayac++
      }
    }
    if (yeniYol.toLowerCase() !== filePath.toLowerCase()) {
      await rename(filePath, yeniYol)
    } else if (filePath !== yeniYol) {
      // Sadece büyük/küçük harf değişimi (Windows için geçici ad üzerinden)
      const tempPath = join(klasor, `__temp_${Date.now()}_${sonAd}`)
      await rename(filePath, tempPath)
      await rename(tempPath, yeniYol)
    }
    return { path: yeniYol, name: sonAd, kind: dosyaTuruBelirle(sonAd), isMainFile: false }
  }

  /**
   * Sketch'i yeni bir konuma/isimle kopyalar (Farklı Kaydet). Arduino IDE
   * geleneğine uyarak ana .ino dosyası, yeni klasör adıyla eşleşecek
   * şekilde yeniden adlandırılır.
   */
  async saveAs(sourceFolderPath: string, targetParentDir: string, newName: string): Promise<SketchInfo> {
    const guvenliAd = adDogrula(newName)
    const hedefKlasor = join(targetParentDir, guvenliAd)
    if (existsSync(hedefKlasor)) {
      throw new Error('Bu isimde bir klasör zaten var')
    }
    await cp(sourceFolderPath, hedefKlasor, { recursive: true })

    const eskiKlasorAdi = basename(sourceFolderPath)
    const eskiInoYolu = join(hedefKlasor, `${eskiKlasorAdi}.ino`)
    const yeniInoYolu = join(hedefKlasor, `${guvenliAd}.ino`)
    if (eskiKlasorAdi !== guvenliAd && existsSync(eskiInoYolu)) {
      await rename(eskiInoYolu, yeniInoYolu)
    }
    return this.openSketch(hedefKlasor)
  }
}
