import { describe, expect, it } from 'vitest'
import { LINUX_SERI_IZIN_IPUCU, izinIpucuylaBirlestir, seriIzinIpucu } from './seriPortIzni'

describe('seriIzinIpucu', () => {
  it('Linux izin hatalarını tanır', () => {
    expect(seriIzinIpucu('Error: Permission denied, cannot open /dev/ttyUSB0', 'linux')).toBe(LINUX_SERI_IZIN_IPUCU)
    expect(seriIzinIpucu("could not open port /dev/ttyACM0: [Errno 13] Permission denied: '/dev/ttyACM0'", 'linux')).not.toBeNull()
    expect(seriIzinIpucu('Error: EACCES', 'linux')).not.toBeNull()
  })

  it('başka hatalarda ve başka platformlarda ipucu vermez', () => {
    expect(seriIzinIpucu('Error: No such file or directory, cannot open /dev/ttyUSB0', 'linux')).toBeNull()
    expect(seriIzinIpucu('Access denied', 'win32')).toBeNull()
    expect(seriIzinIpucu(undefined, 'linux')).toBeNull()
  })

  it('ipucunu hata metninin altına ekler', () => {
    expect(izinIpucuylaBirlestir('Port açılamadı: Permission denied', 'linux')).toBe(
      `Port açılamadı: Permission denied\n${LINUX_SERI_IZIN_IPUCU}`
    )
    expect(izinIpucuylaBirlestir('Port açılamadı: busy', 'linux')).toBe('Port açılamadı: busy')
  })
})
