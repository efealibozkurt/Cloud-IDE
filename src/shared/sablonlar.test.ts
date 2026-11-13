import { describe, expect, it } from 'vitest'
import { pinleriDenetle } from './pinCheck'
import { AILE_ADI, SABLONLAR, alanHatasi, kartAilesiBul, sablonBul, tumAlanlarGecerliMi, varsayilanDegerler, type KartAilesi } from './sablonlar'

const FQBN: Record<KartAilesi, string> = { avr: 'arduino:avr:uno', esp32: 'esp32:esp32:esp32', esp8266: 'esp8266:esp8266:nodemcuv2' }

function parantezDengeli(kod: string): boolean {
  const sayac = { '{': 0, '(': 0, '[': 0 }
  const kapat: Record<string, keyof typeof sayac> = { '}': '{', ')': '(', ']': '[' }
  // Metin sabitlerinin içini yok say
  const temiz = kod.replace(/"(?:[^"\n]|\\.)*"/g, '""').replace(/'(?:[^'\n]|\\.)*'/g, "''")
  for (const c of temiz) {
    if (c in sayac) sayac[c as keyof typeof sayac]++
    else if (c in kapat) {
      sayac[kapat[c]]--
      if (sayac[kapat[c]] < 0) return false
    }
  }
  return Object.values(sayac).every((n) => n === 0)
}

describe('kartAilesiBul', () => {
  it('kartı aileye çevirir, tanınmayana AVR verir ve bunu bildirir', () => {
    expect(kartAilesiBul('esp32:esp32:esp32')).toEqual({ aile: 'esp32', taninan: true })
    expect(kartAilesiBul('esp8266:esp8266:nodemcuv2')).toEqual({ aile: 'esp8266', taninan: true })
    expect(kartAilesiBul('arduino:avr:uno')).toEqual({ aile: 'avr', taninan: true })
    expect(kartAilesiBul(null)).toEqual({ aile: 'avr', taninan: false })
    expect(kartAilesiBul('rp2040:rp2040:rpipico').taninan).toBe(false)
  })
})

describe('şablonlar', () => {
  it('kimlikler ve proje adları benzersiz, proje adları klasör için güvenli', () => {
    expect(new Set(SABLONLAR.map((s) => s.id)).size).toBe(SABLONLAR.length)
    for (const s of SABLONLAR) expect(s.projeAdi).toMatch(/^[A-Za-z0-9_]+$/)
  })

  for (const sablon of SABLONLAR) {
    for (const aile of sablon.uyumlu) {
      describe(`${sablon.id} · ${AILE_ADI[aile]}`, () => {
        const v = varsayilanDegerler(sablon, aile)
        const kod = sablon.kod(v, aile)

        it('varsayılan değerler geçerli', () => {
          for (const a of sablon.alanlar) expect(alanHatasi(a, v[a.id]), a.id).toBeNull()
          expect(tumAlanlarGecerliMi(sablon, v)).toBe(true)
        })

        it('setup ve loop içerir, parantezler dengeli, doldurulmamış yer tutucu kalmaz', () => {
          expect(kod).toContain('void setup()')
          expect(kod).toContain('void loop()')
          expect(parantezDengeli(kod)).toBe(true)
          expect(kod).not.toMatch(/\{\{|undefined|\$\{/)
        })

        it('varsayılan pinler pin denetiminde hata üretmez', () => {
          const hatalar = pinleriDenetle([{ dosya: 'a.ino', icerik: kod }], FQBN[aile]).filter((s) => s.tur === 'error')
          expect(hatalar).toEqual([])
        })

        it('kablolama adımları ve kütüphane listesi tanımlı', () => {
          expect(sablon.baglanti(v, aile).length).toBeGreaterThan(0)
          expect(Array.isArray(sablon.kutuphaneler(aile))).toBe(true)
        })
      })
    }
  }

  it('ESP32 şablonlarında tone() ve analogWrite() kullanılmaz (çekirdek sürümüne bağlı)', () => {
    for (const s of SABLONLAR.filter((x) => x.uyumlu.includes('esp32'))) {
      const kod = s.kod(varsayilanDegerler(s, 'esp32'), 'esp32')
      expect(kod, s.id).not.toMatch(/\btone\(|\banalogWrite\(/)
    }
  })

  it('doğrulama: pin, sayı, seçim ve metin kuralları', () => {
    const led = sablonBul('led-yanip-sonme')!
    expect(alanHatasi(led.alanlar[0], '13')).toBeNull()
    expect(alanHatasi(led.alanlar[0], 'A0')).toBeNull()
    expect(alanHatasi(led.alanlar[0], 'x')).not.toBeNull()
    expect(alanHatasi(led.alanlar[1], '5')).not.toBeNull() // min 10
    expect(alanHatasi(led.alanlar[1], '500')).toBeNull()
    expect(alanHatasi(led.alanlar[1], '1.5')).not.toBeNull()
    const wifi = sablonBul('wifi-led-web')!
    expect(alanHatasi(wifi.alanlar[0], 'Ev Agi')).toBeNull()
    expect(alanHatasi(wifi.alanlar[0], 'ev"agi')).not.toBeNull()
    expect(alanHatasi(wifi.alanlar[0], 'a\\b')).not.toBeNull()
    const oled = sablonBul('oled')!
    expect(alanHatasi(oled.alanlar[0], 'Merhaba')).toBeNull()
    expect(alanHatasi(oled.alanlar[0], 'Şiir')).not.toBeNull()
    expect(alanHatasi(oled.alanlar[1], '0x99')).not.toBeNull()
  })

  it('kullanıcı değerleri koda girer (pin ve metin)', () => {
    const led = sablonBul('led-yanip-sonme')!
    expect(led.kod({ LED: '7', BEKLEME: '250' }, 'avr')).toContain('const int LED_PIN = 7;')
    const wifi = sablonBul('wifi-led-web')!
    const kod = wifi.kod({ SSID: 'Evim', SIFRE: 'gizli123', LED: '5' }, 'esp32')
    expect(kod).toContain('"Evim"')
    expect(kod).toContain('#include <WebServer.h>')
    expect(wifi.kod({ SSID: 'a', SIFRE: 'b', LED: '5' }, 'esp8266')).toContain('ESP8266WebServer sunucu(80);')
  })

  it('röle şablonu seviyeyi tersler', () => {
    const r = sablonBul('role')!
    expect(r.kod({ ROLE: '7', SEVIYE: 'LOW' }, 'avr')).toMatch(/ACIK = LOW;\nconst int KAPALI = HIGH;/)
    expect(r.kod({ ROLE: '7', SEVIYE: 'HIGH' }, 'avr')).toMatch(/ACIK = HIGH;\nconst int KAPALI = LOW;/)
  })
})
