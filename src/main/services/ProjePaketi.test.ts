import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HistoryService } from './HistoryService'
import { guvenliYol, projePaketiniAc, projeyiPaketle, zipOku, zipYaz } from './ProjePaketi'

let kok: string

beforeEach(() => {
  kok = mkdtempSync(join(tmpdir(), 'cloudide-zip-'))
})
afterEach(() => {
  rmSync(kok, { recursive: true, force: true })
})

describe('zip yazma/okuma', () => {
  it('girdileri aynen geri okur (sıkışan ve sıkışmayan içerik)', () => {
    const girdiler = [
      { ad: 'a/x.ino', veri: Buffer.from('merhaba '.repeat(500)) },
      { ad: 'a/y.h', veri: Buffer.from('k') },
      { ad: 'a/ç.cpp', veri: Buffer.from('türkçe içerik') }
    ]
    const geri = zipOku(zipYaz(girdiler))
    expect(geri.map((g) => g.ad)).toEqual(['a/x.ino', 'a/y.h', 'a/ç.cpp'])
    expect(geri[0].veri.equals(girdiler[0].veri)).toBe(true)
    expect(geri[2].veri.toString()).toBe('türkçe içerik')
  })

  it('bozuk veya ZIP olmayan veriyi reddeder', () => {
    expect(() => zipOku(Buffer.from('bu bir zip değil'))).toThrow()
    const zip = zipYaz([{ ad: 'a/x.ino', veri: Buffer.from('x'.repeat(100)) }])
    zip[40] ^= 0xff // sıkıştırılmış veriyi boz
    expect(() => zipOku(zip)).toThrow()
  })

  it('güvensiz yol adlarını reddeder', () => {
    for (const k of ['../x', '/etc/passwd', 'C:/x', 'a/../../b', '']) expect(guvenliYol(k)).toBeNull()
    expect(guvenliYol('a\\b/c.ino')).toBe('a/b/c.ino')
  })
})

describe('proje paketi', () => {
  async function projeKur(ad: string): Promise<string> {
    const p = join(kok, 'kaynak', ad)
    mkdirSync(p, { recursive: true })
    writeFileSync(join(p, `${ad}.ino`), 'void setup(){}\nvoid loop(){}\n')
    writeFileSync(join(p, 'yardim.h'), '#pragma once\n')
    writeFileSync(join(p, 'notlar.txt'), 'pakete girmemeli')
    const h = new HistoryService()
    await h.commit(p, 'ilk')
    writeFileSync(join(p, `${ad}.ino`), 'degisti')
    await h.commit(p, 'ikinci')
    return p
  }

  it('dışa aktarılıp içe aktarılınca dosyalar ve geçmiş korunur', async () => {
    const p = await projeKur('Led')
    const hedef = projePaketiniAc(projeyiPaketle(p), join(kok, 'hedef'))
    expect(readFileSync(join(hedef, 'Led.ino'), 'utf8')).toBe('degisti')
    expect(existsSync(join(hedef, 'notlar.txt'))).toBe(false)
    const l = await new HistoryService().list(hedef)
    expect(l.surumler.map((s) => s.mesaj)).toEqual(['ikinci', 'ilk'])
    // eski sürüme geri yükleme içe aktarılan projede çalışır
    await new HistoryService().restore(hedef, l.surumler[1].id)
    expect(readFileSync(join(hedef, 'Led.ino'), 'utf8')).toContain('setup')
  })

  it('aynı adlı proje varsa yeni klasör açar ve ana .ino ile geçmişi yeniden adlandırır', async () => {
    const p = await projeKur('Led')
    const paket = projeyiPaketle(p)
    const ilk = projePaketiniAc(paket, join(kok, 'hedef'))
    const ikinci = projePaketiniAc(paket, join(kok, 'hedef'))
    expect(ikinci).not.toBe(ilk)
    expect(existsSync(join(ikinci, 'Led_2.ino'))).toBe(true)
    expect(existsSync(join(ikinci, 'Led.ino'))).toBe(false)
    const h = new HistoryService()
    const l = await h.list(ikinci)
    await h.restore(ikinci, l.surumler[1].id)
    expect(existsSync(join(ikinci, 'Led.ino'))).toBe(false) // eski ad geri gelmez
    expect(readFileSync(join(ikinci, 'Led_2.ino'), 'utf8')).toContain('setup')
  })

  it('proje notları pakete girer ve içe aktarılınca geri gelir', async () => {
    const p = await projeKur('Notlu')
    writeFileSync(join(p, 'NOTLAR.md'), '# parçalar\n- servo')
    const hedef = projePaketiniAc(projeyiPaketle(p), join(kok, 'hedef'))
    expect(readFileSync(join(hedef, 'NOTLAR.md'), 'utf8')).toBe('# parçalar\n- servo')
  })

  it('zip-slip, çalıştırılabilir dosya ve çoklu kök içeren paketleri reddeder', () => {
    const hedef = join(kok, 'h')
    expect(() => projePaketiniAc(zipYaz([{ ad: '../kacis.ino', veri: Buffer.from('x') }]), hedef)).toThrow()
    expect(() =>
      projePaketiniAc(
        zipYaz([
          { ad: 'A/A.ino', veri: Buffer.from('x') },
          { ad: 'B/B.ino', veri: Buffer.from('x') }
        ]),
        hedef
      )
    ).toThrow()
    const k = projePaketiniAc(
      zipYaz([
        { ad: 'A/A.ino', veri: Buffer.from('x') },
        { ad: 'A/virus.exe', veri: Buffer.from('MZ') },
        { ad: 'A/.history/evil.sh', veri: Buffer.from('x') }
      ]),
      hedef
    )
    expect(existsSync(join(k, 'A.ino'))).toBe(true)
    expect(existsSync(join(k, 'virus.exe'))).toBe(false)
    expect(existsSync(join(k, '.history', 'evil.sh'))).toBe(false)
  })

  it('.ino içermeyen paketi reddeder', () => {
    expect(() => projePaketiniAc(zipYaz([{ ad: 'A/x.h', veri: Buffer.from('x') }]), join(kok, 'h'))).toThrow()
  })
})
