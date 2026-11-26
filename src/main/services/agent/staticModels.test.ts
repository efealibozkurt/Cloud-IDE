import { describe, expect, it } from 'vitest'
import { GEMINI_ONERILEN_MODELLER, STATIK_MODELLER, geminiModelleriniSirala } from './staticModels'

describe('geminiModelleriniSirala', () => {
  it('önerilen modelleri başa alır, kalanların sırasını korur', () => {
    const liste = ['gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-eski', 'gemini-3.8-flash']
    expect(geminiModelleriniSirala(liste)).toEqual([
      'gemini-3.8-flash',
      'gemini-3.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-eski'
    ])
  })

  it('listede olmayan modeli eklemez', () => {
    expect(geminiModelleriniSirala(['gemini-x'])).toEqual(['gemini-x'])
  })

  it('yedek liste varsayılan modelle başlar', () => {
    expect(STATIK_MODELLER.gemini[0]).toBe(GEMINI_ONERILEN_MODELLER[0])
  })
})
