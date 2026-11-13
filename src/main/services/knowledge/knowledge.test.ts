import { describe, expect, it } from 'vitest'
import { Bm25Dizini, belirtecle, kodTanimlayicilari, rrfBirlestir } from './bm25'
import { vektorleriAc, vektorleriPaketle, icCarpim } from './vectorStore'
import { anahtarKelimeleriOku, apiOzetiniParcala, basliktanApiCikar } from './libraryApi'

describe('belirtecle', () => {
  it('Türkçe karakterleri sadeleştirir', () => {
    expect(belirtecle('Röle sıcaklık')).toEqual(['role', 'sicaklik'])
  })

  it('camelCase adları hem bütün hem parça olarak ekler', () => {
    const t = belirtecle('digitalWrite')
    expect(t).toContain('digitalwrite')
    expect(t).toContain('digital')
    expect(t).toContain('write')
  })
})

describe('Bm25Dizini', () => {
  const dizin = new Bm25Dizini([
    'ESP32 Wi-Fi bağlantısı ve web sunucu',
    'Servo motor açı kontrolü',
    'DHT22 sıcaklık ve nem sensörü okuma'
  ])

  it('en alakalı belgeyi başa koyar', () => {
    expect(dizin.ara('sıcaklık sensörü')[0].indeks).toBe(2)
    expect(dizin.ara('servo')[0].indeks).toBe(1)
  })

  it('uzun sorguda tek rastlantısal kelime eşleşmesi sonuç üretmez', () => {
    expect(dizin.ara('pizza tarifi motor hamur sosu')).toEqual([])
  })

  it('eşleşme yoksa boş döner', () => {
    expect(dizin.ara('yokboyle')).toEqual([])
  })
})

describe('rrfBirlestir', () => {
  it('iki listede de üstte olan öğeyi öne alır', () => {
    const sonuc = rrfBirlestir([
      [3, 1, 2],
      [1, 3, 4]
    ])
    expect(sonuc.slice(0, 2).map((x) => x.indeks).sort()).toEqual([1, 3])
  })
})

describe('vektör paketleme', () => {
  it('yazılan vektörleri aynen geri okur', () => {
    const v = [new Float32Array([0.5, -0.25, 1]), new Float32Array([0, 1, 0])]
    const geri = vektorleriAc(vektorleriPaketle(v, 3), 3)
    expect(Array.from(geri[0])).toEqual([0.5, -0.25, 1])
    expect(geri).toHaveLength(2)
  })

  it('bozuk dosyada hata verir', () => {
    expect(() => vektorleriAc(Buffer.alloc(5), 3)).toThrow()
  })

  it('boyut farkında iç çarpım 0 döner', () => {
    expect(icCarpim([1, 0], [1, 0, 0])).toBe(0)
    expect(icCarpim([1, 0], [1, 0])).toBe(1)
  })
})

describe('basliktanApiCikar', () => {
  const baslik = `
#define SERVO_MAX 180
class Servo {
 public:
  Servo();
  uint8_t attach(int pin);
  void write(int value);
  int read();
 private:
  void gizli(int x);
};
`
  it('public imzaları ve sınıfı bulur, private olanı atlar', () => {
    const o = basliktanApiCikar(baslik)
    expect(o.siniflar).toEqual(['Servo'])
    expect(o.fonksiyonlar.some((f) => f.includes('attach(int pin)'))).toBe(true)
    expect(o.fonksiyonlar.some((f) => f.includes('gizli'))).toBe(false)
    expect(o.sabitler).toContain('SERVO_MAX')
  })

  it('keywords.txt adlarını okur', () => {
    expect(anahtarKelimeleriOku('# yorum\nServo\tKEYWORD1\nattach\tKEYWORD2')).toEqual(['Servo', 'attach'])
  })

  it('uzun listeyi parçalara böler', () => {
    const parcalar = apiOzetiniParcala({ siniflar: ['A'], sabitler: [], fonksiyonlar: Array.from({ length: 80 }, (_, i) => `void f${i}();`) }, 35)
    expect(parcalar).toHaveLength(3)
    expect(parcalar[0]).toContain('Sınıflar: A')
  })
})

describe('kodTanimlayicilari', () => {
  it('yorumları ve metin sabitlerini atar, tanımlayıcıları korur', () => {
    const sonuc = kodTanimlayicilari('// hava durumu\nServo s; /* bloktur */ Serial.println("durumu yazdır");')
    expect(sonuc).toContain('Servo')
    expect(sonuc).toContain('println')
    expect(sonuc).not.toContain('hava')
    expect(sonuc).not.toContain('bloktur')
    expect(sonuc).not.toContain('yazdır')
  })
})
