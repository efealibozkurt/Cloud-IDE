import { describe, expect, it } from 'vitest'
import { MetinAkisSuzgeci, metinAraclariniAyikla } from './textProtocol'

function suz(parcalar: string[]): { gorunen: string; gizlendi: boolean } {
  const f = new MetinAkisSuzgeci()
  let g = ''
  for (const p of parcalar) g += f.isle(p)
  g += f.bosalt()
  return { gorunen: g, gizlendi: f.aracBasladiMi() }
}

describe('MetinAkisSuzgeci', () => {
  it('düz metni aynen geçirir', () => {
    expect(suz(['Merhaba ', 'dünya']).gorunen).toBe('Merhaba dünya')
  })

  it('araç bloğunun öncesindeki metni gösterir, bloğu gizler', () => {
    const r = suz(['Dosyayı okuyorum.\n<tool name="read_file"><arg name="path">a.ino</arg></tool>'])
    expect(r.gorunen).toBe('Dosyayı okuyorum.\n')
    expect(r.gizlendi).toBe(true)
  })

  it('etiket parçalara bölünse bile gizler', () => {
    const r = suz(['Bakıyorum <to', 'ol name="read_', 'file">...'])
    expect(r.gorunen).toBe('Bakıyorum ')
    expect(r.gizlendi).toBe(true)
  })

  it('<tool_call> (Hermes) biçimini de gizler', () => {
    const r = suz(['Tamam. <tool_call>{"name":"read_file","arguments":{"path":"a"}}</tool_call>'])
    expect(r.gorunen).toBe('Tamam. ')
  })

  it('"<tool" ile başlayan sıradan metni/kodu YUTMAZ (örn. #include <toolbar.h>)', () => {
    const r = suz(['Şunu ekleyin:\n```cpp\n#include <toolbar.h>\n```\nSonra derleyin ve test edin.'])
    expect(r.gizlendi).toBe(false)
    expect(r.gorunen).toContain('Sonra derleyin ve test edin.')
    expect(r.gorunen).toContain('<toolbar.h>')
  })

  it('akış sonunda yarım kalmış masum bir "<" işaretini kaybetmez', () => {
    expect(suz(['if (a <', ' b) {}']).gorunen).toBe('if (a < b) {}')
    expect(suz(['x <to']).gorunen).toBe('x <to')
  })
})

describe('metinAraclariniAyikla', () => {
  const izinli = new Set(['write_file', 'read_file', 'edit_file'])

  it('write_file bloğunu argümanlarıyla çözer', () => {
    const { calls, temiz } = metinAraclariniAyikla(
      'Yazıyorum.\n<tool name="write_file"><arg name="path">S/a.h</arg><content>\n```cpp\nint a;\n```\n</content></tool>',
      izinli
    )
    expect(calls).toHaveLength(1)
    expect(calls[0].name).toBe('write_file')
    expect(calls[0].args.path).toBe('S/a.h')
    expect(calls[0].args.content).toBe('int a;')
    expect(temiz).toBe('Yazıyorum.')
  })

  it('izinli olmayan aracı yok sayar', () => {
    const { calls } = metinAraclariniAyikla('<tool name="rm_rf"><arg name="path">/</arg></tool>', izinli)
    expect(calls).toHaveLength(0)
  })

  it('edit_file için old/new etiketlerini çözer', () => {
    const { calls } = metinAraclariniAyikla(
      '<tool name="edit_file"><arg name="path">S/S.ino</arg><old>delay(1000);</old><new>delay(10);</new></tool>',
      izinli
    )
    expect(calls[0].args.old_text).toBe('delay(1000);')
    expect(calls[0].args.new_text).toBe('delay(10);')
  })

  it('kapanış etiketi unutulmuş blokta içeriği sonuna kadar alır', () => {
    const { calls } = metinAraclariniAyikla('<tool name="write_file"><arg name="path">a.h</arg><content>int z;', izinli)
    expect(calls[0].args.content).toBe('int z;')
  })
})
