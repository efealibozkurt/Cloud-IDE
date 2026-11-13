import { describe, expect, it } from 'vitest'
import { fqbnSecenekleriniAyir, fqbnSecenekleriyle, temelFqbn } from './boardFqbn'

describe('FQBN yardımcıları', () => {
  it('temel FQBN seçenekleri atar', () => {
    expect(temelFqbn('arduino:avr:nano:cpu=atmega328old')).toBe('arduino:avr:nano')
    expect(temelFqbn('esp32:esp32:esp32')).toBe('esp32:esp32:esp32')
  })

  it('seçenekleri sıralı ve virgüllü ekler, seçenek yoksa temel döner', () => {
    expect(fqbnSecenekleriyle('esp32:esp32:esp32', { UploadSpeed: '921600', PartitionScheme: 'huge_app' })).toBe(
      'esp32:esp32:esp32:PartitionScheme=huge_app,UploadSpeed=921600'
    )
    expect(fqbnSecenekleriyle('arduino:avr:uno', {})).toBe('arduino:avr:uno')
    expect(fqbnSecenekleriyle('arduino:avr:uno', undefined)).toBe('arduino:avr:uno')
  })

  it('zaten seçenekli bir FQBN verilirse önce temele indirir', () => {
    expect(fqbnSecenekleriyle('arduino:avr:nano:cpu=atmega168', { cpu: 'atmega328old' })).toBe('arduino:avr:nano:cpu=atmega328old')
  })

  it('güvenli olmayan ad ve değerleri atar (komut satırına sızmasın)', () => {
    expect(fqbnSecenekleriyle('arduino:avr:nano', { cpu: 'x; rm -rf', 'a b': '1', ok: 'v1' })).toBe('arduino:avr:nano:ok=v1')
  })

  it('FQBN içindeki seçenekleri ayırır', () => {
    expect(fqbnSecenekleriniAyir('esp32:esp32:esp32:PartitionScheme=huge_app,CPUFreq=240')).toEqual({ PartitionScheme: 'huge_app', CPUFreq: '240' })
    expect(fqbnSecenekleriniAyir('arduino:avr:uno')).toEqual({})
  })
})
