import { describe, expect, it } from 'vitest'
import { TEKRAR_SINIRI, tekrarMi } from './runSteps'

describe('tekrarMi', () => {
  const cagri = (name: string, args: Record<string, unknown>) => ({ id: 'x', name, args })

  it('aynı çağrıyı sınıra kadar tekrar saymaz, sonra reddeder', () => {
    const sayac = new Map<string, number>()
    const c = cagri('read_file', { path: 'a.ino' })
    for (let i = 1; i < TEKRAR_SINIRI; i++) expect(tekrarMi(sayac, c).asildi).toBe(false)
    expect(tekrarMi(sayac, c).asildi).toBe(true)
  })

  it('farklı argümanlar ayrı sayılır', () => {
    const sayac = new Map<string, number>()
    for (let i = 0; i < 10; i++) expect(tekrarMi(sayac, cagri('read_file', { path: `f${i}.ino` })).asildi).toBe(false)
  })

  it('compile hiçbir zaman tekrar nedeniyle reddedilmez', () => {
    const sayac = new Map<string, number>()
    for (let i = 0; i < 10; i++) expect(tekrarMi(sayac, cagri('compile', {})).asildi).toBe(false)
  })
})
