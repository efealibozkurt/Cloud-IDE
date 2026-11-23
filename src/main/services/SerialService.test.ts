import { beforeEach, describe, expect, it, vi } from 'vitest'

const { portOrnekleri, SahtePort } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter: EE } = require('events') as typeof import('events')
  const ornekler = new Map<string, SahtePortSinifi>()

  class SahtePortSinifi extends EE {
    path: string
    baudRate: number
    isOpen = false
    yazilanlar: string[] = []

    constructor(ayar: { path: string; baudRate: number }) {
      super()
      this.path = ayar.path
      this.baudRate = ayar.baudRate
      ornekler.set(ayar.path, this)
    }

    open(cb: (err: Error | null) => void): void {
      this.isOpen = true
      cb(null)
    }

    close(cb: (err: Error | null) => void): void {
      this.isOpen = false
      this.emit('close')
      cb(null)
    }

    write(data: string, cb: (err: Error | null) => void): void {
      this.yazilanlar.push(data)
      cb(null)
    }

    veriGonder(metin: string): void {
      this.emit('data', Buffer.from(metin, 'utf8'))
    }
  }

  return { portOrnekleri: ornekler, SahtePort: SahtePortSinifi }
})

vi.mock('serialport', () => ({
  SerialPort: Object.assign(SahtePort, {
    list: vi.fn(async () => [])
  })
}))

import { SerialService } from './SerialService'

describe('SerialService tampon ve canlı dinleme', () => {
  let service: SerialService

  beforeEach(() => {
    portOrnekleri.clear()
    service = new SerialService()
  })

  it('parça parça gelen verileri satırlara bölüp tampona yazar', async () => {
    await service.open('COM3', 115200)
    const p = portOrnekleri.get('COM3')!
    p.veriGonder('Merhaba ')
    expect(service.sonSatirlar()).toEqual([])
    p.veriGonder('Dunya\r\nIkinci satir\n')

    const satirlar = service.sonSatirlar()
    expect(satirlar.map((s) => s.satir)).toEqual(['Merhaba Dunya', 'Ikinci satir'])
    expect(satirlar[0].port).toBe('COM3')
  })

  it('1000 satırlık dairesel tampon sınırını korur', async () => {
    await service.open('COM3', 115200)
    const p = portOrnekleri.get('COM3')!
    const paket = Array.from({ length: 1250 }, (_, i) => `satir-${i}`).join('\n') + '\n'
    p.veriGonder(paket)

    const son = service.sonSatirlar({ limit: 300 })
    expect(son).toHaveLength(300)
    expect(son[0].satir).toBe('satir-950')
    expect(son[299].satir).toBe('satir-1249')
  })

  it('port filtresi ve tamponuTemizle doğru çalışır', async () => {
    await service.open('COM3', 115200)
    await service.open('COM4', 9600)
    portOrnekleri.get('COM3')!.veriGonder('port3-a\nport3-b\n')
    portOrnekleri.get('COM4')!.veriGonder('port4-a\n')

    expect(service.sonSatirlar({ port: 'COM4' }).map((s) => s.satir)).toEqual(['port4-a'])

    service.tamponuTemizle('COM3')
    expect(service.sonSatirlar({ port: 'COM3' })).toEqual([])
    expect(service.sonSatirlar({ port: 'COM4' })).toHaveLength(1)

    service.tamponuTemizle()
    expect(service.sonSatirlar()).toEqual([])
  })

  it('satirBekle canlı satırları toplar, limite veya zaman aşımına göre döner', async () => {
    await service.open('COM3', 115200)
    const p = portOrnekleri.get('COM3')!

    const bekle = service.satirBekle({ port: 'COM3', sureMs: 400, enFazlaSatir: 2 })
    setTimeout(() => {
      p.veriGonder('yanit-1\nyanit-2\nyanit-3\n')
    }, 10)

    const sonuc = await bekle
    expect(sonuc.map((s) => s.satir)).toEqual(['yanit-1', 'yanit-2'])
  })

  it('satirBekle AbortSignal ile hemen iptal edilir', async () => {
    await service.open('COM3', 115200)
    const ac = new AbortController()
    const bekle = service.satirBekle({ port: 'COM3', sureMs: 3000, signal: ac.signal })
    setTimeout(() => ac.abort(), 15)
    const sonuc = await bekle
    expect(sonuc).toEqual([])
  })
})
