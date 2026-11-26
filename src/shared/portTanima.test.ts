import { describe, expect, it } from 'vitest'
import { portAciklamasi, portTuru, portlariSirala } from './portTanima'
import type { DetectedPort } from './types'

const port = (address: string, ek: Partial<DetectedPort> = {}): DetectedPort => ({
  address,
  label: address,
  protocol: 'serial',
  protocolLabel: 'Serial Port',
  matchingBoards: [],
  ...ek
})

// Kart takılı olmayan gerçek bir Windows bilgisayarda görülen portlar
const dahili = port('COM1', { pnpId: 'ACPI\\PNP0501\\0' })
const bluetooth = port('COM5', { pnpId: 'BTHENUM\\{00001101-0000-1000-8000-00805F9B34FB}_VID&0001005D\\8' })
const ch340 = port('COM7', { vendorId: '1A86', productId: '7523', pnpId: 'USB\\VID_1A86&PID_7523\\5' })

describe('portTanima', () => {
  it('dahili ve Bluetooth portlarını karttan ayırır', () => {
    expect(portTuru(dahili)).toBe('diger')
    expect(portTuru(bluetooth)).toBe('bluetooth')
    expect(portTuru(ch340)).toBe('kart')
  })

  it('tanınan kartı ve Linux/macOS USB aygıtlarını kart sayar', () => {
    expect(portTuru(port('COM3', { matchingBoards: [{ name: 'Arduino Uno', fqbn: 'arduino:avr:uno' }] }))).toBe('kart')
    expect(portTuru(port('/dev/ttyUSB0'))).toBe('kart')
    expect(portTuru(port('/dev/cu.usbserial-110'))).toBe('kart')
    expect(portTuru(port('/dev/ttyS0'))).toBe('diger')
    expect(portTuru(port('/dev/cu.Bluetooth-Incoming-Port'))).toBe('bluetooth')
  })

  it('anlaşılır açıklama verir', () => {
    expect(portAciklamasi(ch340)).toBe('CH340')
    expect(portAciklamasi(port('COM8', { vendorId: 'ABCD' }))).toBe('USB kart')
    expect(portAciklamasi(dahili)).toBe('Bilgisayarın kendi portu')
  })

  it('kart portlarını başa alır', () => {
    expect(portlariSirala([dahili, bluetooth, ch340]).map((p) => p.address)).toEqual(['COM7', 'COM1', 'COM5'])
  })
})
