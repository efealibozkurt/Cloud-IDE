import { describe, expect, it } from 'vitest'
import { kartProfili, pinleriDenetle, yorumlariTemizle } from './pinCheck'

const UNO = 'arduino:avr:uno'
const ESP32 = 'esp32:esp32:esp32'

function kontrol(kod: string, fqbn: string | null = UNO) {
  return pinleriDenetle([{ dosya: 'a.ino', icerik: kod }], fqbn)
}
const mesajlar = (kod: string, fqbn: string | null = UNO) => kontrol(kod, fqbn).map((s) => s.mesaj)

describe('yorumlariTemizle', () => {
  it('yorum ve metin içeriğini siler, satır numaralarını korur', () => {
    const t = yorumlariTemizle('a(); // pinMode(5)\n/* digitalWrite(6)\n*/ b("pinMode(7)");')
    expect(t).not.toContain('pinMode')
    expect(t).not.toContain('digitalWrite')
    expect(t.split('\n')).toHaveLength(3)
  })
})

describe('kartProfili', () => {
  it('bilinen kartları ayırt eder, bilinmeyeni null verir', () => {
    expect(kartProfili('arduino:avr:uno')?.ad).toBe('Arduino Uno')
    expect(kartProfili('arduino:avr:nano:cpu=atmega328')?.ad).toBe('Arduino Nano')
    expect(kartProfili('arduino:avr:mega')?.ad).toBe('Arduino Mega')
    expect(kartProfili('esp32:esp32:esp32')?.ad).toBe('ESP32')
    expect(kartProfili('esp32:esp32:esp32s3')).toBeNull() // farklı pin düzeni: kural uygulanmaz
    expect(kartProfili('esp8266:esp8266:nodemcuv2')?.ad).toBe('ESP8266')
    expect(kartProfili('rp2040:rp2040:rpipico')).toBeNull()
    expect(kartProfili(null)).toBeNull()
  })
})

describe('pin denetimi: genel kurallar', () => {
  it('temiz bir sketch için sorun üretmez', () => {
    expect(kontrol('const int led = 13;\nvoid setup(){ pinMode(led, OUTPUT); }\nvoid loop(){ digitalWrite(led, HIGH); }')).toEqual([])
  })

  it('pinMode olmadan digitalWrite uyarısı verir; döngüyle ayarlanan pinlerde vermez', () => {
    expect(mesajlar('void loop(){ digitalWrite(7, HIGH); }').join()).toMatch(/pinMode\(7, OUTPUT\)/)
    expect(kontrol('void setup(){ for(int p=2;p<9;p++) pinMode(p, OUTPUT); }\nvoid loop(){ digitalWrite(7, HIGH); }')).toEqual([])
  })

  it('#define ve const ile tanımlanan pinleri çözer, satır numarasını doğru verir', () => {
    const s = kontrol('#define LED 9\n\nvoid loop(){\n  digitalWrite(LED, HIGH);\n}')
    expect(s).toHaveLength(1)
    expect(s[0].satir).toBe(4)
    expect(s[0].pin).toBe(9)
  })

  it('yorum ve metin içindeki çağrıları yok sayar', () => {
    expect(kontrol('// digitalWrite(7, HIGH);\nconst char* m = "analogWrite(2, 5)";')).toEqual([])
  })

  it('Servo ile aynı pini başka amaçla kullanmayı yakalar', () => {
    const m = mesajlar('Servo s;\nvoid setup(){ s.attach(9); pinMode(9, OUTPUT); }')
    expect(m.some((x) => /Servo\.attach/.test(x))).toBe(true)
  })

  it('iki servoyu aynı pine bağlamayı yakalar', () => {
    const m = mesajlar('Servo a, b;\nvoid setup(){ a.attach(9); b.attach(9); }')
    expect(m.some((x) => /birden fazla Servo/.test(x))).toBe(true)
  })

  it('aynı pini hem giriş hem çıkış yapmayı not eder', () => {
    const s = kontrol('void setup(){ pinMode(4, INPUT); pinMode(4, OUTPUT); }')
    expect(s.some((x) => x.tur === 'note' && /giriş hem çıkış/.test(x.mesaj))).toBe(true)
  })
})

describe('pin denetimi: AVR', () => {
  it('kartta olmayan pini hata olarak bildirir', () => {
    expect(kontrol('void setup(){ pinMode(30, OUTPUT); }').some((s) => s.tur === 'error' && /yok/.test(s.mesaj))).toBe(true)
  })

  it('PWM olmayan pinde analogWrite uyarır, PWM pinde uyarmaz', () => {
    const kod = (p: number) => `void setup(){ pinMode(${p}, OUTPUT); }\nvoid loop(){ analogWrite(${p}, 100); }`
    expect(mesajlar(kod(4)).join()).toMatch(/PWM desteklemiyor/)
    expect(kontrol(kod(9))).toEqual([])
  })

  it('kesme pini olmayan pini hata sayar', () => {
    expect(mesajlar('void setup(){ attachInterrupt(digitalPinToInterrupt(5), f, RISING); }').join()).toMatch(/dış kesme desteklemiyor/)
    expect(kontrol('void setup(){ attachInterrupt(digitalPinToInterrupt(2), f, RISING); }')).toEqual([])
  })

  it('Serial.begin varken 0/1 pinlerini uyarır', () => {
    expect(mesajlar('void setup(){ Serial.begin(9600); pinMode(1, OUTPUT); }').join()).toMatch(/Serial \(USB\)/)
    expect(kontrol('void setup(){ pinMode(1, OUTPUT); }')).toEqual([])
  })

  it('analog takma adlarını (A0) kart pinine çevirir', () => {
    expect(kontrol('void loop(){ analogRead(A0); }')).toEqual([])
    expect(mesajlar('void loop(){ analogWrite(A0, 10); }').join()).toMatch(/Pin 14 PWM/)
  })

  it('Mega için farklı sınırları kullanır', () => {
    expect(kontrol('void setup(){ pinMode(40, OUTPUT); }', 'arduino:avr:mega')).toEqual([])
    expect(kontrol('void setup(){ attachInterrupt(digitalPinToInterrupt(18), f, FALLING); }', 'arduino:avr:mega')).toEqual([])
  })
})

describe('pin denetimi: ESP32', () => {
  it('flash pinlerini hata sayar', () => {
    expect(kontrol('void setup(){ pinMode(6, OUTPUT); }', ESP32).some((s) => s.tur === 'error' && /flash/.test(s.mesaj))).toBe(true)
  })

  it('yalnızca giriş pininde çıkış kullanımını hata sayar, girişte sorun görmez', () => {
    expect(mesajlar('void setup(){ pinMode(34, OUTPUT); }', ESP32).join()).toMatch(/yalnızca giriş/)
    expect(kontrol('void setup(){ pinMode(34, INPUT); }\nvoid loop(){ digitalRead(34); }', ESP32)).toEqual([])
  })

  it('Wi-Fi varken ADC2 pininde analogRead uyarır, ADC1 pininde uyarmaz', () => {
    const kod = (p: number) => `#include <WiFi.h>\nvoid loop(){ analogRead(${p}); }`
    expect(mesajlar(kod(25), ESP32).join()).toMatch(/ADC2/)
    expect(kontrol(kod(34), ESP32)).toEqual([])
    expect(kontrol('void loop(){ analogRead(25); }', ESP32)).toEqual([]) // Wi-Fi yoksa sorun yok
  })

  it('strapping pininde çıkış için not düşer', () => {
    expect(kontrol('void setup(){ pinMode(12, OUTPUT); }', ESP32).some((s) => s.tur === 'note' && /strapping/.test(s.mesaj))).toBe(true)
  })

  it('kart bilinmiyorsa yalnızca genel kuralları uygular', () => {
    expect(kontrol('void setup(){ pinMode(6, OUTPUT); }', null)).toEqual([])
    expect(kontrol('void setup(){ pinMode(6, OUTPUT); }', 'esp32:esp32:esp32s3')).toEqual([])
  })
})

describe('pin denetimi: ESP8266', () => {
  it('GPIO16 için kesme ve PWM uyarısı verir', () => {
    const m = mesajlar(
      'void setup(){ pinMode(16, OUTPUT); attachInterrupt(digitalPinToInterrupt(16), f, RISING); analogWrite(16, 5); }',
      'esp8266:esp8266:nodemcuv2'
    )
    expect(m.some((x) => /kesmeyi desteklemez/.test(x))).toBe(true)
    expect(m.some((x) => /PWM/.test(x))).toBe(true)
  })
})

describe('pinOzetiCikar', () => {
  it('kullanılan pinleri rolleriyle ve ilk konumuyla listeler', async () => {
    const { pinOzetiCikar } = await import('./pinCheck')
    const o = pinOzetiCikar([{ dosya: 'a.ino', icerik: '#define LED 13\nvoid setup(){ pinMode(LED, OUTPUT); }\nvoid loop(){ digitalWrite(LED, HIGH); analogRead(A0); }' }], UNO)
    expect(o.kartAdi).toBe('Arduino Uno')
    expect(o.kullanimlar).toEqual([
      { pin: 13, roller: ['çıkış'], dosya: 'a.ino', satir: 2 },
      { pin: 14, roller: ['analog okuma'], dosya: 'a.ino', satir: 3 }
    ])
  })
})
