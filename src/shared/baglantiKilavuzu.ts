import { kartProfili, pinleriDenetle, pinOzetiCikar, yorumlariTemizle, type PinKaynakDosya } from './pinCheck'
import { pinHaritasi } from './pinHaritasi'

export const BAGLANTI_DOSYA_ADI = 'BAGLANTI.json'

export type KabloRengi = 'kirmizi' | 'siyah' | 'mavi' | 'sari' | 'yesil' | 'turuncu' | 'beyaz' | 'gri'

export const KABLO_RENK_HEX: Record<KabloRengi, { hex: string; ad: string }> = {
  kirmizi: { hex: '#ef4444', ad: 'Kırmızı' },
  siyah: { hex: '#64748b', ad: 'Siyah' },
  mavi: { hex: '#38bdf8', ad: 'Mavi' },
  sari: { hex: '#facc15', ad: 'Sarı' },
  yesil: { hex: '#34d399', ad: 'Yeşil' },
  turuncu: { hex: '#fb923c', ad: 'Turuncu' },
  beyaz: { hex: '#e2e8f0', ad: 'Beyaz' },
  gri: { hex: '#94a3b8', ad: 'Gri' }
}

const GECERLI_RENKLER = new Set<string>(Object.keys(KABLO_RENK_HEX))

export interface BaglantiHatti {
  id: string
  bilesen: string
  bilesenPini: string
  kartPini: string
  kartPinNo?: number
  renk: KabloRengi
  not?: string
}

export interface BaglantiBileseni {
  ad: string
  tur: string
  voltaj?: string
  ekParcalar?: string[]
  aciklama?: string
}

export interface BaglantiUyarisi {
  seviye: 'dikkat' | 'bilgi'
  mesaj: string
}

export interface BaglantiKilavuzu {
  kaynak: 'statik' | 'ai'
  kartAdi: string
  fqbn?: string
  ozet: string
  mantikVoltaj: '5V' | '3.3V'
  bilesenler: BaglantiBileseni[]
  baglantilar: BaglantiHatti[]
  uyarilar: BaglantiUyarisi[]
  tamamlananlar?: string[]
  guncellemeZamani: number
}

function slugla(metin: string): string {
  const tr: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u' }
  return metin
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => tr[c] ?? c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

function benzersizHatId(bilesen: string, bilesenPini: string, kartPini: string, kullanilan: Set<string>): string {
  const taban = slugla(`${bilesen}-${bilesenPini}-${kartPini}`) || 'hat'
  let aday = taban
  let n = 2
  while (kullanilan.has(aday)) {
    aday = `${taban}-${n}`
    n++
  }
  kullanilan.add(aday)
  return aday
}

function mantikVoltajBelirle(fqbn: string | null | undefined, kartAdi: string): '5V' | '3.3V' {
  const birlesik = `${fqbn ?? ''} ${kartAdi}`.toLowerCase()
  return /(esp32|esp8266|rp2040|deneyap|stm32|samd)/.test(birlesik) ? '3.3V' : '5V'
}

interface SabitBilgisi {
  adToPin: Map<string, number>
  pinToAd: Map<number, string>
}

function sabitIsimleriniTopla(temizKodlar: string[], fqbn: string | null | undefined): SabitBilgisi {
  const profil = kartProfili(fqbn)
  const adToPin = new Map<string, number>()
  const pinToAd = new Map<number, string>()

  const coz = (v: string): number | null => {
    if (/^\d+$/.test(v)) return Number(v)
    const a = /^A(\d+)$/.exec(v)
    return a && profil ? profil.analogAlias(Number(a[1])) : null
  }

  const kaydet = (ad: string, pin: number | null): void => {
    if (pin === null) return
    if (!adToPin.has(ad)) adToPin.set(ad, pin)
    if (!pinToAd.has(pin)) pinToAd.set(pin, ad)
  }

  for (const temiz of temizKodlar) {
    for (const m of temiz.matchAll(/#define\s+(\w+)\s+(A?\d+)\b/g)) {
      kaydet(m[1], coz(m[2]))
    }
    for (const m of temiz.matchAll(
      /\b(?:(?:constexpr|const|static|volatile)\s+)*(?:unsigned\s+)?(?:int|byte|uint8_t|uint16_t|short|long|gpio_num_t)\s+(\w+)\s*=\s*(A?\d+)\s*;/g
    )) {
      if (!/\b(?:constexpr|const)\b/.test(m[0])) {
        const oncesi = temiz.slice(0, m.index ?? 0)
        if ((oncesi.match(/\{/g)?.length ?? 0) !== (oncesi.match(/\}/g)?.length ?? 0)) continue
      }
      kaydet(m[1], coz(m[2]))
    }
  }

  return { adToPin, pinToAd }
}

function tokenPinCoz(token: string | undefined, sabitler: SabitBilgisi, fqbn: string | null | undefined): number | null {
  if (!token) return null
  const temiz = token.trim()
  if (/^\d+$/.test(temiz)) return Number(temiz)
  if (sabitler.adToPin.has(temiz)) return sabitler.adToPin.get(temiz)!
  const profil = kartProfili(fqbn)
  const a = /^A(\d+)$/.exec(temiz)
  if (a && profil) return profil.analogAlias(Number(a[1]))
  if (temiz === 'LED_BUILTIN') {
    if (profil?.ad === 'ESP32' || profil?.ad === 'ESP8266') return 2
    return 13
  }
  return null
}

function sabitBulDesenle(sabitler: SabitBilgisi, desen: RegExp): number | null {
  for (const [ad, pin] of sabitler.adToPin) {
    if (desen.test(ad)) return pin
  }
  return null
}

function i2cPinleri(fqbn: string | null | undefined, kartAdi: string): { sda: { etiket: string; no?: number }; scl: { etiket: string; no?: number } } {
  const f = (fqbn ?? '').toLowerCase()
  if (kartAdi === 'Arduino Mega' || f.includes('mega')) {
    return { sda: { etiket: 'D20 (SDA)', no: 20 }, scl: { etiket: 'D21 (SCL)', no: 21 } }
  }
  if (kartAdi === 'ESP32' || f.includes('esp32')) {
    return { sda: { etiket: 'GPIO21 (SDA)', no: 21 }, scl: { etiket: 'GPIO22 (SCL)', no: 22 } }
  }
  if (kartAdi === 'ESP8266' || f.includes('esp8266')) {
    return { sda: { etiket: 'GPIO4 (SDA / D2)', no: 4 }, scl: { etiket: 'GPIO5 (SCL / D1)', no: 5 } }
  }
  if (kartAdi === 'Arduino Uno' || kartAdi === 'Arduino Nano' || f.startsWith('arduino:avr:')) {
    return { sda: { etiket: 'A4 (SDA)', no: 18 }, scl: { etiket: 'A5 (SCL)', no: 19 } }
  }
  return { sda: { etiket: 'SDA' }, scl: { etiket: 'SCL' } }
}

function spiPinleri(
  fqbn: string | null | undefined,
  kartAdi: string
): { mosi: { etiket: string; no?: number }; miso: { etiket: string; no?: number }; sck: { etiket: string; no?: number } } {
  const f = (fqbn ?? '').toLowerCase()
  if (kartAdi === 'Arduino Mega' || f.includes('mega')) {
    return { mosi: { etiket: 'D51 (MOSI)', no: 51 }, miso: { etiket: 'D50 (MISO)', no: 50 }, sck: { etiket: 'D52 (SCK)', no: 52 } }
  }
  if (kartAdi === 'ESP32' || f.includes('esp32')) {
    return { mosi: { etiket: 'GPIO23 (MOSI)', no: 23 }, miso: { etiket: 'GPIO19 (MISO)', no: 19 }, sck: { etiket: 'GPIO18 (SCK)', no: 18 } }
  }
  if (kartAdi === 'ESP8266' || f.includes('esp8266')) {
    return { mosi: { etiket: 'GPIO13 (MOSI / D7)', no: 13 }, miso: { etiket: 'GPIO12 (MISO / D6)', no: 12 }, sck: { etiket: 'GPIO14 (SCK / D5)', no: 14 } }
  }
  if (kartAdi === 'Arduino Uno' || kartAdi === 'Arduino Nano' || f.startsWith('arduino:avr:')) {
    return { mosi: { etiket: 'D11 (MOSI)', no: 11 }, miso: { etiket: 'D12 (MISO)', no: 12 }, sck: { etiket: 'D13 (SCK)', no: 13 } }
  }
  return { mosi: { etiket: 'MOSI' }, miso: { etiket: 'MISO' }, sck: { etiket: 'SCK' } }
}

/** Kaynak kodlardan statik olarak bileşen, pin bağlantısı, kablo rengi ve güvenlik uyarılarını çıkarır. */
export function koddanBaglantiCikar(dosyalar: PinKaynakDosya[], fqbn: string | null | undefined): BaglantiKilavuzu {
  const profil = kartProfili(fqbn)
  const harita = pinHaritasi(fqbn)
  const kartAdi = profil?.ad ?? (fqbn || 'Seçili kart yok')
  const mantikVoltaj = mantikVoltajBelirle(fqbn, kartAdi)

  const haritaPinMap = new Map<number, string>()
  if (harita) {
    for (const g of harita.gruplar) {
      for (const p of g.pinler) haritaPinMap.set(p.numara, p.etiket)
    }
  }
  const kartPinEtiketi = (pinNo: number): string => {
    const bilinen = haritaPinMap.get(pinNo)
    if (bilinen) return bilinen
    if (kartAdi === 'ESP32' || kartAdi === 'ESP8266') return `GPIO${pinNo}`
    return profil ? `D${pinNo}` : `Pin ${pinNo}`
  }

  const temizKodlar = dosyalar.map((d) => yorumlariTemizle(d.icerik))
  const tumKod = temizKodlar.join('\n')
  const sabitler = sabitIsimleriniTopla(temizKodlar, fqbn)
  const ozetPin = pinOzetiCikar(dosyalar, fqbn)
  const pinSorunlari = pinleriDenetle(dosyalar, fqbn)

  const basliklar = new Set<string>()
  for (const d of dosyalar) {
    for (const m of d.icerik.matchAll(/#\s*include\s*[<"]([^>"]+)[>"]/g)) {
      basliklar.add(m[1].trim())
    }
  }
  const baslikVar = (desen: RegExp): boolean => [...basliklar].some((b) => desen.test(b))

  const bilesenler: BaglantiBileseni[] = []
  const baglantilar: BaglantiHatti[] = []
  const uyarilar: BaglantiUyarisi[] = []
  const kullanilanIdler = new Set<string>()
  const tanimlananPinler = new Set<number>()

  const hatEkle = (hat: Omit<BaglantiHatti, 'id'>): void => {
    baglantilar.push({
      ...hat,
      id: benzersizHatId(hat.bilesen, hat.bilesenPini, hat.kartPini, kullanilanIdler)
    })
  }

  // 1) DHT sensörleri
  const dhtEslesme = /\bDHT(?:_Unified)?\s+\w+\s*\(\s*([A-Za-z_]\w*|\d+)/.exec(tumKod)
  if (baslikVar(/^DHT/i) || dhtEslesme) {
    const ad = 'DHT11 / DHT22 Sensör'
    const pin = tokenPinCoz(dhtEslesme?.[1], sabitler, fqbn) ?? sabitBulDesenle(sabitler, /dht/i)
    bilesenler.push({
      ad,
      tur: 'Sıcaklık ve Nem Sensörü',
      voltaj: mantikVoltaj,
      ekParcalar: ['4.7kΩ–10kΩ pull-up direnci (çıplak sensör ise)']
    })
    hatEkle({ bilesen: ad, bilesenPini: 'VCC', kartPini: mantikVoltaj, renk: 'kirmizi' })
    hatEkle({ bilesen: ad, bilesenPini: 'GND', kartPini: 'GND', renk: 'siyah' })
    if (pin !== null) {
      tanimlananPinler.add(pin)
      hatEkle({
        bilesen: ad,
        bilesenPini: 'DATA',
        kartPini: kartPinEtiketi(pin),
        kartPinNo: pin,
        renk: 'sari',
        not: 'Çıplak 4 bacaklı sensörlerde DATA ile VCC arasına 4.7kΩ–10kΩ pull-up direnci bağlayın (3 pinli modüllerde genelde kart üzerindedir).'
      })
    }
  }

  // 2) Servo motorlar
  const servoPinleri: number[] = []
  const servoSinifAdlari = new Set<string>()
  for (const m of tumKod.matchAll(/\b(?:ESP32)?Servo\s+(\w+(?:\s*,\s*\w+)*)\s*[;[]/g)) {
    m[1].split(',').forEach((s) => servoSinifAdlari.add(s.trim()))
  }
  for (const m of tumKod.matchAll(/\b(\w+)\s*\.\s*attach\s*\(\s*([A-Za-z_]\w*|\d+)/g)) {
    if (!servoSinifAdlari.has(m[1]) && !baslikVar(/Servo/i)) continue
    const pin = tokenPinCoz(m[2], sabitler, fqbn)
    if (pin !== null && !servoPinleri.includes(pin)) servoPinleri.push(pin)
  }
  if (servoPinleri.length > 0) {
    servoPinleri.forEach((pin, idx) => {
      const ad = servoPinleri.length > 1 ? `Servo Motor ${idx + 1}` : 'Servo Motor'
      tanimlananPinler.add(pin)
      bilesenler.push({ ad, tur: 'Aktüatör', voltaj: '5V (harici önerilir)' })
      hatEkle({ bilesen: ad, bilesenPini: 'Sinyal', kartPini: kartPinEtiketi(pin), kartPinNo: pin, renk: 'turuncu' })
      hatEkle({ bilesen: ad, bilesenPini: 'VCC (+)', kartPini: '5V', renk: 'kirmizi', not: 'Yüksek akım çeken servolar için harici 5V kaynak kullanın.' })
      hatEkle({ bilesen: ad, bilesenPini: 'GND (−)', kartPini: 'GND', renk: 'siyah', not: 'Harici kaynak kullanılıyorsa GND ucu kartın GND ucuyla birleştirilmelidir.' })
    })
    uyarilar.push({
      seviye: 'bilgi',
      mesaj: 'Servo motorlar hareket anında yüksek akım çeker; birden fazla servo varsa harici 5V besleme kullanıp GND hatlarını ortaklayın.'
    })
  }

  // 3) I2C cihazları
  const i2cAlgilandi = baslikVar(/(Adafruit_SSD1306|U8g2lib|LiquidCrystal_I2C|Adafruit_BME280|Adafruit_BMP280|MPU6050|Wire\.h)/i)
  if (i2cAlgilandi) {
    let ad = 'I2C Modülü'
    let tur = 'I2C Cihazı'
    let voltaj: string = mantikVoltaj
    if (baslikVar(/Adafruit_SSD1306|U8g2lib/i)) {
      ad = 'OLED Ekran (I2C)'
      tur = 'Ekran'
    } else if (baslikVar(/LiquidCrystal_I2C/i)) {
      ad = 'I2C LCD Ekran'
      tur = 'Ekran'
      voltaj = '5V'
    } else if (baslikVar(/Adafruit_BM[EP]280/i)) {
      ad = 'BME280 / BMP280 Sensör'
      tur = 'Basınç / Sıcaklık Sensörü'
    } else if (baslikVar(/MPU6050/i)) {
      ad = 'MPU6050 Sensör'
      tur = 'İvmeölçer / Jiroskop'
    }

    const i2c = i2cPinleri(fqbn, kartAdi)
    const wireBegin = /\bWire\s*\.\s*begin\s*\(\s*([A-Za-z_]\w*|\d+)\s*,\s*([A-Za-z_]\w*|\d+)/.exec(tumKod)
    const ozelSda = wireBegin ? tokenPinCoz(wireBegin[1], sabitler, fqbn) : null
    const ozelScl = wireBegin ? tokenPinCoz(wireBegin[2], sabitler, fqbn) : null
    const sdaPin = ozelSda !== null ? { etiket: kartPinEtiketi(ozelSda), no: ozelSda } : i2c.sda
    const sclPin = ozelScl !== null ? { etiket: kartPinEtiketi(ozelScl), no: ozelScl } : i2c.scl
    if (sdaPin.no !== undefined) tanimlananPinler.add(sdaPin.no)
    if (sclPin.no !== undefined) tanimlananPinler.add(sclPin.no)

    bilesenler.push({ ad, tur, voltaj })
    hatEkle({ bilesen: ad, bilesenPini: 'VCC', kartPini: voltaj, renk: 'kirmizi' })
    hatEkle({ bilesen: ad, bilesenPini: 'GND', kartPini: 'GND', renk: 'siyah' })
    hatEkle({ bilesen: ad, bilesenPini: 'SDA', kartPini: sdaPin.etiket, kartPinNo: sdaPin.no, renk: 'mavi' })
    hatEkle({ bilesen: ad, bilesenPini: 'SCL', kartPini: sclPin.etiket, kartPinNo: sclPin.no, renk: 'sari' })

    if (baslikVar(/LiquidCrystal_I2C/i) && mantikVoltaj === '3.3V') {
      uyarilar.push({
        seviye: 'dikkat',
        mesaj: `I2C LCD genellikle 5V ile çalışır; ${kartAdi} pinleri 3.3V olduğundan I2C hattında çift yönlü seviye dönüştürücü kullanmanız gerekir.`
      })
    }
  }

  // 4) NeoPixel / FastLED
  const neoEslesme = /\bAdafruit_NeoPixel\s+\w+\s*\([^,]+,\s*([A-Za-z_]\w*|\d+)/.exec(tumKod)
  const fastEslesme = /\bFastLED\s*\.\s*addLeds\s*<[^>]+,\s*([A-Za-z_]\w*|\d+)/.exec(tumKod)
  if (baslikVar(/Adafruit_NeoPixel|FastLED/i) || neoEslesme || fastEslesme) {
    const ad = 'WS2812B / NeoPixel LED'
    const pin =
      tokenPinCoz(neoEslesme?.[1] ?? fastEslesme?.[1], sabitler, fqbn) ??
      sabitBulDesenle(sabitler, /neo|pixel|led_pin|data_pin/i)
    bilesenler.push({
      ad,
      tur: 'Adreslenebilir LED Şerit',
      voltaj: '5V',
      ekParcalar: ['330Ω–470Ω veri direnci', '1000µF kondansatör (uzun şeritlerde)']
    })
    if (pin !== null) {
      tanimlananPinler.add(pin)
      hatEkle({
        bilesen: ad,
        bilesenPini: 'DIN',
        kartPini: kartPinEtiketi(pin),
        kartPinNo: pin,
        renk: 'yesil',
        not: 'Veri hattına seri 330Ω–470Ω direnç eklemek ilk LED\'i korur.'
      })
    }
    hatEkle({ bilesen: ad, bilesenPini: '5V', kartPini: '5V', renk: 'kirmizi', not: 'Çoklu LED için harici 5V güç kaynağı kullanın.' })
    hatEkle({ bilesen: ad, bilesenPini: 'GND', kartPini: 'GND', renk: 'siyah' })
    uyarilar.push({
      seviye: 'bilgi',
      mesaj: 'NeoPixel şeridinde 8\'den fazla LED varsa kartın 5V pinini zorlamamak için harici 5V güç kaynağı ve ortak GND kullanın.'
    })
  }

  // 5) Ultrasonik HC-SR04
  const trigPin = sabitBulDesenle(sabitler, /trig/i)
  const echoPin =
    sabitBulDesenle(sabitler, /echo/i) ??
    (() => {
      const m = /\bpulseIn\s*\(\s*([A-Za-z_]\w*|\d+)/.exec(tumKod)
      return tokenPinCoz(m?.[1], sabitler, fqbn)
    })()
  if ((trigPin !== null && echoPin !== null) || (echoPin !== null && /\bpulseIn\s*\(/.test(tumKod))) {
    const ad = 'HC-SR04 Ultrasonik Sensör'
    bilesenler.push({
      ad,
      tur: 'Mesafe Sensörü',
      voltaj: '5V',
      ekParcalar: mantikVoltaj === '3.3V' ? ['1kΩ + 2kΩ direnç (ECHO gerilim bölücü)'] : undefined
    })
    hatEkle({ bilesen: ad, bilesenPini: 'VCC', kartPini: '5V', renk: 'kirmizi' })
    hatEkle({ bilesen: ad, bilesenPini: 'GND', kartPini: 'GND', renk: 'siyah' })
    if (trigPin !== null) {
      tanimlananPinler.add(trigPin)
      hatEkle({ bilesen: ad, bilesenPini: 'TRIG', kartPini: kartPinEtiketi(trigPin), kartPinNo: trigPin, renk: 'mavi' })
    }
    if (echoPin !== null) {
      tanimlananPinler.add(echoPin)
      hatEkle({
        bilesen: ad,
        bilesenPini: 'ECHO',
        kartPini: kartPinEtiketi(echoPin),
        kartPinNo: echoPin,
        renk: 'sari',
        not:
          mantikVoltaj === '3.3V'
            ? 'ECHO çıkışı 5V verir; 1kΩ / 2kΩ gerilim bölücü üzerinden bağlayın.'
            : undefined
      })
    }
    if (mantikVoltaj === '3.3V' && echoPin !== null) {
      uyarilar.push({
        seviye: 'dikkat',
        mesaj: `HC-SR04 ECHO pini 5V çıkış verir; ${kartAdi} 3.3V lojik kullandığı için ECHO ile ${kartPinEtiketi(echoPin)} arasına 1kΩ / 2kΩ gerilim bölücü kurun.`
      })
    }
  }

  // 6) SPI modülleri
  const spiAlgilandi = baslikVar(/(MFRC522|SD\.h|SPI\.h)/i)
  if (spiAlgilandi) {
    const rfidMi = baslikVar(/MFRC522/i)
    const sdMi = baslikVar(/^SD\.h$/i)
    const ad = rfidMi ? 'RFID-RC522 Okuyucu' : sdMi ? 'SD Kart Modülü' : 'SPI Modülü'
    const voltaj = rfidMi ? '3.3V' : sdMi ? '5V' : mantikVoltaj
    const spi = spiPinleri(fqbn, kartAdi)
    bilesenler.push({ ad, tur: 'SPI Modülü', voltaj })
    hatEkle({
      bilesen: ad,
      bilesenPini: 'VCC',
      kartPini: voltaj,
      renk: 'kirmizi',
      not: rfidMi ? 'RC522 yalnızca 3.3V ile çalışır, 5V bağlamayın!' : undefined
    })
    hatEkle({ bilesen: ad, bilesenPini: 'GND', kartPini: 'GND', renk: 'siyah' })
    hatEkle({ bilesen: ad, bilesenPini: 'SCK', kartPini: spi.sck.etiket, kartPinNo: spi.sck.no, renk: 'sari' })
    hatEkle({ bilesen: ad, bilesenPini: 'MOSI', kartPini: spi.mosi.etiket, kartPinNo: spi.mosi.no, renk: 'turuncu' })
    hatEkle({ bilesen: ad, bilesenPini: 'MISO', kartPini: spi.miso.etiket, kartPinNo: spi.miso.no, renk: 'yesil' })

    const csPin = sabitBulDesenle(sabitler, /^(ss|cs|sda|chip_select)(_pin)?$/i)
    const rstPin = sabitBulDesenle(sabitler, /^rst(_pin)?$/i)
    if (csPin !== null) {
      tanimlananPinler.add(csPin)
      hatEkle({ bilesen: ad, bilesenPini: rfidMi ? 'SDA (SS)' : 'CS', kartPini: kartPinEtiketi(csPin), kartPinNo: csPin, renk: 'mavi' })
    }
    if (rstPin !== null) {
      tanimlananPinler.add(rstPin)
      hatEkle({ bilesen: ad, bilesenPini: 'RST', kartPini: kartPinEtiketi(rstPin), kartPinNo: rstPin, renk: 'beyaz' })
    }
    if (rfidMi) {
      uyarilar.push({
        seviye: 'dikkat',
        mesaj: 'RFID-RC522 modülü 3.3V besleme ister; 5V pinine bağlamak modüle zarar verebilir.'
      })
    }
  }

  // 7) Kalan genel pin kullanımları (LED, buton, buzzer, röle, analog sensör vb.)
  for (const k of ozetPin.kullanimlar) {
    if (tanimlananPinler.has(k.pin)) continue
    tanimlananPinler.add(k.pin)
    const etiket = kartPinEtiketi(k.pin)
    const sabitAdi = (sabitler.pinToAd.get(k.pin) ?? '').toUpperCase()

    if (/LED/.test(sabitAdi) || (k.pin === 13 && kartAdi.startsWith('Arduino') && k.roller.includes('çıkış'))) {
      const ad = sabitAdi ? `LED (${sabitAdi})` : `LED (${etiket})`
      bilesenler.push({ ad, tur: 'Gösterge', ekParcalar: ['220Ω–330Ω akım sınırlama direnci'] })
      hatEkle({
        bilesen: ad,
        bilesenPini: 'Anot (+)',
        kartPini: etiket,
        kartPinNo: k.pin,
        renk: 'yesil',
        not: 'Harici LED kullanıyorsanız seri 220Ω–330Ω direnç üzerinden bağlayın (D13 dahili LED için ekstra bağlantı gerekmez).'
      })
      hatEkle({ bilesen: ad, bilesenPini: 'Katot (−)', kartPini: 'GND', renk: 'siyah' })
    } else if (/BTN|BUTON|BUTTON|\bSW\b/.test(sabitAdi) || (k.roller.includes('giriş') && /INPUT_PULLUP/.test(tumKod))) {
      const ad = sabitAdi ? `Buton (${sabitAdi})` : `Buton (${etiket})`
      bilesenler.push({ ad, tur: 'Giriş' })
      hatEkle({
        bilesen: ad,
        bilesenPini: '1. Bacak',
        kartPini: etiket,
        kartPinNo: k.pin,
        renk: 'mavi',
        not: 'INPUT_PULLUP kullanılıyorsa diğer bacağı doğrudan GND\'ye bağlamak yeterlidir.'
      })
      hatEkle({ bilesen: ad, bilesenPini: '2. Bacak', kartPini: 'GND', renk: 'siyah' })
    } else if (/BUZZ|BIP|PIEZO/.test(sabitAdi)) {
      const ad = sabitAdi ? `Buzzer (${sabitAdi})` : `Buzzer (${etiket})`
      bilesenler.push({ ad, tur: 'Ses Çıkışı', voltaj: mantikVoltaj })
      hatEkle({ bilesen: ad, bilesenPini: '+', kartPini: etiket, kartPinNo: k.pin, renk: 'turuncu' })
      hatEkle({ bilesen: ad, bilesenPini: '−', kartPini: 'GND', renk: 'siyah' })
    } else if (/ROLE|RELAY/.test(sabitAdi)) {
      const ad = sabitAdi ? `Röle Modülü (${sabitAdi})` : `Röle Modülü (${etiket})`
      bilesenler.push({ ad, tur: 'Güç Anahtarı', voltaj: '5V' })
      hatEkle({ bilesen: ad, bilesenPini: 'IN', kartPini: etiket, kartPinNo: k.pin, renk: 'sari' })
      hatEkle({ bilesen: ad, bilesenPini: 'VCC', kartPini: '5V', renk: 'kirmizi' })
      hatEkle({ bilesen: ad, bilesenPini: 'GND', kartPini: 'GND', renk: 'siyah' })
    } else if (/POT|LDR|NTC|MQ|SOIL|NEM|TEMP|SENSOR/.test(sabitAdi) || k.roller.includes('analog okuma')) {
      const ad = sabitAdi ? `Analog Sensör (${sabitAdi})` : `Analog Sensör (${etiket})`
      bilesenler.push({ ad, tur: 'Analog Sensör', voltaj: mantikVoltaj })
      hatEkle({ bilesen: ad, bilesenPini: 'Sinyal', kartPini: etiket, kartPinNo: k.pin, renk: 'sari' })
      hatEkle({ bilesen: ad, bilesenPini: 'VCC', kartPini: mantikVoltaj, renk: 'kirmizi' })
      hatEkle({ bilesen: ad, bilesenPini: 'GND', kartPini: 'GND', renk: 'siyah' })
    } else {
      const ad = sabitAdi ? `${sabitAdi} (${etiket})` : `Pin ${etiket} (${k.roller.join(', ')})`
      bilesenler.push({ ad, tur: k.roller.join(', ') })
      hatEkle({ bilesen: ad, bilesenPini: 'Sinyal', kartPini: etiket, kartPinNo: k.pin, renk: 'mavi' })
    }
  }

  // LED_BUILTIN özel durumu (pinCheck sayıya çeviremediyse)
  if (baglantilar.length === 0 && /\bLED_BUILTIN\b/.test(tumKod)) {
    const pin = tokenPinCoz('LED_BUILTIN', sabitler, fqbn) ?? 13
    const etiket = kartPinEtiketi(pin)
    bilesenler.push({ ad: 'Dahili LED', tur: 'Gösterge' })
    hatEkle({
      bilesen: 'Dahili LED',
      bilesenPini: 'LED_BUILTIN',
      kartPini: etiket,
      kartPinNo: pin,
      renk: 'yesil',
      not: 'Kart üzerindeki dahili LED kullanılır; harici LED için seri 220Ω direnç ekleyin.'
    })
  }

  // Pin denetimi hata/uyarılarını aktar
  for (const s of pinSorunlari) {
    if (s.tur === 'error' || s.tur === 'warning') {
      if (!uyarilar.some((u) => u.mesaj === s.mesaj)) {
        uyarilar.push({ seviye: 'dikkat', mesaj: s.mesaj })
      }
    }
  }

  const ozet =
    baglantilar.length > 0
      ? `${bilesenler.length} bileşen ve ${baglantilar.length} bağlantı hattı koddan otomatik çıkarıldı.`
      : 'Kodda henüz tanınabilir bir pin veya sensör bağlantısı bulunamadı.'

  return {
    kaynak: 'statik',
    kartAdi,
    fqbn: fqbn || undefined,
    ozet,
    mantikVoltaj,
    bilesenler,
    baglantilar,
    uyarilar,
    guncellemeZamani: Date.now()
  }
}

function metinMi(v: unknown, max = 300): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t ? t.slice(0, max) : undefined
}

function varsayilanRenk(bilesenPini: string, kartPini: string): KabloRengi {
  const b = `${bilesenPini} ${kartPini}`.toLowerCase()
  if (/\b(vcc|5v|3\.3v|3v3|vin)\b/.test(b)) return 'kirmizi'
  if (/\b(gnd|toprak)\b/.test(b)) return 'siyah'
  if (/\b(sda|miso)\b/.test(b)) return 'mavi'
  if (/\b(scl|sck|echo)\b/.test(b)) return 'sari'
  if (/\b(mosi|trig|din|data)\b/.test(b)) return 'yesil'
  return 'turuncu'
}

/** Diskten okunan BAGLANTI.json veya AI aracından gelen veriyi doğrular ve normalize eder. */
export function baglantiKilavuzuDogrula(
  ham: unknown,
  varsayilanKart = 'Seçili kart',
  fqbn?: string
): BaglantiKilavuzu | null {
  if (!ham || typeof ham !== 'object') return null
  const o = ham as Record<string, unknown>

  const hamBaglantilar = Array.isArray(o.baglantilar) ? o.baglantilar : []
  const kullanilanIdler = new Set<string>()
  const baglantilar: BaglantiHatti[] = []

  for (const item of hamBaglantilar) {
    if (!item || typeof item !== 'object') continue
    const h = item as Record<string, unknown>
    const bilesen = metinMi(h.bilesen, 80)
    const bilesenPini = metinMi(h.bilesenPini ?? h.bilesen_pini, 40)
    const kartPini = metinMi(h.kartPini ?? h.kart_pini, 40)
    if (!bilesen || !bilesenPini || !kartPini) continue

    const hamId = metinMi(h.id, 64)
    let id: string
    if (hamId && !kullanilanIdler.has(hamId)) {
      kullanilanIdler.add(hamId)
      id = hamId
    } else {
      id = benzersizHatId(bilesen, bilesenPini, kartPini, kullanilanIdler)
    }

    const hamRenk = typeof h.renk === 'string' ? h.renk.trim().toLowerCase() : ''
    const renk: KabloRengi = GECERLI_RENKLER.has(hamRenk)
      ? (hamRenk as KabloRengi)
      : varsayilanRenk(bilesenPini, kartPini)

    const hamPinNo = h.kartPinNo ?? h.kart_pin_no
    const kartPinNo = typeof hamPinNo === 'number' && Number.isInteger(hamPinNo) && hamPinNo >= 0 ? hamPinNo : undefined

    baglantilar.push({
      id,
      bilesen,
      bilesenPini,
      kartPini,
      ...(kartPinNo !== undefined ? { kartPinNo } : {}),
      renk,
      ...(metinMi(h.not, 240) ? { not: metinMi(h.not, 240) } : {})
    })
  }

  const hamBilesenler = Array.isArray(o.bilesenler) ? o.bilesenler : []
  const bilesenler: BaglantiBileseni[] = []
  for (const item of hamBilesenler) {
    if (!item || typeof item !== 'object') continue
    const b = item as Record<string, unknown>
    const ad = metinMi(b.ad, 80)
    if (!ad) continue
    const tur = metinMi(b.tur, 60) ?? 'Bileşen'
    const voltaj = metinMi(b.voltaj, 40)
    const ekParcalarRaw = b.ekParcalar ?? b.ek_parcalar
    const ekParcalar = Array.isArray(ekParcalarRaw)
      ? ekParcalarRaw.map((x) => metinMi(x, 80)).filter((x): x is string => Boolean(x))
      : undefined
    const aciklama = metinMi(b.aciklama, 240)
    bilesenler.push({
      ad,
      tur,
      ...(voltaj ? { voltaj } : {}),
      ...(ekParcalar && ekParcalar.length ? { ekParcalar } : {}),
      ...(aciklama ? { aciklama } : {})
    })
  }

  const hamUyarilar = Array.isArray(o.uyarilar) ? o.uyarilar : []
  const uyarilar: BaglantiUyarisi[] = []
  for (const item of hamUyarilar) {
    if (!item || typeof item !== 'object') continue
    const u = item as Record<string, unknown>
    const mesaj = metinMi(u.mesaj, 320)
    if (!mesaj) continue
    const seviye = u.seviye === 'dikkat' ? 'dikkat' : 'bilgi'
    uyarilar.push({ seviye, mesaj })
  }

  const ozet = metinMi(o.ozet, 320) ?? ''
  if (baglantilar.length === 0 && bilesenler.length === 0 && !ozet) return null

  const kartAdi = metinMi(o.kartAdi ?? o.kart_adi, 80) ?? varsayilanKart
  const hamVoltaj = o.mantikVoltaj ?? o.mantik_voltaj
  const mantikVoltaj: '5V' | '3.3V' =
    hamVoltaj === '3.3V' || hamVoltaj === '5V' ? hamVoltaj : mantikVoltajBelirle(fqbn, kartAdi)
  const kaynak: 'statik' | 'ai' = o.kaynak === 'statik' ? 'statik' : 'ai'
  const tamamlananlar = Array.isArray(o.tamamlananlar)
    ? o.tamamlananlar.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 64)
    : undefined

  return {
    kaynak,
    kartAdi,
    fqbn: metinMi(o.fqbn, 120) ?? fqbn,
    ozet: ozet || `${bilesenler.length} bileşen ve ${baglantilar.length} bağlantı hattı.`,
    mantikVoltaj,
    bilesenler,
    baglantilar,
    uyarilar,
    ...(tamamlananlar ? { tamamlananlar } : {}),
    guncellemeZamani: typeof o.guncellemeZamani === 'number' ? o.guncellemeZamani : Date.now()
  }
}
