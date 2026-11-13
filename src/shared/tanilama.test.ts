import { describe, expect, it } from 'vitest'
import { ciktiyiKisalt, metniTemizle, raporuBicimle, sorunAdresi, type RaporGirdisi } from './tanilama'

const SISTEM = {
  uygulamaSurumu: '0.1.5',
  kodAdi: 'Stratus',
  electron: '31.0.0',
  chrome: '126',
  node: '20.0',
  isletimSistemi: 'Windows 11',
  mimari: 'x64',
  ramGb: 16,
  cliSurumu: '1.5.1',
  kartPaketleri: [{ id: 'arduino:avr', surum: '1.8.8' }],
  kutuphaneler: [{ ad: 'Servo', surum: '1.2.1' }],
  anaGunluk: ['[t] error Bir şey olmadı']
}

function girdi(ek: Partial<RaporGirdisi> = {}): RaporGirdisi {
  return {
    sistem: SISTEM,
    aciklama: 'Yükleme başarısız oluyor',
    kart: { fqbn: 'arduino:avr:nano', secenekler: { cpu: 'atmega328old' } },
    derleme: { basarili: false, hatalar: [{ dosya: 'C:\\Users\\Ali\\Sketch\\a.ino', satir: 3, tur: 'error', mesaj: 'x yok' }], cikti: 'satir1\nsatir2' },
    secimler: { sistem: true, kart: true, paketler: true, derleme: true, gunluk: true, kod: false },
    zaman: '2026-11-12T10:00:00Z',
    ...ek
  }
}

describe('metniTemizle', () => {
  it('kullanıcı klasörünü ve adını yollardan temizler', () => {
    const t = metniTemizle('Hata: C:\\Users\\Ali\\Documents\\x.ino ve C:/Users/Ali/y.ino', { anaDizin: 'C:\\Users\\Ali', kullaniciAdi: 'Ali' })
    expect(t).not.toMatch(/Ali/)
    expect(t).toContain('~')
  })
  it('anaDizin verilmese de Users yolundaki adı gizler', () => {
    expect(metniTemizle('C:\\Users\\Mehmet\\Desktop\\a.ino')).toBe('C:\\Users\\<kullanici>\\Desktop\\a.ino')
    expect(metniTemizle('/home/ayse/proje')).toBe('/home/<kullanici>/proje')
  })
  it('API anahtarlarını ve belirteçleri gizler', () => {
    const t = metniTemizle('key sk-abcdefghijklmnopqrstuv AIzaSyA1234567890abcdefghijk nvapi-abcdefghijklmnop0000 Bearer abcdefghijklmnop12345 ghp_abcdefghijklmnopqrstuvwxyz1234')
    expect(t).not.toMatch(/sk-abc|AIzaSy|nvapi-abc|abcdefghijklmnop1|ghp_abc/)
    expect(t.match(/<api-anahtari>/g)?.length).toBe(4)
    expect(t).toContain('Bearer <belirtec>')
  })
  it('api_key=... biçimini ve URL içindeki kimliği gizler', () => {
    expect(metniTemizle('api_key=supersecretvalue1')).toContain('<gizli>')
    expect(metniTemizle('https://user:pass123@example.com/x')).toBe('https://<kimlik>@example.com/x')
  })
  it('e-posta ve IP adresini gizler, yerel döngüyü korur', () => {
    const t = metniTemizle('mail a.b@site.com ip 192.168.1.20 ve 127.0.0.1')
    expect(t).toContain('<e-posta>')
    expect(t).toContain('<ip>')
    expect(t).toContain('127.0.0.1')
  })
  it('sürüm numaralarını IP sanıp bozmaz', () => {
    expect(metniTemizle('arduino-cli 1.5.1 ve 0.1.5')).toBe('arduino-cli 1.5.1 ve 0.1.5')
  })
})

describe('metniTemizle: ek kalıplar (inceleme bulguları)', () => {
  it('boşluk içeren Windows kullanıcı adını tamamen gizler', () => {
    expect(metniTemizle('C:\\Users\\Ali Veli\\Documents\\x.ino')).toBe('C:\\Users\\<kullanici>\\Documents\\x.ino')
  })
  it('JSON içinde kaçışlı (çift ters eğik çizgili) yolu ana dizinle eşleştirir', () => {
    const t = metniTemizle('{"yol":"C:\\\\Users\\\\Ali\\\\proje"}', { anaDizin: 'C:\\Users\\Ali' })
    expect(t).not.toContain('Ali')
    expect(t).toContain('~')
  })
  it('UNC sunucu adını gizler, normal çift ters eğik çizgili yolu bozmaz', () => {
    expect(metniTemizle('\\\\LAPTOP-AB\\paylasim\\a.ino')).toBe('\\\\<sunucu>\\paylasim\\a.ino')
    expect(metniTemizle('{"y":"C:\\\\Temp\\\\a"}')).toContain('C:\\\\Temp')
  })
  it('JSON biçimli ve tırnak içinde boşluklu gizli değerleri gizler', () => {
    expect(metniTemizle('{"api_key": "my secret 123"}')).not.toContain('my secret')
    expect(metniTemizle("password='bir iki uc'")).not.toContain('bir iki')
  })
  it('JWT, AWS, GitHub ince ayarlı belirteç ve Basic yetkilendirmesini gizler', () => {
    const t = metniTemizle(
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghij1234567890 AKIAIOSFODNN7EXAMPLE github_pat_11ABCDEFG0abcdefghijklmnop Authorization: Basic dXNlcjpwYXNzd29yZDEyMzQ1'
    )
    expect(t).not.toMatch(/eyJhbG|AKIAIOS|github_pat_11|dXNlcjpw/)
    expect(t).toContain('<jwt>')
  })
  it('her protokoldeki URL kimliğini gizler', () => {
    expect(metniTemizle('ftp://ali:parola1@sunucu.com/x')).toBe('ftp://<kimlik>@sunucu.com/x')
    expect(metniTemizle('https://ghp_belirtecbelirtec@github.com/r')).toContain('<kimlik>@')
  })
  it('IPv6 adresini gizler; saat ve ::1 değerlerini bozmaz', () => {
    expect(metniTemizle('adres 2001:db8:85a3::8a2e:370:7334 son')).toContain('<ipv6>')
    expect(metniTemizle('[10:15:32] ve ::1')).toBe('[10:15:32] ve ::1')
  })
  it('ASCII dışı kullanıcı adını (çağrı) gizler', () => {
    expect(metniTemizle('merhaba çağrı nasılsın', { kullaniciAdi: 'çağrı' })).toBe('merhaba <kullanici> nasılsın')
  })
  it('koddaki Wi-Fi adı ve şifresini gizler', () => {
    const t = metniTemizle('const char* WIFI_ADI = "EvAgim";\nconst char* WIFI_SIFRE = "gizli1234";\nWiFi.begin("Ofis", "sifre99");')
    expect(t).not.toMatch(/EvAgim|gizli1234|Ofis|sifre99/)
  })
  it('sürüm numaralarını ve saatleri bozmaz', () => {
    expect(metniTemizle('Windows 10.0.22621.3007 ve 1.5.1 saat 12:30:45')).toBe('Windows 10.0.22621.3007 ve 1.5.1 saat 12:30:45')
  })
})

describe('ciktiyiKisalt', () => {
  it('çok uzun komut satırlarını atar ama uzun gcc hatasını korur', () => {
    const uzun = 'x'.repeat(400)
    const hata = 'a.ino:1:1: error: ' + 'y'.repeat(400)
    const k = ciktiyiKisalt(`${uzun}\nnormal\n${hata}`)
    expect(k).toContain('normal')
    expect(k).toContain('error:')
    expect(k).not.toContain('xxxxxxxxxx')
  })
  it('yalnızca son N satırı tutar', () => {
    const k = ciktiyiKisalt(Array.from({ length: 100 }, (_, i) => `s${i}`).join('\n'), 5)
    expect(k.split('\n')).toEqual(['s95', 's96', 's97', 's98', 's99'])
  })
})

describe('raporuBicimle', () => {
  it('seçili bölümleri içerir ve kişisel yolu temizler', () => {
    const r = raporuBicimle(girdi(), { anaDizin: 'C:\\Users\\Ali', kullaniciAdi: 'Ali' })
    expect(r).toContain('# Cloud IDE sorun raporu')
    expect(r).toContain('v0.1.5 Stratus')
    expect(r).toContain('arduino:avr:nano')
    expect(r).toContain('cpu=atmega328old')
    expect(r).toContain('a.ino:3 error: x yok')
    expect(r).toContain('Servo 1.2.1')
    expect(r).not.toMatch(/Ali\b/)
  })
  it('kapalı bölümleri ve kapalı kodu dışarıda bırakır', () => {
    const r = raporuBicimle(girdi({ secimler: { sistem: false, kart: false, paketler: false, derleme: false, gunluk: false, kod: false }, kod: { dosya: 'a.ino', icerik: 'GIZLI KOD' } }))
    expect(r).not.toContain('## Sistem')
    expect(r).not.toContain('## Kart')
    expect(r).not.toContain('Servo')
    expect(r).not.toContain('GIZLI KOD')
    expect(r).toContain('Yükleme başarısız oluyor')
  })
  it('kod seçilince ekler, uzun kodu kırpar, içindeki API anahtarını yine de gizler', () => {
    const icerik = Array.from({ length: 300 }, (_, i) => `satir ${i}`).join('\n') + '\nconst k = "sk-abcdefghijklmnopqrstuvwxyz";'
    const r = raporuBicimle(girdi({ secimler: { sistem: false, kart: false, paketler: false, derleme: false, gunluk: false, kod: true }, kod: { dosya: 'a.ino', icerik } }))
    expect(r).toContain('## Kod: a.ino')
    expect(r).toContain('İlk 250 satır')
    expect(r).not.toContain('satir 299')
  })
  it('açıklama boşsa bunu belirtir', () => {
    expect(raporuBicimle(girdi({ aciklama: '   ' }))).toContain('Açıklama girilmedi')
  })
})

describe('sorunAdresi', () => {
  it('depo adresine başlık ve gövdeyi kodlayarak ekler', () => {
    const a = sorunAdresi('Başlık & test', 'Gövde')
    expect(a.startsWith('https://github.com/efealibozkurt/Cloud-IDE/issues/new?title=')).toBe(true)
    expect(a).toContain(encodeURIComponent('Başlık & test'))
  })
  it('uzun gövdeyi kısaltır ve bunu belirtir', () => {
    const a = sorunAdresi('b', 'x'.repeat(9000))
    expect(a.length).toBeLessThan(9000)
    expect(decodeURIComponent(a)).toContain('rapor kısaltıldı')
  })
})
