import { describe, expect, it } from 'vitest'
import { ANAHTAR_SAYFALARI, KART_ONERILERI, cekirdekKurulu, kartiBul } from './ilkKurulum'
import type { PlatformSummary } from './types'

const platformlar: PlatformSummary[] = [
  {
    id: 'arduino:avr',
    name: 'Arduino AVR Boards',
    installedVersion: '1.8.6',
    latestVersion: '1.8.6',
    boards: [
      { name: 'Arduino Uno', fqbn: 'arduino:avr:uno', platformId: 'arduino:avr', platformName: 'Arduino AVR Boards' },
      { name: 'Arduino Nano', fqbn: 'arduino:avr:nano', platformId: 'arduino:avr', platformName: 'Arduino AVR Boards' }
    ]
  },
  {
    id: 'deneyap:esp32',
    name: 'Deneyap',
    installedVersion: null,
    latestVersion: '1.0.0',
    boards: []
  }
]

describe('ilkKurulum', () => {
  const oneri = (id: string) => KART_ONERILERI.find((k) => k.id === id)!

  it('çekirdeğin kurulu olup olmadığını söyler', () => {
    expect(cekirdekKurulu(platformlar, 'arduino:avr')).toBe(true)
    expect(cekirdekKurulu(platformlar, 'deneyap:esp32')).toBe(false)
    expect(cekirdekKurulu(platformlar, 'esp32:esp32')).toBe(false)
  })

  it('kurulu çekirdekten FQBN ile kartı bulur', () => {
    expect(kartiBul(oneri('uno'), platformlar)?.fqbn).toBe('arduino:avr:uno')
    expect(kartiBul(oneri('nano'), platformlar)?.fqbn).toBe('arduino:avr:nano')
  })

  it('çekirdek kurulu değilse ya da kart yoksa null döner', () => {
    expect(kartiBul(oneri('esp32'), platformlar)).toBeNull()
    expect(kartiBul(oneri('mega'), platformlar)).toBeNull()
    expect(kartiBul(oneri('deneyap-mini-v2'), platformlar)).toBeNull()
  })

  it('kartı ada göre bulur (Deneyap)', () => {
    const p: PlatformSummary[] = [
      {
        id: 'deneyap:esp32',
        name: 'Deneyap',
        installedVersion: '1.0.0',
        latestVersion: '1.0.0',
        boards: [
          { name: 'Deneyap Mini', fqbn: 'deneyap:esp32:dymini', platformId: 'deneyap:esp32', platformName: 'Deneyap' },
          { name: 'Deneyap Mini v2', fqbn: 'deneyap:esp32:dymini2', platformId: 'deneyap:esp32', platformName: 'Deneyap' }
        ]
      }
    ]
    expect(kartiBul(oneri('deneyap-mini-v2'), p)?.fqbn).toBe('deneyap:esp32:dymini2')
  })

  it('FQBN alt seçeneklerle uzamış olsa da kartı bulur', () => {
    const p: PlatformSummary[] = [
      {
        id: 'esp32:esp32',
        name: 'esp32',
        installedVersion: '3.0.0',
        latestVersion: '3.0.0',
        boards: [{ name: 'ESP32 Dev Module', fqbn: 'esp32:esp32:esp32:UploadSpeed=921600', platformId: 'esp32:esp32', platformName: 'esp32' }]
      }
    ]
    expect(kartiBul(oneri('esp32'), p)?.name).toBe('ESP32 Dev Module')
  })

  it('anahtar sayfaları yalnızca https adresleridir', () => {
    for (const url of Object.values(ANAHTAR_SAYFALARI)) expect(url).toMatch(/^https:\/\//)
  })

  it('önerilerin kimlikleri benzersizdir', () => {
    expect(new Set(KART_ONERILERI.map((k) => k.id)).size).toBe(KART_ONERILERI.length)
  })
})
