import { existsSync, realpathSync } from 'fs'
import { mkdir, readdir, readFile, rm, stat, writeFile, rename, unlink } from 'fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'path'
import { randomUUID } from 'crypto'
import type { AgentChangeItem } from '@shared/types'
import type { SketchService } from '../SketchService'

/** Agent'ın yazabileceği dosya uzantıları (kaynak + küçük dokümantasyon/veri dosyaları) */
const YAZILABILIR_UZANTILAR = new Set(['.ino', '.h', '.hpp', '.cpp', '.c', '.md', '.txt', '.json', '.csv', '.ini', '.yaml', '.yml'])
const KAYNAK_UZANTILAR = new Set(['.ino', '.h', '.hpp', '.cpp', '.c'])
const MAKS_DOSYA_BAYT = 512 * 1024

export function turkceyiSadelestir(s: string): string {
  const harita: Record<string, string> = { ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I', ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U' }
  return s.replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => harita[c] ?? c)
}

/** Arduino sketch/klasör adı için güvenli ad üretir (boşluk → _, Türkçe karakter sadeleştirme) */
export function sketchAdiTemizle(ham: string): string {
  const ad = turkceyiSadelestir(ham.trim())
    .replace(/\.ino$/i, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_\-.]/g, '')
    .replace(/^[.\-]+/, '')
    .slice(0, 60)
  if (!ad) throw new Error(`Geçersiz sketch adı: "${ham}". Harf, rakam, _ ve - kullanın.`)
  return ad
}

function icinde(kok: string, hedef: string): boolean {
  const k = process.platform === 'win32' ? kok.toLowerCase() : kok
  const h = process.platform === 'win32' ? hedef.toLowerCase() : hedef
  const r = relative(k, h)
  return r === '' || (!r.startsWith('..') && !isAbsolute(r))
}

// ────────────────────────────────────────────────────────────────────────
// Checkpoint (geri alma)
// ────────────────────────────────────────────────────────────────────────

type CheckpointOp =
  | { op: 'write'; path: string; before: string | null }
  | { op: 'delete'; path: string; before: string }
  | { op: 'rename'; from: string; to: string }
  | { op: 'mkdir'; path: string }
  | { op: 'deleteDir'; path: string; files: Array<{ name: string; content: string }> }

export interface Checkpoint {
  id: string
  createdAt: number
  ops: CheckpointOp[]
}

export class CheckpointStore {
  private bellek = new Map<string, Checkpoint>()
  constructor(private dizin: string) {}

  baslat(): Checkpoint {
    const cp: Checkpoint = { id: randomUUID(), createdAt: Date.now(), ops: [] }
    this.bellek.set(cp.id, cp)
    return cp
  }

  async kaydet(cp: Checkpoint): Promise<void> {
    if (cp.ops.length === 0) {
      this.bellek.delete(cp.id)
      return
    }
    try {
      await mkdir(this.dizin, { recursive: true })
      await writeFile(join(this.dizin, `${cp.id}.json`), JSON.stringify(cp), 'utf8')
      await this.eskileriTemizle()
    } catch (err) {
      console.warn('[Checkpoint] Kaydedilemedi:', err)
    }
  }

  private async eskileriTemizle(): Promise<void> {
    const dosyalar = (await readdir(this.dizin)).filter((d) => d.endsWith('.json'))
    if (dosyalar.length <= 40) return
    const bilgiler = await Promise.all(
      dosyalar.map(async (d) => ({ d, t: (await stat(join(this.dizin, d))).mtimeMs }))
    )
    bilgiler.sort((a, b) => a.t - b.t)
    for (const { d } of bilgiler.slice(0, dosyalar.length - 40)) {
      await unlink(join(this.dizin, d)).catch(() => {})
    }
  }

  private async yukle(id: string): Promise<Checkpoint | null> {
    const m = this.bellek.get(id)
    if (m) return m
    try {
      return JSON.parse(await readFile(join(this.dizin, `${id}.json`), 'utf8')) as Checkpoint
    } catch {
      return null
    }
  }

  /** Değişiklikleri ters sırada geri alır; etkilenen sketch klasörlerini döner */
  async geriAl(id: string): Promise<{ ok: boolean; error?: string; affectedFolders: string[] }> {
    const cp = await this.yukle(id)
    if (!cp) return { ok: false, error: 'Checkpoint bulunamadı (süresi dolmuş olabilir).', affectedFolders: [] }
    const etkilenen = new Set<string>()
    const hatalar: string[] = []
    for (const o of [...cp.ops].reverse()) {
      try {
        switch (o.op) {
          case 'write':
            etkilenen.add(dirname(o.path))
            if (o.before === null) await rm(o.path, { force: true })
            else await writeFile(o.path, o.before, 'utf8')
            break
          case 'delete':
            etkilenen.add(dirname(o.path))
            await writeFile(o.path, o.before, 'utf8')
            break
          case 'rename':
            etkilenen.add(dirname(o.to))
            etkilenen.add(dirname(o.from))
            if (existsSync(o.to)) await rename(o.to, o.from)
            break
          case 'mkdir':
            etkilenen.add(o.path)
            await rm(o.path, { recursive: true, force: true })
            break
          case 'deleteDir':
            etkilenen.add(o.path)
            await mkdir(o.path, { recursive: true })
            for (const f of o.files) await writeFile(join(o.path, f.name), f.content, 'utf8')
            break
        }
      } catch (err) {
        hatalar.push((err as Error).message)
      }
    }
    this.bellek.delete(id)
    await unlink(join(this.dizin, `${id}.json`)).catch(() => {})
    return hatalar.length
      ? { ok: false, error: `Bazı değişiklikler geri alınamadı: ${hatalar.join('; ')}`, affectedFolders: [...etkilenen] }
      : { ok: true, affectedFolders: [...etkilenen] }
  }
}

// ────────────────────────────────────────────────────────────────────────
// Çalışma alanı (yol sınırı + disk işlemleri)
// ────────────────────────────────────────────────────────────────────────

export interface SketchOzet {
  folderPath: string
  name: string
  files: Array<{ name: string; path: string; isMainFile: boolean; size: number }>
}

/**
 * Agent'ın dosya sistemi erişimini sınırlayan ve tüm değişiklikleri checkpoint'e kaydeden katman.
 * İzin verilen alan: açık sketch klasörleri + sketchbook (Belgelerim/Cloud_IDE_Sketches) altı.
 */
export class AgentWorkspace {
  private acikSketchler: string[] = []
  private aktifSketch: string | null = null
  private olusturulanlar = new Set<string>()
  readonly degisiklikler: AgentChangeItem[] = []

  constructor(
    private sketchbookDir: string,
    private sketchService: SketchService,
    private cp: Checkpoint
  ) {}

  kapsamAyarla(aktif: string | null, acik: string[]): void {
    this.aktifSketch = aktif
    this.acikSketchler = [...new Set([...(aktif ? [aktif] : []), ...acik])].map((p) => resolve(p))
  }

  getSketchbookDir(): string {
    return this.sketchbookDir
  }

  getAktifSketch(): string | null {
    return this.aktifSketch ? resolve(this.aktifSketch) : null
  }

  bilinenSketchKlasorleri(): string[] {
    return [...new Set([...this.acikSketchler, ...this.olusturulanlar])]
  }

  /**
   * Symlink/junction ile çalışma alanından kaçışı önlemek için yolu gerçek konumuna çözer.
   * Henüz var olmayan hedeflerde en yakın mevcut atanın gerçek yolu + kalan parçalar kullanılır.
   */
  private gercekYol(yol: string): string {
    const kalan: string[] = []
    let simdiki = resolve(yol)
    while (!existsSync(simdiki)) {
      const ust = dirname(simdiki)
      if (ust === simdiki) return resolve(yol)
      kalan.unshift(basename(simdiki))
      simdiki = ust
    }
    try {
      return join(realpathSync.native(simdiki), ...kalan)
    } catch {
      return resolve(yol)
    }
  }

  private izinliMi(yol: string): boolean {
    const p = this.gercekYol(yol)
    const kokler = [this.sketchbookDir, ...this.bilinenSketchKlasorleri()].map((k) => this.gercekYol(k))
    if (kokler.some((k) => icinde(k, p))) return true
    // Açık sketch'in yanına yeni kardeş sketch KLASÖRÜ oluşturmaya izin ver (uzantısız, doğrudan alt öğe).
    // Üst klasördeki mevcut dosyalara (package.json, .env vb.) erişim verilmez.
    return (
      extname(p) === '' &&
      this.bilinenSketchKlasorleri().some((k) => {
        const ust = this.gercekYol(dirname(k))
        return dirname(p) === ust && p !== ust
      })
    )
  }

  /** Göreli/mutlak yolu çözer ve çalışma alanı dışına çıkışı engeller */
  yolCoz(girdi: string): string {
    let ham = String(girdi ?? '').trim().replace(/^[`'"]+|[`'"]+$/g, '')
    if (!ham) throw new Error('Yol boş olamaz')
    ham = ham.replace(/[\\/]+/g, sep)
    let aday: string
    if (isAbsolute(ham)) {
      aday = resolve(ham)
    } else {
      const parcalar = ham.split(sep).filter(Boolean)
      const ilk = parcalar[0]
      const klasorler = this.bilinenSketchKlasorleri()
      const eslesen = klasorler.find((k) => basename(k).toLowerCase() === ilk.toLowerCase())
      const adaylar: string[] = []
      if (eslesen && parcalar.length > 1) adaylar.push(join(eslesen, ...parcalar.slice(1)))
      if (eslesen && parcalar.length === 1) adaylar.push(eslesen)
      if (this.aktifSketch) adaylar.push(join(this.aktifSketch, ham))
      adaylar.push(join(this.sketchbookDir, ham))
      aday = adaylar.find((a) => existsSync(a)) ?? adaylar[0]
    }
    aday = resolve(aday)
    if (!this.izinliMi(aday)) {
      throw new Error(`Bu yol çalışma alanı dışında ve erişime kapalı: ${aday}`)
    }
    return aday
  }

  /** Dosyanın bulunduğu klasör geçerli bir sketch mi (klasör adıyla aynı .ino var mı) */
  sketchMi(klasor: string): boolean {
    return existsSync(join(klasor, `${basename(klasor)}.ino`))
  }

  async sketchOzeti(klasor: string): Promise<SketchOzet> {
    const dosyalar = await this.sketchService.listFiles(klasor)
    const files = await Promise.all(
      dosyalar.map(async (d) => ({
        name: d.name,
        path: d.path,
        isMainFile: d.isMainFile,
        size: (await stat(d.path).catch(() => ({ size: 0 }))).size
      }))
    )
    return { folderPath: klasor, name: basename(klasor), files }
  }

  /** Sketchbook altında (en çok 2 seviye) bulunan, açık olmayan diğer sketch'ler */
  async sketchbookSketchleri(): Promise<string[]> {
    const sonuc: string[] = []
    const kok = this.sketchbookDir
    if (!existsSync(kok)) return sonuc
    const tara = async (d: string, seviye: number): Promise<void> => {
      const girdiler = await readdir(d, { withFileTypes: true }).catch(() => [])
      for (const g of girdiler) {
        if (!g.isDirectory() || g.name.startsWith('.')) continue
        const yol = join(d, g.name)
        if (this.sketchMi(yol)) sonuc.push(yol)
        else if (seviye < 2) await tara(yol, seviye + 1)
      }
    }
    await tara(kok, 1)
    return sonuc
  }

  private kayitDegisiklik(c: AgentChangeItem): void {
    // Aynı dosya için eski yazma kayıtlarını birleştir (sekme yalnızca son içeriği bilmeli)
    if (c.kind === 'write_file' || c.kind === 'create_file') {
      const i = this.degisiklikler.findIndex(
        (x) => (x.kind === 'write_file' || x.kind === 'create_file') && x.path === c.path
      )
      if (i >= 0) {
        const eskiKind = this.degisiklikler[i].kind
        this.degisiklikler[i] = { ...c, kind: eskiKind === 'create_file' ? 'create_file' : c.kind }
        return
      }
    }
    this.degisiklikler.push(c)
  }

  dosyaYazilabilirMi(yol: string): void {
    const uzanti = extname(yol).toLowerCase()
    if (!YAZILABILIR_UZANTILAR.has(uzanti)) {
      throw new Error(`Bu uzantı yazılamaz (${uzanti || 'uzantısız'}). İzinli: ${[...YAZILABILIR_UZANTILAR].join(' ')}`)
    }
  }

  kaynakDosyaMi(yol: string): boolean {
    return KAYNAK_UZANTILAR.has(extname(yol).toLowerCase())
  }

  async oku(yol: string): Promise<string> {
    const s = await stat(yol)
    if (!s.isFile()) throw new Error('Bu bir dosya değil')
    if (s.size > 2 * 1024 * 1024) throw new Error('Dosya çok büyük (>2MB)')
    return readFile(yol, 'utf8')
  }

  async yaz(yol: string, icerik: string): Promise<{ yeni: boolean; satir: number }> {
    this.dosyaYazilabilirMi(yol)
    if (Buffer.byteLength(icerik, 'utf8') > MAKS_DOSYA_BAYT) throw new Error('İçerik çok büyük (>512KB)')
    const klasor = dirname(yol)
    if (!existsSync(klasor)) {
      throw new Error(
        `Klasör yok: ${klasor}. Yeni bir proje/sketch için create_sketch kullanın; yeni dosya yalnızca mevcut bir sketch klasörüne eklenebilir.`
      )
    }
    const onceki = existsSync(yol) ? await readFile(yol, 'utf8') : null
    this.cp.ops.push({ op: 'write', path: yol, before: onceki })
    // Satır sonlarını mevcut dosyaya uydur (CRLF korunur)
    let yazilacak = icerik
    if (onceki !== null && onceki.includes('\r\n') && !icerik.includes('\r\n')) yazilacak = icerik.replace(/\n/g, '\r\n')
    await writeFile(yol, yazilacak, 'utf8')
    const satir = icerik.split('\n').length
    this.kayitDegisiklik({
      kind: onceki === null ? 'create_file' : 'write_file',
      path: yol,
      sketchPath: klasor,
      sketchName: basename(klasor),
      fileName: basename(yol),
      linesCount: satir,
      content: yazilacak
    })
    return { yeni: onceki === null, satir }
  }

  async dosyaSil(yol: string): Promise<void> {
    const klasorAdi = basename(dirname(yol))
    if (basename(yol).toLowerCase() === `${klasorAdi}.ino`.toLowerCase()) {
      throw new Error('Ana .ino dosyası silinemez; tüm sketch için delete_sketch kullanın.')
    }
    const onceki = await readFile(yol, 'utf8')
    this.cp.ops.push({ op: 'delete', path: yol, before: onceki })
    await unlink(yol)
    this.kayitDegisiklik({
      kind: 'delete_file',
      path: yol,
      sketchPath: dirname(yol),
      sketchName: klasorAdi,
      fileName: basename(yol)
    })
  }

  async dosyaYenidenAdlandir(yol: string, yeniAd: string): Promise<string> {
    const klasor = dirname(yol)
    const klasorAdi = basename(klasor)
    if (basename(yol).toLowerCase() === `${klasorAdi}.ino`.toLowerCase()) {
      throw new Error('Ana .ino dosyası tek başına yeniden adlandırılamaz; rename_sketch kullanın.')
    }
    const hedef = join(klasor, yeniAd.trim())
    this.dosyaYazilabilirMi(hedef)
    if (existsSync(hedef)) throw new Error(`Hedef zaten var: ${yeniAd}`)
    this.cp.ops.push({ op: 'rename', from: yol, to: hedef })
    await rename(yol, hedef)
    this.kayitDegisiklik({
      kind: 'rename_file',
      path: hedef,
      oldPath: yol,
      sketchPath: klasor,
      sketchName: klasorAdi,
      fileName: basename(hedef)
    })
    return hedef
  }

  /** Yeni sketch (klasör + aynı adlı .ino) oluşturur; opsiyonel proje grubu klasörü altında */
  async sketchOlustur(adHam: string, kod: string | undefined, grup?: string): Promise<{ folderPath: string; name: string }> {
    const ad = sketchAdiTemizle(adHam)
    let ust: string
    if (grup && grup.trim()) {
      ust = join(this.sketchbookDir, sketchAdiTemizle(grup))
    } else {
      const aktif = this.getAktifSketch()
      ust = aktif ? dirname(aktif) : this.sketchbookDir
    }
    const klasor = join(ust, ad)
    if (existsSync(klasor)) {
      throw new Error(`"${ad}" adlı sketch zaten var (${klasor}). read_file ile inceleyip write_file/edit_file ile güncelleyin veya farklı bir ad seçin.`)
    }
    const ustVarMi = existsSync(ust)
    if (!ustVarMi) {
      await mkdir(ust, { recursive: true })
      this.cp.ops.push({ op: 'mkdir', path: ust })
    }
    await mkdir(klasor, { recursive: true })
    if (ustVarMi) this.cp.ops.push({ op: 'mkdir', path: klasor })
    const iskelet = `// ${ad}\n\nvoid setup() {\n  Serial.begin(115200);\n}\n\nvoid loop() {\n\n}\n`
    const icerik = kod && kod.trim() ? kod : iskelet
    await writeFile(join(klasor, `${ad}.ino`), icerik, 'utf8')
    this.olusturulanlar.add(resolve(klasor))
    this.kayitDegisiklik({
      kind: 'create_sketch',
      path: klasor,
      sketchPath: klasor,
      sketchName: ad,
      fileName: `${ad}.ino`,
      linesCount: icerik.split('\n').length,
      content: icerik
    })
    return { folderPath: klasor, name: ad }
  }

  async sketchSil(klasor: string): Promise<void> {
    if (!this.sketchMi(klasor)) throw new Error('Bu klasör bir sketch değil')
    if (resolve(klasor) === resolve(this.sketchbookDir)) throw new Error('Sketchbook klasörü silinemez')
    const girdiler = await readdir(klasor, { withFileTypes: true })
    if (girdiler.some((g) => g.isDirectory())) {
      throw new Error('Sketch alt klasör içeriyor; güvenlik için otomatik silinmedi. Kullanıcıdan elle silmesini isteyin.')
    }
    const dosyalar: Array<{ name: string; content: string }> = []
    for (const g of girdiler) {
      const yol = join(klasor, g.name)
      const s = await stat(yol)
      if (s.size > MAKS_DOSYA_BAYT || !YAZILABILIR_UZANTILAR.has(extname(g.name).toLowerCase())) {
        throw new Error(`Sketch geri alınamayacak bir dosya içeriyor (${g.name}); güvenlik için otomatik silinmedi.`)
      }
      dosyalar.push({ name: g.name, content: await readFile(yol, 'utf8') })
    }
    this.cp.ops.push({ op: 'deleteDir', path: klasor, files: dosyalar })
    await rm(klasor, { recursive: true, force: true })
    this.olusturulanlar.delete(resolve(klasor))
    this.acikSketchler = this.acikSketchler.filter((k) => k !== resolve(klasor))
    this.kayitDegisiklik({ kind: 'delete_sketch', path: klasor, sketchPath: klasor, sketchName: basename(klasor) })
  }

  async sketchYenidenAdlandir(klasor: string, yeniAdHam: string): Promise<string> {
    if (!this.sketchMi(klasor)) throw new Error('Bu klasör bir sketch değil')
    const yeniAd = sketchAdiTemizle(yeniAdHam)
    const hedefKlasor = join(dirname(klasor), yeniAd)
    if (existsSync(hedefKlasor)) throw new Error(`"${yeniAd}" adlı klasör zaten var`)
    const anaIno = join(klasor, `${basename(klasor)}.ino`)
    const sonuc = await this.sketchService.renameFile(anaIno, `${yeniAd}.ino`)
    const yeniKlasor = dirname(sonuc.path)
    // Geri alma ters sırada işler: önce klasör eski adına döner, sonra içindeki .ino eski adına döner
    this.cp.ops.push({ op: 'rename', from: join(klasor, `${basename(klasor)}.ino`), to: join(klasor, sonuc.name) })
    this.cp.ops.push({ op: 'rename', from: klasor, to: yeniKlasor })
    this.olusturulanlar.delete(resolve(klasor))
    this.olusturulanlar.add(resolve(yeniKlasor))
    this.acikSketchler = this.acikSketchler.map((k) => (k === resolve(klasor) ? resolve(yeniKlasor) : k))
    if (this.aktifSketch && resolve(this.aktifSketch) === resolve(klasor)) this.aktifSketch = yeniKlasor
    this.kayitDegisiklik({
      kind: 'rename_sketch',
      path: yeniKlasor,
      oldPath: klasor,
      sketchPath: yeniKlasor,
      sketchName: basename(yeniKlasor)
    })
    return yeniKlasor
  }
}
