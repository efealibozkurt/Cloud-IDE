import { existsSync } from 'fs'
import { copyFile, mkdir, readdir } from 'fs/promises'
import { join } from 'path'

/**
 * Windows'ta bazı xtensa/GCC tabanlı ESP32 toolchain paketlerinde (deneyap,
 * esp32 vb.) bilinen, yaygın bildirilen bir sorun: derleyici "bits/c++allocator.h",
 * "bits/c++config.h" gibi hedefe-özel (target-specific) başlık dosyalarını
 * kendi include/c++/<sürüm>/<hedef-üçlü>/bits/ alt klasöründen bulamıyor,
 * "No such file or directory" hatası veriyor
 * (bkz. arduino/arduino-cli#1002, espressif/arduino-esp32#9271, #9654, #961).
 *
 * Bu dosyalar zaten genel include/c++/<sürüm>/bits/ klasöründe HİÇ
 * bulunmadığından (çakışma riski yok), güvenli çözüm bunları oraya da
 * kopyalamaktır — derleyici o zaman ilk arama yolunda bulur.
 *
 * Bu modül, kurulu her çekirdeğin toolchain'lerini tarayıp bu deseni
 * (bir "include/c++/<sürüm>" klasörünün alt klasörlerinden birinin kendi
 * bits/ klasörü olması) otomatik tespit edip onarır. Böylece sorun hem
 * çekirdek kurulumundan hemen sonra hem de bir derleme bu hatayla
 * başarısız olduğunda otomatik giderilir; kullanıcı elle bir şey yapmaz.
 */

/** Bir dizinin alt klasörlerinin adlarını döner; erişilemezse boş dizi */
async function altDizinAdlariniListele(yol: string): Promise<string[]> {
  try {
    const girdiler = await readdir(yol, { withFileTypes: true })
    return girdiler.filter((g) => g.isDirectory()).map((g) => g.name)
  } catch {
    return []
  }
}

/**
 * Tek bir "include/c++/<sürüm>" klasörünü onarır: alt klasörlerinden
 * herhangi birinin kendi bits/ klasörü varsa (hedefe-özel başlıklar),
 * oradaki dosyalardan genel bits/ klasöründe eksik olanları kopyalar.
 * Zaten var olan dosyaların üzerine ASLA yazılmaz.
 */
async function cppSurumKlasorunuOnar(cppSurumYolu: string): Promise<number> {
  let onarilanSayisi = 0
  const genelBitsYolu = join(cppSurumYolu, 'bits')
  const altKlasorler = await altDizinAdlariniListele(cppSurumYolu)

  for (const alt of altKlasorler) {
    // Standart, hedeften bağımsız alt klasörleri atla; yalnızca hedef-üçlü
    // adındaki (ör. xtensa-esp32s2-elf) klasörler kendi bits/ alt
    // klasörünü barındırır.
    if (alt === 'bits') continue
    const hedefBitsYolu = join(cppSurumYolu, alt, 'bits')
    let hedefDosyaAdlari: string[]
    try {
      hedefDosyaAdlari = (await readdir(hedefBitsYolu, { withFileTypes: true }))
        .filter((g) => g.isFile())
        .map((g) => g.name)
    } catch {
      continue
    }
    if (hedefDosyaAdlari.length === 0) continue

    await mkdir(genelBitsYolu, { recursive: true })
    for (const dosyaAdi of hedefDosyaAdlari) {
      const genelDosyaYolu = join(genelBitsYolu, dosyaAdi)
      if (existsSync(genelDosyaYolu)) continue
      await copyFile(join(hedefBitsYolu, dosyaAdi), genelDosyaYolu)
      onarilanSayisi++
    }
  }
  return onarilanSayisi
}

/** Bir toolchain kök dizini altında "include/c++/<sürüm>" desenindeki tüm klasörleri, sınırlı derinlikte arar */
async function cppSurumKlasorleriniBul(kok: string, kalanDerinlik: number): Promise<string[]> {
  if (kalanDerinlik <= 0) return []
  let girdiler: { name: string; isDirectory: () => boolean }[]
  try {
    girdiler = await readdir(kok, { withFileTypes: true })
  } catch {
    return []
  }

  const sonuc: string[] = []
  for (const g of girdiler) {
    if (!g.isDirectory()) continue
    const tamYol = join(kok, g.name)
    if (g.name === 'c++') {
      const surumler = await altDizinAdlariniListele(tamYol)
      for (const surum of surumler) sonuc.push(join(tamYol, surum))
      continue
    }
    sonuc.push(...(await cppSurumKlasorleriniBul(tamYol, kalanDerinlik - 1)))
  }
  return sonuc
}

/**
 * Verilen arduino-cli veri dizini (arduino-cli-data) altındaki TÜM kurulu
 * çekirdeklerin toolchain'lerini tarar ve bilinen başlık dosyası
 * çözümleme sorununu onarır. Onarılan dosya sayısını döner (0 ise
 * yapılacak bir şey yoktu).
 */
export async function tumToolchainBaslikYollariniOnar(arduinoCliDataDir: string): Promise<number> {
  const packagesDir = join(arduinoCliDataDir, 'packages')
  let toplamOnarilan = 0

  const paketAdlari = await altDizinAdlariniListele(packagesDir)
  for (const paketAdi of paketAdlari) {
    const toolsDir = join(packagesDir, paketAdi, 'tools')
    const toolAdlari = await altDizinAdlariniListele(toolsDir)
    for (const toolAdi of toolAdlari) {
      const toolKlasoru = join(toolsDir, toolAdi)
      const surumAdlari = await altDizinAdlariniListele(toolKlasoru)
      for (const surumAdi of surumAdlari) {
        const toolKokYolu = join(toolKlasoru, surumAdi)
        const cppKlasorleri = await cppSurumKlasorleriniBul(toolKokYolu, 6)
        for (const cppKlasoru of cppKlasorleri) {
          toplamOnarilan += await cppSurumKlasorunuOnar(cppKlasoru)
        }
      }
    }
  }
  return toplamOnarilan
}

/**
 * Bir derleme hatasının, bilinen "hedefe-özel bits/ başlığı bulunamadı"
 * deseniyle eşleşip eşleşmediğini kontrol eder. Eşleşiyorsa otomatik
 * onarım deneyip derlemeyi bir kez daha tekrarlamak anlamlı olur.
 */
export function baslikEksikligiDeseniMi(metin: string): boolean {
  return /bits\/[\w+]+\.h: No such file or directory/i.test(metin)
}
