import { describe, expect, it } from 'vitest'
import { usbCipiBul } from './usbCipleri'

describe('usbCipiBul', () => {
  it('bilinen çipleri büyük/küçük harf ve 0x önekinden bağımsız bulur', () => {
    expect(usbCipiBul('1A86', '7523')?.ad).toMatch(/CH340/)
    expect(usbCipiBul('1a86', '7523')?.ad).toMatch(/CH340/)
    expect(usbCipiBul('0x10c4', '0xea60')?.ad).toMatch(/CP210x/)
    expect(usbCipiBul('303A', '1001')?.ad).toMatch(/Espressif/)
  })
  it('ürün kimliği gerektiren girdide yanlış ürünü eşlemez', () => {
    expect(usbCipiBul('10C4', '0001')).toBeNull()
  })
  it('bilinmeyen ya da eksik kimlikte null döner', () => {
    expect(usbCipiBul('ABCD', '1234')).toBeNull()
    expect(usbCipiBul(undefined, undefined)).toBeNull()
  })
})
