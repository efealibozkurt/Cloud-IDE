import { describe, expect, it } from 'vitest'
import { baglantiKilavuzuDogrula, koddanBaglantiCikar } from './baglantiKilavuzu'

describe('koddanBaglantiCikar', () => {
  it('basit Blink kodundan dahili LED bağlantısını çıkarır', () => {
    const kod = `void setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n}`
    const k = koddanBaglantiCikar([{ dosya: 'blink.ino', icerik: kod }], 'arduino:avr:uno')

    expect(k.kartAdi).toBe('Arduino Uno')
    expect(k.mantikVoltaj).toBe('5V')
    expect(k.baglantilar.some((b) => b.kartPini === 'D13')).toBe(true)
  })

  it('DHT ve I2C OLED kodunda Uno ve ESP32 için doğru I2C pinlerini seçer', () => {
    const kod = `
#include <DHT.h>
#include <Adafruit_SSD1306.h>
#define DHTPIN 4
DHT dht(DHTPIN, DHT11);
void setup() {}
void loop() {}
`
    const uno = koddanBaglantiCikar([{ dosya: 'a.ino', icerik: kod }], 'arduino:avr:uno')
    expect(uno.baglantilar.some((b) => b.bilesen.includes('DHT') && b.bilesenPini === 'DATA' && b.kartPini === 'D4')).toBe(true)
    expect(uno.baglantilar.some((b) => b.bilesen.includes('OLED') && b.bilesenPini === 'SDA' && b.kartPini.includes('A4'))).toBe(true)
    expect(uno.baglantilar.some((b) => b.bilesen.includes('OLED') && b.bilesenPini === 'SCL' && b.kartPini.includes('A5'))).toBe(true)

    const esp = koddanBaglantiCikar([{ dosya: 'a.ino', icerik: kod }], 'esp32:esp32:esp32')
    expect(esp.mantikVoltaj).toBe('3.3V')
    expect(esp.baglantilar.some((b) => b.bilesen.includes('OLED') && b.bilesenPini === 'SDA' && b.kartPini.includes('GPIO21'))).toBe(true)
    expect(esp.baglantilar.some((b) => b.bilesen.includes('OLED') && b.bilesenPini === 'SCL' && b.kartPini.includes('GPIO22'))).toBe(true)
  })

  it('ESP32 üzerinde HC-SR04 için 3.3V ECHO gerilim bölücü uyarısı ekler', () => {
    const kod = `
const int TRIG_PIN = 5;
const int ECHO_PIN = 18;
void setup() { pinMode(TRIG_PIN, OUTPUT); pinMode(ECHO_PIN, INPUT); }
void loop() { pulseIn(ECHO_PIN, HIGH); }
`
    const k = koddanBaglantiCikar([{ dosya: 'mesafe.ino', icerik: kod }], 'esp32:esp32:esp32')
    expect(k.bilesenler.some((b) => b.ad.includes('HC-SR04'))).toBe(true)
    expect(k.uyarilar.some((u) => u.seviye === 'dikkat' && u.mesaj.includes('gerilim bölücü'))).toBe(true)
  })

  it('Servo ve NeoPixel için güç/direnç bilgilerini ve pin denetimi hatalarını içerir', () => {
    const kod = `
#include <Servo.h>
#include <Adafruit_NeoPixel.h>
#define NEO_PIN 6
Servo s1;
Adafruit_NeoPixel pixels(8, NEO_PIN, NEO_GRB + NEO_KHZ800);
void setup() {
  s1.attach(9);
  pinMode(35, OUTPUT);
}
void loop() {}
`
    const k = koddanBaglantiCikar([{ dosya: 'robot.ino', icerik: kod }], 'esp32:esp32:esp32')
    expect(k.bilesenler.some((b) => b.ad.includes('Servo'))).toBe(true)
    expect(k.bilesenler.some((b) => b.ad.includes('NeoPixel'))).toBe(true)
    expect(k.uyarilar.some((u) => u.seviye === 'dikkat' && u.mesaj.includes('GPIO35'))).toBe(true)
    expect(k.uyarilar.some((u) => u.seviye === 'bilgi' && u.mesaj.includes('Servo'))).toBe(true)
  })

  it('aynı kod için kararlı hat kimlikleri üretir', () => {
    const kod = 'const int LED_PIN = 7;\nvoid setup() { pinMode(LED_PIN, OUTPUT); }'
    const k1 = koddanBaglantiCikar([{ dosya: 'led.ino', icerik: kod }], 'arduino:avr:uno')
    const k2 = koddanBaglantiCikar([{ dosya: 'led.ino', icerik: kod }], 'arduino:avr:uno')
    expect(k1.baglantilar.map((b) => b.id)).toEqual(k2.baglantilar.map((b) => b.id))
  })
})

describe('baglantiKilavuzuDogrula', () => {
  it('geçerli yapıyı normalize eder ve eksik renkleri otomatik atar', () => {
    const sonuc = baglantiKilavuzuDogrula(
      {
        ozet: 'LED ve buton devresi',
        bilesenler: [{ ad: 'Kırmızı LED', tur: 'Gösterge', ek_parcalar: ['220Ω direnç'] }],
        baglantilar: [
          { bilesen: 'LED', bilesen_pini: 'VCC', kart_pini: '5V' },
          { bilesen: 'LED', bilesen_pini: 'Katot', kart_pini: 'GND', renk: 'gecersiz_renk' },
          { bilesen: 'LED', bilesen_pini: 'Anot', kart_pini: 'D9', kart_pin_no: 9, renk: 'yesil' }
        ],
        uyarilar: [{ seviye: 'dikkat', mesaj: '220Ω direnç kullanın.' }],
        tamamlananlar: ['hat-1']
      },
      'Arduino Uno',
      'arduino:avr:uno'
    )

    expect(sonuc).not.toBeNull()
    expect(sonuc!.kaynak).toBe('ai')
    expect(sonuc!.mantikVoltaj).toBe('5V')
    expect(sonuc!.baglantilar[0].renk).toBe('kirmizi')
    expect(sonuc!.baglantilar[1].renk).toBe('siyah')
    expect(sonuc!.baglantilar[2].kartPinNo).toBe(9)
    expect(sonuc!.bilesenler[0].ekParcalar).toEqual(['220Ω direnç'])
    expect(sonuc!.tamamlananlar).toEqual(['hat-1'])
  })

  it('boş veya bozuk nesneyi reddeder', () => {
    expect(baglantiKilavuzuDogrula(null)).toBeNull()
    expect(baglantiKilavuzuDogrula({})).toBeNull()
    expect(baglantiKilavuzuDogrula({ baglantilar: [{ bilesen: 'Eksik' }] })).toBeNull()
  })
})
