import { afterEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { LibraryInfo } from '@shared/types'
import { KutuphaneSembolServisi } from './KutuphaneSembolServisi'

const geciciKlasorler: string[] = []

async function geciciDizinAc(): Promise<string> {
  const yol = await fs.mkdtemp(join(tmpdir(), 'dret-kut-sembol-'))
  geciciKlasorler.push(yol)
  return yol
}

afterEach(async () => {
  while (geciciKlasorler.length > 0) {
    const dizin = geciciKlasorler.pop()!
    await fs.rm(dizin, { recursive: true, force: true }).catch(() => {})
  }
})

describe('KutuphaneSembolServisi', () => {
  it('src ve kök başlıklardan sembolleri, sabitleri ve keywords.txt yedeğini çıkarır', async () => {
    const kok = await geciciDizinAc()
    const dhtDizin = join(kok, 'DHT sensor library')
    const servoDizin = join(kok, 'ServoEx')
    await fs.mkdir(join(dhtDizin, 'src'), { recursive: true })
    await fs.mkdir(servoDizin, { recursive: true })

    await fs.writeFile(
      join(dhtDizin, 'src', 'DHT.h'),
      `#define DHT11 11
class DHT {
 public:
  DHT(uint8_t pin, uint8_t type);
  void begin();
  float readTemperature();
 private:
  int _pin;
};
`,
      'utf-8'
    )
    // 256 KB sınırı üstündeki başlık içeriği atlanmalı ama basliklar listesinde dosya adı korunmalı
    await fs.writeFile(join(dhtDizin, 'src', 'Devasa.h'), 'class GizliDevasa { public: void f(); };\n' + 'x'.repeat(270_000), 'utf-8')
    await fs.writeFile(join(dhtDizin, 'keywords.txt'), 'DHT\tKEYWORD1\nreadTemperature\tKEYWORD2\nextraKeyword\tLITERAL1\n', 'utf-8')

    await fs.writeFile(
      join(servoDizin, 'ServoEx.h'),
      `class ServoEx {
 public:
  void attach(int pin);
};
`,
      'utf-8'
    )

    const kutuphaneler: LibraryInfo[] = [
      { name: 'DHT sensor library', version: '1.4.6', sentence: 'Nem ve sıcaklık sensörü', installDir: dhtDizin },
      { name: 'ServoEx', version: '1.0.0', installDir: servoDizin }
    ]
    const listLibraries = vi.fn(async () => kutuphaneler)
    const servis = new KutuphaneSembolServisi({ listLibraries })

    const indeks = await servis.sembolleriGetir()
    expect(indeks.kutuphaneler).toHaveLength(2)

    const dht = indeks.kutuphaneler.find((k) => k.kutuphane === 'DHT sensor library')!
    expect(dht.basliklar).toEqual(['DHT.h', 'Devasa.h'])
    expect(dht.siniflar).toEqual(['DHT'])
    expect(dht.sabitler).toContain('DHT11')
    expect(dht.uyeler.some((u) => u.sinif === 'DHT' && u.ad === 'readTemperature')).toBe(true)
    expect(dht.uyeler.some((u) => u.ad === 'GizliDevasa')).toBe(false)
    // Zaten sınıf veya üye olanlar keywords listesinden elenir, yenisi korunur
    expect(dht.anahtarKelimeler).toEqual(['extraKeyword'])

    const servo = indeks.kutuphaneler.find((k) => k.kutuphane === 'ServoEx')!
    expect(servo.basliklar).toEqual(['ServoEx.h'])
    expect(servo.uyeler.some((u) => u.sinif === 'ServoEx' && u.ad === 'attach')).toBe(true)
  })

  it('aynı kütüphane listesinde önbellekten döner; force ve onbellegiTemizle sonrası yeniden tarar', async () => {
    const kok = await geciciDizinAc()
    const kutDizin = join(kok, 'Sensor')
    await fs.mkdir(kutDizin, { recursive: true })
    const baslikYolu = join(kutDizin, 'Sensor.h')
    await fs.writeFile(baslikYolu, 'class Sensor { public: void baslat(); };\n', 'utf-8')

    const servis = new KutuphaneSembolServisi({
      listLibraries: async () => [{ name: 'Sensor', version: '1.0.0', installDir: kutDizin }]
    })

    const ilk = await servis.sembolleriGetir()
    await fs.writeFile(baslikYolu, 'class Sensor { public: void baslat(); void durdur(); };\n', 'utf-8')

    const onbellekli = await servis.sembolleriGetir()
    expect(onbellekli).toBe(ilk)
    expect(onbellekli.kutuphaneler[0].uyeler.some((u) => u.ad === 'durdur')).toBe(false)

    const zorlanan = await servis.sembolleriGetir(true)
    expect(zorlanan.kutuphaneler[0].uyeler.some((u) => u.ad === 'durdur')).toBe(true)

    await fs.writeFile(baslikYolu, 'class Sensor { public: void yeniMetot(); };\n', 'utf-8')
    servis.onbellegiTemizle()
    const temizlenmis = await servis.sembolleriGetir()
    expect(temizlenmis.kutuphaneler[0].uyeler.some((u) => u.ad === 'yeniMetot')).toBe(true)
  })

  it('listLibraries hatasında veya eksik dizinde çökmeden güvenli sonuç döner', async () => {
    const hataServis = new KutuphaneSembolServisi({
      listLibraries: async () => {
        throw new Error('cli yok')
      }
    })
    const bos = await hataServis.sembolleriGetir()
    expect(bos.kutuphaneler).toEqual([])

    const eksikDizinServis = new KutuphaneSembolServisi({
      listLibraries: async () => [{ name: 'Olmayan', version: '1.0.0', installDir: 'C:\\olmayan\\dizin\\12345' }]
    })
    const kismi = await eksikDizinServis.sembolleriGetir()
    expect(kismi.kutuphaneler).toEqual([])
  })
})
