/**
 * Çevrimdışı Arduino / ESP32 çekirdek API kataloğu.
 * Tamamlama önerileri, hover belgeleri ve parametre imza ipuçları için
 * Türkçe açıklamalarla birlikte temel fonksiyonları, nesneleri, sınıfları,
 * sabitleri, kod şablonlarını ve standart başlık dosyalarını içerir.
 */

export interface ApiParametre {
  ad: string
  imza: string
  aciklama: string
}

export interface ApiFonksiyonKaydi {
  ad: string
  imza: string
  donusTipi: string
  aciklama: string
  snippet: string
  parametreler: ApiParametre[]
  platform?: 'esp32'
  kategori: string
}

export interface ApiSabitKaydi {
  ad: string
  tur: 'sabit' | 'tip' | 'makro' | 'pin'
  deger?: string
  aciklama: string
  snippet?: string
  platform?: 'esp32'
}

export interface ApiNesneKaydi {
  ad: string
  aciklama: string
  sinifMi?: boolean
  platform?: 'esp32'
  uyeler: ApiFonksiyonKaydi[]
}

export interface ApiSnippetKaydi {
  etiket: string
  baslik: string
  aciklama: string
  snippet: string
  platform?: 'esp32'
}

export interface StandartBaslikKaydi {
  baslik: string
  aciklama: string
  platform?: 'esp32' | 'esp8266'
}

export const ARDUINO_FONKSIYONLARI: ApiFonksiyonKaydi[] = [
  // ── Dijital & Analog G/Ç ──
  {
    ad: 'pinMode',
    imza: 'void pinMode(uint8_t pin, uint8_t mode)',
    donusTipi: 'void',
    aciklama: 'Belirtilen dijital pini giriş veya çıkış moduna ayarlar.',
    snippet: 'pinMode(${1:pin}, ${2|OUTPUT,INPUT,INPUT_PULLUP,INPUT_PULLDOWN|})',
    kategori: 'Dijital G/Ç',
    parametreler: [
      { ad: 'pin', imza: 'uint8_t pin', aciklama: 'Yapılandırılacak pin numarası (ör. 13, A0)' },
      { ad: 'mode', imza: 'uint8_t mode', aciklama: 'OUTPUT, INPUT, INPUT_PULLUP veya INPUT_PULLDOWN' }
    ]
  },
  {
    ad: 'digitalWrite',
    imza: 'void digitalWrite(uint8_t pin, uint8_t val)',
    donusTipi: 'void',
    aciklama: 'OUTPUT olarak ayarlı pine HIGH (açık) veya LOW (kapalı) voltaj verir.',
    snippet: 'digitalWrite(${1:pin}, ${2|HIGH,LOW|})',
    kategori: 'Dijital G/Ç',
    parametreler: [
      { ad: 'pin', imza: 'uint8_t pin', aciklama: 'Dijital pin numarası' },
      { ad: 'val', imza: 'uint8_t val', aciklama: 'HIGH (1) veya LOW (0)' }
    ]
  },
  {
    ad: 'digitalRead',
    imza: 'int digitalRead(uint8_t pin)',
    donusTipi: 'int',
    aciklama: 'Belirtilen dijital pinin seviyesini okur (HIGH veya LOW döner).',
    snippet: 'digitalRead(${1:pin})',
    kategori: 'Dijital G/Ç',
    parametreler: [{ ad: 'pin', imza: 'uint8_t pin', aciklama: 'Okunacak dijital pin numarası' }]
  },
  {
    ad: 'analogRead',
    imza: 'int analogRead(uint8_t pin)',
    donusTipi: 'int',
    aciklama: 'Analog pindeki gerilimi ADC ile okur (Uno 0–1023, ESP32 0–4095).',
    snippet: 'analogRead(${1:A0})',
    kategori: 'Analog G/Ç',
    parametreler: [{ ad: 'pin', imza: 'uint8_t pin', aciklama: 'Analog giriş pini (ör. A0, 34)' }]
  },
  {
    ad: 'analogWrite',
    imza: 'void analogWrite(uint8_t pin, int val)',
    donusTipi: 'void',
    aciklama: 'PWM destekli pinden darbe genişliği modülasyonlu (0–255) sinyal üretir.',
    snippet: 'analogWrite(${1:pin}, ${2:128})',
    kategori: 'Analog G/Ç',
    parametreler: [
      { ad: 'pin', imza: 'uint8_t pin', aciklama: 'PWM destekleyen pin numarası' },
      { ad: 'val', imza: 'int val', aciklama: 'Görev döngüsü (0 = %0, 255 = %100)' }
    ]
  },
  {
    ad: 'analogReference',
    imza: 'void analogReference(uint8_t mode)',
    donusTipi: 'void',
    aciklama: 'Analog okumalar için kullanılan referans voltaj kaynağını ayarlar.',
    snippet: 'analogReference(${1|DEFAULT,INTERNAL,EXTERNAL|})',
    kategori: 'Analog G/Ç',
    parametreler: [{ ad: 'mode', imza: 'uint8_t mode', aciklama: 'DEFAULT, INTERNAL veya EXTERNAL' }]
  },
  {
    ad: 'analogReadResolution',
    imza: 'void analogReadResolution(uint8_t bits)',
    donusTipi: 'void',
    aciklama: 'analogRead() çıktısının bit çözünürlüğünü belirler (ör. 10 veya 12 bit).',
    snippet: 'analogReadResolution(${1:12})',
    kategori: 'Analog G/Ç',
    parametreler: [{ ad: 'bits', imza: 'uint8_t bits', aciklama: 'Çözünürlük bit sayısı (9–12)' }]
  },

  // ── Zamanlama ──
  {
    ad: 'delay',
    imza: 'void delay(unsigned long ms)',
    donusTipi: 'void',
    aciklama: 'Program akışını belirtilen milisaniye kadar bekletir (1000 ms = 1 saniye).',
    snippet: 'delay(${1:1000})',
    kategori: 'Zamanlama',
    parametreler: [{ ad: 'ms', imza: 'unsigned long ms', aciklama: 'Bekleme süresi (milisaniye)' }]
  },
  {
    ad: 'delayMicroseconds',
    imza: 'void delayMicroseconds(unsigned int us)',
    donusTipi: 'void',
    aciklama: 'Programı çok kısa süreliğine mikrosaniye cinsinden bekletir.',
    snippet: 'delayMicroseconds(${1:10})',
    kategori: 'Zamanlama',
    parametreler: [{ ad: 'us', imza: 'unsigned int us', aciklama: 'Bekleme süresi (mikrosaniye)' }]
  },
  {
    ad: 'millis',
    imza: 'unsigned long millis()',
    donusTipi: 'unsigned long',
    aciklama: 'Kart çalıştığından beri geçen süreyi milisaniye olarak döndürür (bloklamadan zamanlama için idealdir).',
    snippet: 'millis()',
    kategori: 'Zamanlama',
    parametreler: []
  },
  {
    ad: 'micros',
    imza: 'unsigned long micros()',
    donusTipi: 'unsigned long',
    aciklama: 'Kart çalıştığından beri geçen süreyi mikrosaniye olarak döndürür.',
    snippet: 'micros()',
    kategori: 'Zamanlama',
    parametreler: []
  },

  // ── Gelişmiş G/Ç & Kesmeler ──
  {
    ad: 'tone',
    imza: 'void tone(uint8_t pin, unsigned int frequency, unsigned long duration = 0)',
    donusTipi: 'void',
    aciklama: 'Belirtilen pinden buzzer veya hoparlör için kare dalga ses frekansı üretir.',
    snippet: 'tone(${1:pin}, ${2:1000})',
    kategori: 'Gelişmiş G/Ç',
    parametreler: [
      { ad: 'pin', imza: 'uint8_t pin', aciklama: 'Ses üretilecek çıkış pini' },
      { ad: 'frequency', imza: 'unsigned int frequency', aciklama: 'Frekans (Hz)' },
      { ad: 'duration', imza: 'unsigned long duration = 0', aciklama: 'İsteğe bağlı süre (ms)' }
    ]
  },
  {
    ad: 'noTone',
    imza: 'void noTone(uint8_t pin)',
    donusTipi: 'void',
    aciklama: 'tone() ile başlatılan kare dalga ses çıkışını durdurur.',
    snippet: 'noTone(${1:pin})',
    kategori: 'Gelişmiş G/Ç',
    parametreler: [{ ad: 'pin', imza: 'uint8_t pin', aciklama: 'Durdurulacak pin' }]
  },
  {
    ad: 'pulseIn',
    imza: 'unsigned long pulseIn(uint8_t pin, uint8_t state, unsigned long timeout = 1000000L)',
    donusTipi: 'unsigned long',
    aciklama: 'Pindeki HIGH veya LOW darbesinin süresini mikrosaniye olarak ölçer (HC-SR04 echo için kullanılır).',
    snippet: 'pulseIn(${1:echoPin}, ${2|HIGH,LOW|})',
    kategori: 'Gelişmiş G/Ç',
    parametreler: [
      { ad: 'pin', imza: 'uint8_t pin', aciklama: 'Darbenin okunacağı pin' },
      { ad: 'state', imza: 'uint8_t state', aciklama: 'Ölçülecek seviye: HIGH veya LOW' },
      { ad: 'timeout', imza: 'unsigned long timeout = 1000000L', aciklama: 'Zaman aşımı (mikrosaniye)' }
    ]
  },
  {
    ad: 'pulseInLong',
    imza: 'unsigned long pulseInLong(uint8_t pin, uint8_t state, unsigned long timeout = 1000000L)',
    donusTipi: 'unsigned long',
    aciklama: 'Kesmeleri kapatmadan uzun darbe sürelerini mikrosaniye cinsinden ölçer.',
    snippet: 'pulseInLong(${1:pin}, ${2|HIGH,LOW|})',
    kategori: 'Gelişmiş G/Ç',
    parametreler: [
      { ad: 'pin', imza: 'uint8_t pin', aciklama: 'Darbenin okunacağı pin' },
      { ad: 'state', imza: 'uint8_t state', aciklama: 'HIGH veya LOW' },
      { ad: 'timeout', imza: 'unsigned long timeout = 1000000L', aciklama: 'Zaman aşımı (mikrosaniye)' }
    ]
  },
  {
    ad: 'shiftOut',
    imza: 'void shiftOut(uint8_t dataPin, uint8_t clockPin, uint8_t bitOrder, uint8_t val)',
    donusTipi: 'void',
    aciklama: 'Bir baytı saat pini eşliğinde bit bit kaydırma yazmacına (ör. 74HC595) gönderir.',
    snippet: 'shiftOut(${1:dataPin}, ${2:clockPin}, ${3|MSBFIRST,LSBFIRST|}, ${4:val})',
    kategori: 'Gelişmiş G/Ç',
    parametreler: [
      { ad: 'dataPin', imza: 'uint8_t dataPin', aciklama: 'Veri pini' },
      { ad: 'clockPin', imza: 'uint8_t clockPin', aciklama: 'Saat (clock) pini' },
      { ad: 'bitOrder', imza: 'uint8_t bitOrder', aciklama: 'MSBFIRST veya LSBFIRST' },
      { ad: 'val', imza: 'uint8_t val', aciklama: 'Gönderilecek 8 bit değer' }
    ]
  },
  {
    ad: 'shiftIn',
    imza: 'uint8_t shiftIn(uint8_t dataPin, uint8_t clockPin, uint8_t bitOrder)',
    donusTipi: 'uint8_t',
    aciklama: 'Saat sinyali üreterek bir veri pininden bit bit 1 bayt okur.',
    snippet: 'shiftIn(${1:dataPin}, ${2:clockPin}, ${3|MSBFIRST,LSBFIRST|})',
    kategori: 'Gelişmiş G/Ç',
    parametreler: [
      { ad: 'dataPin', imza: 'uint8_t dataPin', aciklama: 'Veri giriş pini' },
      { ad: 'clockPin', imza: 'uint8_t clockPin', aciklama: 'Saat çıkış pini' },
      { ad: 'bitOrder', imza: 'uint8_t bitOrder', aciklama: 'MSBFIRST veya LSBFIRST' }
    ]
  },
  {
    ad: 'attachInterrupt',
    imza: 'void attachInterrupt(uint8_t interruptNum, void (*isr)(void), int mode)',
    donusTipi: 'void',
    aciklama: 'Kesme pininde sinyal değişimi olduğunda otomatik çalıştırılacak kesme fonksiyonunu (ISR) bağlar.',
    snippet: 'attachInterrupt(digitalPinToInterrupt(${1:pin}), ${2:isrFonksiyonu}, ${3|RISING,FALLING,CHANGE|})',
    kategori: 'Kesmeler',
    parametreler: [
      { ad: 'interruptNum', imza: 'uint8_t interruptNum', aciklama: 'digitalPinToInterrupt(pin) ile elde edilen kesme no' },
      { ad: 'isr', imza: 'void (*isr)(void)', aciklama: 'Parametresiz void kesme fonksiyonu' },
      { ad: 'mode', imza: 'int mode', aciklama: 'RISING, FALLING, CHANGE veya LOW' }
    ]
  },
  {
    ad: 'detachInterrupt',
    imza: 'void detachInterrupt(uint8_t interruptNum)',
    donusTipi: 'void',
    aciklama: 'Belirtilen kesme numarasına bağlı ISR fonksiyonunu devre dışı bırakır.',
    snippet: 'detachInterrupt(digitalPinToInterrupt(${1:pin}))',
    kategori: 'Kesmeler',
    parametreler: [{ ad: 'interruptNum', imza: 'uint8_t interruptNum', aciklama: 'Devre dışı bırakılacak kesme numarası' }]
  },
  {
    ad: 'digitalPinToInterrupt',
    imza: 'int digitalPinToInterrupt(uint8_t pin)',
    donusTipi: 'int',
    aciklama: 'Dijital pin numarasını attachInterrupt() için geçerli kesme numarasına dönüştürür.',
    snippet: 'digitalPinToInterrupt(${1:pin})',
    kategori: 'Kesmeler',
    parametreler: [{ ad: 'pin', imza: 'uint8_t pin', aciklama: 'Kesme kullanılacak dijital pin' }]
  },
  {
    ad: 'interrupts',
    imza: 'void interrupts()',
    donusTipi: 'void',
    aciklama: 'noInterrupts() ile kapatılmış genel donanım kesmelerini yeniden etkinleştirir.',
    snippet: 'interrupts()',
    kategori: 'Kesmeler',
    parametreler: []
  },
  {
    ad: 'noInterrupts',
    imza: 'void noInterrupts()',
    donusTipi: 'void',
    aciklama: 'Kritik zamanlama blokları için genel kesmeleri geçici olarak kapatır.',
    snippet: 'noInterrupts()',
    kategori: 'Kesmeler',
    parametreler: []
  },

  // ── Matematik & Bit İşlemleri ──
  {
    ad: 'map',
    imza: 'long map(long value, long fromLow, long fromHigh, long toLow, long toHigh)',
    donusTipi: 'long',
    aciklama: 'Bir değeri kaynak aralığından hedef aralığına doğrusal olarak ölçekler.',
    snippet: 'map(${1:deger}, ${2:0}, ${3:1023}, ${4:0}, ${5:255})',
    kategori: 'Matematik',
    parametreler: [
      { ad: 'value', imza: 'long value', aciklama: 'Dönüştürülecek sayı' },
      { ad: 'fromLow', imza: 'long fromLow', aciklama: 'Mevcut aralığın alt sınırı' },
      { ad: 'fromHigh', imza: 'long fromHigh', aciklama: 'Mevcut aralığın üst sınırı' },
      { ad: 'toLow', imza: 'long toLow', aciklama: 'Hedef aralığın alt sınırı' },
      { ad: 'toHigh', imza: 'long toHigh', aciklama: 'Hedef aralığın üst sınırı' }
    ]
  },
  {
    ad: 'constrain',
    imza: 'T constrain(T x, T a, T b)',
    donusTipi: 'T',
    aciklama: 'Bir sayıyı [a, b] aralığında sınırlar.',
    snippet: 'constrain(${1:deger}, ${2:0}, ${3:255})',
    kategori: 'Matematik',
    parametreler: [
      { ad: 'x', imza: 'T x', aciklama: 'Sınırlandırılacak değer' },
      { ad: 'a', imza: 'T a', aciklama: 'Minimum değer' },
      { ad: 'b', imza: 'T b', aciklama: 'Maksimum değer' }
    ]
  },
  {
    ad: 'min',
    imza: 'T min(T a, T b)',
    donusTipi: 'T',
    aciklama: 'İki değerden küçük olanı döndürür.',
    snippet: 'min(${1:a}, ${2:b})',
    kategori: 'Matematik',
    parametreler: [
      { ad: 'a', imza: 'T a', aciklama: 'Birinci değer' },
      { ad: 'b', imza: 'T b', aciklama: 'İkinci değer' }
    ]
  },
  {
    ad: 'max',
    imza: 'T max(T a, T b)',
    donusTipi: 'T',
    aciklama: 'İki değerden büyük olanı döndürür.',
    snippet: 'max(${1:a}, ${2:b})',
    kategori: 'Matematik',
    parametreler: [
      { ad: 'a', imza: 'T a', aciklama: 'Birinci değer' },
      { ad: 'b', imza: 'T b', aciklama: 'İkinci değer' }
    ]
  },
  {
    ad: 'abs',
    imza: 'T abs(T x)',
    donusTipi: 'T',
    aciklama: 'Bir sayının mutlak değerini döndürür.',
    snippet: 'abs(${1:x})',
    kategori: 'Matematik',
    parametreler: [{ ad: 'x', imza: 'T x', aciklama: 'Sayı' }]
  },
  {
    ad: 'pow',
    imza: 'double pow(float base, float exponent)',
    donusTipi: 'double',
    aciklama: 'Taban sayının üssünü hesaplar (base^exponent).',
    snippet: 'pow(${1:taban}, ${2:us})',
    kategori: 'Matematik',
    parametreler: [
      { ad: 'base', imza: 'float base', aciklama: 'Taban' },
      { ad: 'exponent', imza: 'float exponent', aciklama: 'Üs' }
    ]
  },
  {
    ad: 'sq',
    imza: 'T sq(T x)',
    donusTipi: 'T',
    aciklama: 'Bir sayının karesini hesaplar.',
    snippet: 'sq(${1:x})',
    kategori: 'Matematik',
    parametreler: [{ ad: 'x', imza: 'T x', aciklama: 'Karesi alınacak sayı' }]
  },
  {
    ad: 'sqrt',
    imza: 'double sqrt(double x)',
    donusTipi: 'double',
    aciklama: 'Bir sayının karekökünü hesaplar.',
    snippet: 'sqrt(${1:x})',
    kategori: 'Matematik',
    parametreler: [{ ad: 'x', imza: 'double x', aciklama: 'Karekökü alınacak sayı' }]
  },
  {
    ad: 'random',
    imza: 'long random(long min, long max)',
    donusTipi: 'long',
    aciklama: 'Sözde rastgele tamsayı üretir ([min, max) aralığında). Tek parametre verilirse [0, max).',
    snippet: 'random(${1:0}, ${2:100})',
    kategori: 'Rastgele',
    parametreler: [
      { ad: 'min', imza: 'long min', aciklama: 'Alt sınır (dahil)' },
      { ad: 'max', imza: 'long max', aciklama: 'Üst sınır (hariç)' }
    ]
  },
  {
    ad: 'randomSeed',
    imza: 'void randomSeed(unsigned long seed)',
    donusTipi: 'void',
    aciklama: 'Rastgele sayı üretecini yeni bir başlangıç değeriyle başlatır (genelde analogRead ile beslenir).',
    snippet: 'randomSeed(${1:analogRead(A0)})',
    kategori: 'Rastgele',
    parametreler: [{ ad: 'seed', imza: 'unsigned long seed', aciklama: 'Başlangıç çekirdek değeri' }]
  },
  {
    ad: 'bitRead',
    imza: 'int bitRead(unsigned long x, unsigned int n)',
    donusTipi: 'int',
    aciklama: 'Bir sayının n. bitini (0 veya 1) okur.',
    snippet: 'bitRead(${1:x}, ${2:n})',
    kategori: 'Bit İşlemleri',
    parametreler: [
      { ad: 'x', imza: 'unsigned long x', aciklama: 'Kaynak sayı' },
      { ad: 'n', imza: 'unsigned int n', aciklama: 'Bit konumu (0 = en sağ)' }
    ]
  },
  {
    ad: 'bitWrite',
    imza: 'void bitWrite(unsigned long &x, unsigned int n, int b)',
    donusTipi: 'void',
    aciklama: 'Bir sayının n. bitine 0 veya 1 yazar.',
    snippet: 'bitWrite(${1:x}, ${2:n}, ${3|1,0|})',
    kategori: 'Bit İşlemleri',
    parametreler: [
      { ad: 'x', imza: 'unsigned long &x', aciklama: 'Değişken' },
      { ad: 'n', imza: 'unsigned int n', aciklama: 'Bit konumu' },
      { ad: 'b', imza: 'int b', aciklama: 'Yazılacak bit (0 veya 1)' }
    ]
  },
  {
    ad: 'bitSet',
    imza: 'void bitSet(unsigned long &x, unsigned int n)',
    donusTipi: 'void',
    aciklama: 'Bir sayının n. bitini 1 yapar.',
    snippet: 'bitSet(${1:x}, ${2:n})',
    kategori: 'Bit İşlemleri',
    parametreler: [
      { ad: 'x', imza: 'unsigned long &x', aciklama: 'Değişken' },
      { ad: 'n', imza: 'unsigned int n', aciklama: 'Bit konumu' }
    ]
  },
  {
    ad: 'bitClear',
    imza: 'void bitClear(unsigned long &x, unsigned int n)',
    donusTipi: 'void',
    aciklama: 'Bir sayının n. bitini 0 yapar.',
    snippet: 'bitClear(${1:x}, ${2:n})',
    kategori: 'Bit İşlemleri',
    parametreler: [
      { ad: 'x', imza: 'unsigned long &x', aciklama: 'Değişken' },
      { ad: 'n', imza: 'unsigned int n', aciklama: 'Bit konumu' }
    ]
  },
  {
    ad: 'bit',
    imza: 'unsigned long bit(unsigned int n)',
    donusTipi: 'unsigned long',
    aciklama: 'Belirtilen bitin değerini (1 << n) hesaplar.',
    snippet: 'bit(${1:n})',
    kategori: 'Bit İşlemleri',
    parametreler: [{ ad: 'n', imza: 'unsigned int n', aciklama: 'Bit indeksi' }]
  },
  {
    ad: 'lowByte',
    imza: 'uint8_t lowByte(unsigned int x)',
    donusTipi: 'uint8_t',
    aciklama: 'Bir kelimenin (16 bit) en düşük anlamlı baytını çıkarır.',
    snippet: 'lowByte(${1:x})',
    kategori: 'Bit İşlemleri',
    parametreler: [{ ad: 'x', imza: 'unsigned int x', aciklama: 'Kaynak sayı' }]
  },
  {
    ad: 'highByte',
    imza: 'uint8_t highByte(unsigned int x)',
    donusTipi: 'uint8_t',
    aciklama: 'Bir kelimenin (16 bit) en yüksek anlamlı baytını çıkarır.',
    snippet: 'highByte(${1:x})',
    kategori: 'Bit İşlemleri',
    parametreler: [{ ad: 'x', imza: 'unsigned int x', aciklama: 'Kaynak sayı' }]
  },

  // ── ESP32 Özel Fonksiyonları ──
  {
    ad: 'ledcAttach',
    imza: 'bool ledcAttach(uint8_t pin, uint32_t freq, uint8_t resolution)',
    donusTipi: 'bool',
    aciklama: 'ESP32 Arduino çekirdeği 3.x ile PWM pinini frekans ve çözünürlükle yapılandırır.',
    snippet: 'ledcAttach(${1:pin}, ${2:5000}, ${3:8})',
    platform: 'esp32',
    kategori: 'ESP32 PWM',
    parametreler: [
      { ad: 'pin', imza: 'uint8_t pin', aciklama: 'PWM pini' },
      { ad: 'freq', imza: 'uint32_t freq', aciklama: 'PWM frekansı (Hz)' },
      { ad: 'resolution', imza: 'uint8_t resolution', aciklama: 'Çözünürlük bit sayısı (1–16)' }
    ]
  },
  {
    ad: 'ledcWrite',
    imza: 'bool ledcWrite(uint8_t pin, uint32_t duty)',
    donusTipi: 'bool',
    aciklama: 'ESP32 LEDC PWM çıkışının görev döngüsü (duty cycle) değerini yazar.',
    snippet: 'ledcWrite(${1:pin}, ${2:128})',
    platform: 'esp32',
    kategori: 'ESP32 PWM',
    parametreler: [
      { ad: 'pin', imza: 'uint8_t pin', aciklama: 'Pin (veya çekirdek 2.x için kanal)' },
      { ad: 'duty', imza: 'uint32_t duty', aciklama: 'Görev döngüsü değeri' }
    ]
  },
  {
    ad: 'ledcSetup',
    imza: 'double ledcSetup(uint8_t channel, double freq, uint8_t resolution_bits)',
    donusTipi: 'double',
    aciklama: 'ESP32 çekirdek 2.x API: PWM kanalının frekans ve çözünürlüğünü ayarlar.',
    snippet: 'ledcSetup(${1:0}, ${2:5000}, ${3:8})',
    platform: 'esp32',
    kategori: 'ESP32 PWM',
    parametreler: [
      { ad: 'channel', imza: 'uint8_t channel', aciklama: 'LEDC kanalı (0–15)' },
      { ad: 'freq', imza: 'double freq', aciklama: 'Frekans (Hz)' },
      { ad: 'resolution_bits', imza: 'uint8_t resolution_bits', aciklama: 'Bit çözünürlüğü' }
    ]
  },
  {
    ad: 'ledcAttachPin',
    imza: 'void ledcAttachPin(uint8_t pin, uint8_t channel)',
    donusTipi: 'void',
    aciklama: 'ESP32 çekirdek 2.x API: bir GPIO pinini yapılandırılmış LEDC PWM kanalına bağlar.',
    snippet: 'ledcAttachPin(${1:pin}, ${2:0})',
    platform: 'esp32',
    kategori: 'ESP32 PWM',
    parametreler: [
      { ad: 'pin', imza: 'uint8_t pin', aciklama: 'GPIO pini' },
      { ad: 'channel', imza: 'uint8_t channel', aciklama: 'LEDC kanalı' }
    ]
  },
  {
    ad: 'dacWrite',
    imza: 'void dacWrite(uint8_t pin, uint8_t value)',
    donusTipi: 'void',
    aciklama: 'ESP32 DAC pininden (GPIO 25 veya 26) gerçek analog voltaj (0–255) üretir.',
    snippet: 'dacWrite(${1|25,26|}, ${2:128})',
    platform: 'esp32',
    kategori: 'ESP32 DAC',
    parametreler: [
      { ad: 'pin', imza: 'uint8_t pin', aciklama: 'DAC1 (25) veya DAC2 (26)' },
      { ad: 'value', imza: 'uint8_t value', aciklama: '8 bit çıkış seviyesi (0–255)' }
    ]
  },
  {
    ad: 'touchRead',
    imza: 'uint16_t touchRead(uint8_t pin)',
    donusTipi: 'uint16_t',
    aciklama: 'ESP32 kapasitif dokunmatik pin değerini okur (dokunulduğunda değer düşer).',
    snippet: 'touchRead(${1:T0})',
    platform: 'esp32',
    kategori: 'ESP32 Dokunmatik',
    parametreler: [{ ad: 'pin', imza: 'uint8_t pin', aciklama: 'Dokunmatik pin (ör. T0 / GPIO 4)' }]
  },
  {
    ad: 'esp_sleep_enable_timer_wakeup',
    imza: 'esp_err_t esp_sleep_enable_timer_wakeup(uint64_t time_in_us)',
    donusTipi: 'esp_err_t',
    aciklama: 'ESP32 derin/hafif uyku modundan zamanlayıcıyla uyanma süresini mikrosaniye cinsinden ayarlar.',
    snippet: 'esp_sleep_enable_timer_wakeup(${1:10ULL * 1000000ULL})',
    platform: 'esp32',
    kategori: 'ESP32 Uyku',
    parametreler: [{ ad: 'time_in_us', imza: 'uint64_t time_in_us', aciklama: 'Uyku süresi (mikrosaniye)' }]
  },
  {
    ad: 'esp_deep_sleep_start',
    imza: 'void esp_deep_sleep_start()',
    donusTipi: 'void',
    aciklama: 'ESP32 kartını derin uyku moduna geçirir; uyandığında setup() baştan başlar.',
    snippet: 'esp_deep_sleep_start()',
    platform: 'esp32',
    kategori: 'ESP32 Uyku',
    parametreler: []
  }
]

const SERIAL_UYELERI: ApiFonksiyonKaydi[] = [
  {
    ad: 'begin',
    imza: 'void begin(unsigned long baud)',
    donusTipi: 'void',
    aciklama: 'Seri haberleşmeyi belirtilen baud hızında başlatır.',
    snippet: 'begin(${1|115200,9600,57600,38400|})',
    kategori: 'Serial',
    parametreler: [{ ad: 'baud', imza: 'unsigned long baud', aciklama: 'İletişim hızı (genellikle 115200 veya 9600)' }]
  },
  {
    ad: 'end',
    imza: 'void end()',
    donusTipi: 'void',
    aciklama: 'Seri haberleşmeyi durdurur ve TX/RX pinlerini genel amaçlı kullanıma serbest bırakır.',
    snippet: 'end()',
    kategori: 'Serial',
    parametreler: []
  },
  {
    ad: 'available',
    imza: 'int available()',
    donusTipi: 'int',
    aciklama: 'Seri port tamponunda okunmayı bekleyen bayt sayısını döndürür.',
    snippet: 'available()',
    kategori: 'Serial',
    parametreler: []
  },
  {
    ad: 'availableForWrite',
    imza: 'int availableForWrite()',
    donusTipi: 'int',
    aciklama: 'Bloklamadan yazılabilecek TX tamponu boş bayt sayısını döndürür.',
    snippet: 'availableForWrite()',
    kategori: 'Serial',
    parametreler: []
  },
  {
    ad: 'read',
    imza: 'int read()',
    donusTipi: 'int',
    aciklama: 'Seri tampondan bir bayt (karakter) okur; veri yoksa -1 döner.',
    snippet: 'read()',
    kategori: 'Serial',
    parametreler: []
  },
  {
    ad: 'peek',
    imza: 'int peek()',
    donusTipi: 'int',
    aciklama: 'Tampondaki sonraki baytı tampondan silmeden okur.',
    snippet: 'peek()',
    kategori: 'Serial',
    parametreler: []
  },
  {
    ad: 'readString',
    imza: 'String readString()',
    donusTipi: 'String',
    aciklama: 'Seri tampondaki karakterleri zaman aşımına kadar okuyup String olarak döndürür.',
    snippet: 'readString()',
    kategori: 'Serial',
    parametreler: []
  },
  {
    ad: 'readStringUntil',
    imza: "String readStringUntil(char terminator)",
    donusTipi: 'String',
    aciklama: 'Belirtilen ayırıcı karaktere kadar (ör. \\n) seri porttan metin okur.',
    snippet: "readStringUntil('${1:\\n}')",
    kategori: 'Serial',
    parametreler: [{ ad: 'terminator', imza: 'char terminator', aciklama: 'Okumayı sonlandıran karakter' }]
  },
  {
    ad: 'readBytes',
    imza: 'size_t readBytes(char *buffer, size_t length)',
    donusTipi: 'size_t',
    aciklama: 'Belirtilen uzunlukta baytı hedef tampona okur.',
    snippet: 'readBytes(${1:buffer}, ${2:length})',
    kategori: 'Serial',
    parametreler: [
      { ad: 'buffer', imza: 'char *buffer', aciklama: 'Hedef karakter dizisi' },
      { ad: 'length', imza: 'size_t length', aciklama: 'Okunacak bayt sayısı' }
    ]
  },
  {
    ad: 'readBytesUntil',
    imza: 'size_t readBytesUntil(char character, char *buffer, size_t length)',
    donusTipi: 'size_t',
    aciklama: 'Ayırıcı karakter görene kadar baytları tampona okur.',
    snippet: "readBytesUntil('${1:\\n}', ${2:buffer}, ${3:length})",
    kategori: 'Serial',
    parametreler: [
      { ad: 'character', imza: 'char character', aciklama: 'Ayırıcı karakter' },
      { ad: 'buffer', imza: 'char *buffer', aciklama: 'Hedef tampon' },
      { ad: 'length', imza: 'size_t length', aciklama: 'Azami uzunluk' }
    ]
  },
  {
    ad: 'parseInt',
    imza: 'long parseInt()',
    donusTipi: 'long',
    aciklama: 'Seri gelen veriden ilk geçerli tamsayıyı ayrıştırıp döndürür.',
    snippet: 'parseInt()',
    kategori: 'Serial',
    parametreler: []
  },
  {
    ad: 'parseFloat',
    imza: 'float parseFloat()',
    donusTipi: 'float',
    aciklama: 'Seri gelen veriden ilk ondalıklı sayıyı ayrıştırıp döndürür.',
    snippet: 'parseFloat()',
    kategori: 'Serial',
    parametreler: []
  },
  {
    ad: 'print',
    imza: 'size_t print(const T &val)',
    donusTipi: 'size_t',
    aciklama: 'Veriyi satır sonu eklemeden Seri Monitör’e ASCII metin olarak yazar.',
    snippet: 'print(${1:"deger"})',
    kategori: 'Serial',
    parametreler: [{ ad: 'val', imza: 'const T &val', aciklama: 'Yazdırılacak metin veya sayı' }]
  },
  {
    ad: 'println',
    imza: 'size_t println(const T &val)',
    donusTipi: 'size_t',
    aciklama: 'Veriyi ve ardından yeni satır karakterini Seri Monitör’e yazar.',
    snippet: 'println(${1:"merhaba"})',
    kategori: 'Serial',
    parametreler: [{ ad: 'val', imza: 'const T &val', aciklama: 'Yazdırılacak metin veya sayı' }]
  },
  {
    ad: 'printf',
    imza: 'size_t printf(const char *format, ...)',
    donusTipi: 'size_t',
    aciklama: 'Biçimli metin yazdırır (ESP32 / ESP8266 kartlarında yerleşiktir).',
    snippet: 'printf("${1:%d\\n}", ${2:deger})',
    kategori: 'Serial',
    parametreler: [
      { ad: 'format', imza: 'const char *format', aciklama: 'printf biçim dizesi' },
      { ad: 'args', imza: '...', aciklama: 'Biçim argümanları' }
    ]
  },
  {
    ad: 'write',
    imza: 'size_t write(uint8_t val)',
    donusTipi: 'size_t',
    aciklama: 'Seri porta doğrudan ham ikili (binary) bayt gönderir.',
    snippet: 'write(${1:val})',
    kategori: 'Serial',
    parametreler: [{ ad: 'val', imza: 'uint8_t val', aciklama: 'Gönderilecek ham bayt veya tampon' }]
  },
  {
    ad: 'flush',
    imza: 'void flush()',
    donusTipi: 'void',
    aciklama: 'Giden seri verilerin tamamen gönderilmesini bekler.',
    snippet: 'flush()',
    kategori: 'Serial',
    parametreler: []
  },
  {
    ad: 'setTimeout',
    imza: 'void setTimeout(unsigned long timeout)',
    donusTipi: 'void',
    aciklama: 'readString ve parseInt gibi işlemler için bekleme zaman aşımını (ms) ayarlar (varsayılan 1000 ms).',
    snippet: 'setTimeout(${1:100})',
    kategori: 'Serial',
    parametreler: [{ ad: 'timeout', imza: 'unsigned long timeout', aciklama: 'Milisaniye cinsinden zaman aşımı' }]
  }
]

const WIRE_UYELERI: ApiFonksiyonKaydi[] = [
  {
    ad: 'begin',
    imza: 'void begin(uint8_t address = 0)',
    donusTipi: 'void',
    aciklama: 'I2C (TWI) haberleşmesini başlatır. Adres verilmezse yönetici (master) olarak başlar.',
    snippet: 'begin()',
    kategori: 'Wire (I2C)',
    parametreler: [{ ad: 'address', imza: 'uint8_t address = 0', aciklama: 'İsteğe bağlı 7-bit uydu adresi' }]
  },
  {
    ad: 'beginTransmission',
    imza: 'void beginTransmission(uint8_t address)',
    donusTipi: 'void',
    aciklama: 'Belirtilen 7-bit I2C adresindeki cihaza veri aktarımını başlatır.',
    snippet: 'beginTransmission(${1:0x27})',
    kategori: 'Wire (I2C)',
    parametreler: [{ ad: 'address', imza: 'uint8_t address', aciklama: 'Hedef cihazın 7-bit I2C adresi' }]
  },
  {
    ad: 'endTransmission',
    imza: 'uint8_t endTransmission(bool sendStop = true)',
    donusTipi: 'uint8_t',
    aciklama: 'Tamponlanmış I2C baytlarını gönderir ve durumu döndürür (0 = başarılı).',
    snippet: 'endTransmission()',
    kategori: 'Wire (I2C)',
    parametreler: [{ ad: 'sendStop', imza: 'bool sendStop = true', aciklama: 'true ise STOP biti gönderilir' }]
  },
  {
    ad: 'requestFrom',
    imza: 'uint8_t requestFrom(uint8_t address, uint8_t quantity, bool stop = true)',
    donusTipi: 'uint8_t',
    aciklama: 'Belirtilen I2C adresindeki cihazdan belirtilen sayıda bayt ister.',
    snippet: 'requestFrom(${1:0x68}, ${2:6})',
    kategori: 'Wire (I2C)',
    parametreler: [
      { ad: 'address', imza: 'uint8_t address', aciklama: '7-bit cihaz adresi' },
      { ad: 'quantity', imza: 'uint8_t quantity', aciklama: 'İstenecek bayt sayısı' },
      { ad: 'stop', imza: 'bool stop = true', aciklama: 'İstek sonrası STOP biti' }
    ]
  },
  {
    ad: 'write',
    imza: 'size_t write(uint8_t data)',
    donusTipi: 'size_t',
    aciklama: 'beginTransmission() sonrası gönderilecek I2C baytını sıraya ekler.',
    snippet: 'write(${1:veri})',
    kategori: 'Wire (I2C)',
    parametreler: [{ ad: 'data', imza: 'uint8_t data', aciklama: 'Gönderilecek bayt' }]
  },
  {
    ad: 'available',
    imza: 'int available()',
    donusTipi: 'int',
    aciklama: 'requestFrom() ile gelen ve okunmayı bekleyen bayt sayısını döndürür.',
    snippet: 'available()',
    kategori: 'Wire (I2C)',
    parametreler: []
  },
  {
    ad: 'read',
    imza: 'int read()',
    donusTipi: 'int',
    aciklama: 'I2C alma tamponundan bir bayt okur.',
    snippet: 'read()',
    kategori: 'Wire (I2C)',
    parametreler: []
  },
  {
    ad: 'setClock',
    imza: 'void setClock(uint32_t clockFrequency)',
    donusTipi: 'void',
    aciklama: 'I2C saat hızını değiştirir (ör. 100000 standart, 400000 hızlı mod).',
    snippet: 'setClock(${1|100000,400000|})',
    kategori: 'Wire (I2C)',
    parametreler: [{ ad: 'clockFrequency', imza: 'uint32_t clockFrequency', aciklama: 'Saat frekansı (Hz)' }]
  },
  {
    ad: 'onReceive',
    imza: 'void onReceive(void (*handler)(int numBytes))',
    donusTipi: 'void',
    aciklama: 'Uydu (slave) modunda I2C verisi geldiğinde çağrılacak işleyiciyi tanımlar.',
    snippet: 'onReceive(${1:veriGeldi})',
    kategori: 'Wire (I2C)',
    parametreler: [{ ad: 'handler', imza: 'void (*handler)(int numBytes)', aciklama: 'İşleyici fonksiyon' }]
  },
  {
    ad: 'onRequest',
    imza: 'void onRequest(void (*handler)(void))',
    donusTipi: 'void',
    aciklama: 'Uydu (slave) modunda yöneticiden okuma isteği geldiğinde çağrılacak işleyiciyi tanımlar.',
    snippet: 'onRequest(${1:istekGeldi})',
    kategori: 'Wire (I2C)',
    parametreler: [{ ad: 'handler', imza: 'void (*handler)(void)', aciklama: 'İşleyici fonksiyon' }]
  }
]

export const ARDUINO_NESNELERI: ApiNesneKaydi[] = [
  {
    ad: 'Serial',
    aciklama: 'USB/UART üzerinden bilgisayarla seri haberleşme sağlayan yerleşik nesne.',
    uyeler: SERIAL_UYELERI
  },
  {
    ad: 'Serial1',
    aciklama: 'İkinci donanım seri portu (Mega, Leonardo, ESP32 vb. kartlarda).',
    uyeler: SERIAL_UYELERI
  },
  {
    ad: 'Serial2',
    aciklama: 'Üçüncü donanım seri portu (Arduino Mega ve ESP32 kartlarında).',
    uyeler: SERIAL_UYELERI
  },
  {
    ad: 'Wire',
    aciklama: 'I2C (SDA/SCL) veriyolu haberleşmesi için standart nesne (<Wire.h> gerektirir).',
    uyeler: WIRE_UYELERI
  },
  {
    ad: 'Wire1',
    aciklama: 'İkinci I2C veriyolu nesnesi (ESP32 ve çift I2C destekli kartlarda).',
    platform: 'esp32',
    uyeler: WIRE_UYELERI
  },
  {
    ad: 'SPI',
    aciklama: 'Yüksek hızlı senkron SPI (MOSI/MISO/SCK) haberleşme nesnesi (<SPI.h> gerektirir).',
    uyeler: [
      { ad: 'begin', imza: 'void begin()', donusTipi: 'void', aciklama: 'SPI veriyolunu başlatır.', snippet: 'begin()', kategori: 'SPI', parametreler: [] },
      { ad: 'end', imza: 'void end()', donusTipi: 'void', aciklama: 'SPI donanımını kapatır.', snippet: 'end()', kategori: 'SPI', parametreler: [] },
      {
        ad: 'beginTransaction',
        imza: 'void beginTransaction(SPISettings settings)',
        donusTipi: 'void',
        aciklama: 'Verilen saat hızı ve mod ayarlarıyla SPI işlemini başlatır.',
        snippet: 'beginTransaction(SPISettings(${1:1000000}, ${2|MSBFIRST,LSBFIRST|}, ${3|SPI_MODE0,SPI_MODE1,SPI_MODE2,SPI_MODE3|}))',
        kategori: 'SPI',
        parametreler: [{ ad: 'settings', imza: 'SPISettings settings', aciklama: 'Saat, bit sırası ve SPI modu ayarları' }]
      },
      { ad: 'endTransaction', imza: 'void endTransaction()', donusTipi: 'void', aciklama: 'Aktif SPI işlemini sonlandırır.', snippet: 'endTransaction()', kategori: 'SPI', parametreler: [] },
      {
        ad: 'transfer',
        imza: 'uint8_t transfer(uint8_t val)',
        donusTipi: 'uint8_t',
        aciklama: '1 bayt veri gönderirken eşzamanlı olarak gelen baytı okur.',
        snippet: 'transfer(${1:0x00})',
        kategori: 'SPI',
        parametreler: [{ ad: 'val', imza: 'uint8_t val', aciklama: 'Gönderilecek 8 bit veri' }]
      },
      {
        ad: 'transfer16',
        imza: 'uint16_t transfer16(uint16_t data)',
        donusTipi: 'uint16_t',
        aciklama: '16 bit veri gönderir ve gelen 16 bit veriyi döndürür.',
        snippet: 'transfer16(${1:data})',
        kategori: 'SPI',
        parametreler: [{ ad: 'data', imza: 'uint16_t data', aciklama: 'Gönderilecek 16 bit veri' }]
      },
      {
        ad: 'setClockDivider',
        imza: 'void setClockDivider(uint8_t divider)',
        donusTipi: 'void',
        aciklama: 'Eski API: SPI saat bölücüsünü ayarlar (yerine beginTransaction önerilir).',
        snippet: 'setClockDivider(${1:SPI_CLOCK_DIV4})',
        kategori: 'SPI',
        parametreler: [{ ad: 'divider', imza: 'uint8_t divider', aciklama: 'Saat bölücü sabiti' }]
      },
      {
        ad: 'setDataMode',
        imza: 'void setDataMode(uint8_t dataMode)',
        donusTipi: 'void',
        aciklama: 'SPI saat polaritesi ve faz modunu ayarlar.',
        snippet: 'setDataMode(${1|SPI_MODE0,SPI_MODE1,SPI_MODE2,SPI_MODE3|})',
        kategori: 'SPI',
        parametreler: [{ ad: 'dataMode', imza: 'uint8_t dataMode', aciklama: 'SPI_MODE0 .. SPI_MODE3' }]
      },
      {
        ad: 'setBitOrder',
        imza: 'void setBitOrder(uint8_t bitOrder)',
        donusTipi: 'void',
        aciklama: 'SPI veri bit sırasını ayarlar.',
        snippet: 'setBitOrder(${1|MSBFIRST,LSBFIRST|})',
        kategori: 'SPI',
        parametreler: [{ ad: 'bitOrder', imza: 'uint8_t bitOrder', aciklama: 'MSBFIRST veya LSBFIRST' }]
      }
    ]
  },
  {
    ad: 'WiFi',
    aciklama: 'ESP32 / ESP8266 kablosuz ağ bağlantı nesnesi (<WiFi.h> veya <ESP8266WiFi.h> gerektirir).',
    platform: 'esp32',
    uyeler: [
      {
        ad: 'begin',
        imza: 'wl_status_t begin(const char *ssid, const char *passphrase = nullptr)',
        donusTipi: 'wl_status_t',
        aciklama: 'Belirtilen Wi-Fi ağına bağlanmayı başlatır.',
        snippet: 'begin(${1:ssid}, ${2:sifre})',
        kategori: 'WiFi',
        parametreler: [
          { ad: 'ssid', imza: 'const char *ssid', aciklama: 'Kablosuz ağ adı' },
          { ad: 'passphrase', imza: 'const char *passphrase = nullptr', aciklama: 'Ağ parolası' }
        ]
      },
      {
        ad: 'mode',
        imza: 'bool mode(wifi_mode_t m)',
        donusTipi: 'bool',
        aciklama: 'Wi-Fi çalışma modunu (WIFI_STA, WIFI_AP, WIFI_AP_STA) ayarlar.',
        snippet: 'mode(${1|WIFI_STA,WIFI_AP,WIFI_AP_STA|})',
        kategori: 'WiFi',
        parametreler: [{ ad: 'm', imza: 'wifi_mode_t m', aciklama: 'Çalışma modu sabiti' }]
      },
      { ad: 'status', imza: 'wl_status_t status()', donusTipi: 'wl_status_t', aciklama: 'Mevcut bağlantı durumunu döndürür (bağlıysa WL_CONNECTED).', snippet: 'status()', kategori: 'WiFi', parametreler: [] },
      { ad: 'localIP', imza: 'IPAddress localIP()', donusTipi: 'IPAddress', aciklama: 'Kartın ağdan aldığı IP adresini döndürür.', snippet: 'localIP()', kategori: 'WiFi', parametreler: [] },
      { ad: 'RSSI', imza: 'int32_t RSSI()', donusTipi: 'int32_t', aciklama: 'Kablosuz sinyal gücünü dBm cinsinden döndürür.', snippet: 'RSSI()', kategori: 'WiFi', parametreler: [] },
      { ad: 'macAddress', imza: 'String macAddress()', donusTipi: 'String', aciklama: 'Cihazın MAC adresini metin olarak döndürür.', snippet: 'macAddress()', kategori: 'WiFi', parametreler: [] },
      { ad: 'scanNetworks', imza: 'int16_t scanNetworks()', donusTipi: 'int16_t', aciklama: 'Çevredeki Wi-Fi ağlarını tarar ve bulunan ağ sayısını döndürür.', snippet: 'scanNetworks()', kategori: 'WiFi', parametreler: [] },
      { ad: 'SSID', imza: 'String SSID(uint8_t networkItem = 0)', donusTipi: 'String', aciklama: 'Bağlı veya taranmış ağın SSID adını döndürür.', snippet: 'SSID()', kategori: 'WiFi', parametreler: [{ ad: 'networkItem', imza: 'uint8_t networkItem = 0', aciklama: 'Tarama indeksi (isteğe bağlı)' }] },
      {
        ad: 'softAP',
        imza: 'bool softAP(const char *ssid, const char *passphrase = nullptr)',
        donusTipi: 'bool',
        aciklama: 'Kartı kendi Wi-Fi erişim noktası (Access Point) olarak başlatır.',
        snippet: 'softAP(${1:"CloudIDE-AP"}, ${2:"12345678"})',
        kategori: 'WiFi',
        parametreler: [
          { ad: 'ssid', imza: 'const char *ssid', aciklama: 'Yayınlanacak ağ adı' },
          { ad: 'passphrase', imza: 'const char *passphrase = nullptr', aciklama: 'En az 8 karakterli parola' }
        ]
      },
      { ad: 'disconnect', imza: 'bool disconnect(bool wifioff = false)', donusTipi: 'bool', aciklama: 'Aktif Wi-Fi bağlantısını keser.', snippet: 'disconnect()', kategori: 'WiFi', parametreler: [{ ad: 'wifioff', imza: 'bool wifioff = false', aciklama: 'true ise radyoyu kapatır' }] }
    ]
  },
  {
    ad: 'EEPROM',
    aciklama: 'Kalıcı belleğe (EEPROM/Flash) ayar ve küçük veri kaydetme nesnesi (<EEPROM.h>).',
    uyeler: [
      { ad: 'begin', imza: 'bool begin(size_t size)', donusTipi: 'bool', aciklama: 'ESP32/ESP8266 için ayrılacak EEPROM boyutunu (bayt) başlatır.', snippet: 'begin(${1:512})', kategori: 'EEPROM', parametreler: [{ ad: 'size', imza: 'size_t size', aciklama: 'Bayt cinsinden boyut' }] },
      { ad: 'read', imza: 'uint8_t read(int address)', donusTipi: 'uint8_t', aciklama: 'Belirtilen adresteki 1 baytlık veriyi okur.', snippet: 'read(${1:0})', kategori: 'EEPROM', parametreler: [{ ad: 'address', imza: 'int address', aciklama: 'Bellek adresi' }] },
      {
        ad: 'write',
        imza: 'void write(int address, uint8_t val)',
        donusTipi: 'void',
        aciklama: 'Belirtilen adrese 1 bayt veri yazar (ESP kartlarında sonrasında commit() gerekir).',
        snippet: 'write(${1:0}, ${2:deger})',
        kategori: 'EEPROM',
        parametreler: [
          { ad: 'address', imza: 'int address', aciklama: 'Bellek adresi' },
          { ad: 'val', imza: 'uint8_t val', aciklama: 'Yazılacak bayt (0–255)' }
        ]
      },
      {
        ad: 'update',
        imza: 'void update(int address, uint8_t val)',
        donusTipi: 'void',
        aciklama: 'Değer gerçekten farklıysa EEPROM’a yazar (yazma ömrünü korur).',
        snippet: 'update(${1:0}, ${2:deger})',
        kategori: 'EEPROM',
        parametreler: [
          { ad: 'address', imza: 'int address', aciklama: 'Bellek adresi' },
          { ad: 'val', imza: 'uint8_t val', aciklama: 'Yeni değer' }
        ]
      },
      {
        ad: 'put',
        imza: 'const T &put(int idx, const T &t)',
        donusTipi: 'const T &',
        aciklama: 'Herhangi bir veri tipini veya struct yapısını EEPROM’a yazar.',
        snippet: 'put(${1:0}, ${2:veri})',
        kategori: 'EEPROM',
        parametreler: [
          { ad: 'idx', imza: 'int idx', aciklama: 'Başlangıç adresi' },
          { ad: 't', imza: 'const T &t', aciklama: 'Kaydedilecek değişken' }
        ]
      },
      {
        ad: 'get',
        imza: 'T &get(int idx, T &t)',
        donusTipi: 'T &',
        aciklama: 'EEPROM’dan herhangi bir veri tipini veya struct yapısını okur.',
        snippet: 'get(${1:0}, ${2:veri})',
        kategori: 'EEPROM',
        parametreler: [
          { ad: 'idx', imza: 'int idx', aciklama: 'Başlangıç adresi' },
          { ad: 't', imza: 'T &t', aciklama: 'Hedef değişken' }
        ]
      },
      { ad: 'commit', imza: 'bool commit()', donusTipi: 'bool', aciklama: 'ESP32/ESP8266 üzerinde tamponlanan EEPROM değişikliklerini kalıcı belleğe yazar.', snippet: 'commit()', kategori: 'EEPROM', parametreler: [] },
      { ad: 'end', imza: 'void end()', donusTipi: 'void', aciklama: 'EEPROM oturumunu kapatır ve belleği serbest bırakır.', snippet: 'end()', kategori: 'EEPROM', parametreler: [] },
      { ad: 'length', imza: 'uint16_t length()', donusTipi: 'uint16_t', aciklama: 'Kullanılabilir toplam EEPROM bayt kapasitesini döndürür.', snippet: 'length()', kategori: 'EEPROM', parametreler: [] }
    ]
  },
  {
    ad: 'ESP',
    aciklama: 'ESP32 / ESP8266 sistem, bellek ve yeniden başlatma bilgilerine erişim nesnesi.',
    platform: 'esp32',
    uyeler: [
      { ad: 'restart', imza: 'void restart()', donusTipi: 'void', aciklama: 'Mikrodenetleyiciyi yazılımsal olarak yeniden başlatır.', snippet: 'restart()', kategori: 'ESP', parametreler: [] },
      { ad: 'deepSleep', imza: 'void deepSleep(uint64_t time_us)', donusTipi: 'void', aciklama: 'Belirtilen mikrosaniye süresince derin uyku moduna geçer.', snippet: 'deepSleep(${1:10000000})', kategori: 'ESP', parametreler: [{ ad: 'time_us', imza: 'uint64_t time_us', aciklama: 'Uyku süresi (mikrosaniye)' }] },
      { ad: 'getFreeHeap', imza: 'uint32_t getFreeHeap()', donusTipi: 'uint32_t', aciklama: 'Kullanılabilir boş RAM (heap) boyutunu bayt cinsinden döndürür.', snippet: 'getFreeHeap()', kategori: 'ESP', parametreler: [] },
      { ad: 'getHeapSize', imza: 'uint32_t getHeapSize()', donusTipi: 'uint32_t', aciklama: 'Toplam heap RAM boyutunu bayt cinsinden döndürür.', snippet: 'getHeapSize()', kategori: 'ESP', parametreler: [] },
      { ad: 'getMinFreeHeap', imza: 'uint32_t getMinFreeHeap()', donusTipi: 'uint32_t', aciklama: 'Açılıştan beri görülen en düşük boş RAM miktarını döndürür.', snippet: 'getMinFreeHeap()', kategori: 'ESP', parametreler: [] },
      { ad: 'getChipModel', imza: 'const char *getChipModel()', donusTipi: 'const char *', aciklama: 'Çip model adını (ör. ESP32-S3, ESP32-C3) döndürür.', snippet: 'getChipModel()', kategori: 'ESP', parametreler: [] },
      { ad: 'getChipRevision', imza: 'uint8_t getChipRevision()', donusTipi: 'uint8_t', aciklama: 'Silikon revizyon numarasını döndürür.', snippet: 'getChipRevision()', kategori: 'ESP', parametreler: [] },
      { ad: 'getCpuFreqMHz', imza: 'uint32_t getCpuFreqMHz()', donusTipi: 'uint32_t', aciklama: 'İşlemci çalışma frekansını MHz olarak döndürür.', snippet: 'getCpuFreqMHz()', kategori: 'ESP', parametreler: [] },
      { ad: 'getFlashChipSize', imza: 'uint32_t getFlashChipSize()', donusTipi: 'uint32_t', aciklama: 'Flash bellek kapasitesini bayt cinsinden döndürür.', snippet: 'getFlashChipSize()', kategori: 'ESP', parametreler: [] },
      { ad: 'getSdkVersion', imza: 'const char *getSdkVersion()', donusTipi: 'const char *', aciklama: 'Altta çalışan ESP-IDF SDK sürümünü döndürür.', snippet: 'getSdkVersion()', kategori: 'ESP', parametreler: [] },
      { ad: 'getEfuseMac', imza: 'uint64_t getEfuseMac()', donusTipi: 'uint64_t', aciklama: 'Fabrika çıkışı benzersiz eFuse MAC kimliğini döndürür.', snippet: 'getEfuseMac()', kategori: 'ESP', parametreler: [] }
    ]
  },

  // ── Yerleşik Sınıflar (Değişken tipi çözümlemesi için) ──
  {
    ad: 'String',
    aciklama: 'Arduino yerleşik dinamik metin (karakter katarı) sınıfı.',
    sinifMi: true,
    uyeler: [
      { ad: 'length', imza: 'unsigned int length() const', donusTipi: 'unsigned int', aciklama: 'Metnin karakter sayısını döndürür.', snippet: 'length()', kategori: 'String', parametreler: [] },
      { ad: 'charAt', imza: 'char charAt(unsigned int index) const', donusTipi: 'char', aciklama: 'Belirtilen konumdaki karakteri döndürür.', snippet: 'charAt(${1:0})', kategori: 'String', parametreler: [{ ad: 'index', imza: 'unsigned int index', aciklama: 'Sıfır tabanlı konum' }] },
      {
        ad: 'setCharAt',
        imza: 'void setCharAt(unsigned int index, char c)',
        donusTipi: 'void',
        aciklama: 'Belirtilen konumdaki karakteri yenisiyle değiştirir.',
        snippet: "setCharAt(${1:0}, '${2:a}')",
        kategori: 'String',
        parametreler: [
          { ad: 'index', imza: 'unsigned int index', aciklama: 'Konum' },
          { ad: 'c', imza: 'char c', aciklama: 'Yeni karakter' }
        ]
      },
      {
        ad: 'indexOf',
        imza: 'int indexOf(const String &str, unsigned int fromIndex = 0) const',
        donusTipi: 'int',
        aciklama: 'Alt metnin ilk geçtiği indeksi bulur; bulunamazsa -1 döner.',
        snippet: 'indexOf(${1:aranan})',
        kategori: 'String',
        parametreler: [
          { ad: 'str', imza: 'const String &str', aciklama: 'Aranacak alt metin veya karakter' },
          { ad: 'fromIndex', imza: 'unsigned int fromIndex = 0', aciklama: 'Aramanın başlayacağı konum' }
        ]
      },
      {
        ad: 'lastIndexOf',
        imza: 'int lastIndexOf(const String &str) const',
        donusTipi: 'int',
        aciklama: 'Alt metnin sondan ilk geçtiği indeksi bulur.',
        snippet: 'lastIndexOf(${1:aranan})',
        kategori: 'String',
        parametreler: [{ ad: 'str', imza: 'const String &str', aciklama: 'Aranacak alt metin' }]
      },
      {
        ad: 'substring',
        imza: 'String substring(unsigned int beginIndex, unsigned int endIndex) const',
        donusTipi: 'String',
        aciklama: 'Belirtilen aralıktaki alt metni yeni String olarak döndürür.',
        snippet: 'substring(${1:0}, ${2:5})',
        kategori: 'String',
        parametreler: [
          { ad: 'beginIndex', imza: 'unsigned int beginIndex', aciklama: 'Başlangıç indeksi' },
          { ad: 'endIndex', imza: 'unsigned int endIndex', aciklama: 'Bitiş indeksi (hariç)' }
        ]
      },
      {
        ad: 'startsWith',
        imza: 'unsigned char startsWith(const String &prefix) const',
        donusTipi: 'unsigned char',
        aciklama: 'Metnin verilen ön ek ile başlayıp başlamadığını kontrol eder.',
        snippet: 'startsWith(${1:"onek"})',
        kategori: 'String',
        parametreler: [{ ad: 'prefix', imza: 'const String &prefix', aciklama: 'Ön ek' }]
      },
      {
        ad: 'endsWith',
        imza: 'unsigned char endsWith(const String &suffix) const',
        donusTipi: 'unsigned char',
        aciklama: 'Metnin verilen son ek ile bitip bitmediğini kontrol eder.',
        snippet: 'endsWith(${1:"sonek"})',
        kategori: 'String',
        parametreler: [{ ad: 'suffix', imza: 'const String &suffix', aciklama: 'Son ek' }]
      },
      { ad: 'equals', imza: 'unsigned char equals(const String &s) const', donusTipi: 'unsigned char', aciklama: 'Büyük/küçük harfe duyarlı eşitlik kontrolü yapar.', snippet: 'equals(${1:diger})', kategori: 'String', parametreler: [{ ad: 's', imza: 'const String &s', aciklama: 'Karşılaştırılacak metin' }] },
      { ad: 'equalsIgnoreCase', imza: 'unsigned char equalsIgnoreCase(const String &s) const', donusTipi: 'unsigned char', aciklama: 'Büyük/küçük harfi yok sayarak eşitlik kontrolü yapar.', snippet: 'equalsIgnoreCase(${1:diger})', kategori: 'String', parametreler: [{ ad: 's', imza: 'const String &s', aciklama: 'Karşılaştırılacak metin' }] },
      { ad: 'compareTo', imza: 'int compareTo(const String &s) const', donusTipi: 'int', aciklama: 'İki metni alfabetik (ASCII) sıraya göre karşılaştırır.', snippet: 'compareTo(${1:diger})', kategori: 'String', parametreler: [{ ad: 's', imza: 'const String &s', aciklama: 'Karşılaştırılacak metin' }] },
      { ad: 'concat', imza: 'unsigned char concat(const String &str)', donusTipi: 'unsigned char', aciklama: 'Metnin sonuna başka bir metin ekler.', snippet: 'concat(${1:ek})', kategori: 'String', parametreler: [{ ad: 'str', imza: 'const String &str', aciklama: 'Eklenecek değer' }] },
      {
        ad: 'replace',
        imza: 'void replace(const String &find, const String &replace)',
        donusTipi: 'void',
        aciklama: 'Geçen tüm eşleşmeleri yeni metinle değiştirir.',
        snippet: 'replace(${1:eski}, ${2:yeni})',
        kategori: 'String',
        parametreler: [
          { ad: 'find', imza: 'const String &find', aciklama: 'Değiştirilecek parça' },
          { ad: 'replace', imza: 'const String &replace', aciklama: 'Yeni parça' }
        ]
      },
      {
        ad: 'remove',
        imza: 'void remove(unsigned int index, unsigned int count = 1)',
        donusTipi: 'void',
        aciklama: 'Belirtilen konumdan itibaren karakter siler.',
        snippet: 'remove(${1:0}, ${2:1})',
        kategori: 'String',
        parametreler: [
          { ad: 'index', imza: 'unsigned int index', aciklama: 'Başlangıç indeksi' },
          { ad: 'count', imza: 'unsigned int count = 1', aciklama: 'Silinecek karakter sayısı' }
        ]
      },
      { ad: 'trim', imza: 'void trim()', donusTipi: 'void', aciklama: 'Baştaki ve sondaki boşluk/yeni satır karakterlerini temizler.', snippet: 'trim()', kategori: 'String', parametreler: [] },
      { ad: 'toLowerCase', imza: 'void toLowerCase()', donusTipi: 'void', aciklama: 'Tüm harfleri küçük harfe dönüştürür.', snippet: 'toLowerCase()', kategori: 'String', parametreler: [] },
      { ad: 'toUpperCase', imza: 'void toUpperCase()', donusTipi: 'void', aciklama: 'Tüm harfleri büyük harfe dönüştürür.', snippet: 'toUpperCase()', kategori: 'String', parametreler: [] },
      { ad: 'toInt', imza: 'long toInt() const', donusTipi: 'long', aciklama: 'Metni tamsayıya (long) dönüştürür.', snippet: 'toInt()', kategori: 'String', parametreler: [] },
      { ad: 'toFloat', imza: 'float toFloat() const', donusTipi: 'float', aciklama: 'Metni ondalıklı sayıya (float) dönüştürür.', snippet: 'toFloat()', kategori: 'String', parametreler: [] },
      { ad: 'toDouble', imza: 'double toDouble() const', donusTipi: 'double', aciklama: 'Metni çift duyarlıklı sayıya (double) dönüştürür.', snippet: 'toDouble()', kategori: 'String', parametreler: [] },
      { ad: 'c_str', imza: 'const char *c_str() const', donusTipi: 'const char *', aciklama: 'C tarzı null sonlu const char* işaretçisi döndürür.', snippet: 'c_str()', kategori: 'String', parametreler: [] },
      { ad: 'isEmpty', imza: 'bool isEmpty() const', donusTipi: 'bool', aciklama: 'Metnin boş olup olmadığını döndürür.', snippet: 'isEmpty()', kategori: 'String', parametreler: [] },
      { ad: 'reserve', imza: 'unsigned char reserve(unsigned int size)', donusTipi: 'unsigned char', aciklama: 'Bellek parçalanmasını azaltmak için önceden yer ayırır.', snippet: 'reserve(${1:64})', kategori: 'String', parametreler: [{ ad: 'size', imza: 'unsigned int size', aciklama: 'Ayrılacak bayt miktarı' }] }
    ]
  },
  {
    ad: 'Servo',
    aciklama: 'Standart hobi servo motorlarını açı veya darbe süresiyle sürme sınıfı (<Servo.h>).',
    sinifMi: true,
    uyeler: [
      { ad: 'attach', imza: 'uint8_t attach(int pin)', donusTipi: 'uint8_t', aciklama: 'Servo nesnesini belirtilen PWM/dijital pine bağlar.', snippet: 'attach(${1:9})', kategori: 'Servo', parametreler: [{ ad: 'pin', imza: 'int pin', aciklama: 'Servo sinyal pini' }] },
      { ad: 'detach', imza: 'void detach()', donusTipi: 'void', aciklama: 'Servonun pin bağlantısını ayırır.', snippet: 'detach()', kategori: 'Servo', parametreler: [] },
      { ad: 'write', imza: 'void write(int value)', donusTipi: 'void', aciklama: 'Servoyu hedef açıya (0°–180°) döndürür.', snippet: 'write(${1:90})', kategori: 'Servo', parametreler: [{ ad: 'value', imza: 'int value', aciklama: 'Hedef açı (0–180)' }] },
      { ad: 'writeMicroseconds', imza: 'void writeMicroseconds(int value)', donusTipi: 'void', aciklama: 'Servoyu mikrosaniye cinsinden darbe genişliğiyle (genelde 1000–2000) sürer.', snippet: 'writeMicroseconds(${1:1500})', kategori: 'Servo', parametreler: [{ ad: 'value', imza: 'int value', aciklama: 'Darbe süresi (µs)' }] },
      { ad: 'read', imza: 'int read()', donusTipi: 'int', aciklama: 'Son ayarlanan açı değerini (0–180) döndürür.', snippet: 'read()', kategori: 'Servo', parametreler: [] },
      { ad: 'attached', imza: 'bool attached()', donusTipi: 'bool', aciklama: 'Servonun bir pine bağlı olup olmadığını döndürür.', snippet: 'attached()', kategori: 'Servo', parametreler: [] }
    ]
  },
  {
    ad: 'SoftwareSerial',
    aciklama: 'Herhangi iki dijital pini yazılımsal seri port (UART) olarak kullanma sınıfı.',
    sinifMi: true,
    uyeler: [
      { ad: 'begin', imza: 'void begin(long speed)', donusTipi: 'void', aciklama: 'Yazılımsal seri portu verilen baud hızında başlatır.', snippet: 'begin(${1:9600})', kategori: 'SoftwareSerial', parametreler: [{ ad: 'speed', imza: 'long speed', aciklama: 'Baud hızı' }] },
      { ad: 'listen', imza: 'bool listen()', donusTipi: 'bool', aciklama: 'Birden fazla SoftwareSerial portu varsa bu portu dinlemeye alır.', snippet: 'listen()', kategori: 'SoftwareSerial', parametreler: [] },
      { ad: 'isListening', imza: 'bool isListening()', donusTipi: 'bool', aciklama: 'Bu portun şu anda dinlenip dinlenmediğini döndürür.', snippet: 'isListening()', kategori: 'SoftwareSerial', parametreler: [] },
      { ad: 'available', imza: 'int available()', donusTipi: 'int', aciklama: 'Okunmayı bekleyen bayt sayısını döndürür.', snippet: 'available()', kategori: 'SoftwareSerial', parametreler: [] },
      { ad: 'read', imza: 'int read()', donusTipi: 'int', aciklama: 'Gelen veriden bir bayt okur.', snippet: 'read()', kategori: 'SoftwareSerial', parametreler: [] },
      { ad: 'peek', imza: 'int peek()', donusTipi: 'int', aciklama: 'Tampondaki sonraki baytı silmeden okur.', snippet: 'peek()', kategori: 'SoftwareSerial', parametreler: [] },
      { ad: 'print', imza: 'size_t print(const T &val)', donusTipi: 'size_t', aciklama: 'Veriyi satır sonu olmadan gönderir.', snippet: 'print(${1:"veri"})', kategori: 'SoftwareSerial', parametreler: [{ ad: 'val', imza: 'const T &val', aciklama: 'Gönderilecek değer' }] },
      { ad: 'println', imza: 'size_t println(const T &val)', donusTipi: 'size_t', aciklama: 'Veriyi yeni satır karakteriyle gönderir.', snippet: 'println(${1:"veri"})', kategori: 'SoftwareSerial', parametreler: [{ ad: 'val', imza: 'const T &val', aciklama: 'Gönderilecek değer' }] },
      { ad: 'write', imza: 'size_t write(uint8_t byte)', donusTipi: 'size_t', aciklama: 'Ham bayt gönderir.', snippet: 'write(${1:b})', kategori: 'SoftwareSerial', parametreler: [{ ad: 'byte', imza: 'uint8_t byte', aciklama: 'Gönderilecek bayt' }] },
      { ad: 'flush', imza: 'void flush()', donusTipi: 'void', aciklama: 'Alım tamponunu sıfırlar.', snippet: 'flush()', kategori: 'SoftwareSerial', parametreler: [] },
      { ad: 'end', imza: 'void end()', donusTipi: 'void', aciklama: 'Yazılımsal seri iletişimi kapatır.', snippet: 'end()', kategori: 'SoftwareSerial', parametreler: [] }
    ]
  }
]

export const ARDUINO_SABITLERI: ApiSabitKaydi[] = [
  { ad: 'HIGH', tur: 'sabit', deger: '1', aciklama: 'Yüksek lojik seviye (5V veya 3.3V).' },
  { ad: 'LOW', tur: 'sabit', deger: '0', aciklama: 'Düşük lojik seviye (0V / GND).' },
  { ad: 'INPUT', tur: 'sabit', deger: '0x0', aciklama: 'Pin modu: yüksek empedanslı dijital giriş.' },
  { ad: 'OUTPUT', tur: 'sabit', deger: '0x1', aciklama: 'Pin modu: dijital çıkış.' },
  { ad: 'INPUT_PULLUP', tur: 'sabit', deger: '0x2', aciklama: 'Dahili pull-up direnci etkin giriş (boşta HIGH okunur).' },
  { ad: 'INPUT_PULLDOWN', tur: 'sabit', deger: '0x09', aciklama: 'Dahili pull-down direnci etkin giriş (ESP32).' , platform: 'esp32' },
  { ad: 'LED_BUILTIN', tur: 'sabit', aciklama: 'Kart üzerindeki dahili LED’in bağlı olduğu pin numarası.' },
  { ad: 'RISING', tur: 'sabit', aciklama: 'Kesme tetikleme: sinyal LOW’dan HIGH’a geçerken.' },
  { ad: 'FALLING', tur: 'sabit', aciklama: 'Kesme tetikleme: sinyal HIGH’dan LOW’a düşerken.' },
  { ad: 'CHANGE', tur: 'sabit', aciklama: 'Kesme tetikleme: sinyal seviyesi her değiştiğinde.' },
  { ad: 'MSBFIRST', tur: 'sabit', aciklama: 'En yüksek anlamlı bit (MSB) önce gönderilir/okunur.' },
  { ad: 'LSBFIRST', tur: 'sabit', aciklama: 'En düşük anlamlı bit (LSB) önce gönderilir/okunur.' },
  { ad: 'DEC', tur: 'sabit', deger: '10', aciklama: 'Serial.print() için onluk taban biçimi.' },
  { ad: 'HEX', tur: 'sabit', deger: '16', aciklama: 'Serial.print() için onaltılık (hexadecimal) taban biçimi.' },
  { ad: 'OCT', tur: 'sabit', deger: '8', aciklama: 'Serial.print() için sekizlik taban biçimi.' },
  { ad: 'BIN', tur: 'sabit', deger: '2', aciklama: 'Serial.print() için ikilik (binary) taban biçimi.' },
  { ad: 'PROGMEM', tur: 'makro', aciklama: 'Sabit dizileri RAM yerine Flash (program) belleğinde saklar.' },
  { ad: 'IRAM_ATTR', tur: 'makro', aciklama: 'ESP32 kesme (ISR) fonksiyonunu hızlı dahili RAM’e yerleştirir.', platform: 'esp32' },
  { ad: 'WL_CONNECTED', tur: 'sabit', aciklama: 'WiFi.status() için ağa başarıyla bağlanıldığını gösteren durum sabiti.', platform: 'esp32' },
  { ad: 'WIFI_STA', tur: 'sabit', aciklama: 'Wi-Fi istemci (Station) modu; mevcut bir modeme bağlanır.', platform: 'esp32' },
  { ad: 'WIFI_AP', tur: 'sabit', aciklama: 'Wi-Fi erişim noktası (Access Point) modu; kendi ağını kurar.', platform: 'esp32' },
  { ad: 'WIFI_AP_STA', tur: 'sabit', aciklama: 'Hem erişim noktası hem istemci (çift) Wi-Fi modu.', platform: 'esp32' },
  { ad: 'F', tur: 'makro', snippet: 'F("${1:metin}")', aciklama: 'Sabit metni RAM tüketmeden doğrudan Flash bellekten yazdırır.' },
  { ad: 'uint8_t', tur: 'tip', aciklama: 'İşaretsiz 8 bit tamsayı (0 – 255).' },
  { ad: 'uint16_t', tur: 'tip', aciklama: 'İşaretsiz 16 bit tamsayı (0 – 65535).' },
  { ad: 'uint32_t', tur: 'tip', aciklama: 'İşaretsiz 32 bit tamsayı.' },
  { ad: 'int8_t', tur: 'tip', aciklama: 'İşaretli 8 bit tamsayı (-128 – 127).' },
  { ad: 'int16_t', tur: 'tip', aciklama: 'İşaretli 16 bit tamsayı (-32768 – 32767).' },
  { ad: 'int32_t', tur: 'tip', aciklama: 'İşaretli 32 bit tamsayı.' },
  { ad: 'byte', tur: 'tip', aciklama: 'İşaretsiz 8 bit tamsayı (uint8_t ile eşdeğer).' },
  { ad: 'boolean', tur: 'tip', aciklama: 'Mantıksal doğru/yanlış (true/false) veri tipi.' },
  { ad: 'String', tur: 'tip', aciklama: 'Dinamik karakter dizisi (metin) sınıfı.' },
  { ad: 'unsigned long', tur: 'tip', aciklama: '32 bit işaretsiz tamsayı; millis() ve zamanlayıcılar için kullanılır.' }
]

export const ARDUINO_SNIPPETLERI: ApiSnippetKaydi[] = [
  {
    etiket: 'setup',
    baslik: 'setup() başlangıç fonksiyonu',
    aciklama: 'Kart açıldığında veya sıfırlandığında bir kez çalışan setup() bloğu.',
    snippet: 'void setup() {\n  ${1}\n}'
  },
  {
    etiket: 'loop',
    baslik: 'loop() ana döngü',
    aciklama: 'setup() tamamlandıktan sonra sürekli tekrarlanan ana program döngüsü.',
    snippet: 'void loop() {\n  ${1}\n}'
  },
  {
    etiket: 'millis_zamanlayici',
    baslik: 'millis() ile bloklamayan zamanlayıcı',
    aciklama: 'delay() kullanmadan belirli aralıklarla görev çalıştıran zamanlayıcı kalıbı.',
    snippet:
      'static unsigned long sonZaman = 0;\nif (millis() - sonZaman >= ${1:1000}) {\n  sonZaman = millis();\n  ${2:// Periyodik işlem}\n}'
  },
  {
    etiket: 'seri_baslat',
    baslik: 'Seri haberleşme başlatma',
    aciklama: 'Serial.begin() ile seri portu başlatır ve karşılama mesajı yazar.',
    snippet: 'Serial.begin(${1|115200,9600|});\nSerial.println("${2:Sistem hazir}");'
  },
  {
    etiket: 'pin_cikis',
    baslik: 'Dijital çıkış pin tanımı',
    aciklama: 'Bir pini OUTPUT yapar ve başlangıçta LOW seviyesine çeker.',
    snippet: 'pinMode(${1:pin}, OUTPUT);\ndigitalWrite(${1:pin}, ${2|LOW,HIGH|});'
  },
  {
    etiket: 'pin_giris',
    baslik: 'Pull-up buton girişi',
    aciklama: 'Bir pini dahili pull-up direnciyle INPUT_PULLUP olarak yapılandırır.',
    snippet: 'pinMode(${1:butonPin}, INPUT_PULLUP);'
  },
  {
    etiket: 'for_dongu',
    baslik: 'for sayaç döngüsü',
    aciklama: 'Belirli sayıda tekrar eden standart C/C++ for döngüsü.',
    snippet: 'for (int ${1:i} = 0; ${1:i} < ${2:10}; ${1:i}++) {\n  ${3}\n}'
  },
  {
    etiket: 'wifi_baglan',
    baslik: 'ESP32 Wi-Fi bağlantı kalıbı',
    aciklama: 'WiFi.begin() çağrısından sonra WL_CONNECTED olana kadar bekleyen kalıp.',
    snippet:
      'WiFi.mode(WIFI_STA);\nWiFi.begin(${1:ssid}, ${2:sifre});\nwhile (WiFi.status() != WL_CONNECTED) {\n  delay(500);\n  Serial.print(".");\n}\nSerial.println(WiFi.localIP());',
    platform: 'esp32'
  }
]

export const STANDART_BASLIKLAR: StandartBaslikKaydi[] = [
  { baslik: 'Arduino.h', aciklama: 'Çekirdek Arduino fonksiyonları, tipleri ve sabitleri' },
  { baslik: 'Wire.h', aciklama: 'I2C / TWI haberleşme kütüphanesi (SDA / SCL)' },
  { baslik: 'SPI.h', aciklama: 'SPI donanım veriyolu haberleşme kütüphanesi' },
  { baslik: 'EEPROM.h', aciklama: 'Kalıcı EEPROM / Flash bellek okuma ve yazma' },
  { baslik: 'Servo.h', aciklama: 'Standart hobi servo motor kontrol kütüphanesi' },
  { baslik: 'SoftwareSerial.h', aciklama: 'Dijital pinler üzerinde yazılımsal seri port' },
  { baslik: 'WiFi.h', aciklama: 'ESP32 Wi-Fi ağ bağlantısı ve soket API', platform: 'esp32' },
  { baslik: 'WebServer.h', aciklama: 'ESP32 yerleşik HTTP web sunucusu', platform: 'esp32' },
  { baslik: 'HTTPClient.h', aciklama: 'ESP32 HTTP GET/POST istemci kütüphanesi', platform: 'esp32' },
  { baslik: 'Preferences.h', aciklama: 'ESP32 NVS kalıcı anahtar-değer deposu', platform: 'esp32' },
  { baslik: 'ESP8266WiFi.h', aciklama: 'ESP8266 Wi-Fi ağ bağlantı kütüphanesi', platform: 'esp8266' },
  { baslik: 'BluetoothSerial.h', aciklama: 'ESP32 klasik Bluetooth SPP seri haberleşme', platform: 'esp32' },
  { baslik: 'FS.h', aciklama: 'ESP32 / ESP8266 dosya sistemi temel API', platform: 'esp32' },
  { baslik: 'SD.h', aciklama: 'SPI üzerinden microSD kart okuma ve yazma' },
  { baslik: 'math.h', aciklama: 'Standart C trigonometri ve matematik fonksiyonları' }
]

/** Seçili kartın FQBN bilgisine göre kullanılabilir pin ve veriyolu takma adlarını üretir. */
export function kartPinSabitleri(fqbn?: string | null): ApiSabitKaydi[] {
  if (!fqbn) return []
  const temiz = fqbn.toLowerCase()
  const [, arch = '', varyant = ''] = temiz.split(':')

  const ekleAnalog = (adet: number): ApiSabitKaydi[] =>
    Array.from({ length: adet }, (_, i) => ({
      ad: `A${i}`,
      tur: 'pin' as const,
      aciklama: `Kartın A${i} analog giriş pini.`
    }))

  const ortakI2cSpi: ApiSabitKaydi[] = [
    { ad: 'SDA', tur: 'pin', aciklama: 'Varsayılan I2C veri pini.' },
    { ad: 'SCL', tur: 'pin', aciklama: 'Varsayılan I2C saat pini.' },
    { ad: 'SS', tur: 'pin', aciklama: 'Varsayılan SPI çip seçim (CS/SS) pini.' },
    { ad: 'MOSI', tur: 'pin', aciklama: 'Varsayılan SPI veri çıkış pini.' },
    { ad: 'MISO', tur: 'pin', aciklama: 'Varsayılan SPI veri giriş pini.' },
    { ad: 'SCK', tur: 'pin', aciklama: 'Varsayılan SPI saat pini.' }
  ]

  if (arch === 'avr') {
    if (varyant.startsWith('mega')) {
      return [...ekleAnalog(16), ...ortakI2cSpi]
    }
    const adet = varyant.startsWith('nano') || varyant.startsWith('mini') ? 8 : 6
    return [...ekleAnalog(adet), ...ortakI2cSpi]
  }

  if (arch === 'esp8266' || temiz.includes('esp8266')) {
    return [
      ...Array.from({ length: 9 }, (_, i) => ({
        ad: `D${i}`,
        tur: 'pin' as const,
        aciklama: `NodeMCU / Wemos D1 dijital pin D${i}.`
      })),
      ...ekleAnalog(1),
      ...ortakI2cSpi,
      { ad: 'TX', tur: 'pin', aciklama: 'UART gönderim pini.' },
      { ad: 'RX', tur: 'pin', aciklama: 'UART alım pini.' }
    ]
  }

  if (temiz.includes('deneyap') || arch === 'esp32') {
    const baz: ApiSabitKaydi[] = [
      ...ortakI2cSpi,
      { ad: 'TX', tur: 'pin', aciklama: 'Varsayılan UART TX pini.' },
      { ad: 'RX', tur: 'pin', aciklama: 'Varsayılan UART RX pini.' },
      { ad: 'DAC1', tur: 'pin', aciklama: 'ESP32 analog çıkış pini DAC1 (GPIO 25).' },
      { ad: 'DAC2', tur: 'pin', aciklama: 'ESP32 analog çıkış pini DAC2 (GPIO 26).' },
      ...Array.from({ length: 10 }, (_, i) => ({
        ad: `T${i}`,
        tur: 'pin' as const,
        aciklama: `ESP32 kapasitif dokunmatik algılama kanalı T${i}.`
      }))
    ]
    if (temiz.includes('deneyap')) {
      return [
        ...Array.from({ length: 16 }, (_, i) => ({
          ad: `D${i}`,
          tur: 'pin' as const,
          aciklama: `Deneyap Kart dijital pin D${i}.`
        })),
        ...ekleAnalog(6),
        ...baz
      ]
    }
    return baz
  }

  return [...ekleAnalog(6), ...ortakI2cSpi]
}

export function avrKartMi(fqbn?: string | null): boolean {
  if (!fqbn) return false
  return fqbn.toLowerCase().includes(':avr:')
}
