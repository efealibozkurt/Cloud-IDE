import { readFile } from 'fs/promises'
import { basename, dirname, join, relative, resolve } from 'path'
import { BAGLANTI_DOSYA_ADI, baglantiKilavuzuDogrula } from '@shared/baglantiKilavuzu'
import { pinleriDenetle, pinOzetiCikar, type PinKaynakDosya } from '@shared/pinCheck'
import { BOOTLOADER_DESENI, seriCiktiAnalizEt } from '@shared/seriTeshis'
import type { AgentDiffPreview, AgentEvent, AgentPermissionMode, AgentPlanItem, CompileResult, LineEnding } from '@shared/types'
import type { ArduinoCliService } from '../ArduinoCliService'
import type { DeviceLock } from '../DeviceLock'
import type { RagKind } from '../RagService'
import type { SerialService } from '../SerialService'
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
  },
  {
    name: 'read_serial',
    description:
      'Seri monitör tamponundaki son çıktıları okur ve isteğe bağlı olarak canlı veri dinler (wait_ms). Donanım çökmesi (Guru Meditation, WDT, Brownout) veya baud uyuşmazlığı belirtilerini otomatik analiz eder.',
    parameters: {
      type: 'object',
      properties: {
        port: { type: 'string', description: 'Opsiyonel seri port yolu (örn. "COM3"); verilmezse birincil/tüm açık portlar okunur' },
        lines: { type: 'integer', description: 'Okunacak son satır sayısı (1–200, varsayılan 60)' },
        wait_ms: { type: 'integer', description: 'Canlı gelen yeni satırları beklemek için süre (0–8000 ms, varsayılan 0)' },
        hide_bootloader: { type: 'boolean', description: 'true ise ESP önyükleyici teknik satırlarını gizler' }
      }
    }
  },
  {
    name: 'send_serial',
    description:
      'Açık seri porta metin/komut gönderir ve yanıt bekler. Kullanıcıdan onay isteyebilir; yalnızca test veya kullanıcı istediğinde kullan.',
    parameters: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Gönderilecek metin veya komut (en fazla 500 karakter)' },
        line_ending: { type: 'string', enum: ['none', 'nl', 'cr', 'nlcr'], description: 'Satır sonu eki (varsayılan: nl)' },
        port: { type: 'string', description: 'Opsiyonel port yolu (varsayılan: birincil açık port)' },
        wait_ms: { type: 'integer', description: 'Gönderim sonrası yanıt bekleme süresi (0–5000 ms, varsayılan 800)' }
      },
      required: ['data']
    }
  },
  {
    name: 'check_pins',
    description:
      'Aktif sketch kodunu seçili kartın pin haritası ve kurallarına göre (PWM, kesme, ADC2/Wi-Fi, flash pinleri, çakışmalar) statik olarak denetler.',
    parameters: {
      type: 'object',
      properties: {
        sketch: { type: 'string', description: 'Opsiyonel sketch klasörü yolu/adı (varsayılan: aktif sketch)' },
        fqbn: { type: 'string', description: 'Opsiyonel kart FQBN (varsayılan: seçili kart)' }
      }
    }
  },
  {
    name: 'save_wiring_guide',
    description:
      'Projenin etkileşimli Bağlantı Kılavuzu sekmesi için devre bileşenlerini, kablo renk kodlu pin bağlantılarını ve 3.3V/5V güvenlik uyarılarını BAGLANTI.json olarak kaydeder.',
    parameters: {
      type: 'object',
      properties: {
        ozet: { type: 'string', description: 'Devrenin tek cümlelik Türkçe özeti' },
        kart_adi: { type: 'string', description: 'Opsiyonel kart adı (örn. "Arduino Uno", "ESP32")' },
        mantik_voltaj: { type: 'string', enum: ['5V', '3.3V'], description: 'Kartın mantık seviyesi (5V veya 3.3V)' },
        bilesenler: {
          type: 'array',
          description: 'Kullanılan donanım bileşenleri',
          items: {
            type: 'object',
            properties: {
              ad: { type: 'string' },
              tur: { type: 'string' },
              voltaj: { type: 'string' },
              ek_parcalar: { type: 'array', items: { type: 'string' } },
              aciklama: { type: 'string' }
            },
            required: ['ad', 'tur']
          }
        },
        baglantilar: {
          type: 'array',
          description: 'Tek tek kablo bağlantıları',
          items: {
            type: 'object',
            properties: {
              bilesen: { type: 'string' },
              bilesen_pini: { type: 'string' },
              kart_pini: { type: 'string' },
              kart_pin_no: { type: 'integer' },
              renk: { type: 'string', enum: ['kirmizi', 'siyah', 'mavi', 'sari', 'yesil', 'turuncu', 'beyaz', 'gri'] },
              not: { type: 'string' }
            },
            required: ['bilesen', 'bilesen_pini', 'kart_pini']
          }
        },
        uyarilar: {
          type: 'array',
          description: 'Önemli güvenlik ve güç uyarıları',
          items: {
            type: 'object',
            properties: {
              seviye: { type: 'string', enum: ['dikkat', 'bilgi'] },
              mesaj: { type: 'string' }
            },
            required: ['mesaj']
          }
        },
        sketch: { type: 'string', description: 'Opsiyonel sketch klasörü yolu/adı (varsayılan: aktif sketch)' }
      },
      required: ['ozet', 'baglantilar']
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
  'install_library',
  'read_serial',
  'check_pins'
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
  serial?: SerialService
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
      case 'read_serial':
        return await readSerialTool(ctx, args)
      case 'send_serial':
        return await sendSerialTool(ctx, args)
      case 'check_pins':
        return await checkPinsTool(ctx, args)
      case 'save_wiring_guide':
        return await saveWiringGuideTool(ctx, args)
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

// ── seri port / pin denetimi / bağlantı kılavuzu ──

function sketchKlasoruCoz(ctx: ToolContext, sketchArg?: unknown): string {
  let klasor: string | null = null
  if (sketchArg) {
    klasor = ctx.ws.yolCoz(str(sketchArg))
    if (!ctx.ws.sketchMi(klasor)) klasor = dirname(klasor)
  } else {
    klasor = ctx.ws.getAktifSketch()
  }
  if (!klasor || !ctx.ws.sketchMi(klasor)) {
    throw new Error('Geçerli bir sketch bulunamadı. sketch parametresi verin veya bir proje açın.')
  }
  return klasor
}

async function readSerialTool(ctx: ToolContext, a: Record<string, unknown>): Promise<ToolOutcome> {
  if (!ctx.serial) {
    return { ok: false, label: 'Seri port okunamadı', output: 'HATA: Seri port servisine erişilemiyor.' }
  }
  const aciklar = ctx.serial.acikPortlar()
  const istenenPort = str(a.port).trim() || undefined
  const limit = Math.min(200, Math.max(1, Math.floor(Number(a.lines ?? 60) || 60)))
  const waitMs = Math.min(8000, Math.max(0, Math.floor(Number(a.wait_ms ?? 0) || 0)))
  const gizleBootloader = Boolean(a.hide_bootloader)

  let canliSayi = 0
  let canliNotu = ''
  if (waitMs > 0) {
    const beklePort = istenenPort ?? ctx.serial.aktifPort() ?? undefined
    if (beklePort && ctx.serial.isOpen(beklePort)) {
      const gelen = await ctx.serial.satirBekle({
        port: beklePort,
        sureMs: waitMs,
        enFazlaSatir: limit,
        signal: ctx.signal
      })
      canliSayi = gelen.length
    } else {
      canliNotu = 'Not: Canlı dinleme için açık seri port bulunamadı; yalnızca tampondaki eski satırlar kontrol edildi.'
    }
  }

  let kayitlar = ctx.serial.sonSatirlar({ port: istenenPort, limit })
  if (gizleBootloader) {
    kayitlar = kayitlar.filter((k) => !BOOTLOADER_DESENI.test(k.satir))
  }

  if (kayitlar.length === 0 && aciklar.length === 0) {
    return {
      ok: true,
      label: 'Seri port kapalı',
      output:
        'Açık seri port yok ve tampondaki seri çıktı boş. Kullanıcıdan üst çubuktan portu seçip Seri Monitör\'den "Bağlan"a tıklamasını iste.'
    }
  }

  const satirlar: string[] = []
  satirlar.push(
    `Açık portlar: ${aciklar.length ? aciklar.map((p) => `${p.port} @ ${p.baud}`).join(', ') : '(yok)'}`
  )
  if (canliNotu) satirlar.push(canliNotu)
  else if (waitMs > 0) satirlar.push(`Canlı beklemede (${waitMs} ms) gelen yeni satır: ${canliSayi}`)

  if (kayitlar.length === 0) {
    satirlar.push('\nSeri tampondan okunacak yeni çıktı yok.')
  } else {
    satirlar.push(`\nSERİ ÇIKTI (son ${kayitlar.length} satır):`)
    for (const k of kayitlar) {
      const saat = new Date(k.zaman).toLocaleTimeString('tr-TR', { hour12: false })
      satirlar.push(`[${saat} ${k.port}] ${k.satir}`)
    }
    const ipuclari = seriCiktiAnalizEt(kayitlar.map((k) => k.satir))
    if (ipuclari.length > 0) {
      satirlar.push('\nOTOMATİK TEŞHİS İPUÇLARI:')
      for (const ip of ipuclari) satirlar.push(`- ${ip}`)
    }
  }

  return {
    ok: true,
    label: `Seri çıktı okundu (${kayitlar.length} satır)`,
    detail: aciklar[0]?.port,
    output: kisalt(satirlar.join('\n'), ctx.maksSonucKarakter)
  }
}

async function sendSerialTool(ctx: ToolContext, a: Record<string, unknown>): Promise<ToolOutcome> {
  if (!ctx.serial) {
    return { ok: false, label: 'Seri gönderim başarısız', output: 'HATA: Seri port servisine erişilemiyor.' }
  }
  const veri = str(a.data)
  if (!veri) throw new Error('data boş olamaz')
  if (veri.length > 500) throw new Error('data en fazla 500 karakter olabilir')

  const hedefPort = str(a.port).trim() || ctx.serial.aktifPort()
  if (!hedefPort || !ctx.serial.isOpen(hedefPort)) {
    return {
      ok: false,
      label: 'Seri port açık değil',
      output: 'HATA: Açık seri port bulunamadı. Önce kullanıcının Seri Monitör üzerinden bir porta bağlanması gerekir.'
    }
  }

  const hamSonu = str(a.line_ending) || 'nl'
  const satirSonu: LineEnding =
    hamSonu === 'none' || hamSonu === 'nl' || hamSonu === 'cr' || hamSonu === 'nlcr' ? hamSonu : 'nl'

  const ret = await onayAl(
    ctx,
    'yikici',
    'send_serial',
    `Seri porta veri gönderilecek (${hedefPort}): "${veri.slice(0, 80)}"`
  )
  if (ret) return { ok: false, label: 'Seri gönderim reddedildi', output: ret }

  const waitMs = Math.min(5000, Math.max(0, Math.floor(Number(a.wait_ms ?? 800) || 0)))
  const bekleme =
    waitMs > 0
      ? ctx.serial.satirBekle({ port: hedefPort, sureMs: waitMs, enFazlaSatir: 60, signal: ctx.signal })
      : Promise.resolve([])

  await ctx.serial.write(veri, satirSonu, hedefPort)
  const yanitlar = await bekleme

  const cikti = [
    `${hedefPort} portuna gönderildi (${satirSonu}): "${veri}"`,
    yanitlar.length > 0
      ? `\nGELEN YANIT (${yanitlar.length} satır):\n${yanitlar.map((y) => y.satir).join('\n')}`
      : waitMs > 0
        ? `\n${waitMs} ms içinde seri yanıt alınmadı.`
        : ''
  ].join('\n')

  return {
    ok: true,
    label: `Seri gönderildi: ${hedefPort}`,
    detail: yanitlar.length > 0 ? `${yanitlar.length} yanıt` : undefined,
    output: kisalt(cikti, ctx.maksSonucKarakter)
  }
}

async function checkPinsTool(ctx: ToolContext, a: Record<string, unknown>): Promise<ToolOutcome> {
  const klasor = sketchKlasoruCoz(ctx, a.sketch)
  const ozet = await ctx.ws.sketchOzeti(klasor)
  const kaynaklar: PinKaynakDosya[] = []
  for (const f of ozet.files) {
    if (!ctx.ws.kaynakDosyaMi(f.path)) continue
    const icerik = await ctx.ws.oku(f.path).catch(() => null)
    if (icerik !== null) kaynaklar.push({ dosya: f.name, icerik })
  }
  const fqbn = str(a.fqbn).trim() || ctx.board?.fqbn || null
  const pinOzeti = pinOzetiCikar(kaynaklar, fqbn)
  const sorunlar = pinleriDenetle(kaynaklar, fqbn)

  const satirlar: string[] = [
    `Sketch: ${ozet.name} (${kaynaklar.length} kaynak dosya)`,
    `Kart: ${pinOzeti.kartAdi ?? (fqbn || '(seçilmedi — yalnızca genel çakışma kuralları)')}`,
    ''
  ]
  if (pinOzeti.kullanimlar.length === 0) {
    satirlar.push('Sayıya çözülebilen sabit pin kullanımı bulunamadı.')
  } else {
    satirlar.push('KULLANILAN PİNLER:')
    for (const k of pinOzeti.kullanimlar) {
      satirlar.push(`- Pin ${k.pin}: ${k.roller.join(', ')} (${k.dosya}:${k.satir})`)
    }
  }
  satirlar.push('')
  if (sorunlar.length === 0) {
    satirlar.push('SONUÇ: Pin denetiminde hata veya uyarı bulunamadı.')
  } else {
    satirlar.push(`BULGULAR (${sorunlar.length}):`)
    for (const s of sorunlar) {
      const tur = s.tur === 'error' ? 'HATA' : s.tur === 'warning' ? 'UYARI' : 'NOT'
      satirlar.push(`- [${tur}] ${s.dosya}:${s.satir} (Pin ${s.pin}) — ${s.mesaj}`)
    }
  }

  return {
    ok: true,
    label: `Pin denetimi: ${ozet.name}`,
    detail: sorunlar.length > 0 ? `${sorunlar.length} bulgu` : 'sorunsuz',
    output: kisalt(satirlar.join('\n'), ctx.maksSonucKarakter)
  }
}

async function saveWiringGuideTool(ctx: ToolContext, a: Record<string, unknown>): Promise<ToolOutcome> {
  const klasor = sketchKlasoruCoz(ctx, a.sketch)
  const hedefYol = join(klasor, BAGLANTI_DOSYA_ADI)

  let oncekiTamamlananlar: string[] = []
  try {
    const ham = await readFile(hedefYol, 'utf8')
    const eski = baglantiKilavuzuDogrula(JSON.parse(ham), ctx.board?.name, ctx.board?.fqbn)
    if (eski?.tamamlananlar) oncekiTamamlananlar = eski.tamamlananlar
  } catch {
    // mevcut BAGLANTI.json yoksa yok say
  }

  const kartAdi = str(a.kart_adi).trim() || ctx.board?.name || 'Seçili kart'
  const kilavuz = baglantiKilavuzuDogrula(
    {
      ...a,
      kartAdi,
      fqbn: ctx.board?.fqbn,
      kaynak: 'ai',
      guncellemeZamani: Date.now()
    },
    kartAdi,
    ctx.board?.fqbn
  )
  if (!kilavuz) {
    throw new Error('Geçerli en az bir bağlantı hattı (bilesen, bilesen_pini, kart_pini) veya bileşen belirtmelisin.')
  }

  if (oncekiTamamlananlar.length > 0) {
    const gecerliIdler = new Set(kilavuz.baglantilar.map((b) => b.id))
    const korunan = oncekiTamamlananlar.filter((id) => gecerliIdler.has(id))
    if (korunan.length > 0) kilavuz.tamamlananlar = korunan
  }

  await ctx.ws.yaz(hedefYol, JSON.stringify(kilavuz, null, 2))

  return {
    ok: true,
    label: `Bağlantı kılavuzu kaydedildi (${kilavuz.baglantilar.length} hat)`,
    detail: `${kilavuz.bilesenler.length} bileşen`,
    output: `OK: ${dosyaGoreli(ctx.ws, hedefYol)} kaydedildi (${kilavuz.bilesenler.length} bileşen, ${kilavuz.baglantilar.length} bağlantı, ${kilavuz.uyarilar.length} uyarı). Alt paneldeki "Bağlantı Kılavuzu" sekmesinde canlı olarak görüntüleniyor.`
  }
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
    case 'read_serial':
      return 'Seri çıktı okunuyor'
    case 'send_serial':
      return `Seri porta gönderiliyor${a.port ? ': ' + str(a.port) : ''}`
    case 'check_pins':
      return 'Pinler denetleniyor'
    case 'save_wiring_guide':
      return 'Bağlantı kılavuzu kaydediliyor'
    default:
      return ad
  }
}
