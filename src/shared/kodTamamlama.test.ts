import { describe, expect, it } from 'vitest'
import type { KutuphaneSembolIndeksi } from './types'
import {
  belgeSembolleriCikar,
  hoverBilgisiBul,
  imlecYorumVeyaMetindeMi,
  imzaYardimiBul,
  parametredenSnippetUret,
  tamamlamaOnerileriUret
} from './kodTamamlama'

const ORNEK_INDEKS: KutuphaneSembolIndeksi = {
  olusturulmaZamani: 1700000000000,
  kutuphaneler: [
    {
      kutuphane: 'DHT sensor library',
      surum: '1.4.6',
      aciklama: 'DHT11 ve DHT22 sıcaklık/nem sensörü kütüphanesi',
      basliklar: ['DHT.h'],
      siniflar: ['DHT'],
      sabitler: ['DHT11', 'DHT22'],
      anahtarKelimeler: [],
      uyeler: [
        {
          ad: 'DHT',
          sinif: 'DHT',
          donusTipi: '',
          parametreler: 'uint8_t pin, uint8_t type',
          imza: 'DHT(uint8_t pin, uint8_t type)',
          kurucu: true
        },
        {
          ad: 'begin',
          sinif: 'DHT',
          donusTipi: 'void',
          parametreler: 'uint8_t usec = 55',
          imza: 'void begin(uint8_t usec = 55)'
        },
        {
          ad: 'readTemperature',
          sinif: 'DHT',
          donusTipi: 'float',
          parametreler: 'bool S = false, bool force = false',
          imza: 'float readTemperature(bool S = false, bool force = false)'
        }
      ]
    }
  ]
}

function satirSutunSonu(kod: string): { satir: number; sutun: number } {
  const satirlar = kod.split('\n')
  const son = satirlar[satirlar.length - 1]
  return { satir: satirlar.length, sutun: son.length + 1 }
}

describe('parametredenSnippetUret', () => {
  it('boş ve void parametrelerde sadece parantez üretir', () => {
    expect(parametredenSnippetUret('millis', '')).toBe('millis()')
    expect(parametredenSnippetUret('baslat', 'void')).toBe('baslat()')
  })

  it('varsayılan değerleri ve const/pointer niteliklerini temizleyip yer tutucu üretir', () => {
    expect(parametredenSnippetUret('DHT', 'uint8_t pin, uint8_t type = 11')).toBe('DHT(${1:pin}, ${2:type})')
    expect(parametredenSnippetUret('gonder', 'const uint8_t *veri, size_t uzunluk = 0')).toBe(
      'gonder(${1:veri}, ${2:uzunluk})'
    )
  })
})

describe('belgeSembolleriCikar', () => {
  it('#include, #define, nesne deklarasyonu, değişken ve fonksiyon ayrımını çıkarır', () => {
    const kod = `
#include <DHT.h>
#include "Ayarlar.h"
#define LED_PIN 13
DHT sensor(4, DHT22);
const int bekleme = 500;
int topla(int a, int b);
void blinkLed(int sure) {
  digitalWrite(LED_PIN, HIGH);
}
`
    const s = belgeSembolleriCikar(kod)
    expect(s.eklenenBasliklar).toEqual(['DHT.h', 'Ayarlar.h'])
    expect(s.makrolar.map((m) => m.ad)).toEqual(['LED_PIN'])
    expect(s.degiskenler.find((d) => d.ad === 'sensor')).toMatchObject({ tip: 'DHT' })
    expect(s.degiskenler.find((d) => d.ad === 'bekleme')).toMatchObject({ tip: 'int' })
    expect(s.fonksiyonlar.map((f) => f.ad)).toEqual(['topla', 'blinkLed'])
    expect(s.degiskenler.some((d) => d.ad === 'topla')).toBe(false)
  })
})

describe('tamamlamaOnerileriUret', () => {
  it('#include < ve #include " bağlamlarında uygun başlıkları önerir', () => {
    const acili = '#include <DH'
    const aciliKonum = satirSutunSonu(acili)
    const aciliOneriler = tamamlamaOnerileriUret({
      kod: acili,
      ...aciliKonum,
      kutuphaneIndeksi: ORNEK_INDEKS
    })
    const dht = aciliOneriler.find((o) => o.etiket === 'DHT.h')
    expect(dht).toBeDefined()
    expect(dht?.ekleMetni).toBe('DHT.h>')
    expect(aciliOneriler.some((o) => o.etiket === 'Wire.h')).toBe(true)

    const tirnakli = '#include "'
    const tirnakliOneriler = tamamlamaOnerileriUret({
      kod: tirnakli,
      ...satirSutunSonu(tirnakli),
      projeBasliklari: ['Ayarlar.h'],
      kutuphaneIndeksi: ORNEK_INDEKS
    })
    const yerelBaslik = tirnakliOneriler.find((o) => o.etiket === 'Ayarlar.h')
    expect(yerelBaslik?.ekleMetni).toBe('Ayarlar.h"')
    expect(yerelBaslik?.siraOnceligi.startsWith('0_')).toBe(true)
  })

  it('Serial. üzerinde yerleşik üye tamamlama sunar', () => {
    const kod = 'void setup() {\n  Serial.'
    const oneriler = tamamlamaOnerileriUret({ kod, ...satirSutunSonu(kod) })
    const printlnOneri = oneriler.find((o) => o.etiket === 'println')
    expect(printlnOneri).toBeDefined()
    expect(printlnOneri?.tur).toBe('metot')
    expect(printlnOneri?.ekleMetni).toContain('println(')
  })

  it('kurulu kütüphane nesnesinin sınıfını çözüp üyelerini gösterir, kurucuyu gizler', () => {
    const kod = '#include <DHT.h>\nDHT sensor(4, DHT22);\nvoid loop() {\n  sensor.'
    const oneriler = tamamlamaOnerileriUret({
      kod,
      ...satirSutunSonu(kod),
      kutuphaneIndeksi: ORNEK_INDEKS
    })
    expect(oneriler.some((o) => o.etiket === 'readTemperature')).toBe(true)
    expect(oneriler.some((o) => o.etiket === 'begin')).toBe(true)
    expect(oneriler.some((o) => o.etiket === 'DHT')).toBe(false)
  })

  it('yerleşik String sınıfı değişkeni için String üyelerini önerir', () => {
    const kod = 'String mesaj = "test";\nvoid setup() {\n  mesaj.'
    const oneriler = tamamlamaOnerileriUret({ kod, ...satirSutunSonu(kod) })
    expect(oneriler.some((o) => o.etiket === 'length')).toBe(true)
    expect(oneriler.some((o) => o.etiket === 'substring')).toBe(true)
  })

  it('yorum ve metin sabiti içinde tamamlama önerisi döndürmez', () => {
    const yorumKod = '// Serial.'
    expect(imlecYorumVeyaMetindeMi(yorumKod, 1, yorumKod.length + 1)).toBe(true)
    expect(tamamlamaOnerileriUret({ kod: yorumKod, ...satirSutunSonu(yorumKod) })).toEqual([])

    const metinKod = 'Serial.println("merhaba'
    expect(imlecYorumVeyaMetindeMi(metinKod, 1, metinKod.length + 1)).toBe(true)
    expect(tamamlamaOnerileriUret({ kod: metinKod, ...satirSutunSonu(metinKod) })).toEqual([])
  })

  it('seçili karta göre pin sabitlerini ve platform API’lerini uyarlar', () => {
    const kod = 'pinMode('
    const unoOneriler = tamamlamaOnerileriUret({
      kod,
      ...satirSutunSonu(kod),
      fqbn: 'arduino:avr:uno'
    })
    expect(unoOneriler.some((o) => o.etiket === 'A5')).toBe(true)
    expect(unoOneriler.some((o) => o.etiket === 'DAC1')).toBe(false)
    expect(unoOneriler.some((o) => o.etiket === 'ledcAttach')).toBe(false)

    const espOneriler = tamamlamaOnerileriUret({
      kod,
      ...satirSutunSonu(kod),
      fqbn: 'esp32:esp32:esp32'
    })
    expect(espOneriler.some((o) => o.etiket === 'DAC1')).toBe(true)
    expect(espOneriler.some((o) => o.etiket === 'T0')).toBe(true)
    expect(espOneriler.some((o) => o.etiket === 'ledcAttach')).toBe(true)

    const deneyapOneriler = tamamlamaOnerileriUret({
      kod,
      ...satirSutunSonu(kod),
      fqbn: 'deneyap:esp32:dydk'
    })
    expect(deneyapOneriler.some((o) => o.etiket === 'D15')).toBe(true)
  })
})

describe('hoverBilgisiBul', () => {
  it('çekirdek fonksiyon, Serial üyesi, kütüphane üyesi ve yerel semboller için açıklama döndürür', () => {
    const kod = [
      '#include <DHT.h>',
      '#define LED_PIN 13',
      'DHT sensor(4, DHT22);',
      'void setup() {',
      '  Serial.begin(115200);',
      '  pinMode(LED_PIN, OUTPUT);',
      '  sensor.readTemperature();',
      '}'
    ].join('\n')

    const beginHover = hoverBilgisiBul({ kod, satir: 5, sutun: 12 })
    expect(beginHover?.baslik).toBe('Serial.begin')
    expect(beginHover?.imza).toContain('begin')

    const pinModeHover = hoverBilgisiBul({ kod, satir: 6, sutun: 5 })
    expect(pinModeHover?.baslik).toBe('pinMode')
    expect(pinModeHover?.kaynak).toContain('Arduino')

    const makroHover = hoverBilgisiBul({ kod, satir: 6, sutun: 12 })
    expect(makroHover?.baslik).toBe('LED_PIN')
    expect(makroHover?.imza).toBe('#define LED_PIN 13')

    const dhtHover = hoverBilgisiBul({
      kod,
      satir: 7,
      sutun: 14,
      kutuphaneIndeksi: ORNEK_INDEKS
    })
    expect(dhtHover?.baslik).toBe('DHT.readTemperature')
    expect(dhtHover?.kaynak).toContain('DHT sensor library')
  })
})

describe('imzaYardimiBul', () => {
  it('aktif parametre indeksini virgül sayısından ve iç içe parantezlerden doğru hesaplar', () => {
    const cagri = 'digitalWrite(13, '
    const yardim = imzaYardimiBul({ kod: cagri, ...satirSutunSonu(cagri) })
    expect(yardim?.aktifParametre).toBe(1)
    expect(yardim?.imzalar[0].parametreler).toHaveLength(2)

    const icIce = 'map(analogRead(A0), 0, '
    const icIceYardim = imzaYardimiBul({ kod: icIce, ...satirSutunSonu(icIce) })
    expect(icIceYardim?.imzalar[0].etiket).toContain('map(')
    expect(icIceYardim?.aktifParametre).toBe(2)

    const uyeKod = '#include <DHT.h>\nDHT sensor(4, DHT22);\nsensor.readTemperature('
    const uyeYardim = imzaYardimiBul({
      kod: uyeKod,
      ...satirSutunSonu(uyeKod),
      kutuphaneIndeksi: ORNEK_INDEKS
    })
    expect(uyeYardim?.imzalar[0].etiket).toContain('readTemperature')
    expect(uyeYardim?.aktifParametre).toBe(0)

    const kurucuKod = 'DHT sensor(4, '
    const kurucuYardim = imzaYardimiBul({
      kod: kurucuKod,
      ...satirSutunSonu(kurucuKod),
      kutuphaneIndeksi: ORNEK_INDEKS
    })
    expect(kurucuYardim?.imzalar[0].etiket).toBe('DHT(uint8_t pin, uint8_t type)')
    expect(kurucuYardim?.aktifParametre).toBe(1)
  })
})
