import { describe, expect, it } from 'vitest'
import { surumNotunuSadelestir } from './surumNotlari'

describe('surumNotunuSadelestir', () => {
  it('HTML etiketlerini temizler, liste öğelerini madde yapar', () => {
    const s = surumNotunuSadelestir('<h2>Yenilikler</h2><ul><li>Sürüm geçmişi</li><li>Pin &amp; harita</li></ul>')
    expect(s).toContain('Yenilikler')
    expect(s).toContain('• Sürüm geçmişi')
    expect(s).toContain('Pin & harita')
    expect(s).not.toContain('<')
  })
  it('Markdown başlık ve kalın işaretlerini sadeleştirir', () => {
    expect(surumNotunuSadelestir('## Yenilikler\n**Hızlı** derleme')).toBe('Yenilikler\nHızlı derleme')
  })
  it('dizi biçimindeki notları birleştirir ve uzun metni keser', () => {
    expect(surumNotunuSadelestir([{ note: 'a' }, { note: 'b' }])).toBe('a\n\nb')
    expect(surumNotunuSadelestir('x'.repeat(3000), 100)).toHaveLength(101)
  })
  it('tanınmayan girdide boş metin döner', () => {
    expect(surumNotunuSadelestir(undefined)).toBe('')
    expect(surumNotunuSadelestir(42)).toBe('')
  })
})
