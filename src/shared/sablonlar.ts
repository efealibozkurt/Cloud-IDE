import { kartProfili } from './pinCheck'

/**
 * Hazır proje şablonları. Her şablon, kullanıcının doldurduğu alanlardan (pin, süre, Wi-Fi adı…)
 * çalışan bir .ino dosyası üretir. Kod seçili kart ailesine göre uyarlanır (AVR / ESP32 / ESP8266).
 * Şablon kodunda ters eğik çizgi kullanılmaz; çıktı ve metinler println ile yazılır.
 */

export type KartAilesi = 'avr' | 'esp32' | 'esp8266'
export type Degerler = Record<string, string>

export interface SablonAlani {
  id: string
  etiket: string
  tur: 'pin' | 'sayi' | 'metin' | 'secim'
  varsayilan: string | Record<KartAilesi, string>
  ipucu?: string
  secenekler?: string[]
  min?: number
  max?: number
}

export type SablonKategorisi = 'Temel' | 'Sensör' | 'Hareket' | 'Ekran' | 'Kablosuz'

export interface Sablon {
  id: string
  /** Proje klasörü adı için kullanılır (ASCII) */
  projeAdi: string
  ad: string
  ozet: string
  kategori: SablonKategorisi
  uyumlu: KartAilesi[]
  alanlar: SablonAlani[]
  /** Kütüphane yöneticisinden kurulması gereken paketler */
  kutuphaneler: (aile: KartAilesi) => string[]
  /** Kablolama adımları */
  baglanti: (v: Degerler, aile: KartAilesi) => string[]
  notlar?: (aile: KartAilesi) => string[]
  kod: (v: Degerler, aile: KartAilesi) => string
}

export const AILE_ADI: Record<KartAilesi, string> = { avr: 'Arduino (AVR)', esp32: 'ESP32', esp8266: 'ESP8266' }

/** Seçili karttan şablon ailesini bulur; tanınmayan karta Arduino (AVR) varsayılır. */
export function kartAilesiBul(fqbn: string | null | undefined): { aile: KartAilesi; taninan: boolean } {
  const ad = kartProfili(fqbn)?.ad
  if (ad === 'ESP32') return { aile: 'esp32', taninan: true }
  if (ad === 'ESP8266') return { aile: 'esp8266', taninan: true }
  if (ad) return { aile: 'avr', taninan: true }
  return { aile: 'avr', taninan: false }
}

export function varsayilanDegerler(sablon: Sablon, aile: KartAilesi): Degerler {
  const v: Degerler = {}
  for (const a of sablon.alanlar) v[a.id] = typeof a.varsayilan === 'string' ? a.varsayilan : a.varsayilan[aile]
  return v
}

/** Alan değerini doğrular; geçerliyse null, değilse kullanıcıya gösterilecek hata metni. */
export function alanHatasi(alan: SablonAlani, deger: string): string | null {
  const d = deger.trim()
  if (alan.tur === 'pin') return /^(A\d{1,2}|\d{1,2})$/.test(d) ? null : 'Pin numarası girin (ör. 13 ya da A0)'
  if (alan.tur === 'sayi') {
    const n = Number(d)
    if (d === '' || !Number.isInteger(n)) return 'Tam sayı girin'
    if (alan.min !== undefined && n < alan.min) return `En az ${alan.min} olmalı`
    if (alan.max !== undefined && n > alan.max) return `En çok ${alan.max} olabilir`
    return null
  }
  if (alan.tur === 'secim') return alan.secenekler?.includes(d) ? null : 'Listeden seçin'
  if (d.length > 64) return 'En çok 64 karakter'
  if (/["'\\\r\n]/.test(d)) return 'Tırnak ve ters eğik çizgi kullanılamaz'
  if (alan.id === 'METIN' && /[^\x20-\x7e]/.test(d)) return 'Yalnızca İngilizce harf/rakam (OLED yazı tipi Türkçe karakter göstermez)'
  return null
}

export function tumAlanlarGecerliMi(sablon: Sablon, v: Degerler): boolean {
  return sablon.alanlar.every((a) => alanHatasi(a, v[a.id] ?? '') === null)
}

const p = (avr: string, esp32: string, esp8266: string): Record<KartAilesi, string> => ({ avr, esp32, esp8266 })
const ADC_ESP32 = 4095
const adcMax = (aile: KartAilesi): number => (aile === 'esp32' ? ADC_ESP32 : 1023)

/** ESP32 çekirdeği 2.x ve 3.x arasında farklı PWM arayüzü kullanır; ikisini de derleyen blok. */
const ESP32_PWM_BLOGU = (pin: string): string => `#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(${pin}, 5000, 8);
#else
  ledcSetup(0, 5000, 8);
  ledcAttachPin(${pin}, 0);
#endif`

const ESP32_PWM_YAZ = (pin: string, deger: string): string => `#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(${pin}, ${deger});
#else
  ledcWrite(0, ${deger});
#endif`

export const SABLONLAR: Sablon[] = [
  {
    id: 'led-yanip-sonme',
    projeAdi: 'LED_Yanip_Sonme',
    ad: 'LED yanıp sönme',
    ozet: 'Arduino dünyasının "Merhaba Dünya"sı: bir LED saniyede bir yanıp söner.',
    kategori: 'Temel',
    uyumlu: ['avr', 'esp32', 'esp8266'],
    alanlar: [
      { id: 'LED', etiket: 'LED pini', tur: 'pin', varsayilan: p('13', '2', '2'), ipucu: 'Çoğu kartta 13 (Uno) ya da 2 (ESP) dahili LED’e bağlıdır' },
      { id: 'BEKLEME', etiket: 'Bekleme süresi (ms)', tur: 'sayi', varsayilan: '500', min: 10, max: 60000 }
    ],
    kutuphaneler: () => [],
    baglanti: (v) => [`Dahili LED’i kullanıyorsanız kablo gerekmez.`, `Harici LED: uzun bacak (+) → direnç (220 Ω) → pin ${v.LED}; kısa bacak (−) → GND.`],
    notlar: (aile) => (aile === 'esp8266' ? ['ESP8266’nin dahili LED’i ters çalışır: HIGH söndürür, LOW yakar.'] : []),
    kod: (v) => `// LED yanıp sönme
const int LED_PIN = ${v.LED};
const unsigned long BEKLEME_MS = ${v.BEKLEME};

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(BEKLEME_MS);
  digitalWrite(LED_PIN, LOW);
  delay(BEKLEME_MS);
}
`
  },
  {
    id: 'buton-led',
    projeAdi: 'Buton_ile_LED',
    ad: 'Butonla LED yak',
    ozet: 'Butona basılı tutunca LED yanar, bırakınca söner.',
    kategori: 'Temel',
    uyumlu: ['avr', 'esp32', 'esp8266'],
    alanlar: [
      { id: 'BUTON', etiket: 'Buton pini', tur: 'pin', varsayilan: p('2', '4', '5') },
      { id: 'LED', etiket: 'LED pini', tur: 'pin', varsayilan: p('13', '2', '4') }
    ],
    kutuphaneler: () => [],
    baglanti: (v) => [`Buton: bir ucu pin ${v.BUTON}, diğer ucu GND (dahili pull-up kullanılır, direnç gerekmez).`, `LED: uzun bacak (+) → direnç (220 Ω) → pin ${v.LED}; kısa bacak (−) → GND.`],
    kod: (v) => `// Butonla LED yak
const int BUTON_PIN = ${v.BUTON};
const int LED_PIN = ${v.LED};

void setup() {
  pinMode(BUTON_PIN, INPUT_PULLUP);  // basılmadığında HIGH, basılınca LOW okunur
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  bool basili = (digitalRead(BUTON_PIN) == LOW);
  digitalWrite(LED_PIN, basili ? HIGH : LOW);
}
`
  },
  {
    id: 'pot-parlaklik',
    projeAdi: 'Potansiyometre_Parlaklik',
    ad: 'Potansiyometreyle parlaklık',
    ozet: 'Potansiyometreyi çevirdikçe LED’in parlaklığı değişir (PWM).',
    kategori: 'Temel',
    uyumlu: ['avr', 'esp32', 'esp8266'],
    alanlar: [
      { id: 'POT', etiket: 'Potansiyometre pini (analog)', tur: 'pin', varsayilan: p('A0', '34', 'A0') },
      { id: 'LED', etiket: 'LED pini (PWM)', tur: 'pin', varsayilan: p('9', '5', '4'), ipucu: 'Uno’da PWM: 3, 5, 6, 9, 10, 11' }
    ],
    kutuphaneler: () => [],
    baglanti: (v) => [`Potansiyometre: sol uç → 3.3 V (ESP) / 5 V (Arduino), sağ uç → GND, orta uç → ${v.POT}.`, `LED: uzun bacak (+) → direnç (220 Ω) → pin ${v.LED}; kısa bacak (−) → GND.`],
    notlar: () => ['Değerler Seri Monitör › Grafik görünümünde canlı çizilir.'],
    kod: (v, aile) => {
      const max = adcMax(aile)
      if (aile === 'esp32') {
        return `// Potansiyometreyle LED parlaklığı (ESP32, 12 bit ADC)
const int POT_PIN = ${v.POT};
const int LED_PIN = ${v.LED};

void setup() {
  Serial.begin(115200);
${ESP32_PWM_BLOGU('LED_PIN')}
}

void loop() {
  int deger = analogRead(POT_PIN);                 // 0 - ${max}
  int parlaklik = map(deger, 0, ${max}, 0, 255);
${ESP32_PWM_YAZ('LED_PIN', 'parlaklik')}
  Serial.print("pot:");
  Serial.print(deger);
  Serial.print(" parlaklik:");
  Serial.println(parlaklik);
  delay(30);
}
`
      }
      return `// Potansiyometreyle LED parlaklığı
const int POT_PIN = ${v.POT};
const int LED_PIN = ${v.LED};

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int deger = analogRead(POT_PIN);                 // 0 - ${max}
  int parlaklik = map(deger, 0, ${max}, 0, ${aile === 'esp8266' ? 1023 : 255});
  analogWrite(LED_PIN, parlaklik);
  Serial.print("pot:");
  Serial.print(deger);
  Serial.print(" parlaklik:");
  Serial.println(parlaklik);
  delay(30);
}
`
    }
  },
  {
    id: 'analog-grafik',
    projeAdi: 'Analog_Sensor_Grafik',
    ad: 'Analog sensör grafiği',
    ozet: 'LDR, potansiyometre gibi analog bir sensörü okuyup Seri Monitör’de canlı grafik çizer.',
    kategori: 'Sensör',
    uyumlu: ['avr', 'esp32', 'esp8266'],
    alanlar: [
      { id: 'SENSOR', etiket: 'Sensör pini (analog)', tur: 'pin', varsayilan: p('A0', '34', 'A0') },
      { id: 'ARALIK', etiket: 'Okuma aralığı (ms)', tur: 'sayi', varsayilan: '50', min: 5, max: 5000 }
    ],
    kutuphaneler: () => [],
    baglanti: (v, aile) => [
      `LDR için: 3.3 V (veya 5 V) → LDR → pin ${v.SENSOR}; aynı noktadan 10 kΩ direnç → GND.`,
      aile === 'esp8266' ? 'ESP8266’nin A0 girişi en çok 1 V okur; kartta gerilim bölücü yoksa dışarıdan ekleyin.' : 'Potansiyometre için orta ucu pine bağlayın.'
    ],
    notlar: () => ['Seri Monitör’ü açıp sağ üstten "Grafik" görünümüne geçin.'],
    kod: (v) => `// Analog sensör grafiği
const int SENSOR_PIN = ${v.SENSOR};
const int ARALIK_MS = ${v.ARALIK};

void setup() {
  Serial.begin(115200);
}

void loop() {
  int deger = analogRead(SENSOR_PIN);
  Serial.print("deger:");
  Serial.println(deger);   // "etiket:sayı" biçimi grafikte ayrı çizgi olur
  delay(ARALIK_MS);
}
`
  },
  {
    id: 'dht-seri',
    projeAdi: 'DHT_Sicaklik_Nem',
    ad: 'DHT sıcaklık ve nem',
    ozet: 'DHT22 (veya DHT11) sensöründen sıcaklık ve nem okuyup seriye yazar.',
    kategori: 'Sensör',
    uyumlu: ['avr', 'esp32', 'esp8266'],
    alanlar: [
      { id: 'DHT_PIN', etiket: 'Veri pini', tur: 'pin', varsayilan: p('2', '4', '4') },
      { id: 'TIP', etiket: 'Sensör tipi', tur: 'secim', varsayilan: 'DHT22', secenekler: ['DHT22', 'DHT11'] }
    ],
    kutuphaneler: () => ['DHT sensor library', 'Adafruit Unified Sensor'],
    baglanti: (v, aile) => [`Sensör VCC → ${aile === 'avr' ? '5 V' : '3.3 V'}, GND → GND, DATA → pin ${v.DHT_PIN}.`, 'Çıplak (4 bacaklı) sensörde DATA ile VCC arasına 10 kΩ direnç ekleyin; modüllü kartlarda gerekmez.'],
    kod: (v) => `// DHT sıcaklık ve nem
#include <DHT.h>

const int DHT_PIN = ${v.DHT_PIN};
#define DHT_TIPI ${v.TIP}

DHT dht(DHT_PIN, DHT_TIPI);

void setup() {
  Serial.begin(115200);
  dht.begin();
}

void loop() {
  delay(2000);  // DHT sensörleri en az 2 saniyede bir okunabilir
  float nem = dht.readHumidity();
  float sicaklik = dht.readTemperature();

  if (isnan(nem) || isnan(sicaklik)) {
    Serial.println("Sensor okunamadi, baglantiyi kontrol edin");
    return;
  }

  Serial.print("sicaklik:");
  Serial.print(sicaklik);
  Serial.print(" nem:");
  Serial.println(nem);
}
`
  },
  {
    id: 'hcsr04',
    projeAdi: 'HC_SR04_Mesafe',
    ad: 'Ultrasonik mesafe (HC-SR04)',
    ozet: 'Önündeki nesnenin uzaklığını santimetre olarak ölçer.',
    kategori: 'Sensör',
    uyumlu: ['avr', 'esp32', 'esp8266'],
    alanlar: [
      { id: 'TRIG', etiket: 'TRIG pini', tur: 'pin', varsayilan: p('9', '5', '12') },
      { id: 'ECHO', etiket: 'ECHO pini', tur: 'pin', varsayilan: p('10', '18', '14') }
    ],
    kutuphaneler: () => [],
    baglanti: (v) => [`Sensör VCC → 5 V, GND → GND, TRIG → pin ${v.TRIG}, ECHO → pin ${v.ECHO}.`],
    notlar: (aile) => (aile === 'avr' ? [] : ['ECHO çıkışı 5 V verir, ESP pinleri 3.3 V’tur: ECHO ile pin arasına iki dirençli (1 kΩ + 2 kΩ) gerilim bölücü koyun.']),
    kod: (v) => `// HC-SR04 mesafe ölçümü
const int TRIG_PIN = ${v.TRIG};
const int ECHO_PIN = ${v.ECHO};

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
}

void loop() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long sure = pulseIn(ECHO_PIN, HIGH, 30000);  // en çok 30 ms bekle (~5 m)
  if (sure == 0) {
    Serial.println("Nesne bulunamadi");
  } else {
    float cm = sure * 0.0343 / 2;
    Serial.print("mesafe:");
    Serial.println(cm);
  }
  delay(100);
}
`
  },
  {
    id: 'servo-tarama',
    projeAdi: 'Servo_Tarama',
    ad: 'Servo motor tarama',
    ozet: 'Servo motor 0°’den 180°’ye gidip geri gelir.',
    kategori: 'Hareket',
    uyumlu: ['avr', 'esp32', 'esp8266'],
    alanlar: [{ id: 'SERVO', etiket: 'Servo sinyal pini', tur: 'pin', varsayilan: p('9', '18', '14') }],
    kutuphaneler: (aile) => (aile === 'avr' ? ['Servo'] : aile === 'esp32' ? ['ESP32Servo'] : []),
    baglanti: (v) => [`Servo: kahverengi/siyah → GND, kırmızı → 5 V, turuncu/sarı → pin ${v.SERVO}.`],
    notlar: () => ['Servo motorları USB’den fazla akım çeker; titreme olursa harici 5 V besleme kullanın (GND’leri birleştirin).'],
    kod: (v, aile) => `// Servo motor tarama
${aile === 'esp32' ? '#include <ESP32Servo.h>' : '#include <Servo.h>'}

const int SERVO_PIN = ${v.SERVO};
Servo servo;

void setup() {
  servo.attach(SERVO_PIN);
}

void loop() {
  for (int aci = 0; aci <= 180; aci += 2) {
    servo.write(aci);
    delay(15);
  }
  for (int aci = 180; aci >= 0; aci -= 2) {
    servo.write(aci);
    delay(15);
  }
}
`
  },
  {
    id: 'role',
    projeAdi: 'Role_Kontrol',
    ad: 'Röle kontrolü',
    ozet: 'Röle modülünü iki saniye açıp iki saniye kapatır.',
    kategori: 'Hareket',
    uyumlu: ['avr', 'esp32', 'esp8266'],
    alanlar: [
      { id: 'ROLE', etiket: 'Röle IN pini', tur: 'pin', varsayilan: p('7', '26', '5') },
      { id: 'SEVIYE', etiket: 'Röle hangi seviyede çeker?', tur: 'secim', varsayilan: 'LOW', secenekler: ['LOW', 'HIGH'], ipucu: 'Çoğu hazır modül LOW seviyede çeker' }
    ],
    kutuphaneler: () => [],
    baglanti: (v, aile) => [`Modül VCC → ${aile === 'avr' ? '5 V' : '5 V (VIN)'}, GND → GND, IN → pin ${v.ROLE}.`],
    notlar: () => ['DİKKAT: Şebeke gerilimiyle (220 V) çalışırken devreyi mutlaka enerjisiz kurun ve yalıtım kurallarına uyun. Emin değilseniz önce düşük gerilimli bir yükle deneyin.'],
    kod: (v) => `// Röle kontrolü
const int ROLE_PIN = ${v.ROLE};
const int ACIK = ${v.SEVIYE};
const int KAPALI = ${v.SEVIYE === 'LOW' ? 'HIGH' : 'LOW'};

void setup() {
  Serial.begin(115200);
  digitalWrite(ROLE_PIN, KAPALI);  // açılışta röle istemeden çekmesin
  pinMode(ROLE_PIN, OUTPUT);
}

void loop() {
  digitalWrite(ROLE_PIN, ACIK);
  Serial.println("Role ACIK");
  delay(2000);
  digitalWrite(ROLE_PIN, KAPALI);
  Serial.println("Role KAPALI");
  delay(2000);
}
`
  },
  {
    id: 'neopixel',
    projeAdi: 'NeoPixel_Gokkusagi',
    ad: 'NeoPixel gökkuşağı',
    ozet: 'Adreslenebilir RGB LED şeridinde akan gökkuşağı efekti.',
    kategori: 'Hareket',
    uyumlu: ['avr', 'esp32', 'esp8266'],
    alanlar: [
      { id: 'PIN', etiket: 'Veri pini', tur: 'pin', varsayilan: p('6', '5', '4') },
      { id: 'SAYI', etiket: 'LED sayısı', tur: 'sayi', varsayilan: '8', min: 1, max: 300 }
    ],
    kutuphaneler: () => ['Adafruit NeoPixel'],
    baglanti: (v) => [`Şerit 5V → 5 V, GND → GND, DIN → direnç (330 Ω) → pin ${v.PIN}.`, 'Besleme girişine 470–1000 µF kondansatör koymanız önerilir.'],
    notlar: (aile) => [
      'Çok sayıda LED yüksek akım çeker; parlaklık kodda 60/255 ile sınırlıdır.',
      ...(aile === 'avr' ? [] : ['3.3 V’luk ESP pini bazı şeritleri güvenilir sürmeyebilir; gerekirse seviye dönüştürücü kullanın.'])
    ],
    kod: (v) => `// NeoPixel gökkuşağı
#include <Adafruit_NeoPixel.h>

const int SERIT_PIN = ${v.PIN};
const int LED_SAYISI = ${v.SAYI};

Adafruit_NeoPixel serit(LED_SAYISI, SERIT_PIN, NEO_GRB + NEO_KHZ800);
uint16_t baslangicTonu = 0;

void setup() {
  serit.begin();
  serit.setBrightness(60);  // 0-255
  serit.show();
}

void loop() {
  for (int i = 0; i < LED_SAYISI; i++) {
    uint16_t ton = baslangicTonu + (uint32_t)i * 65536UL / LED_SAYISI;
    serit.setPixelColor(i, serit.gamma32(serit.ColorHSV(ton)));
  }
  serit.show();
  baslangicTonu += 256;
  delay(20);
}
`
  },
  {
    id: 'buzzer',
    projeAdi: 'Buzzer_Melodi',
    ad: 'Buzzer ile melodi',
    ozet: 'Pasif buzzer do-re-mi gamını çalar.',
    kategori: 'Hareket',
    uyumlu: ['avr', 'esp8266'],
    alanlar: [{ id: 'BUZZER', etiket: 'Buzzer pini', tur: 'pin', varsayilan: p('8', '14', '14') }],
    kutuphaneler: () => [],
    baglanti: (v) => [`Buzzer (+) → pin ${v.BUZZER}, (−) → GND.`, 'Pasif buzzer kullanın; aktif buzzer tek ton çıkarır.'],
    kod: (v) => `// Buzzer ile melodi
const int BUZZER_PIN = ${v.BUZZER};

// Do Re Mi Fa Sol La Si Do (Hz)
const int NOTALAR[] = {262, 294, 330, 349, 392, 440, 494, 523};
const int NOTA_SAYISI = 8;

void setup() {
}

void loop() {
  for (int i = 0; i < NOTA_SAYISI; i++) {
    tone(BUZZER_PIN, NOTALAR[i], 300);
    delay(400);
  }
  noTone(BUZZER_PIN);
  delay(1500);
}
`
  },
  {
    id: 'oled',
    projeAdi: 'OLED_Merhaba',
    ad: 'OLED ekrana yazı',
    ozet: '128×64 I2C OLED (SSD1306) ekranda bir yazı gösterir.',
    kategori: 'Ekran',
    uyumlu: ['avr', 'esp32', 'esp8266'],
    alanlar: [
      { id: 'METIN', etiket: 'Gösterilecek yazı', tur: 'metin', varsayilan: 'Merhaba!', ipucu: 'Yalnızca İngilizce karakterler' },
      { id: 'ADRES', etiket: 'I2C adresi', tur: 'secim', varsayilan: '0x3C', secenekler: ['0x3C', '0x3D'], ipucu: 'Emin değilseniz "I2C tarayıcı" şablonuyla bulun' }
    ],
    kutuphaneler: () => ['Adafruit SSD1306', 'Adafruit GFX Library'],
    baglanti: (_v, aile) => [
      aile === 'avr' ? 'OLED VCC → 5 V (veya 3.3 V), GND → GND, SDA → A4, SCL → A5.' : aile === 'esp32' ? 'OLED VCC → 3.3 V, GND → GND, SDA → GPIO21, SCL → GPIO22.' : 'OLED VCC → 3.3 V, GND → GND, SDA → GPIO4 (D2), SCL → GPIO5 (D1).'
    ],
    kod: (v) => `// OLED ekrana yazı (SSD1306, I2C)
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define EKRAN_GENISLIK 128
#define EKRAN_YUKSEKLIK 64
#define OLED_ADRES ${v.ADRES}

Adafruit_SSD1306 ekran(EKRAN_GENISLIK, EKRAN_YUKSEKLIK, &Wire, -1);

void setup() {
  Serial.begin(115200);
  if (!ekran.begin(SSD1306_SWITCHCAPVCC, OLED_ADRES)) {
    Serial.println("OLED bulunamadi, baglantiyi ve adresi kontrol edin");
    for (;;) {
      delay(1000);
    }
  }
  ekran.clearDisplay();
  ekran.setTextSize(2);
  ekran.setTextColor(SSD1306_WHITE);
  ekran.setCursor(0, 24);
  ekran.println("${v.METIN}");
  ekran.display();
}

void loop() {
}
`
  },
  {
    id: 'i2c-tarayici',
    projeAdi: 'I2C_Tarayici',
    ad: 'I2C tarayıcı',
    ozet: 'Bağlı I2C cihazlarının adreslerini bulup seriye yazar. Bağlantı sorunlarını ayıklamak için çok işe yarar.',
    kategori: 'Temel',
    uyumlu: ['avr', 'esp32', 'esp8266'],
    alanlar: [],
    kutuphaneler: () => [],
    baglanti: (_v, aile) => [
      aile === 'avr' ? 'SDA → A4, SCL → A5 (Uno/Nano).' : aile === 'esp32' ? 'SDA → GPIO21, SCL → GPIO22.' : 'SDA → GPIO4 (D2), SCL → GPIO5 (D1).',
      'Cihazın VCC ve GND bağlantılarını da unutmayın.'
    ],
    kod: () => `// I2C tarayıcı
#include <Wire.h>

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Serial.println("I2C cihazlari taraniyor...");
}

void loop() {
  int bulunan = 0;
  for (byte adres = 1; adres < 127; adres++) {
    Wire.beginTransmission(adres);
    if (Wire.endTransmission() == 0) {
      Serial.print("Cihaz bulundu: 0x");
      if (adres < 16) Serial.print("0");
      Serial.println(adres, HEX);
      bulunan++;
    }
  }
  if (bulunan == 0) {
    Serial.println("Hic cihaz bulunamadi, kablolari kontrol edin");
  }
  Serial.println("Tarama bitti, 5 saniye sonra tekrar...");
  delay(5000);
}
`
  },
  {
    id: 'wifi-led-web',
    projeAdi: 'WiFi_LED_Kontrol',
    ad: 'Web sayfasından LED kontrolü',
    ozet: 'Kart Wi-Fi’ye bağlanır ve telefondan açılan bir sayfayla LED’i açıp kapatırsınız.',
    kategori: 'Kablosuz',
    uyumlu: ['esp32', 'esp8266'],
    alanlar: [
      { id: 'SSID', etiket: 'Wi-Fi adı (SSID)', tur: 'metin', varsayilan: 'WIFI_ADI' },
      { id: 'SIFRE', etiket: 'Wi-Fi şifresi', tur: 'metin', varsayilan: 'WIFI_SIFRESI' },
      { id: 'LED', etiket: 'LED pini', tur: 'pin', varsayilan: p('2', '2', '4') }
    ],
    kutuphaneler: () => [],
    baglanti: (v) => [`LED: uzun bacak (+) → direnç (220 Ω) → pin ${v.LED}; kısa bacak (−) → GND.`, 'Yüklendikten sonra Seri Monitör’de (115200) yazan IP adresini telefonunuzun tarayıcısına yazın. Telefon ve kart aynı Wi-Fi ağında olmalı.'],
    notlar: () => ['Wi-Fi şifresi kodun içinde düz metin olarak durur; projeyi başkalarıyla paylaşırken silmeyi unutmayın.'],
    kod: (v, aile) => `// Web sayfasından LED kontrolü
${aile === 'esp32' ? '#include <WiFi.h>\n#include <WebServer.h>' : '#include <ESP8266WiFi.h>\n#include <ESP8266WebServer.h>'}

const char* WIFI_ADI = "${v.SSID}";
const char* WIFI_SIFRE = "${v.SIFRE}";
const int LED_PIN = ${v.LED};

${aile === 'esp32' ? 'WebServer' : 'ESP8266WebServer'} sunucu(80);
bool ledAcik = false;

String sayfaOlustur() {
  String html = "<!DOCTYPE html><html><head><meta charset='utf-8'>";
  html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>LED Kontrol</title></head>";
  html += "<body style='font-family:sans-serif;text-align:center;margin-top:40px'>";
  html += "<h1>LED Kontrol</h1><p>Durum: <b>";
  html += ledAcik ? "ACIK" : "KAPALI";
  html += "</b></p>";
  html += "<p><a href='/ac'><button style='font-size:24px;padding:12px 28px'>Ac</button></a> ";
  html += "<a href='/kapat'><button style='font-size:24px;padding:12px 28px'>Kapat</button></a></p>";
  html += "</body></html>";
  return html;
}

void anaSayfa() {
  sunucu.send(200, "text/html; charset=utf-8", sayfaOlustur());
}

void ledAc() {
  ledAcik = true;
  digitalWrite(LED_PIN, HIGH);
  sunucu.sendHeader("Location", "/");
  sunucu.send(303);
}

void ledKapat() {
  ledAcik = false;
  digitalWrite(LED_PIN, LOW);
  sunucu.sendHeader("Location", "/");
  sunucu.send(303);
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_ADI, WIFI_SIFRE);
  Serial.print("Wi-Fi baglaniyor");
  int deneme = 0;
  while (WiFi.status() != WL_CONNECTED && deneme < 40) {
    delay(500);
    Serial.print(".");
    deneme++;
  }
  Serial.println();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Baglanilamadi: Wi-Fi adini ve sifresini kontrol edin");
    return;
  }
  Serial.print("Baglandi. Tarayicida su adresi acin: http://");
  Serial.println(WiFi.localIP());

  sunucu.on("/", anaSayfa);
  sunucu.on("/ac", ledAc);
  sunucu.on("/kapat", ledKapat);
  sunucu.begin();
}

void loop() {
  sunucu.handleClient();
}
`
  },
  {
    id: 'wifi-dht-web',
    projeAdi: 'WiFi_Sicaklik_Sayfasi',
    ad: 'Sıcaklık ve nemi web sayfasında göster',
    ozet: 'DHT sensörünün değerleri, Wi-Fi’ye bağlı herhangi bir cihazın tarayıcısında kendini yenileyen bir sayfada görünür.',
    kategori: 'Kablosuz',
    uyumlu: ['esp32', 'esp8266'],
    alanlar: [
      { id: 'SSID', etiket: 'Wi-Fi adı (SSID)', tur: 'metin', varsayilan: 'WIFI_ADI' },
      { id: 'SIFRE', etiket: 'Wi-Fi şifresi', tur: 'metin', varsayilan: 'WIFI_SIFRESI' },
      { id: 'DHT_PIN', etiket: 'DHT veri pini', tur: 'pin', varsayilan: p('4', '4', '4') },
      { id: 'TIP', etiket: 'Sensör tipi', tur: 'secim', varsayilan: 'DHT22', secenekler: ['DHT22', 'DHT11'] }
    ],
    kutuphaneler: () => ['DHT sensor library', 'Adafruit Unified Sensor'],
    baglanti: (v) => [`Sensör VCC → 3.3 V, GND → GND, DATA → pin ${v.DHT_PIN}.`, 'Yüklendikten sonra Seri Monitör’de yazan IP adresini tarayıcıya yazın.'],
    notlar: () => ['Wi-Fi şifresi kodun içinde düz metin olarak durur; projeyi paylaşırken silmeyi unutmayın.'],
    kod: (v, aile) => `// Sıcaklık ve nemi web sayfasında göster
${aile === 'esp32' ? '#include <WiFi.h>\n#include <WebServer.h>' : '#include <ESP8266WiFi.h>\n#include <ESP8266WebServer.h>'}
#include <DHT.h>

const char* WIFI_ADI = "${v.SSID}";
const char* WIFI_SIFRE = "${v.SIFRE}";
const int DHT_PIN = ${v.DHT_PIN};
#define DHT_TIPI ${v.TIP}

DHT dht(DHT_PIN, DHT_TIPI);
${aile === 'esp32' ? 'WebServer' : 'ESP8266WebServer'} sunucu(80);

void anaSayfa() {
  float nem = dht.readHumidity();
  float sicaklik = dht.readTemperature();

  String html = "<!DOCTYPE html><html><head><meta charset='utf-8'>";
  html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<meta http-equiv='refresh' content='5'>";
  html += "<title>Sicaklik ve Nem</title></head>";
  html += "<body style='font-family:sans-serif;text-align:center;margin-top:40px'>";
  html += "<h1>Sicaklik ve Nem</h1>";
  if (isnan(nem) || isnan(sicaklik)) {
    html += "<p>Sensor okunamadi</p>";
  } else {
    html += "<p style='font-size:48px'>" + String(sicaklik, 1) + " &deg;C</p>";
    html += "<p style='font-size:32px'>Nem: %" + String(nem, 0) + "</p>";
  }
  html += "<p style='color:gray'>Sayfa 5 saniyede bir yenilenir</p></body></html>";
  sunucu.send(200, "text/html; charset=utf-8", html);
}

void setup() {
  Serial.begin(115200);
  dht.begin();

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_ADI, WIFI_SIFRE);
  Serial.print("Wi-Fi baglaniyor");
  int deneme = 0;
  while (WiFi.status() != WL_CONNECTED && deneme < 40) {
    delay(500);
    Serial.print(".");
    deneme++;
  }
  Serial.println();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Baglanilamadi: Wi-Fi adini ve sifresini kontrol edin");
    return;
  }
  Serial.print("Baglandi. Tarayicida su adresi acin: http://");
  Serial.println(WiFi.localIP());

  sunucu.on("/", anaSayfa);
  sunucu.begin();
}

void loop() {
  sunucu.handleClient();
}
`
  }
]

export function sablonBul(id: string): Sablon | undefined {
  return SABLONLAR.find((s) => s.id === id)
}
