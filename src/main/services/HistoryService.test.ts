import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HistoryService } from './HistoryService'

let proje: string
let h: HistoryService

const yaz = (ad: string, icerik: string): void => writeFileSync(join(proje, ad), icerik)
const oku = (ad: string): string => readFileSync(join(proje, ad), 'utf8')

beforeEach(() => {
  proje = mkdtempSync(join(tmpdir(), 'cloudide-hist-'))
  h = new HistoryService()
  yaz('p.ino', 'void setup(){}\nvoid loop(){}\n')
})

afterEach(() => {
  rmSync(proje, { recursive: true, force: true })
})

describe('HistoryService', () => {
  it('ilk sürümü kaydeder ve listeler', async () => {
    const c = await h.commit(proje, 'ilk')
    expect(c?.mesaj).toBe('ilk')
    const l = await h.list(proje)
    expect(l.surumler).toHaveLength(1)
    expect(l.aktifDal).toBe('ana')
    expect(l.surumler[0].dosyaSayisi).toBe(1)
  })

  it('değişiklik yoksa yeni sürüm üretmez', async () => {
    await h.commit(proje, 'a')
    expect(await h.commit(proje, 'b')).toBeNull()
    expect((await h.list(proje)).surumler).toHaveLength(1)
  })

  it('status değişen, eklenen ve silinen dosyaları bildirir', async () => {
    yaz('a.h', 'x')
    await h.commit(proje, 'a')
    yaz('p.ino', 'degisti')
    yaz('b.cpp', 'yeni')
    rmSync(join(proje, 'a.h'))
    const s = await h.status(proje)
    expect(s.degisenler).toEqual(
      expect.arrayContaining([
        { ad: 'p.ino', durum: 'degisti' },
        { ad: 'b.cpp', durum: 'eklendi' },
        { ad: 'a.h', durum: 'silindi' }
      ])
    )
  })

  it('diff sürümler ve çalışma kopyası arasında içerik döner', async () => {
    const a = await h.commit(proje, 'a')
    yaz('p.ino', 'yeni icerik')
    const b = await h.commit(proje, 'b')
    const d = await h.diff(proje, a!.id, b!.id)
    expect(d).toEqual([{ ad: 'p.ino', durum: 'degisti', eski: 'void setup(){}\nvoid loop(){}\n', yeni: 'yeni icerik' }])
    yaz('p.ino', 'calisma')
    const c = await h.diff(proje, b!.id, 'calisma')
    expect(c[0].yeni).toBe('calisma')
  })

  it('geri yükleme dosyaları eski hale getirir, eklenenleri siler ve geri alınabilir', async () => {
    const a = await h.commit(proje, 'a')
    yaz('p.ino', 'sonra')
    yaz('ek.h', 'ek')
    await h.restore(proje, a!.id)
    expect(oku('p.ino')).toBe('void setup(){}\nvoid loop(){}\n')
    expect(existsSync(join(proje, 'ek.h'))).toBe(false)
    // Geri yükleme öncesi otomatik kayıt oluştu: "sonra" hali kurtarılabilir
    const l = await h.list(proje)
    const oncesi = l.surumler.find((s) => s.tur === 'geri-yukleme-oncesi')
    expect(oncesi).toBeDefined()
    await h.restore(proje, oncesi!.id)
    expect(oku('p.ino')).toBe('sonra')
    expect(oku('ek.h')).toBe('ek')
  })

  it('tek dosya geri yükleme diğer dosyalara dokunmaz', async () => {
    yaz('a.h', 'a1')
    const c = await h.commit(proje, 'a')
    yaz('a.h', 'a2')
    yaz('p.ino', 'p2')
    const degisen = await h.restore(proje, c!.id, ['a.h'])
    expect(degisen).toEqual(['a.h'])
    expect(oku('a.h')).toBe('a1')
    expect(oku('p.ino')).toBe('p2')
  })

  it('geçersiz dosya adı ve sürüm kimliğini reddeder', async () => {
    const c = await h.commit(proje, 'a')
    await expect(h.restore(proje, c!.id, ['../x.ino'])).rejects.toThrow()
    await expect(h.restore(proje, '../../etc')).rejects.toThrow()
    await expect(h.diff(proje, 'bozuk id', 'calisma')).rejects.toThrow()
  })

  it('etiketler eklenir, tekrarı reddedilir ve kaldırılır', async () => {
    const c = await h.commit(proje, 'a')
    await h.etiketle(proje, c!.id, 'v1.0')
    expect((await h.list(proje)).surumler[0].etiketler).toEqual(['v1.0'])
    await expect(h.etiketle(proje, c!.id, 'v1.0')).rejects.toThrow()
    await expect(h.etiketle(proje, c!.id, 'kötü ad!')).rejects.toThrow()
    await h.etiketiKaldir(proje, 'v1.0')
    expect((await h.list(proje)).surumler[0].etiketler).toEqual([])
  })

  it('dallar: oluşturma, geçiş, bağımsız geçmiş ve kirli kopyada engelleme', async () => {
    const a = await h.commit(proje, 'a')
    await h.dalOlustur(proje, 'deney', a!.id)
    yaz('p.ino', 'deney surumu')
    await h.commit(proje, 'deney 1')
    expect((await h.list(proje)).aktifDal).toBe('deney')
    expect((await h.list(proje)).surumler).toHaveLength(2)
    expect((await h.list(proje, 'ana')).surumler).toHaveLength(1)

    yaz('p.ino', 'kaydedilmemis')
    await expect(h.dalaGec(proje, 'ana')).rejects.toThrow(/Kaydedilmemiş/)
    expect(oku('p.ino')).toBe('kaydedilmemis')

    await h.commit(proje, 'deney 2')
    await h.dalaGec(proje, 'ana')
    expect(oku('p.ino')).toBe('void setup(){}\nvoid loop(){}\n')
    await expect(h.dalSil(proje, 'ana')).rejects.toThrow()
    await h.dalSil(proje, 'deney')
    expect((await h.list(proje)).dallar).toEqual(['ana'])
  })

  it('aynı içerik tekrar depolanmaz', async () => {
    await h.commit(proje, 'a')
    yaz('p.ino', 'baska')
    await h.commit(proje, 'b')
    yaz('p.ino', 'void setup(){}\nvoid loop(){}\n')
    await h.commit(proje, 'c')
    expect(readdirSync(join(proje, '.history', 'objects'))).toHaveLength(2)
  })

  it('budama: yalnızca otomatik kayıtları eler, etiketli ve elle olanları korur, zinciri bozmaz', async () => {
    const sira = ['a', 'b', 'c', 'd', 'e', 'f']
    for (const s of sira) {
      yaz('p.ino', s)
      await h.commit(proje, s, s === 'a' ? 'elle' : 'otomatik')
    }
    const oncesi = (await h.list(proje)).surumler
    await h.etiketle(proje, oncesi.find((x) => x.mesaj === 'c')!.id, 'onemli')
    const silinen = await h.prune(proje, 2)
    // f dal ucu, c etiketli, a elle → korunur; kalan adaylar e, d, b → en yeni 2'si (e, d) kalır, b elenir
    expect(silinen).toBe(1)
    const kalan = (await h.list(proje)).surumler.map((x) => x.mesaj)
    expect(kalan).toEqual(['f', 'e', 'd', 'c', 'a'])
    expect(await h.prune(proje, 0)).toBe(2) // e ve d de elenir; zincir f → c → a olarak yeniden bağlanır
    expect((await h.list(proje)).surumler.map((x) => x.mesaj)).toEqual(['f', 'c', 'a'])
  })

  it('bozuk refs.json ve eksik commit dosyası çökertmez', async () => {
    await h.commit(proje, 'a')
    writeFileSync(join(proje, '.history', 'refs.json'), '{bozuk')
    expect((await h.list(proje)).surumler).toEqual([])
    const s = await h.status(proje)
    expect(s.degisenler.length).toBeGreaterThan(0)
  })

  it('.history klasörü ve kaynak olmayan dosyalar sürüme girmez', async () => {
    yaz('notlar.txt', 'x')
    yaz('veri.bin', 'x')
    const c = await h.commit(proje, 'a')
    expect(c?.dosyaSayisi).toBe(1)
  })

  it('eşzamanlı commit çağrıları sıraya girer', async () => {
    yaz('p.ino', '1')
    const [a, b] = await Promise.all([h.commit(proje, 'x'), h.commit(proje, 'y')])
    expect([a, b].filter(Boolean)).toHaveLength(1)
    expect((await h.list(proje)).surumler).toHaveLength(1)
  })

  it('derleme kaydı: dosyalar sürümle aynıysa sürüme işlenir, değiştiyse otomatik sürüm açılır', async () => {
    const meta = { fqbn: 'arduino:avr:uno', zaman: 1, kutuphaneler: { Servo: '1.2.1' }, boyut: { flash: { kullanilan: 10, azami: 100 } } }
    const a = await h.commit(proje, 'a')
    const k1 = await h.derlemeKaydet(proje, meta, true)
    expect(k1?.id).toBe(a!.id) // yeni sürüm açılmadı
    expect(k1?.derleme?.fqbn).toBe('arduino:avr:uno')

    yaz('p.ino', 'degisti')
    expect(await h.derlemeKaydet(proje, meta, false)).toBeNull() // otomatik kapalıyken sürüm açılmaz
    const k2 = await h.derlemeKaydet(proje, meta, true)
    expect(k2?.tur).toBe('derleme')
    expect(k2?.id).not.toBe(a!.id)
    expect((await h.list(proje)).surumler[0].derleme?.kutuphaneler).toEqual({ Servo: '1.2.1' })
  })

  it('yükleme işareti yalnızca dosyalar aynıyken ve derlenmiş uca konur', async () => {
    await h.commit(proje, 'a')
    await h.yuklemeIsaretle(proje) // derleme bilgisi yok → etkisiz
    expect((await h.list(proje)).surumler[0].derleme).toBeUndefined()
    await h.derlemeKaydet(proje, { fqbn: 'x:y:z', zaman: 1, kutuphaneler: {} }, true)
    await h.yuklemeIsaretle(proje)
    expect((await h.list(proje)).surumler[0].derleme?.yuklendi).toBe(true)
    // Aynı kartla yeniden derleme yükleme işaretini korur, farklı kartla sıfırlar
    await h.derlemeKaydet(proje, { fqbn: 'x:y:z', zaman: 2, kutuphaneler: {} }, true)
    expect((await h.list(proje)).surumler[0].derleme?.yuklendi).toBe(true)
    await h.derlemeKaydet(proje, { fqbn: 'baska:kart:q', zaman: 3, kutuphaneler: {} }, true)
    expect((await h.list(proje)).surumler[0].derleme?.yuklendi).toBeUndefined()
  })

  it('proje notları (NOTLAR.md) sürümlenir ve geri yüklenir; diğer .md dosyaları sürüme girmez', async () => {
    yaz('NOTLAR.md', '# Notlar\n- parça listesi')
    yaz('README.md', 'sürüme girmemeli')
    const a = await h.commit(proje, 'a')
    expect(a?.dosyaSayisi).toBe(2) // p.ino + NOTLAR.md
    yaz('NOTLAR.md', 'degisti')
    await h.restore(proje, a!.id)
    expect(oku('NOTLAR.md')).toBe('# Notlar\n- parça listesi')
    expect(oku('README.md')).toBe('sürüme girmemeli')
  })
})
