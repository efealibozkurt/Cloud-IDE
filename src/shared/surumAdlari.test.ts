import { describe, expect, it } from 'vitest'
import { SURUM_ADLARI, sonrakiSurumAdi, surumAdiBul } from './surumAdlari'

describe('sürüm kod adları', () => {
  it('0.1.x sürümleri Stratus', () => {
    expect(surumAdiBul('0.1.0').ad).toBe('Stratus')
    expect(surumAdiBul('0.1.5').ad).toBe('Stratus')
    expect(surumAdiBul('v0.1.9').ad).toBe('Stratus')
  })

  it('küçük sürüm arttıkça bulut değişir', () => {
    expect(surumAdiBul('0.2.0').ad).toBe('Cumulus')
    expect(surumAdiBul('0.3.7').ad).toBe('Altostratus')
    expect(surumAdiBul('0.4.0').ad).toBe('Nimbostratus')
    expect(surumAdiBul('0.5.0').ad).toBe('Cumulonimbus')
  })

  it('1.0 ve sonrası son kod adında kalır, tanınmayan metin Stratus olur', () => {
    expect(surumAdiBul('1.0.0').ad).toBe('Cumulonimbus')
    expect(surumAdiBul('3.2.1').ad).toBe('Cumulonimbus')
    expect(surumAdiBul('belirsiz').ad).toBe('Stratus')
  })

  it('sıradaki bulutu verir, sonuncuda null döner', () => {
    expect(sonrakiSurumAdi('0.1.5')?.ad).toBe('Cumulus')
    expect(sonrakiSurumAdi('0.5.0')).toBeNull()
  })

  it('başlangıç sürümleri artan sırada', () => {
    for (let i = 1; i < SURUM_ADLARI.length; i++) {
      const a = SURUM_ADLARI[i - 1].baslangic
      const b = SURUM_ADLARI[i].baslangic
      expect(a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])).toBe(true)
    }
  })
})
