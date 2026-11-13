/**
 * Pin denetimi: sketch kaynak kodunu kart bilgisiyle birlikte statik olarak inceler ve
 * pin kullanımındaki yaygın hataları bulur (çakışmalar, kartta olmayan veya uygun olmayan
 * pinler). Derlemeden bağımsızdır, saf fonksiyondur. En iyi çaba analizidir: yalnızca sayı
 * sabitine çözülebilen pinler değerlendirilir, çözülemeyenler sessizce atlanır.
 */

export interface PinKaynakDosya {
  /** Sorunun bağlanacağı dosya yolu */
  dosya: string
  icerik: string
}

export interface PinSorunu {
  dosya: string
  satir: number
  sutun: number
  tur: 'error' | 'warning' | 'note'
  mesaj: string
  pin: number
}

type Rol = 'cikis' | 'giris' | 'analog-okuma' | 'pwm' | 'servo' | 'kesme' | 'diger'

interface Kullanim {
  pin: number
  rol: Rol
  /** pinMode ile verilen mod ('OUTPUT', 'INPUT_PULLUP' vb.) */
  mod?: string
  fonksiyon: string
  dosya: string
  satir: number
  sutun: number
  /** Servo nesnesi adı (servo rolü için) */
  nesne?: string
}

interface KartProfili {
  ad: string
  gecerliPin: (pin: number) => boolean
  pwm?: (pin: number) => boolean
  kesme?: (pin: number) => boolean
  analogAlias: (n: number) => number | null
}

// ───────── metin hazırlığı ─────────

/** Yorumları ve metin sabitlerinin içini boşlukla değiştirir; satır/sütun konumları korunur. */
export function yorumlariTemizle(kod: string): string {
  let sonuc = ''
  let i = 0
  const bosalt = (metin: string): string => metin.replace(/[^\n]/g, ' ')
  while (i < kod.length) {
    const c = kod[i]
    const n = kod[i + 1]
    if (c === '/' && n === '/') {
      let j = i
      while (j < kod.length && kod[j] !== '\n') j++
      sonuc += bosalt(kod.slice(i, j))
      i = j
    } else if (c === '/' && n === '*') {
      const j = kod.indexOf('*/', i + 2)
      const son = j < 0 ? kod.length : j + 2
      sonuc += bosalt(kod.slice(i, son))
      i = son
    } else if (c === '"' || c === "'") {
      let j = i + 1
      while (j < kod.length && kod[j] !== c && kod[j] !== '\n') j += kod[j] === '\\' ? 2 : 1
      const son = Math.min(kod.length, j + 1)
      sonuc += c + bosalt(kod.slice(i + 1, son - 1)) + (kod[son - 1] === c ? c : '')
      i = son
    } else {
      sonuc += c
      i++
    }
  }
  return sonuc
}

function konumBul(kod: string, indeks: number): { satir: number; sutun: number } {
  let satir = 1
  let son = -1
  for (let i = 0; i < indeks; i++) {
    if (kod[i] === '\n') {
      satir++
      son = i
    }
  }
  return { satir, sutun: indeks - son }
}

// ───────── kart profilleri ─────────

export function kartProfili(fqbn: string | null | undefined): KartProfili | null {
  if (!fqbn) return null
  const [vendor, arch, varyant = ''] = fqbn.split(':')
  const v = varyant.toLowerCase()

  if (vendor === 'arduino' && arch === 'avr') {
    if (v.startsWith('mega')) {
      return {
        ad: 'Arduino Mega',
        gecerliPin: (p) => p >= 0 && p <= 69,
        pwm: (p) => (p >= 2 && p <= 13) || (p >= 44 && p <= 46),
        kesme: (p) => [2, 3, 18, 19, 20, 21].includes(p),
        analogAlias: (n) => (n >= 0 && n <= 15 ? 54 + n : null)
      }
    }
    if (['uno', 'nano', 'diecimila', 'duemilanove', 'mini', 'pro', 'fio', 'bt', 'lilypad', 'ethernet', 'atmegang'].some((x) => v.startsWith(x))) {
      const nano = v.startsWith('nano') || v.startsWith('mini')
      const enYuksek = nano ? 21 : 19
      return {
        ad: nano ? 'Arduino Nano' : 'Arduino Uno',
        gecerliPin: (p) => p >= 0 && p <= enYuksek,
        pwm: (p) => [3, 5, 6, 9, 10, 11].includes(p),
        kesme: (p) => p === 2 || p === 3,
        analogAlias: (n) => (n >= 0 && n <= (nano ? 7 : 5) ? 14 + n : null)
      }
    }
    return null
  }

  if (vendor === 'esp32' && arch === 'esp32' && !/(s2|s3|c2|c3|c5|c6|h2|p4)/.test(v)) {
    return {
      ad: 'ESP32',
      gecerliPin: (p) => p >= 0 && p <= 39 && ![20, 24, 28, 29, 30, 31].includes(p),
      analogAlias: () => null
    }
  }

  if (vendor === 'esp8266' && arch === 'esp8266') {
    return {
      ad: 'ESP8266',
      gecerliPin: (p) => p >= 0 && p <= 17,
      analogAlias: (n) => (n === 0 ? 17 : null)
    }
  }
  return null
}

const ESP32_FLASH = new Set([6, 7, 8, 9, 10, 11])
const ESP32_SADECE_GIRIS = new Set([34, 35, 36, 37, 38, 39])
const ESP32_ADC2 = new Set([0, 2, 4, 12, 13, 14, 15, 25, 26, 27])
const ESP32_STRAPPING = new Set([0, 2, 5, 12, 15])

// ───────── ayıklama ─────────

function sabitleriTopla(temiz: string, profil: KartProfili | null): Map<string, number> {
  const harita = new Map<string, number>()
  const cozum = (v: string): number | null => {
    if (/^\d+$/.test(v)) return Number(v)
    const a = /^A(\d+)$/.exec(v)
    return a && profil ? profil.analogAlias(Number(a[1])) : null
  }
  for (const m of temiz.matchAll(/#define\s+(\w+)\s+(A?\d+)\b/g)) {
    const d = cozum(m[2])
    if (d !== null) harita.set(m[1], d)
  }
  for (const m of temiz.matchAll(
    /\b(?:(?:constexpr|const|static|volatile)\s+)*(?:unsigned\s+)?(?:int|byte|uint8_t|uint16_t|short|long|gpio_num_t)\s+(\w+)\s*=\s*(A?\d+)\s*;/g
  )) {
    // const olmayan değişkenler yalnızca genel kapsamda sabit sayılır (döngü sayaçları pin değildir)
    if (!/\b(?:constexpr|const)\b/.test(m[0])) {
      const oncesi = temiz.slice(0, m.index ?? 0)
      if ((oncesi.match(/\{/g)?.length ?? 0) !== (oncesi.match(/\}/g)?.length ?? 0)) continue
    }
    const d = cozum(m[2])
    if (d !== null) harita.set(m[1], d)
  }
  return harita
}

function kullanimlariTopla(
  dosyalar: Array<{ dosya: string; temiz: string }>,
  sabitler: Map<string, number>,
  profil: KartProfili | null
): { kullanimlar: Kullanim[]; dinamikPinMode: boolean; seri: boolean; wifi: boolean } {
  const kullanimlar: Kullanim[] = []
  let dinamikPinMode = false
  let seri = false
  let wifi = false
  const coz = (token: string): number | null => {
    if (/^\d+$/.test(token)) return Number(token)
    if (sabitler.has(token)) return sabitler.get(token)!
    const a = /^A(\d+)$/.exec(token)
    return a && profil ? profil.analogAlias(Number(a[1])) : null
  }

  // Servo nesne adları (tüm dosyalarda)
  const servolar = new Set<string>()
  for (const { temiz } of dosyalar) for (const m of temiz.matchAll(/\bServo\s+(\w+(?:\s*,\s*\w+)*)\s*[;[]/g)) m[1].split(',').forEach((a) => servolar.add(a.trim()))

  for (const { dosya, temiz } of dosyalar) {
    if (/\bSerial\s*\.\s*begin\s*\(/.test(temiz)) seri = true
    if (/#include\s*<\s*(WiFi|ESP8266WiFi)\.h\s*>|\bWiFi\s*\.\s*begin\s*\(/.test(temiz)) wifi = true

    for (const m of temiz.matchAll(/\b(pinMode|digitalWrite|digitalRead|analogRead|analogWrite|ledcAttachPin|ledcAttach|dacWrite|tone|noTone|pulseIn|touchRead)\s*\(\s*([A-Za-z_]\w*|\d+)\s*(?:,\s*([A-Za-z_]\w*|\d+))?/g)) {
      const [, fonksiyon, arg, ikinci] = m
      const konum = konumBul(temiz, m.index ?? 0)
      const pin = coz(arg)
      if (pin === null) {
        if (fonksiyon === 'pinMode') dinamikPinMode = true
        continue
      }
      let rol: Rol = 'diger'
      let mod: string | undefined
      if (fonksiyon === 'pinMode') {
        mod = ikinci
        rol = ikinci === 'OUTPUT' || ikinci === 'OUTPUT_OPEN_DRAIN' ? 'cikis' : 'giris'
      } else if (fonksiyon === 'digitalWrite') rol = 'cikis'
      else if (fonksiyon === 'digitalRead') rol = 'giris'
      else if (fonksiyon === 'analogRead' || fonksiyon === 'touchRead') rol = 'analog-okuma'
      else if (fonksiyon === 'analogWrite' || fonksiyon === 'ledcAttachPin' || fonksiyon === 'ledcAttach' || fonksiyon === 'dacWrite') rol = 'pwm'
      kullanimlar.push({ pin, rol, mod, fonksiyon, dosya, ...konum })
    }

    for (const m of temiz.matchAll(/\b(\w+)\s*\.\s*attach\s*\(\s*([A-Za-z_]\w*|\d+)/g)) {
      if (!servolar.has(m[1])) continue
      const pin = coz(m[2])
      if (pin !== null) kullanimlar.push({ pin, rol: 'servo', fonksiyon: `${m[1]}.attach`, nesne: m[1], dosya, ...konumBul(temiz, m.index ?? 0) })
    }

    for (const m of temiz.matchAll(/\battachInterrupt\s*\(\s*digitalPinToInterrupt\s*\(\s*([A-Za-z_]\w*|\d+)\s*\)/g)) {
      const pin = coz(m[1])
      if (pin !== null) kullanimlar.push({ pin, rol: 'kesme', fonksiyon: 'attachInterrupt', dosya, ...konumBul(temiz, m.index ?? 0) })
    }
  }
  return { kullanimlar, dinamikPinMode, seri, wifi }
}

// ───────── denetim ─────────

export function pinleriDenetle(dosyalar: PinKaynakDosya[], fqbn: string | null | undefined): PinSorunu[] {
  const profil = kartProfili(fqbn)
  const hazir = dosyalar.map((d) => ({ dosya: d.dosya, temiz: yorumlariTemizle(d.icerik) }))
  const sabitler = sabitleriTopla(hazir.map((h) => h.temiz).join('\n'), profil)
  const { kullanimlar, dinamikPinMode, seri, wifi } = kullanimlariTopla(hazir, sabitler, profil)
  const sorunlar: PinSorunu[] = []
  const ekle = (k: Kullanim, tur: PinSorunu['tur'], mesaj: string): void => {
    if (!sorunlar.some((s) => s.dosya === k.dosya && s.satir === k.satir && s.sutun === k.sutun && s.mesaj === mesaj)) {
      sorunlar.push({ dosya: k.dosya, satir: k.satir, sutun: k.sutun, tur, mesaj, pin: k.pin })
    }
  }

  // Kart kuralları
  if (profil) {
    const esp32 = profil.ad === 'ESP32'
    const esp8266 = profil.ad === 'ESP8266'
    const avr = !esp32 && !esp8266
    for (const k of kullanimlar) {
      if (!profil.gecerliPin(k.pin)) {
        ekle(k, 'error', `Pin ${k.pin} ${profil.ad} kartında yok (${k.fonksiyon}).`)
        continue
      }
      if (esp32 || esp8266) {
        if (k.pin >= 6 && k.pin <= 11 && (esp8266 || ESP32_FLASH.has(k.pin))) {
          ekle(k, 'error', `GPIO${k.pin} kartın flash belleğine bağlı; kullanılırsa kart kilitlenir. Başka bir pin seçin.`)
        }
      }
      if (esp32) {
        if (ESP32_SADECE_GIRIS.has(k.pin) && (k.rol === 'cikis' || k.rol === 'pwm')) {
          ekle(k, 'error', `GPIO${k.pin} yalnızca giriş pinidir; ${k.fonksiyon} ile çıkış olarak kullanılamaz.`)
        }
        if (k.rol === 'analog-okuma' && ESP32_ADC2.has(k.pin) && wifi) {
          ekle(k, 'warning', `GPIO${k.pin} ADC2 üzerindedir; Wi-Fi açıkken analogRead çalışmaz. ADC1 pinlerinden birini (32–39) kullanın.`)
        }
        if (ESP32_STRAPPING.has(k.pin) && k.rol === 'cikis' && k.fonksiyon === 'pinMode') {
          ekle(k, 'note', `GPIO${k.pin} önyükleme (strapping) pinidir; açılışta yanlış seviyede kalırsa kart başlamayabilir.`)
        }
      }
      if (esp8266 && k.pin === 16) {
        if (k.rol === 'kesme') ekle(k, 'warning', 'GPIO16 kesmeyi desteklemez.')
        if (k.fonksiyon === 'analogWrite') ekle(k, 'warning', 'GPIO16 PWM (analogWrite) desteklemez.')
      }
      if (avr) {
        if (k.fonksiyon === 'analogWrite' && profil.pwm && !profil.pwm(k.pin)) {
          ekle(k, 'warning', `Pin ${k.pin} PWM desteklemiyor; analogWrite yalnızca 0 veya 255 gibi davranır. PWM pinleri: ${profil.ad === 'Arduino Mega' ? '2–13, 44–46' : '3, 5, 6, 9, 10, 11'}.`)
        }
        if (k.rol === 'kesme' && profil.kesme && !profil.kesme(k.pin)) {
          ekle(k, 'error', `Pin ${k.pin} dış kesme desteklemiyor. Kesme pinleri: ${profil.ad === 'Arduino Mega' ? '2, 3, 18, 19, 20, 21' : '2, 3'}.`)
        }
        if (seri && (k.pin === 0 || k.pin === 1) && k.fonksiyon !== 'attachInterrupt') {
          ekle(k, 'warning', `Pin ${k.pin} Serial (USB) ile paylaşılır; Serial.begin kullanılırken başka amaçla kullanmayın.`)
        }
      }
    }
  }

  // Genel çakışma kuralları (karttan bağımsız)
  const pinler = new Map<number, Kullanim[]>()
  for (const k of kullanimlar) pinler.set(k.pin, [...(pinler.get(k.pin) ?? []), k])
  for (const [pin, liste] of pinler) {
    const servolar = liste.filter((k) => k.rol === 'servo')
    const nesneler = new Set(servolar.map((k) => k.nesne))
    if (nesneler.size > 1) {
      for (const k of servolar.slice(1)) ekle(k, 'warning', `Pin ${pin} birden fazla Servo nesnesine bağlanmış (${[...nesneler].join(', ')}).`)
    }
    if (servolar.length > 0) {
      for (const k of liste) {
        if (k.rol === 'cikis' || k.rol === 'pwm' || k.rol === 'giris') {
          ekle(k, 'warning', `Pin ${pin} Servo.attach ile de kullanılıyor; ${k.fonksiyon} servoyu bozar.`)
        }
      }
    }
    const modlar = liste.filter((k) => k.fonksiyon === 'pinMode')
    const cikisVar = modlar.some((k) => k.rol === 'cikis')
    const girisVar = modlar.some((k) => k.rol === 'giris')
    if (cikisVar && girisVar) {
      const ikinci = modlar.find((k) => k.rol !== modlar[0].rol)!
      ekle(ikinci, 'note', `Pin ${pin} hem giriş hem çıkış olarak ayarlanmış; bilerek mod değiştirmiyorsanız çakışma olabilir.`)
    }
    // pinMode(…, OUTPUT) çağrısı olmadan digitalWrite
    if (!dinamikPinMode && modlar.length === 0 && servolar.length === 0 && !liste.some((k) => k.fonksiyon === 'tone' || k.fonksiyon.startsWith('ledc'))) {
      const yazma = liste.find((k) => k.fonksiyon === 'digitalWrite')
      if (yazma) ekle(yazma, 'warning', `Pin ${pin} için pinMode(${pin}, OUTPUT) çağrısı bulunamadı; çıkış beklenen gibi çalışmayabilir.`)
    }
  }

  return sorunlar.sort((a, b) => (a.dosya === b.dosya ? a.satir - b.satir : a.dosya.localeCompare(b.dosya)))
}

// ───────── özet ─────────

export interface PinOzetSatiri {
  pin: number
  /** Pinin kodda kullanıldığı roller (ör. "çıkış", "Servo") */
  roller: string[]
  /** İlk kullanım yeri */
  dosya: string
  satir: number
}

export interface PinOzeti {
  /** Tanınan kart adı; kart seçili değilse ya da tanınmıyorsa null */
  kartAdi: string | null
  kullanimlar: PinOzetSatiri[]
}

const ROL_ADI: Record<Rol, string> = {
  cikis: 'çıkış',
  giris: 'giriş',
  'analog-okuma': 'analog okuma',
  pwm: 'PWM',
  servo: 'Servo',
  kesme: 'kesme',
  diger: 'diğer'
}

/** Kodda hangi pinlerin hangi amaçla kullanıldığını listeler (denetimden bağımsız, bilgi amaçlı). */
export function pinOzetiCikar(dosyalar: PinKaynakDosya[], fqbn: string | null | undefined): PinOzeti {
  const profil = kartProfili(fqbn)
  const hazir = dosyalar.map((d) => ({ dosya: d.dosya, temiz: yorumlariTemizle(d.icerik) }))
  const sabitler = sabitleriTopla(hazir.map((h) => h.temiz).join('\n'), profil)
  const { kullanimlar } = kullanimlariTopla(hazir, sabitler, profil)
  const harita = new Map<number, PinOzetSatiri>()
  for (const k of kullanimlar) {
    const rol = ROL_ADI[k.rol]
    const mevcut = harita.get(k.pin)
    if (!mevcut) harita.set(k.pin, { pin: k.pin, roller: [rol], dosya: k.dosya, satir: k.satir })
    else if (!mevcut.roller.includes(rol)) mevcut.roller.push(rol)
  }
  return { kartAdi: profil?.ad ?? null, kullanimlar: [...harita.values()].sort((a, b) => a.pin - b.pin) }
}
