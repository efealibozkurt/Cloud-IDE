import { kartProfili } from './pinCheck'

/**
 * Seçili kartın pin haritası: hangi pinin hangi işleve (PWM, analog, kesme, I2C…) sahip olduğu.
 * Özellikler mümkün olduğunca pin denetimiyle aynı kart profilinden türetilir, böylece ikisi çelişmez.
 * Yalnızca Arduino Uno/Nano/Mega, klasik ESP32 ve ESP8266 için veri vardır.
 */

export type PinOzellik = 'pwm' | 'adc' | 'dac' | 'kesme' | 'i2c' | 'spi' | 'uart' | 'dokunmatik' | 'sadece-giris' | 'flash' | 'strapping'

export interface HaritaPini {
  numara: number
  /** Kartın üzerinde yazan ad (A0, GPIO4 (D2) …) */
  etiket: string
  ozellikler: PinOzellik[]
  /** Fare ile üzerine gelince gösterilen kısa açıklama */
  not?: string
}

export interface PinHaritasi {
  kartAdi: string
  gruplar: Array<{ ad: string; pinler: HaritaPini[] }>
}

export const OZELLIK_ADI: Record<PinOzellik, string> = {
  pwm: 'PWM (analogWrite)',
  adc: 'Analog giriş',
  dac: 'Analog çıkış (DAC)',
  kesme: 'Dış kesme',
  i2c: 'I2C',
  spi: 'SPI',
  uart: 'Seri (UART)',
  dokunmatik: 'Dokunmatik',
  'sadece-giris': 'Yalnızca giriş',
  flash: 'Flash belleğe bağlı, kullanmayın',
  strapping: 'Önyükleme pini'
}

function avrHaritasi(fqbn: string): PinHaritasi | null {
  const profil = kartProfili(fqbn)
  if (!profil || !profil.pwm || !profil.kesme) return null
  const mega = profil.ad === 'Arduino Mega'
  const nano = profil.ad === 'Arduino Nano'
  const dijitalSon = mega ? 53 : 13
  const analogIlk = mega ? 54 : 14
  const analogSayisi = mega ? 16 : nano ? 8 : 6

  const dijital: HaritaPini[] = []
  for (let p = 0; p <= dijitalSon; p++) {
    const oz: PinOzellik[] = []
    if (profil.pwm(p)) oz.push('pwm')
    if (profil.kesme(p)) oz.push('kesme')
    const seri = mega ? [0, 1, 14, 15, 16, 17, 18, 19] : [0, 1]
    if (seri.includes(p)) oz.push('uart')
    if (mega ? p >= 50 && p <= 53 : p >= 10 && p <= 13) oz.push('spi')
    if (mega && (p === 20 || p === 21)) oz.push('i2c')
    dijital.push({ numara: p, etiket: `D${p}`, ozellikler: oz, not: p === 13 ? 'Dahili LED (LED_BUILTIN)' : p <= 1 ? 'USB seri ile paylaşılır' : undefined })
  }
  const analog: HaritaPini[] = []
  for (let n = 0; n < analogSayisi; n++) {
    const oz: PinOzellik[] = ['adc']
    if (!mega && (n === 4 || n === 5)) oz.push('i2c')
    if (nano && n >= 6) oz.push('sadece-giris')
    analog.push({ numara: analogIlk + n, etiket: `A${n}`, ozellikler: oz, not: !mega && n === 4 ? 'I2C SDA' : !mega && n === 5 ? 'I2C SCL' : undefined })
  }
  return {
    kartAdi: profil.ad,
    gruplar: [
      { ad: 'Dijital pinler', pinler: dijital },
      { ad: 'Analog pinler', pinler: analog }
    ]
  }
}

const ESP32_ADC1 = [32, 33, 34, 35, 36, 37, 38, 39]
const ESP32_ADC2 = [0, 2, 4, 12, 13, 14, 15, 25, 26, 27]
const ESP32_DOKUNMATIK = [0, 2, 4, 12, 13, 14, 15, 27, 32, 33]

function esp32Haritasi(): PinHaritasi {
  const pinler: HaritaPini[] = []
  for (let p = 0; p <= 39; p++) {
    if ([20, 24, 28, 29, 30, 31].includes(p)) continue
    const flash = p >= 6 && p <= 11
    const sadeceGiris = p >= 34
    const oz: PinOzellik[] = []
    if (flash) {
      oz.push('flash')
    } else {
      if (!sadeceGiris) oz.push('pwm')
      oz.push('kesme')
      if (ESP32_ADC1.includes(p) || ESP32_ADC2.includes(p)) oz.push('adc')
      if (p === 25 || p === 26) oz.push('dac')
      if (ESP32_DOKUNMATIK.includes(p)) oz.push('dokunmatik')
      if (p === 21 || p === 22) oz.push('i2c')
      if ([5, 18, 19, 23].includes(p)) oz.push('spi')
      if (p === 1 || p === 3) oz.push('uart')
      if (sadeceGiris) oz.push('sadece-giris')
      if ([0, 2, 5, 12, 15].includes(p)) oz.push('strapping')
    }
    const adc2 = ESP32_ADC2.includes(p)
    pinler.push({
      numara: p,
      etiket: `GPIO${p}`,
      ozellikler: oz,
      not: adc2 && !flash ? 'ADC2: Wi-Fi açıkken analogRead çalışmaz' : p === 21 ? 'Varsayılan I2C SDA' : p === 22 ? 'Varsayılan I2C SCL' : p === 2 ? 'Çoğu kartta dahili LED' : undefined
    })
  }
  return { kartAdi: 'ESP32', gruplar: [{ ad: 'GPIO pinleri', pinler }] }
}

const NODEMCU_ETIKETLERI: Record<number, string> = { 16: 'D0', 5: 'D1', 4: 'D2', 0: 'D3', 2: 'D4', 14: 'D5', 12: 'D6', 13: 'D7', 15: 'D8', 3: 'RX', 1: 'TX' }

function esp8266Haritasi(fqbn: string): PinHaritasi {
  const nodemcuTipi = /nodemcu|d1_mini|wemos|d1\b/i.test(fqbn.split(':')[2] ?? '')
  const pinler: HaritaPini[] = []
  for (let p = 0; p <= 16; p++) {
    const flash = p >= 6 && p <= 11
    const oz: PinOzellik[] = []
    if (flash) {
      oz.push('flash')
    } else {
      if (p !== 16) oz.push('pwm', 'kesme')
      if (p === 4 || p === 5) oz.push('i2c')
      if (p >= 12 && p <= 15) oz.push('spi')
      if (p === 1 || p === 3) oz.push('uart')
      if ([0, 2, 15].includes(p)) oz.push('strapping')
    }
    const takma = nodemcuTipi ? NODEMCU_ETIKETLERI[p] : undefined
    pinler.push({
      numara: p,
      etiket: takma ? `GPIO${p} (${takma})` : `GPIO${p}`,
      ozellikler: oz,
      not: p === 16 ? 'Kesme ve PWM desteklemez' : p === 4 ? 'Varsayılan I2C SDA' : p === 5 ? 'Varsayılan I2C SCL' : undefined
    })
  }
  pinler.push({ numara: 17, etiket: 'A0', ozellikler: ['adc'], not: 'Tek analog giriş (0–1 V, kartta bölücü varsa 3,3 V)' })
  return { kartAdi: 'ESP8266', gruplar: [{ ad: 'GPIO pinleri', pinler }] }
}

export function pinHaritasi(fqbn: string | null | undefined): PinHaritasi | null {
  const profil = kartProfili(fqbn)
  if (!profil || !fqbn) return null
  if (profil.ad === 'ESP32') return esp32Haritasi()
  if (profil.ad === 'ESP8266') return esp8266Haritasi(fqbn)
  return avrHaritasi(fqbn)
}
