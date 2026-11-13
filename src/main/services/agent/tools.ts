import { readFile } from 'fs/promises'
import { basename, dirname, relative, resolve } from 'path'
import type { AgentDiffPreview, AgentEvent, AgentPermissionMode, AgentPlanItem, CompileResult } from '@shared/types'
import type { ArduinoCliService } from '../ArduinoCliService'
import type { DeviceLock } from '../DeviceLock'
import type { RagKind } from '../RagService'
import type { BoardContext, BoardSkillEngine } from '../BoardSkillEngine'
import type { AgentWorkspace } from './AgentWorkspace'
import { sketchAdiTemizle } from './AgentWorkspace'
import type { ToolDef } from './llmTypes'

// ────────────────────────────────────────────────────────────────────────
// Araç tanımları (tüm sağlayıcılara aynı şema gönderilir)
// ────────────────────────────────────────────────────────────────────────

export const TOOL_DEFS: ToolDef[] = [
  {
    name: 'list_workspace',
    description:
      'Açık sketch/projeleri, dosyalarını (boyutlarıyla), seçili kartı ve sketchbook\'taki diğer projeleri listeler. Göreve başlarken ve neyin nerede olduğundan emin değilken çağır.',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'read_file',
    description:
      'Bir dosyanın içeriğini okur. Bir dosyayı DEĞİŞTİRMEDEN önce mutlaka oku. Uzun dosyalarda start_line/end_line ile parça parça oku.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Dosya yolu: "Sketch/Sketch.ino" ya da mutlak yol' },
        start_line: { type: 'integer', description: 'Başlangıç satırı (1 tabanlı, opsiyonel)' },
        end_line: { type: 'integer', description: 'Bitiş satırı (opsiyonel)' }
      },
      required: ['path']
    }
  },
  {
    name: 'search_code',
    description: 'Açık sketch dosyalarında metin/regex arar; dosya, satır numarası ve satırı döner.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Aranacak metin veya regex' },
        path: { type: 'string', description: 'Opsiyonel: yalnızca bu sketch klasörü veya dosyada ara' },
        regex: { type: 'boolean', description: 'true ise pattern regex olarak yorumlanır' }
      },
      required: ['pattern']
    }
  },
  {
    name: 'edit_file',
    description:
      'Mevcut bir dosyada küçük/orta bir değişiklik yapar: old_text dosyada BİREBİR geçen (girinti dahil) benzersiz bir parça olmalı, new_text ile değiştirilir. Büyük yeniden yazımlarda write_file kullan.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Dosya yolu' },
        old_text: { type: 'string', description: 'Değiştirilecek mevcut metin (birebir)' },
        new_text: { type: 'string', description: 'Yeni metin' },
        replace_all: { type: 'boolean', description: 'true ise tüm eşleşmeler değiştirilir' }
      },
      required: ['path', 'old_text', 'new_text']
    }
  },
  {
    name: 'write_file',
    description:
      'Bir dosyanın TAM içeriğini yazar (yoksa oluşturur). Mevcut bir sketch klasörüne yeni .h/.cpp/.ino dosyası eklemek veya dosyayı baştan yazmak için. İçeriği asla kısaltma ("..." ile geçme); dosyanın tamamını ver.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Dosya yolu: "Sketch/dosya.h" ya da mutlak yol' },
        content: { type: 'string', description: 'Dosyanın tam içeriği' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'create_sketch',
    description:
      'YENİ bağımsız bir sketch (klasör + aynı adlı .ino) oluşturur. Alıcı/Verici gibi ayrı kartlara yüklenecek her kod için AYRI sketch oluştur: Arduino\'da aynı klasörde iki .ino derlenemez. group verilirse sketchbook altında o proje klasörünün içine açılır.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Sketch adı (harf, rakam, _ ve -)' },
        code: { type: 'string', description: 'Ana .ino dosyasının tam kodu (boşsa iskelet oluşur)' },
        group: { type: 'string', description: 'Opsiyonel proje grubu klasörü adı (örn. "RF_Projesi")' }
      },
      required: ['name']
    }
  },
  {
    name: 'delete_file',
    description: 'Bir yardımcı dosyayı siler (ana .ino silinemez). Kullanıcıdan onay istenebilir; geri alınabilir.',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
  },
  {
    name: 'rename_file',
    description: 'Yardımcı bir dosyayı yeniden adlandırır (aynı klasörde).',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' }, new_name: { type: 'string' } },
      required: ['path', 'new_name']
    }
  },
  {
    name: 'delete_sketch',
    description: 'Bir sketch klasörünü tamamen siler. Yalnızca kullanıcı açıkça istediyse kullan.',
    parameters: { type: 'object', properties: { path: { type: 'string', description: 'Sketch klasörü yolu veya adı' } }, required: ['path'] }
  },
  {
    name: 'rename_sketch',
    description: 'Bir sketch\'i (klasör + ana .ino) yeniden adlandırır.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Sketch klasörü yolu veya adı' }, new_name: { type: 'string' } },
      required: ['path', 'new_name']
    }
  },
  {
    name: 'compile',
    description:
      'Sketch\'i seçili kart için derler ve hataları satır/sütun bilgisiyle döner. Kod yazdıktan/değiştirdikten sonra DOĞRULAMAK için kullan. Yükleme (upload) yapılmaz.',
    parameters: {
      type: 'object',
      properties: {
        sketch: { type: 'string', description: 'Opsiyonel: sketch klasörü yolu/adı (varsayılan: aktif sketch)' },
        fqbn: { type: 'string', description: 'Opsiyonel: kart FQBN (varsayılan: seçili kart)' }
      }
    }
  },
  {
    name: 'search_docs',
    description:
      'Yerel bilgi tabanında (kurulu kütüphanelerin API imzaları, örnek kodlar, kart bilgileri, kullanıcı becerileri) arar. Bir kütüphanenin/kartın API\'sinden emin değilsen KOD YAZMADAN önce çağır.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Ne aradığını doğal dille veya fonksiyon adıyla yaz (örn. "Deneyap IMU okuma", "Servo attach")' },
        source: {
          type: 'string',
          enum: ['all', 'library', 'example', 'board', 'skill'],
          description: 'Aramayı bir kaynakla sınırla: library = kütüphane API imzaları, example = örnek kodlar, board = kart referansı, skill = kullanıcı becerileri. Varsayılan: all'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_board_info',
    description: 'Seçili kartın pin haritası, voltajı, mimari kuralları ve kullanıcı özel kurallarını döner.',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'search_libraries',
    description: 'Arduino kütüphane dizininde arama yapar ve hangilerinin kurulu olduğunu söyler.',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
  },
  {
    name: 'install_library',
    description: 'Bir Arduino kütüphanesini kurar (kullanıcı onayı gerekebilir). Derleme "başlık dosyası bulunamadı" derse kullan.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Tam kütüphane adı' }, version: { type: 'string' } },
      required: ['name']
    }
  },
  {
    name: 'update_plan',
    description:
      'Çok adımlı işlerde görev listesini günceller (kullanıcıya canlı gösterilir). Karmaşık görevin başında listeyi oluştur, ilerledikçe done:true yap.',
    parameters: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          description: 'Görev listesi',
          items: {
            type: 'object',
            properties: { text: { type: 'string' }, done: { type: 'boolean' } },
            required: ['text']
          }
        }
      },
      required: ['todos']
    }
  },
  {
    name: 'ask_user',
    description:
      'Kullanıcıya kısa bir soru sorar ve yanıtını bekler. Yalnızca gerçekten belirsiz/geri dönüşsüz bir karar için kullan (örn. hangi pinler bağlı?). Gereksiz soru sorma.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string' },
        options: { type: 'array', description: 'Opsiyonel hazır seçenekler', items: { type: 'string' } }
      },
      required: ['question']
    }
  }
]

/** Yerel modellerde (native + metin protokolü) sunulan çekirdek araç alt kümesi; az araç = küçük modellerde daha az hata */
export const TEXT_MODE_TOOL_NAMES = [
  'list_workspace',
  'read_file',
  'edit_file',
  'write_file',
  'create_sketch',
  'compile',
  'search_docs',
  'search_libraries',
  'install_library'
]

// ────────────────────────────────────────────────────────────────────────
// Yürütücü
// ────────────────────────────────────────────────────────────────────────

export interface ToolOutcome {
  ok: boolean
  /** Modele geri gönderilen sonuç metni */
  output: string
  /** UI'da gösterilen kısa etiket */
  label: string
  detail?: string
}

export interface ApprovalResult {
  approved: boolean
  answer?: string
}

export interface ToolContext {
  runId: string
  ws: AgentWorkspace
  arduino: ArduinoCliService
  kilit: DeviceLock
  boardSkills: BoardSkillEngine
  board?: BoardContext
  permission: AgentPermissionMode
  signal: AbortSignal
  emit: (e: AgentEvent) => void
  istekOnay: (
    kind: 'permission' | 'question',
    name: string,
    message: string,
    options?: string[],
    diff?: AgentDiffPreview
  ) => Promise<ApprovalResult>
  /** Araç sonuçlarının modele dönecek azami karakter sayısı */
  maksSonucKarakter: number
  /** Başarılı derlemeyi sürüm geçmişine işler (varsa) */
  derlemeyiKaydet?: (klasor: string, fqbn: string, sonuc: CompileResult) => Promise<void>
  durum: {
    /** Son derlemeden beri değişen sketch klasörleri */
    derlenmemis: Set<string>
    derlemeSayaci: number
  }
}

function kisalt(s: string, max: number): string {
  if (s.length <= max) return s
  const bas = Math.floor(max * 0.7)
  const son = max - bas
  return `${s.slice(0, bas)}\n…[${s.length - max} karakter kısaltıldı]…\n${s.slice(s.length - son)}`
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v)
}

/** Yazım sonrası hızlı yapısal sağlık kontrolü: parantez dengesi (yorum/dize hariç) ve yer tutucu tespiti */
function kodSaglikUyarilari(yol: string, kod: string): string[] {
  if (!/\.(ino|h|hpp|cpp|c)$/i.test(yol)) return []
  const temiz = kod
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
  const say = (a: string, b: string): number => temiz.split(a).length - temiz.split(b).length
  const uyarilar: string[] = []
  if (say('{', '}') !== 0) uyarilar.push(`süslü parantez dengesiz ({ - } = ${say('{', '}')})`)
  if (say('(', ')') !== 0) uyarilar.push(`yuvarlak parantez dengesiz (( - ) = ${say('(', ')')})`)
  if (say('[', ']') !== 0) uyarilar.push(`köşeli parantez dengesiz ([ - ] = ${say('[', ']')})`)
  return uyarilar
}

const YER_TUTUCU = /(\.\.\.\s*(rest|remaining|existing|previous|unchanged)\b|\/\/\s*\.\.\.|\/\*\s*\.\.\.\s*\*\/|önceki kod|geri kalan kod|kodun geri kalanı|aynı kalır)/i

function dosyaGoreli(_ws: AgentWorkspace, yol: string): string {
  const sk = dirname(yol)
  return `${basename(sk)}/${basename(yol)}`
}

export async function aracCalistir(ctx: ToolContext, ad: string, args: Record<string, unknown>): Promise<ToolOutcome> {
  try {
    if ('__parse_error' in args) {
      return {
        ok: false,
        label: ad,
        output: `Araç argümanları geçerli JSON değildi. Argümanları kesin JSON olarak ve eksiksiz ver. Alınan: ${str(args.__parse_error)}`
      }
    }
    switch (ad) {
      case 'list_workspace':
        return await listWorkspace(ctx)
      case 'read_file':
        return await readFileTool(ctx, args)
      case 'search_code':
        return await searchCode(ctx, args)
      case 'edit_file':
        return await editFile(ctx, args)
      case 'write_file':
        return await writeFileTool(ctx, args)
      case 'create_sketch':
        return await createSketch(ctx, args)
      case 'delete_file':
        return await deleteFile(ctx, args)
      case 'rename_file':
        return await renameFile(ctx, args)
      case 'delete_sketch':
        return await deleteSketch(ctx, args)
      case 'rename_sketch':
        return await renameSketch(ctx, args)
      case 'compile':
        return await compileTool(ctx, args)
      case 'search_docs':
        return await searchDocs(ctx, args)
      case 'get_board_info':
        return await boardInfo(ctx)
      case 'search_libraries':
        return await searchLibraries(ctx, args)
      case 'install_library':
        return await installLibrary(ctx, args)
      case 'update_plan':
        return updatePlan(ctx, args)
      case 'ask_user':
        return await askUser(ctx, args)
      default:
        return {
          ok: false,
          label: ad,
          output: `Bilinmeyen araç: "${ad}". Kullanılabilir araçlar: ${TOOL_DEFS.map((t) => t.name).join(', ')}`
        }
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortedError') throw err
    return { ok: false, label: ad, output: `HATA: ${(err as Error).message}`, detail: (err as Error).message }
  }
}

/** İzin politikası: true dönerse işlem otomatik yapılır, false ise kullanıcıya sorulur */
function otomatikMi(ctx: ToolContext, risk: 'yaz' | 'yikici'): boolean {
  if (ctx.permission === 'full-auto') return true
  if (ctx.permission === 'auto-edit') return risk === 'yaz'
  return false
}

async function onayAl(
  ctx: ToolContext,
  risk: 'yaz' | 'yikici',
  ad: string,
  mesaj: string,
  diff?: AgentDiffPreview
): Promise<string | null> {
  if (otomatikMi(ctx, risk)) return null
  const r = await ctx.istekOnay('permission', ad, mesaj, undefined, diff)
  return r.approved ? null : 'Kullanıcı bu işlemi reddetti. Aynı işlemi tekrar deneme; alternatif öner veya sor.'
}

// ── list_workspace ──

async function listWorkspace(ctx: ToolContext): Promise<ToolOutcome> {
  const ws = ctx.ws
  const acik = ws.bilinenSketchKlasorleri()
  const satirlar: string[] = []
  const aktif = ws.getAktifSketch()
  satirlar.push(`Aktif sketch: ${aktif ? basename(aktif) : '(yok)'}`)
  satirlar.push(
    `Seçili kart: ${ctx.board?.name || '(seçilmedi)'}${ctx.board?.fqbn ? ` [${ctx.board.fqbn}]` : ''}`
  )
  satirlar.push('')
  satirlar.push('AÇIK SKETCH\'LER:')
  if (acik.length === 0) satirlar.push('  (açık sketch yok)')
  for (const k of acik) {
    try {
      const o = await ws.sketchOzeti(k)
      satirlar.push(`- ${o.name}${k === aktif ? ' (aktif)' : ''}  [${o.folderPath}]`)
      for (const f of o.files) satirlar.push(`    ${f.name}${f.isMainFile ? ' (ana)' : ''}  ${f.size} bayt`)
    } catch {
      satirlar.push(`- ${basename(k)}  [erişilemedi]`)
    }
  }
  const diger = (await ws.sketchbookSketchleri()).filter((p) => !acik.includes(resolve(p)))
  if (diger.length) {
    satirlar.push('')
    satirlar.push('SKETCHBOOK\'TAKİ DİĞER PROJELER (okuyabilirsin):')
    for (const p of diger.slice(0, 30)) satirlar.push(`- ${relative(ws.getSketchbookDir(), p)}`)
  }
  return { ok: true, label: 'Çalışma alanı listelendi', output: kisalt(satirlar.join('\n'), ctx.maksSonucKarakter) }
}

// ── read_file ──

async function readFileTool(ctx: ToolContext, a: Record<string, unknown>): Promise<ToolOutcome> {
  const yol = ctx.ws.yolCoz(str(a.path))
  const icerik = await ctx.ws.oku(yol)
  const satirlar = icerik.replace(/\r\n/g, '\n').split('\n')
  const toplam = satirlar.length
  const bas = Math.max(1, Math.floor(Number(a.start_line) || 1))
  let son = Math.min(toplam, Math.floor(Number(a.end_line) || toplam))
  let govde = satirlar.slice(bas - 1, son).join('\n')
  let kesildi = false
  if (govde.length > ctx.maksSonucKarakter) {
    // Karakter bütçesine sığacak kadar satır al
    let sayac = 0
    let i = bas - 1
    while (i < son && sayac + satirlar[i].length + 1 <= ctx.maksSonucKarakter) {
      sayac += satirlar[i].length + 1
      i++
    }
    son = Math.max(bas, i)
    govde = satirlar.slice(bas - 1, son).join('\n')
    kesildi = son < toplam
  }
  const baslik = `${dosyaGoreli(ctx.ws, yol)} — satır ${bas}-${son} / ${toplam}`
  const ek = kesildi ? `\n[Dosya devam ediyor: read_file ile start_line=${son + 1} verip devamını oku]` : ''
  return {
    ok: true,
    label: `Okundu: ${dosyaGoreli(ctx.ws, yol)}`,
    detail: `${toplam} satır`,
    output: `${baslik}\n\`\`\`\n${govde}\n\`\`\`${ek}`
  }
}

// ── search_code ──

async function searchCode(ctx: ToolContext, a: Record<string, unknown>): Promise<ToolOutcome> {
  const desen = str(a.pattern)
  if (!desen) throw new Error('pattern boş olamaz')
  let re: RegExp
  try {
    re = a.regex ? new RegExp(desen, 'i') : new RegExp(desen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  } catch (e) {
    throw new Error(`Geçersiz regex: ${(e as Error).message}`)
  }
  const dosyalar: string[] = []
  if (a.path) {
    const yol = ctx.ws.yolCoz(str(a.path))
    if (ctx.ws.kaynakDosyaMi(yol)) dosyalar.push(yol)
    else {
      const o = await ctx.ws.sketchOzeti(yol)
      dosyalar.push(...o.files.map((f) => f.path))
    }
  } else {
    for (const k of ctx.ws.bilinenSketchKlasorleri()) {
      const o = await ctx.ws.sketchOzeti(k).catch(() => null)
      if (o) dosyalar.push(...o.files.map((f) => f.path))
    }
  }
  const bulunan: string[] = []
  const MAKS_SONUC = 40
  for (const d of dosyalar) {
    if (bulunan.length >= MAKS_SONUC) break
    const satirlar = (await readFile(d, 'utf8').catch(() => '')).split(/\r?\n/)
    for (let i = 0; i < satirlar.length && bulunan.length < MAKS_SONUC; i++) {
      if (re.test(satirlar[i])) bulunan.push(`${dosyaGoreli(ctx.ws, d)}:${i + 1}: ${satirlar[i].trim().slice(0, 200)}`)
    }
  }
  return {
    ok: true,
    label: `Arandı: ${desen}`,
    detail: `${bulunan.length} sonuç`,
    output: bulunan.length ? bulunan.join('\n') : 'Eşleşme bulunamadı.'
  }
}

// ── edit_file ──

function bosluksuzEsle(satirlar: string[], aranan: string[]): number[] {
  const norm = (s: string): string => s.trim().replace(/\s+/g, ' ')
  const hedef = aranan.map(norm)
  const sonuc: number[] = []
  if (hedef.length === 0 || hedef.every((h) => !h)) return sonuc
  for (let i = 0; i + hedef.length <= satirlar.length; i++) {
    let ok = true
    for (let j = 0; j < hedef.length; j++) {
      if (norm(satirlar[i + j]) !== hedef[j]) {
        ok = false
        break
      }
    }
    if (ok) sonuc.push(i)
  }
  return sonuc
}

async function editFile(ctx: ToolContext, a: Record<string, unknown>): Promise<ToolOutcome> {
  const yol = ctx.ws.yolCoz(str(a.path))
  const eski = str(a.old_text)
  const yeni = str(a.new_text)
  if (!eski) throw new Error('old_text boş olamaz; yeni dosya/tam yazım için write_file kullan.')
  const ham = await ctx.ws.oku(yol)
  const crlf = ham.includes('\r\n')
  const icerik = ham.replace(/\r\n/g, '\n')
  const eskiN = eski.replace(/\r\n/g, '\n')
  const yeniN = yeni.replace(/\r\n/g, '\n')

  let sonuc: string | null = null
  let degisenSayi = 0
  const adetler = icerik.split(eskiN).length - 1
  if (adetler === 1 || (adetler > 1 && a.replace_all)) {
    sonuc = icerik.split(eskiN).join(yeniN)
    degisenSayi = adetler
  } else if (adetler > 1) {
    const konumlar: number[] = []
    let idx = -1
    while ((idx = icerik.indexOf(eskiN, idx + 1)) >= 0 && konumlar.length < 8) {
      konumlar.push(icerik.slice(0, idx).split('\n').length)
    }
    throw new Error(
      `old_text dosyada ${adetler} yerde geçiyor (satırlar: ${konumlar.join(', ')}). Daha fazla çevre satırı ekleyerek benzersiz yap veya replace_all=true ver.`
    )
  } else {
    // Girinti/boşluk farkını tolere eden ikinci deneme
    const satirlar = icerik.split('\n')
    const eslesmeler = bosluksuzEsle(satirlar, eskiN.split('\n'))
    if (eslesmeler.length === 1) {
      const i = eslesmeler[0]
      const n = eskiN.split('\n').length
      satirlar.splice(i, n, ...yeniN.split('\n'))
      sonuc = satirlar.join('\n')
      degisenSayi = 1
    } else if (eslesmeler.length > 1) {
      throw new Error(`old_text boşluk farkları yok sayıldığında ${eslesmeler.length} yerde eşleşiyor; daha fazla bağlam ekle.`)
    } else {
      const ilk = eskiN.split('\n').find((s) => s.trim()) ?? ''
      const satirlar2 = icerik.split('\n')
      const yakin = satirlar2.findIndex((s) => ilk.trim() && s.includes(ilk.trim().slice(0, 30)))
      const ipucu =
        yakin >= 0
          ? `\nEn yakın satır (${yakin + 1}):\n${satirlar2.slice(Math.max(0, yakin - 2), yakin + 4).join('\n')}`
          : '\nDosyada benzer bir satır bulunamadı; read_file ile güncel içeriği oku.'
      throw new Error(`old_text dosyada bulunamadı (birebir eşleşmeli).${ipucu}`)
    }
  }
  const yazilacak = crlf ? sonuc.replace(/\n/g, '\r\n') : sonuc
  // Onay, eşleşme doğrulandıktan sonra istenir: kullanıcı uygulanamayacak bir değişikliği onaylamasın
  const ret = await onayAl(ctx, 'yaz', 'edit_file', `Dosya düzenlenecek: ${dosyaGoreli(ctx.ws, yol)}`, {
    filePath: yol,
    before: ham,
    after: yazilacak,
    isNew: false
  })
  if (ret) return { ok: false, label: `Reddedildi: ${dosyaGoreli(ctx.ws, yol)}`, output: ret }
  const r = await ctx.ws.yaz(yol, yazilacak)
  if (ctx.ws.kaynakDosyaMi(yol)) ctx.durum.derlenmemis.add(dirname(yol))
  const uyarilar = kodSaglikUyarilari(yol, sonuc)
  return {
    ok: true,
    label: `Düzenlendi: ${dosyaGoreli(ctx.ws, yol)}`,
    detail: `${degisenSayi} değişiklik`,
    output:
      `OK: ${dosyaGoreli(ctx.ws, yol)} güncellendi (${degisenSayi} yerde değişti, ${r.satir} satır).` +
      (uyarilar.length ? `\nUYARI: ${uyarilar.join('; ')} — düzeltmeyi düşün.` : '')
  }
}

// ── write_file ──

async function writeFileTool(ctx: ToolContext, a: Record<string, unknown>): Promise<ToolOutcome> {
  const yol = ctx.ws.yolCoz(str(a.path))
  const icerik = str(a.content)
  if (!icerik.trim()) throw new Error('content boş olamaz')
  const klasor = dirname(yol)
  if (ctx.ws.kaynakDosyaMi(yol) && !ctx.ws.sketchMi(klasor)) {
    throw new Error(
      `"${basename(klasor)}" geçerli bir sketch klasörü değil (aynı adlı .ino yok). Yeni proje için create_sketch kullan.`
    )
  }
  // Mevcut dosyada kısaltma yer tutucusu koruması
  let mevcut: string | null = null
  try {
    mevcut = await ctx.ws.oku(yol)
  } catch {
    mevcut = null
  }
  if (mevcut !== null && YER_TUTUCU.test(icerik) && !YER_TUTUCU.test(mevcut)) {
    throw new Error(
      'İçerik "kodun geri kalanı aynı" gibi bir kısaltma yer tutucusu içeriyor; bu dosyayı bozar. Dosyanın TAMAMINI yaz veya küçük değişiklik için edit_file kullan.'
    )
  }
  // Aynı sketch'te ikinci setup()/loop() (Arduino'da çakışma) koruması
  const uzantiIno = yol.toLowerCase().endsWith('.ino')
  if (uzantiIno && basename(yol).toLowerCase() !== `${basename(klasor)}.ino`.toLowerCase() && /void\s+setup\s*\(/.test(icerik)) {
    throw new Error(
      'Ana dosyadan başka bir .ino içinde setup() tanımlanamaz (Arduino bunları birleştirir ve derleme çakışır). Ayrı bir cihaz/kart kodu için create_sketch ile AYRI sketch oluştur.'
    )
  }
  const ret = await onayAl(ctx, 'yaz', 'write_file', `Dosya yazılacak: ${dosyaGoreli(ctx.ws, yol)}`, {
    filePath: yol,
    before: mevcut ?? '',
    after: icerik,
    isNew: mevcut === null
  })
  if (ret) return { ok: false, label: `Reddedildi: ${dosyaGoreli(ctx.ws, yol)}`, output: ret }

  const r = await ctx.ws.yaz(yol, icerik)
  if (ctx.ws.kaynakDosyaMi(yol)) ctx.durum.derlenmemis.add(klasor)
  const uyarilar = kodSaglikUyarilari(yol, icerik)
  return {
    ok: true,
    label: `${r.yeni ? 'Oluşturuldu' : 'Yazıldı'}: ${dosyaGoreli(ctx.ws, yol)}`,
    detail: `${r.satir} satır`,
    output:
      `OK: ${dosyaGoreli(ctx.ws, yol)} ${r.yeni ? 'oluşturuldu' : 'güncellendi'} (${r.satir} satır).` +
      (uyarilar.length ? `\nUYARI: ${uyarilar.join('; ')} — düzeltmeyi düşün.` : '')
  }
}

// ── create_sketch ──

async function createSketch(ctx: ToolContext, a: Record<string, unknown>): Promise<ToolOutcome> {
  const ad = sketchAdiTemizle(str(a.name))
  const grup = str(a.group).trim() || undefined
  const ret = await onayAl(ctx, 'yaz', 'create_sketch', `Yeni sketch oluşturulacak: ${grup ? grup + '/' : ''}${ad}`)
  if (ret) return { ok: false, label: `Reddedildi: ${ad}`, output: ret }
  const kod = str(a.code)
  if (kod && YER_TUTUCU.test(kod)) {
    throw new Error('code içinde kısaltma yer tutucusu var; kodun TAMAMINI ver.')
  }
  const r = await ctx.ws.sketchOlustur(ad, kod, grup)
  ctx.durum.derlenmemis.add(r.folderPath)
  const uyarilar = kod ? kodSaglikUyarilari(`${ad}.ino`, kod) : []
  return {
    ok: true,
    label: `Sketch oluşturuldu: ${r.name}`,
    detail: r.folderPath,
    output:
      `OK: sketch oluşturuldu: ${r.name} (${r.folderPath}). Ana dosya: ${r.name}/${r.name}.ino` +
      (uyarilar.length ? `\nUYARI: ${uyarilar.join('; ')}` : '')
  }
}

// ── silme / yeniden adlandırma ──

async function deleteFile(ctx: ToolContext, a: Record<string, unknown>): Promise<ToolOutcome> {
  const yol = ctx.ws.yolCoz(str(a.path))
  const ret = await onayAl(ctx, 'yikici', 'delete_file', `Dosya silinecek: ${dosyaGoreli(ctx.ws, yol)}`)
  if (ret) return { ok: false, label: `Reddedildi: ${dosyaGoreli(ctx.ws, yol)}`, output: ret }
  await ctx.ws.dosyaSil(yol)
  ctx.durum.derlenmemis.add(dirname(yol))
  return { ok: true, label: `Silindi: ${dosyaGoreli(ctx.ws, yol)}`, output: `OK: ${dosyaGoreli(ctx.ws, yol)} silindi.` }
}

async function renameFile(ctx: ToolContext, a: Record<string, unknown>): Promise<ToolOutcome> {
  const yol = ctx.ws.yolCoz(str(a.path))
  const ret = await onayAl(ctx, 'yikici', 'rename_file', `Dosya yeniden adlandırılacak: ${dosyaGoreli(ctx.ws, yol)} → ${str(a.new_name)}`)
  if (ret) return { ok: false, label: `Reddedildi: ${dosyaGoreli(ctx.ws, yol)}`, output: ret }
  const hedef = await ctx.ws.dosyaYenidenAdlandir(yol, str(a.new_name))
  ctx.durum.derlenmemis.add(dirname(yol))
  return {
    ok: true,
    label: `Yeniden adlandırıldı: ${basename(hedef)}`,
    output: `OK: ${basename(yol)} → ${basename(hedef)}`
  }
}

async function deleteSketch(ctx: ToolContext, a: Record<string, unknown>): Promise<ToolOutcome> {
  const yol = ctx.ws.yolCoz(str(a.path))
  const ret = await onayAl(ctx, 'yikici', 'delete_sketch', `Tüm sketch silinecek: ${basename(yol)}`)
  if (ret) return { ok: false, label: `Reddedildi: ${basename(yol)}`, output: ret }
  await ctx.ws.sketchSil(yol)
  ctx.durum.derlenmemis.delete(yol)
  return { ok: true, label: `Sketch silindi: ${basename(yol)}`, output: `OK: ${basename(yol)} silindi.` }
}

async function renameSketch(ctx: ToolContext, a: Record<string, unknown>): Promise<ToolOutcome> {
  const yol = ctx.ws.yolCoz(str(a.path))
  const ret = await onayAl(ctx, 'yikici', 'rename_sketch', `Sketch yeniden adlandırılacak: ${basename(yol)} → ${str(a.new_name)}`)
  if (ret) return { ok: false, label: `Reddedildi: ${basename(yol)}`, output: ret }
  const yeni = await ctx.ws.sketchYenidenAdlandir(yol, str(a.new_name))
  ctx.durum.derlenmemis.delete(yol)
  ctx.durum.derlenmemis.add(yeni)
  return { ok: true, label: `Sketch yeniden adlandırıldı: ${basename(yeni)}`, output: `OK: yeni yol: ${yeni}` }
}

// ── compile ──

export function derlemeSonucunuOzetle(r: CompileResult, sketchKlasoru: string, maksKarakter: number): string {
  if (r.success) {
    const ozet = r.log
      .split(/\r?\n/)
      .filter((s) => /Sketch uses|Global variables use|Sketch kullanıyor|Program storage|bayt/i.test(s))
      .slice(0, 3)
      .join('\n')
    const uyarilar = r.errors.filter((e) => e.tur === 'warning').slice(0, 5)
    return (
      `DERLEME BAŞARILI.${ozet ? '\n' + ozet : ''}` +
      (uyarilar.length
        ? `\nUyarılar (${uyarilar.length}):\n` +
          uyarilar.map((e) => `  ${relativeOrBase(e.dosya, sketchKlasoru)}:${e.satir}: ${e.mesaj}`).join('\n')
        : '')
    )
  }
  const hatalar = r.errors.filter((e) => e.tur === 'error').slice(0, 10)
  const satirlar: string[] = ['DERLEME BAŞARISIZ.']
  if (r.topLevelError) satirlar.push(`Üst seviye hata: ${r.topLevelError}`)
  for (const e of hatalar) {
    satirlar.push(`${relativeOrBase(e.dosya, sketchKlasoru)}:${e.satir}:${e.sutun}: error: ${e.mesaj}`)
    if (e.baglam?.length) satirlar.push(...e.baglam.slice(0, 3).map((b) => `    ${b}`))
  }
  if (r.errors.filter((e) => e.tur === 'error').length > hatalar.length) {
    satirlar.push(`… ve ${r.errors.filter((e) => e.tur === 'error').length - hatalar.length} hata daha (önce ilkleri düzelt).`)
  }
  const tumMetin = `${r.log}\n${r.topLevelError ?? ''}\n${r.errors.map((e) => e.mesaj).join('\n')}`
  if (/No such file or directory|fatal error:.*\.h|cannot find .*\.h/i.test(tumMetin)) {
    satirlar.push('İPUCU: Eksik başlık dosyası olabilir. search_libraries ile ilgili kütüphaneyi bul, install_library ile kur.')
  }
  if (/platform .* is not installed|Platform .* not found|core.*not installed/i.test(tumMetin)) {
    satirlar.push('İPUCU: Kart platformu kurulu değil. Kullanıcıdan Kart Yöneticisi\'nden kurmasını iste.')
  }
  return kisalt(satirlar.join('\n'), maksKarakter)
}

function relativeOrBase(dosya: string, klasor: string): string {
  try {
    const r = relative(klasor, dosya)
    return r && !r.startsWith('..') ? r : basename(dosya)
  } catch {
    return basename(dosya)
  }
}

export async function derle(
  ctx: ToolContext,
  klasor: string,
  fqbnGirdi?: string
): Promise<{ sonuc: CompileResult | null; mesaj: string; ok: boolean }> {
  const fqbn = (fqbnGirdi || ctx.board?.fqbn || '').trim()
  if (!fqbn) {
    return {
      sonuc: null,
      ok: false,
      mesaj:
        'Derleme yapılamadı: Seçili kart yok. Kullanıcıdan araç çubuğundan bir kart seçmesini iste (ask_user kullanabilirsin) ya da compile aracına fqbn ver.'
    }
  }
  ctx.durum.derlemeSayaci++
  const opId = `agent-${ctx.runId}-${ctx.durum.derlemeSayaci}`
  const onAbort = (): void => {
    ctx.arduino.cancelOperation(opId)
  }
  ctx.signal.addEventListener('abort', onAbort, { once: true })
  try {
    let sonuc: CompileResult
    try {
      sonuc = await ctx.kilit.runExclusive(() => ctx.arduino.compile(klasor, fqbn, opId))
    } catch (e) {
      return { sonuc: null, ok: false, mesaj: `Derleme başlatılamadı: ${(e as Error).message}. Kullanıcının işlemi bitince tekrar dene.` }
    }
    ctx.emit({ runId: ctx.runId, type: 'compile_result', result: sonuc })
    if (sonuc.success) await ctx.derlemeyiKaydet?.(klasor, fqbn, sonuc)
    ctx.durum.derlenmemis.delete(klasor)
    return { sonuc, ok: sonuc.success, mesaj: derlemeSonucunuOzetle(sonuc, klasor, ctx.maksSonucKarakter) }
  } finally {
    ctx.signal.removeEventListener('abort', onAbort)
  }
}

async function compileTool(ctx: ToolContext, a: Record<string, unknown>): Promise<ToolOutcome> {
  let klasor: string | null
  if (a.sketch) {
    klasor = ctx.ws.yolCoz(str(a.sketch))
    if (!ctx.ws.sketchMi(klasor)) klasor = dirname(klasor)
  } else {
    klasor = ctx.ws.getAktifSketch()
  }
  if (!klasor || !ctx.ws.sketchMi(klasor)) {
    return { ok: false, label: 'Derleme', output: 'HATA: Derlenecek geçerli bir sketch bulunamadı. sketch parametresi ver.' }
  }
  const r = await derle(ctx, klasor, str(a.fqbn))
  return {
    ok: r.ok,
    label: `${r.ok ? 'Derlendi' : 'Derleme hatası'}: ${basename(klasor)}`,
    detail: r.sonuc ? `${r.sonuc.errors.filter((e) => e.tur === 'error').length} hata` : undefined,
    output: r.mesaj
  }
}

// ── bilgi araçları ──

async function searchDocs(ctx: ToolContext, a: Record<string, unknown>): Promise<ToolOutcome> {
  const q = str(a.query).trim()
  if (!q) throw new Error('query boş olamaz')
  const kaynak = str(a.source)
  const kinds: RagKind[] | undefined =
    kaynak === 'library' ? ['library'] : kaynak === 'example' ? ['example'] : kaynak === 'skill' ? ['skill'] : kaynak === 'board' ? ['snippet'] : undefined
  const metin = await ctx.boardSkills.getRelevantExamplesContext(q, ctx.board, { topK: 5, kinds })
  return {
    ok: true,
    label: `Belge arandı: ${q.slice(0, 40)}`,
    output: metin.trim()
      ? kisalt(metin, ctx.maksSonucKarakter)
      : 'Yerel bilgi tabanında alakalı sonuç bulunamadı. Kendi bilginle devam et ama API adlarından emin değilsen derleyip doğrula.'
  }
}

async function boardInfo(ctx: ToolContext): Promise<ToolOutcome> {
  const metin = await ctx.boardSkills.getBoardSkillProfile(ctx.board)
  return { ok: true, label: 'Kart bilgisi alındı', output: kisalt(metin, ctx.maksSonucKarakter) }
}

async function searchLibraries(ctx: ToolContext, a: Record<string, unknown>): Promise<ToolOutcome> {
  const q = str(a.query).trim()
  if (!q) throw new Error('query boş olamaz')
  const liste = (await ctx.arduino.searchLibraries(q)).slice(0, 10)
  return {
    ok: true,
    label: `Kütüphane arandı: ${q}`,
    detail: `${liste.length} sonuç`,
    output: liste.length
      ? liste
          .map((l) => `- ${l.name} ${l.latestVersion ? 'v' + l.latestVersion : ''} ${l.installed ? '[KURULU ' + (l.installedVersion ?? '') + ']' : ''} — ${(l.sentence ?? '').slice(0, 100)}`)
          .join('\n')
      : 'Sonuç yok.'
  }
}

async function installLibrary(ctx: ToolContext, a: Record<string, unknown>): Promise<ToolOutcome> {
  const ad = str(a.name).trim()
  if (!ad) throw new Error('name boş olamaz')
  const ret = await onayAl(ctx, 'yikici', 'install_library', `Kütüphane kurulacak: ${ad}`)
  if (ret) return { ok: false, label: `Reddedildi: ${ad}`, output: ret }
  const opId = `agent-lib-${ctx.runId}-${Date.now()}`
  const onAbort = (): void => {
    ctx.arduino.cancelOperation(opId)
  }
  ctx.signal.addEventListener('abort', onAbort, { once: true })
  try {
    await ctx.arduino.installLibrary(ad, str(a.version) || undefined, opId)
  } finally {
    ctx.signal.removeEventListener('abort', onAbort)
  }
  return { ok: true, label: `Kütüphane kuruldu: ${ad}`, output: `OK: ${ad} kuruldu. Şimdi compile ile doğrulayabilirsin.` }
}

// ── plan / soru ──

function updatePlan(ctx: ToolContext, a: Record<string, unknown>): ToolOutcome {
  const ham = Array.isArray(a.todos) ? a.todos : []
  const todos: AgentPlanItem[] = ham
    .map((t) => {
      if (typeof t === 'string') return { text: t, done: false }
      const o = t as { text?: unknown; done?: unknown }
      return { text: str(o.text), done: Boolean(o.done) }
    })
    .filter((t) => t.text.trim())
    .slice(0, 12)
  ctx.emit({ runId: ctx.runId, type: 'plan', todos })
  return {
    ok: true,
    label: 'Plan güncellendi',
    detail: `${todos.filter((t) => t.done).length}/${todos.length}`,
    output: 'Plan güncellendi. Devam et.'
  }
}

async function askUser(ctx: ToolContext, a: Record<string, unknown>): Promise<ToolOutcome> {
  const soru = str(a.question).trim()
  if (!soru) throw new Error('question boş olamaz')
  const secenekler = Array.isArray(a.options) ? a.options.map(str).filter(Boolean).slice(0, 6) : undefined
  const r = await ctx.istekOnay('question', 'ask_user', soru, secenekler)
  if (!r.approved || !r.answer?.trim()) {
    return { ok: true, label: 'Soru yanıtsız bırakıldı', output: 'Kullanıcı yanıt vermedi. Makul varsayımlarla devam et ve varsayımını belirt.' }
  }
  return { ok: true, label: 'Kullanıcı yanıtladı', detail: r.answer.slice(0, 80), output: `Kullanıcı yanıtı: ${r.answer}` }
}

/** UI etiketi (tool_start için, sonuç gelmeden önce gösterilir) */
export function aracEtiketi(ad: string, a: Record<string, unknown>): string {
  const p = typeof a.path === 'string' ? a.path : ''
  const kisa = p ? p.split(/[\\/]/).slice(-2).join('/') : ''
  switch (ad) {
    case 'list_workspace':
      return 'Çalışma alanı inceleniyor'
    case 'read_file':
      return `Okunuyor: ${kisa}`
    case 'search_code':
      return `Aranıyor: ${str(a.pattern).slice(0, 40)}`
    case 'edit_file':
      return `Düzenleniyor: ${kisa}`
    case 'write_file':
      return `Yazılıyor: ${kisa}`
    case 'create_sketch':
      return `Sketch oluşturuluyor: ${str(a.name)}`
    case 'delete_file':
      return `Siliniyor: ${kisa}`
    case 'rename_file':
      return `Yeniden adlandırılıyor: ${kisa}`
    case 'delete_sketch':
      return `Sketch siliniyor: ${kisa || str(a.path)}`
    case 'rename_sketch':
      return `Sketch yeniden adlandırılıyor: ${str(a.new_name)}`
    case 'compile':
      return `Derleniyor${a.sketch ? ': ' + basename(str(a.sketch)) : ''}`
    case 'search_docs':
      return `Belgelerde aranıyor: ${str(a.query).slice(0, 40)}`
    case 'get_board_info':
      return 'Kart bilgisi alınıyor'
    case 'search_libraries':
      return `Kütüphane aranıyor: ${str(a.query)}`
    case 'install_library':
      return `Kütüphane kuruluyor: ${str(a.name)}`
    case 'update_plan':
      return 'Plan güncelleniyor'
    case 'ask_user':
      return 'Kullanıcıya soruluyor'
    default:
      return ad
  }
}
