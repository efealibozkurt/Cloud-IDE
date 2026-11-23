import { describe, expect, it } from 'vitest'
import { BOOTLOADER_DESENI, hataSatiriMi, seriCiktiAnalizEt } from './seriTeshis'

describe('seriTeshis', () => {
  it('bootloader satırlarını tanır', () => {
    expect(BOOTLOADER_DESENI.test('ets Jul 29 2019 12:21:46')).toBe(true)
    expect(BOOTLOADER_DESENI.test('rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)')).toBe(true)
    expect(BOOTLOADER_DESENI.test('Sicaklik: 24.5 C')).toBe(false)
  })

  it('kritik donanım hata satırlarını yakalar', () => {
    expect(hataSatiriMi("Guru Meditation Error: Core  1 panic'ed (LoadProhibited).")).toBe(true)
    expect(hataSatiriMi('Backtrace: 0x400d1234:0x3ffb1230')).toBe(true)
    expect(hataSatiriMi('Brownout detector was triggered')).toBe(true)
    expect(hataSatiriMi('E (1205) task_wdt: Task watchdog got triggered.')).toBe(true)
    expect(hataSatiriMi('Interrupt wdt timeout on CPU0')).toBe(true)
    expect(hataSatiriMi('Stack canary watchpoint triggered (loopTask)')).toBe(true)
    expect(hataSatiriMi('ASSERT failed at sensor.cpp:42')).toBe(true)
    expect(hataSatiriMi('rst:0x7 (TG0WDT_SYS_RESET),boot:0x13')).toBe(true)
    expect(hataSatiriMi('abort() was called at PC 0x40081234')).toBe(true)
    expect(hataSatiriMi('Normal cikti: deger=42')).toBe(false)
    expect(hataSatiriMi('')).toBe(false)
  })

  it('Guru Meditation / Panic, Brownout ve WDT durumları için doğru teşhis ipuçları üretir', () => {
    const ipuclari = seriCiktiAnalizEt([
      "Guru Meditation Error: Core  1 panic'ed (StoreProhibited).",
      'Brownout detector was triggered',
      'Task watchdog got triggered. The following tasks did not reset the watchdog in time:'
    ])
    expect(ipuclari).toHaveLength(3)
    expect(ipuclari[0]).toContain('Guru Meditation')
    expect(ipuclari[1]).toContain('Brownout')
    expect(ipuclari[2]).toContain('Watchdog')
  })

  it('bozuk karakter oranı %20 üstündeyken baud uyuşmazlığı uyarısı verir', () => {
    const bozuk = '\uFFFD\uFFFD\uFFFD\uFFFD\x01\x02abc\uFFFD\uFFFD\x03\x04xyz'
    const ipuclari = seriCiktiAnalizEt([bozuk])
    expect(ipuclari.some((i) => i.includes('baud'))).toBe(true)
  })

  it('kısa veya normal çıktıda yanlış baud uyarısı üretmez', () => {
    expect(seriCiktiAnalizEt(['\uFFFD\uFFFD\uFFFD'])).toEqual([])
    expect(seriCiktiAnalizEt(['Sicaklik: 23.4 C', 'Nem: %55'])).toEqual([])
  })
})
