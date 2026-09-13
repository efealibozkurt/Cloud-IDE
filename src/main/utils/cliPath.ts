import { app } from 'electron'
import { spawn } from 'child_process'
import { access, constants as fsConstants } from 'fs/promises'
import { join } from 'path'

/**
 * Bir dosya yolunun var olup olmadığını ve çalıştırılabilir olduğunu
 * kontrol eder. Bulunamazsa/erişilemezse false döner (hata fırlatmaz).
 */
async function dosyaCalistirilabilirMi(yol: string): Promise<boolean> {
  try {
    await access(yol, fsConstants.X_OK | fsConstants.F_OK)
    return true
  } catch {
    try {
      // Windows'ta X_OK genelde anlamsızdır; sadece varlığını kontrol et
      await access(yol, fsConstants.F_OK)
      return true
    } catch {
      return false
    }
  }
}

/** Platforma göre arduino-cli ikilisinin dosya adı */
function ikiliDosyaAdi(): string {
  return process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli'
}

/**
 * Uygulamayla birlikte paketlenmiş arduino-cli'nin beklenen yolu.
 * Paketlenmiş uygulamada resources/ dizini process.resourcesPath'tir;
 * geliştirme sırasında proje kökündeki resources/ klasörüne bakılır.
 */
function paketlenmisCliYolu(): string {
  const resourcesDir = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources')
  return join(resourcesDir, 'arduino-cli', ikiliDosyaAdi())
}

/**
 * Arduino IDE 2.x'in arduino-cli'yi kendi içine gömdüğü, kullanıcıların
 * bilgisayarında en sık rastlanan konumlar. Çoğu kullanıcı arduino-cli'yi
 * hiç ayrıca kurmaz; zaten kurulu olan Arduino IDE'nin içinde taşır ve
 * PATH'e de eklemez. Bu yüzden salt "resources/" ve PATH kontrolü
 * pratikte çoğu kurulumu bulamaz; burada bilinen kurulum yerleri de
 * taranır.
 */
function bilinenKurulumYerleri(): string[] {
  if (process.platform === 'win32') {
    const adaylar: string[] = []
    const altYol = ['Arduino IDE', 'resources', 'app', 'lib', 'backend', 'resources', 'arduino-cli.exe']
    // Kullanıcı bazlı kurulum (electron-builder NSIS varsayılanı): %LOCALAPPDATA%\Programs\<Uygulama>
    if (process.env['LOCALAPPDATA']) {
      adaylar.push(join(process.env['LOCALAPPDATA'], 'Programs', ...altYol))
    }
    // Makine geneli kurulum: doğrudan Program Files altında
    for (const kok of [process.env['ProgramFiles'], process.env['ProgramFiles(x86)']]) {
      if (kok) adaylar.push(join(kok, ...altYol))
    }
    return adaylar
  }
  if (process.platform === 'darwin') {
    return ['/Applications/Arduino IDE.app/Contents/Resources/app/lib/backend/resources/arduino-cli']
  }
  return ['/usr/local/bin/arduino-cli', '/usr/bin/arduino-cli']
}

/** Yukarıdaki bilinen kurulum yerlerini sırayla dener, ilk bulunanı döner */
async function bilinenYerdeAra(): Promise<string | null> {
  for (const aday of bilinenKurulumYerleri()) {
    if (await dosyaCalistirilabilirMi(aday)) return aday
  }
  return null
}

/**
 * Sistem PATH'inde arduino-cli olup olmadığını `where`/`which` ile kontrol
 * eder. child_process.spawn kullanılır (exec değil), böylece shell
 * enjeksiyon riski oluşmaz.
 */
function pathTeAra(): Promise<string | null> {
  return new Promise((resolve) => {
    const komut = process.platform === 'win32' ? 'where' : 'which'
    const surec = spawn(komut, ['arduino-cli'], { shell: false })
    let cikti = ''
    surec.stdout.on('data', (parca) => {
      cikti += parca.toString()
    })
    surec.on('error', () => resolve(null))
    surec.on('close', (kod) => {
      if (kod === 0 && cikti.trim().length > 0) {
        // `where` birden çok satır döndürebilir, ilkini kullan
        resolve(cikti.trim().split(/\r?\n/)[0].trim())
      } else {
        resolve(null)
      }
    })
  })
}

/**
 * arduino-cli ikilisini şu öncelik sırasına göre bulur:
 * 1. Kullanıcının ayarlarda elle belirttiği yol
 * 2. Uygulamayla birlikte paketlenmiş resources/arduino-cli(.exe)
 * 3. Arduino IDE 2.x'in bilinen kurulum konumları (en yaygın gerçek durum:
 *    kullanıcıda zaten Arduino IDE kurulu ama arduino-cli PATH'e eklenmemiş)
 * 4. Sistem PATH'i
 * Hiçbiri bulunamazsa null döner; çağıran taraf bunu bir hata olarak değil,
 * "henüz yapılandırılmadı" durumu olarak ele almalıdır.
 */
export async function resolveArduinoCliPath(kullaniciYolu: string | null): Promise<string | null> {
  if (kullaniciYolu && (await dosyaCalistirilabilirMi(kullaniciYolu))) {
    return kullaniciYolu
  }

  const paketYolu = paketlenmisCliYolu()
  if (await dosyaCalistirilabilirMi(paketYolu)) {
    return paketYolu
  }

  const bilinenYol = await bilinenYerdeAra()
  if (bilinenYol) return bilinenYol

  return pathTeAra()
}
