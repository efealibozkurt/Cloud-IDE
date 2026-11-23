import { createHash, randomBytes } from 'crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { basename, extname, join, resolve, sep } from 'path'
import { gunzipSync, gzipSync } from 'zlib'
import type {
  BuildMeta,
  HistoryCommit,
  HistoryCommitKind,
  HistoryDiffFile,
  HistoryListResult,
  HistoryStatus
} from '../../shared/types'

/**
 * Proje bazlı sürüm geçmişi. Depo, proje klasörünün içindeki gizli `.history` klasöründedir:
 *   objects/<sha256>  gzip'li dosya içerikleri (içerik adresli, kopya yazılmaz)
 *   commits/<id>.json sürüm kaydı
 *   refs.json         dallar, etiketler, aktif dal
 * Yalnızca Node fs kullanır; Electron'a bağımlı değildir.
 */

const GECERLI_UZANTILAR = new Set(['.ino', '.h', '.hpp', '.cpp', '.c'])
/** Kaynak olmayan ama projeyle birlikte sürümlenen dosyalar */
const NOTLAR_DOSYASI = 'NOTLAR.md'
const BAGLANTI_DOSYASI = 'BAGLANTI.json'

function surumluDosyaMi(ad: string): boolean {
  return ad === NOTLAR_DOSYASI || ad === BAGLANTI_DOSYASI || GECERLI_UZANTILAR.has(extname(ad).toLowerCase())
}
const MAKS_DOSYA_BAYT = 512 * 1024
const ID_DESENI = /^[a-z0-9]{8,40}$/
const AD_DESENI = /^[\p{L}\p{N}._-]{1,40}$/u
const MAKS_MESAJ = 200
const VARSAYILAN_DAL = 'ana'
const OTOMATIK_TURLER: HistoryCommitKind[] = ['otomatik', 'agent-oncesi', 'geri-yukleme-oncesi', 'derleme']

interface Refs {
  dallar: Record<string, string>
  etiketler: Record<string, string>
  aktifDal: string
}

interface DepoCommit extends HistoryCommit {
  dosyalar: Record<string, string>
}

export class HistoryService {
  private kuyruk = new Map<string, Promise<unknown>>()

  /** Aynı proje üzerindeki işlemleri sıraya dizer (yarış durumunda bozuk manifest oluşmasın). */
  private kilitli<T>(proje: string, is: () => T | Promise<T>): Promise<T> {
    const anahtar = resolve(proje)
    const onceki = this.kuyruk.get(anahtar) ?? Promise.resolve()
    const sonraki = onceki.then(is, is)
    this.kuyruk.set(
      anahtar,
      sonraki.catch(() => undefined)
    )
    return sonraki
  }

  // ───────── yardımcılar ─────────

  private kok(proje: string): string {
    return join(resolve(proje), '.history')
  }

  private projeDogrula(proje: string): string {
    const yol = resolve(proje)
    if (!existsSync(yol) || !statSync(yol).isDirectory()) throw new Error('Proje klasörü bulunamadı')
    return yol
  }

  private idDogrula(id: string): void {
    if (!ID_DESENI.test(id)) throw new Error('Geçersiz sürüm kimliği')
  }

  private adDogrula(ad: string, tur: string): string {
    const temiz = ad.trim()
    if (!AD_DESENI.test(temiz)) throw new Error(`Geçersiz ${tur} adı (harf, rakam, . _ - kullanın; en çok 40 karakter)`)
    return temiz
  }

  private atomikYaz(yol: string, veri: string | Buffer): void {
    const gecici = `${yol}.${randomBytes(4).toString('hex')}.tmp`
    writeFileSync(gecici, veri)
    renameSync(gecici, yol)
  }

  private refsOku(proje: string): Refs {
    const yol = join(this.kok(proje), 'refs.json')
    try {
      const ham = JSON.parse(readFileSync(yol, 'utf8')) as Partial<Refs>
      return {
        dallar: ham.dallar && typeof ham.dallar === 'object' ? ham.dallar : {},
        etiketler: ham.etiketler && typeof ham.etiketler === 'object' ? ham.etiketler : {},
        aktifDal: typeof ham.aktifDal === 'string' && ham.aktifDal ? ham.aktifDal : VARSAYILAN_DAL
      }
    } catch {
      return { dallar: {}, etiketler: {}, aktifDal: VARSAYILAN_DAL }
    }
  }

  private refsYaz(proje: string, refs: Refs): void {
    mkdirSync(this.kok(proje), { recursive: true })
    this.atomikYaz(join(this.kok(proje), 'refs.json'), JSON.stringify(refs, null, 2))
  }

  private commitOku(proje: string, id: string): DepoCommit | null {
    try {
      const c = JSON.parse(readFileSync(join(this.kok(proje), 'commits', `${id}.json`), 'utf8')) as DepoCommit
      if (!c || typeof c.id !== 'string' || typeof c.dosyalar !== 'object') return null
      return c
    } catch {
      return null
    }
  }

  private tumCommitler(proje: string): DepoCommit[] {
    const klasor = join(this.kok(proje), 'commits')
    if (!existsSync(klasor)) return []
    const sonuc: DepoCommit[] = []
    for (const ad of readdirSync(klasor)) {
      if (!ad.endsWith('.json')) continue
      const c = this.commitOku(proje, ad.slice(0, -5))
      if (c) sonuc.push(c)
    }
    return sonuc
  }

  private blobYaz(proje: string, icerik: Buffer): string {
    const sha = createHash('sha256').update(icerik).digest('hex')
    const klasor = join(this.kok(proje), 'objects')
    const yol = join(klasor, sha)
    if (!existsSync(yol)) {
      mkdirSync(klasor, { recursive: true })
      this.atomikYaz(yol, gzipSync(icerik))
    }
    return sha
  }

  private blobOku(proje: string, sha: string): Buffer {
    if (!/^[a-f0-9]{64}$/.test(sha)) throw new Error('Geçersiz içerik kimliği')
    return gunzipSync(readFileSync(join(this.kok(proje), 'objects', sha)))
  }

  /** Çalışma kopyasındaki kaynak dosyaları okur (ad → içerik). */
  private calismaDosyalari(proje: string): Map<string, Buffer> {
    const sonuc = new Map<string, Buffer>()
    for (const g of readdirSync(proje, { withFileTypes: true })) {
      if (!g.isFile() || !surumluDosyaMi(g.name)) continue
      const yol = join(proje, g.name)
      if (statSync(yol).size > MAKS_DOSYA_BAYT) continue
      sonuc.set(g.name, readFileSync(yol))
    }
    return sonuc
  }

  private dosyaAdiGuvenliMi(ad: string): boolean {
    return ad === basename(ad) && surumluDosyaMi(ad) && !ad.startsWith('.')
  }

  private shaHaritasi(dosyalar: Map<string, Buffer>): Record<string, string> {
    const h: Record<string, string> = {}
    for (const [ad, icerik] of dosyalar) h[ad] = createHash('sha256').update(icerik).digest('hex')
    return h
  }

  private baslikOzeti(c: DepoCommit, refs: Refs): HistoryCommit {
    const etiketler = Object.entries(refs.etiketler)
      .filter(([, id]) => id === c.id)
      .map(([ad]) => ad)
    return {
      id: c.id,
      parent: c.parent,
      dal: c.dal,
      mesaj: c.mesaj,
      zaman: c.zaman,
      tur: c.tur,
      dosyaSayisi: Object.keys(c.dosyalar).length,
      etiketler,
      derleme: c.derleme
    }
  }

  private basSurum(proje: string, refs: Refs): DepoCommit | null {
    const id = refs.dallar[refs.aktifDal]
    return id ? this.commitOku(proje, id) : null
  }

  private ayniMi(a: Record<string, string>, b: Record<string, string>): boolean {
    const ka = Object.keys(a)
    if (ka.length !== Object.keys(b).length) return false
    return ka.every((k) => a[k] === b[k])
  }

  // ───────── sorgular ─────────

  status(proje: string): Promise<HistoryStatus> {
    return this.kilitli(proje, () => {
      const yol = this.projeDogrula(proje)
      const refs = this.refsOku(yol)
      const bas = this.basSurum(yol, refs)
      const simdi = this.shaHaritasi(this.calismaDosyalari(yol))
      const eski = bas?.dosyalar ?? {}
      const degisenler: HistoryStatus['degisenler'] = []
      for (const ad of Object.keys(simdi)) {
        if (!(ad in eski)) degisenler.push({ ad, durum: 'eklendi' })
        else if (eski[ad] !== simdi[ad]) degisenler.push({ ad, durum: 'degisti' })
      }
      for (const ad of Object.keys(eski)) if (!(ad in simdi)) degisenler.push({ ad, durum: 'silindi' })
      return { aktifDal: refs.aktifDal, basId: bas?.id ?? null, degisenler }
    })
  }

  list(proje: string, dal?: string): Promise<HistoryListResult> {
    return this.kilitli(proje, () => {
      const yol = this.projeDogrula(proje)
      const refs = this.refsOku(yol)
      const hedef = dal ?? refs.aktifDal
      const sonuc: HistoryCommit[] = []
      const gorulen = new Set<string>()
      let id: string | null | undefined = refs.dallar[hedef]
      while (id && !gorulen.has(id)) {
        gorulen.add(id)
        const c = this.commitOku(yol, id)
        if (!c) break
        sonuc.push(this.baslikOzeti(c, refs))
        id = c.parent
      }
      return {
        aktifDal: refs.aktifDal,
        dallar: Object.keys(refs.dallar).sort(),
        etiketler: Object.entries(refs.etiketler).map(([ad, cid]) => ({ ad, id: cid })),
        surumler: sonuc
      }
    })
  }

  diff(proje: string, a: string, b: string): Promise<HistoryDiffFile[]> {
    return this.kilitli(proje, () => {
      const yol = this.projeDogrula(proje)
      const yukle = (ref: string): Map<string, string> => {
        const m = new Map<string, string>()
        if (ref === 'calisma') {
          for (const [ad, icerik] of this.calismaDosyalari(yol)) m.set(ad, icerik.toString('utf8'))
          return m
        }
        this.idDogrula(ref)
        const c = this.commitOku(yol, ref)
        if (!c) throw new Error('Sürüm bulunamadı')
        for (const [ad, sha] of Object.entries(c.dosyalar)) m.set(ad, this.blobOku(yol, sha).toString('utf8'))
        return m
      }
      const eski = yukle(a)
      const yeni = yukle(b)
      const adlar = [...new Set([...eski.keys(), ...yeni.keys()])].sort()
      const sonuc: HistoryDiffFile[] = []
      for (const ad of adlar) {
        const e = eski.get(ad)
        const y = yeni.get(ad)
        if (e === y) continue
        sonuc.push({ ad, durum: e === undefined ? 'eklendi' : y === undefined ? 'silindi' : 'degisti', eski: e ?? '', yeni: y ?? '' })
      }
      return sonuc
    })
  }

  // ───────── yazma işlemleri ─────────

  /** Çalışma kopyasının anlık görüntüsünü alır. Değişiklik yoksa `null` döner. */
  commit(proje: string, mesaj: string, tur: HistoryCommitKind = 'elle', enAzBir = false): Promise<HistoryCommit | null> {
    return this.kilitli(proje, () => this.commitIc(this.projeDogrula(proje), mesaj, tur, enAzBir))
  }

  private commitIc(yol: string, mesaj: string, tur: HistoryCommitKind, ilkseZorla: boolean): HistoryCommit | null {
    const refs = this.refsOku(yol)
    const bas = this.basSurum(yol, refs)
    const dosyalar = this.calismaDosyalari(yol)
    const shaMap = this.shaHaritasi(dosyalar)
    if (bas && this.ayniMi(bas.dosyalar, shaMap)) return null
    if (!bas && dosyalar.size === 0 && !ilkseZorla) return null
    for (const icerik of dosyalar.values()) this.blobYaz(yol, icerik)
    const id = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
    const kayit: DepoCommit = {
      id,
      parent: bas?.id ?? null,
      dal: refs.aktifDal,
      mesaj: mesaj.trim().slice(0, MAKS_MESAJ) || this.varsayilanMesaj(tur),
      // Zincirde kesin artan zaman: aynı milisaniyedeki kayıtların sırası belirsiz kalmasın
      zaman: Math.max(Date.now(), (bas?.zaman ?? 0) + 1),
      tur,
      dosyaSayisi: dosyalar.size,
      etiketler: [],
      dosyalar: shaMap
    }
    mkdirSync(join(this.kok(yol), 'commits'), { recursive: true })
    this.atomikYaz(join(this.kok(yol), 'commits', `${id}.json`), JSON.stringify(kayit))
    refs.dallar[refs.aktifDal] = id
    this.refsYaz(yol, refs)
    return this.baslikOzeti(kayit, refs)
  }

  private varsayilanMesaj(tur: HistoryCommitKind): string {
    switch (tur) {
      case 'otomatik':
        return 'Otomatik anlık görüntü'
      case 'agent-oncesi':
        return 'Yapay zekâ çalışmasından önce'
      case 'geri-yukleme-oncesi':
        return 'Geri yüklemeden önce'
      case 'derleme':
        return 'Derlendi'
      default:
        return 'Sürüm kaydı'
    }
  }

  /**
   * Bir sürümü çalışma kopyasına yükler. `dosyalar` verilirse yalnızca onlar geri gelir;
   * verilmezse tüm kaynak dosyalar sürümdeki hale döner (sürümde olmayanlar silinir).
   * Önce çalışma kopyası otomatik olarak kaydedilir, böylece geri yükleme de geri alınabilir.
   * Değişen dosya adlarını döndürür.
   */
  restore(proje: string, id: string, dosyalar?: string[]): Promise<string[]> {
    return this.kilitli(proje, () => {
      const yol = this.projeDogrula(proje)
      this.idDogrula(id)
      const hedef = this.commitOku(yol, id)
      if (!hedef) throw new Error('Sürüm bulunamadı')
      const secili = dosyalar ? new Set(dosyalar) : null
      if (secili) for (const ad of secili) if (!this.dosyaAdiGuvenliMi(ad)) throw new Error(`Geçersiz dosya adı: ${ad}`)
      this.commitIc(yol, 'Geri yüklemeden önce', 'geri-yukleme-oncesi', false)
      return this.dosyalariUygula(yol, hedef, secili)
    })
  }

  private dosyalariUygula(yol: string, hedef: DepoCommit, secili: Set<string> | null): string[] {
    const degisen: string[] = []
    const simdi = this.calismaDosyalari(yol)
    // Önce tüm blobları oku: eksik/bozuk içerik varsa hiçbir dosyaya dokunma
    const icerikler = new Map<string, Buffer>()
    for (const [ad, sha] of Object.entries(hedef.dosyalar)) {
      if (secili && !secili.has(ad)) continue
      if (!this.dosyaAdiGuvenliMi(ad)) continue
      icerikler.set(ad, this.blobOku(yol, sha))
    }
    for (const [ad, icerik] of icerikler) {
      const mevcut = simdi.get(ad)
      if (mevcut && mevcut.equals(icerik)) continue
      this.atomikYaz(join(yol, ad), icerik)
      degisen.push(ad)
    }
    for (const ad of simdi.keys()) {
      if (secili ? !secili.has(ad) : false) continue
      if (!(ad in hedef.dosyalar)) {
        const tam = join(yol, ad)
        if (resolve(tam).startsWith(resolve(yol) + sep)) {
          unlinkSync(tam)
          degisen.push(ad)
        }
      }
    }
    return degisen
  }

  // ───────── derleme kaydı ─────────

  private commitYaz(yol: string, c: DepoCommit): void {
    this.atomikYaz(join(this.kok(yol), 'commits', `${c.id}.json`), JSON.stringify(c))
  }

  /**
   * Başarılı bir derlemeyi sürüme işler. Çalışma kopyası aktif dalın ucuyla aynıysa o sürüme
   * "derlendi" bilgisi eklenir; dosyalar değişmişse (ve `olustur` true ise) önce otomatik bir sürüm açılır.
   * `olustur` false iken değişiklik varsa hiçbir şey yapılmaz (null döner).
   */
  derlemeKaydet(proje: string, meta: BuildMeta, olustur: boolean): Promise<HistoryCommit | null> {
    return this.kilitli(proje, () => {
      const yol = this.projeDogrula(proje)
      const refs = this.refsOku(yol)
      let bas = this.basSurum(yol, refs)
      const simdi = this.shaHaritasi(this.calismaDosyalari(yol))
      if (!bas || !this.ayniMi(bas.dosyalar, simdi)) {
        if (!olustur) return null
        const yeni = this.commitIc(yol, '', 'derleme', false)
        if (!yeni) return null
        bas = this.commitOku(yol, yeni.id)
        if (!bas) return null
      }
      bas.derleme = { ...meta, yuklendi: bas.derleme?.fqbn === meta.fqbn ? bas.derleme.yuklendi : undefined }
      this.commitYaz(yol, bas)
      return this.baslikOzeti(bas, this.refsOku(yol))
    })
  }

  /** Karta yükleme başarılı olduysa, aynı dosyalara sahip aktif ucu "yüklendi" olarak işaretler. */
  yuklemeIsaretle(proje: string): Promise<void> {
    return this.kilitli(proje, () => {
      const yol = this.projeDogrula(proje)
      const refs = this.refsOku(yol)
      const bas = this.basSurum(yol, refs)
      if (!bas?.derleme) return
      if (!this.ayniMi(bas.dosyalar, this.shaHaritasi(this.calismaDosyalari(yol)))) return
      bas.derleme = { ...bas.derleme, yuklendi: true }
      this.commitYaz(yol, bas)
    })
  }

  // ───────── etiket ve dal ─────────

  etiketle(proje: string, id: string, ad: string): Promise<void> {
    return this.kilitli(proje, () => {
      const yol = this.projeDogrula(proje)
      this.idDogrula(id)
      const temiz = this.adDogrula(ad, 'etiket')
      if (!this.commitOku(yol, id)) throw new Error('Sürüm bulunamadı')
      const refs = this.refsOku(yol)
      if (refs.etiketler[temiz]) throw new Error('Bu etiket zaten kullanılıyor')
      refs.etiketler[temiz] = id
      this.refsYaz(yol, refs)
    })
  }

  etiketiKaldir(proje: string, ad: string): Promise<void> {
    return this.kilitli(proje, () => {
      const yol = this.projeDogrula(proje)
      const refs = this.refsOku(yol)
      delete refs.etiketler[ad]
      this.refsYaz(yol, refs)
    })
  }

  /** Verilen sürümden yeni dal açar ve ona geçer (çalışma kopyası o sürüme döner). */
  dalOlustur(proje: string, ad: string, id?: string): Promise<void> {
    return this.kilitli(proje, () => {
      const yol = this.projeDogrula(proje)
      const temiz = this.adDogrula(ad, 'dal')
      const refs = this.refsOku(yol)
      if (refs.dallar[temiz]) throw new Error('Bu dal zaten var')
      const kaynak = id ?? refs.dallar[refs.aktifDal]
      if (!kaynak) throw new Error('Önce en az bir sürüm kaydı oluşturun')
      this.idDogrula(kaynak)
      const hedef = this.commitOku(yol, kaynak)
      if (!hedef) throw new Error('Sürüm bulunamadı')
      this.temizMi(yol, refs)
      refs.dallar[temiz] = kaynak
      refs.aktifDal = temiz
      this.refsYaz(yol, refs)
      this.dosyalariUygula(yol, hedef, null)
    })
  }

  dalaGec(proje: string, ad: string): Promise<string[]> {
    return this.kilitli(proje, () => {
      const yol = this.projeDogrula(proje)
      const refs = this.refsOku(yol)
      const id = refs.dallar[ad]
      if (!id) throw new Error('Dal bulunamadı')
      if (ad === refs.aktifDal) return []
      const hedef = this.commitOku(yol, id)
      if (!hedef) throw new Error('Dalın sürümü bulunamadı')
      this.temizMi(yol, refs)
      refs.aktifDal = ad
      this.refsYaz(yol, refs)
      return this.dosyalariUygula(yol, hedef, null)
    })
  }

  dalSil(proje: string, ad: string): Promise<void> {
    return this.kilitli(proje, () => {
      const yol = this.projeDogrula(proje)
      const refs = this.refsOku(yol)
      if (ad === refs.aktifDal) throw new Error('Aktif dal silinemez')
      if (ad === VARSAYILAN_DAL) throw new Error('Ana dal silinemez')
      delete refs.dallar[ad]
      this.refsYaz(yol, refs)
    })
  }

  /** Kaydedilmemiş değişiklik varsa dal değişimini engeller (veri kaybı olmasın). */
  private temizMi(yol: string, refs: Refs): void {
    const bas = this.basSurum(yol, refs)
    const simdi = this.shaHaritasi(this.calismaDosyalari(yol))
    const eski = bas?.dosyalar ?? {}
    if (!this.ayniMi(eski, simdi) && Object.keys(simdi).length > 0) {
      throw new Error('Kaydedilmemiş değişiklikler var. Önce "Sürüm kaydet" yapın.')
    }
  }

  // ───────── bakım ─────────

  /**
   * Otomatik kayıtları (otomatik / agent-öncesi / geri-yükleme-öncesi) en yeni `enFazla` taneye indirir.
   * Etiketli, dal ucu olan ve elle alınan sürümler korunur. Kalan zincir yeniden bağlanır; kullanılmayan
   * içerik blobları silinir.
   */
  prune(proje: string, enFazla: number): Promise<number> {
    return this.kilitli(proje, () => {
      const yol = this.projeDogrula(proje)
      const refs = this.refsOku(yol)
      const tum = this.tumCommitler(yol)
      const korunan = new Set<string>([...Object.values(refs.etiketler), ...Object.values(refs.dallar)])
      const adaylar = tum
        .filter((c) => OTOMATIK_TURLER.includes(c.tur) && !korunan.has(c.id))
        .sort((a, b) => b.zaman - a.zaman)
      const silinecek = new Set(adaylar.slice(Math.max(0, enFazla)).map((c) => c.id))
      if (silinecek.size === 0) return 0
      const harita = new Map(tum.map((c) => [c.id, c]))
      for (const c of tum) {
        if (silinecek.has(c.id)) continue
        let p = c.parent
        let degisti = false
        while (p && silinecek.has(p)) {
          p = harita.get(p)?.parent ?? null
          degisti = true
        }
        if (degisti) {
          c.parent = p
          this.atomikYaz(join(this.kok(yol), 'commits', `${c.id}.json`), JSON.stringify(c))
        }
      }
      for (const id of silinecek) rmSync(join(this.kok(yol), 'commits', `${id}.json`), { force: true })
      const kalan = tum.filter((c) => !silinecek.has(c.id))
      const kullanilan = new Set(kalan.flatMap((c) => Object.values(c.dosyalar)))
      const nesneKlasoru = join(this.kok(yol), 'objects')
      if (existsSync(nesneKlasoru)) {
        for (const sha of readdirSync(nesneKlasoru)) {
          if (!sha.endsWith('.tmp') && !kullanilan.has(sha)) rmSync(join(nesneKlasoru, sha), { force: true })
        }
      }
      return silinecek.size
    })
  }
}
