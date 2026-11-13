import { randomUUID } from 'crypto'
import type { ToolCall, ToolDef } from './llmTypes'
import { argumanlariAyristir } from './providers'

/**
 * Araç çağırmayı (function calling) desteklemeyen yerel modeller için metin protokolü.
 * Model şu biçimde yazar:
 *   <tool name="read_file"><arg name="path">x/x.ino</arg></tool>
 *   <tool name="write_file"><arg name="path">..</arg><content>ham kod</content></tool>
 *   <tool name="edit_file"><arg name="path">..</arg><old>..</old><new>..</new></tool>
 * JSON kaçışı gerektirmediği için küçük modellerde çok daha güvenilirdir.
 * Yedek olarak <tool_call>{"name":..,"arguments":{..}}</tool_call> (Hermes biçimi) de ayrıştırılır.
 */

/** Etiket içi özel gövde etiketlerinin hangi argüman adına eşlendiği (araç bazlı) */
function govdeArgumaniAdi(arac: string): string {
  return arac === 'create_sketch' ? 'code' : 'content'
}

function etiketIcerigi(blok: string, etiket: string): string | null {
  const re = new RegExp(`<${etiket}>([\\s\\S]*?)</${etiket}>`, 'i')
  const m = re.exec(blok)
  if (m) return m[1]
  // Kapanış etiketi unutulmuşsa sonuna kadar al
  const acik = new RegExp(`<${etiket}>([\\s\\S]*)$`, 'i').exec(blok)
  return acik ? acik[1] : null
}

/** Kod bloğu çitini (```cpp ... ```) ve baştaki/sondaki tek satır sonunu temizler */
function icerigiTemizle(ham: string): string {
  let s = ham.replace(/^\r?\n/, '')
  const cit = /^```[a-zA-Z+]*\r?\n([\s\S]*?)\r?\n?```\s*$/.exec(s.trim())
  if (cit) s = cit[1]
  return s.replace(/\r?\n$/, '')
}

function degerCoz(v: string): unknown {
  const t = v.trim()
  if (t === 'true') return true
  if (t === 'false') return false
  if (/^-?\d+$/.test(t)) return Number(t)
  if ((t.startsWith('[') && t.endsWith(']')) || (t.startsWith('{') && t.endsWith('}'))) {
    try {
      return JSON.parse(t)
    } catch {
      return t
    }
  }
  return t
}

function blokCoz(ad: string, govde: string): ToolCall {
  const args: Record<string, unknown> = {}
  const argRe = /<arg\s+name\s*=\s*["']([^"']+)["']\s*>([\s\S]*?)<\/arg>/gi
  let m: RegExpExecArray | null
  while ((m = argRe.exec(govde))) args[m[1]] = degerCoz(m[2])

  const icerik = etiketIcerigi(govde, 'content')
  if (icerik !== null) args[govdeArgumaniAdi(ad)] = icerigiTemizle(icerik)
  const eski = etiketIcerigi(govde, 'old')
  if (eski !== null) args.old_text = icerigiTemizle(eski)
  const yeni = etiketIcerigi(govde, 'new')
  if (yeni !== null) args.new_text = icerigiTemizle(yeni)

  // Etiket gövdesi düz JSON ise (model biçimi karıştırdıysa) onu kullan
  if (Object.keys(args).length === 0 && govde.trim().startsWith('{')) {
    const j = argumanlariAyristir(govde.trim())
    if (!('__parse_error' in j)) Object.assign(args, j)
  }
  return { id: `txt_${randomUUID().slice(0, 8)}`, name: ad, args }
}

export interface MetinAracSonucu {
  /** Araç blokları çıkarılmış, kullanıcıya gösterilecek metin */
  temiz: string
  calls: ToolCall[]
}

/** Tam metinden araç çağrılarını çıkarır (akış bittikten sonra çağrılır) */
export function metinAraclariniAyikla(metin: string, izinli: Set<string>): MetinAracSonucu {
  const calls: ToolCall[] = []
  let temiz = metin

  // 1) <tool name="x"> ... </tool>
  const toolRe = /<tool\s+name\s*=\s*["']([a-z_]+)["']\s*(?:\/>|>([\s\S]*?)(?:<\/tool>|$))/gi
  temiz = temiz.replace(toolRe, (_t, ad: string, govde: string | undefined) => {
    if (izinli.has(ad)) calls.push(blokCoz(ad, govde ?? ''))
    return ''
  })

  // 2) <tool_call>{"name": "...", "arguments": {...}}</tool_call>
  const hermesRe = /<tool_call>\s*([\s\S]*?)\s*(?:<\/tool_call>|$)/gi
  temiz = temiz.replace(hermesRe, (_t, json: string) => {
    const j = argumanlariAyristir(json)
    const ad = typeof j.name === 'string' ? j.name : ''
    if (ad && izinli.has(ad)) {
      const a = (j.arguments ?? j.parameters ?? j.args ?? {}) as unknown
      calls.push({
        id: `txt_${randomUUID().slice(0, 8)}`,
        name: ad,
        args: typeof a === 'object' && a ? (a as Record<string, unknown>) : argumanlariAyristir(String(a))
      })
    }
    return ''
  })

  return { temiz: temiz.replace(/\n{3,}/g, '\n\n').trim(), calls }
}

/** Gerçek bir araç bloğunun başlangıcı: <tool name="..."> ya da <tool_call> */
const ARAC_BASLANGICI = /<tool(?:_call>|\s+name\s*=)/i

/** Bir parçanın sonunda kalan metin, araç başlangıcının henüz gelmemiş bir öneki olabilir mi? */
function aracOnekiOlabilirMi(artik: string): boolean {
  if (!artik.startsWith('<') || artik.length > 14) return false
  const a = artik.toLowerCase()
  if ('<tool_call>'.startsWith(a)) return true
  // "<tool", "<tool ", "<tool n", "<tool name", "<tool name=" ...
  return /^<tool(\s+(n(a(m(e(\s*=?)?)?)?)?)?)?$/.test(a)
}

/**
 * Akış sırasında araç bloklarını kullanıcıya göstermemek için süzgeç: yalnızca gerçek araç
 * etiketi (<tool name=...> veya <tool_call>) başladığı andan itibaren metni yutar. Sıradan
 * "<" işaretleri ve "<toolbar.h>" gibi metinler olduğu gibi geçer.
 */
export class MetinAkisSuzgeci {
  private tampon = ''
  private gizli = false

  isle(parca: string): string {
    if (this.gizli) return ''
    this.tampon += parca
    const m = ARAC_BASLANGICI.exec(this.tampon)
    if (m) {
      const gorunur = this.tampon.slice(0, m.index)
      this.gizli = true
      this.tampon = ''
      return gorunur
    }
    // Chunk sonunda yarım kalmış bir araç başlangıcı olabilir: yalnızca o kuyruğu tut
    const son = this.tampon.lastIndexOf('<')
    if (son >= 0 && aracOnekiOlabilirMi(this.tampon.slice(son))) {
      const gonder = this.tampon.slice(0, son)
      this.tampon = this.tampon.slice(son)
      return gonder
    }
    const gonder = this.tampon
    this.tampon = ''
    return gonder
  }

  bosalt(): string {
    if (this.gizli) return ''
    const s = this.tampon
    this.tampon = ''
    return s
  }

  /** Akış sırasında bir araç bloğu başlamışsa true */
  aracBasladiMi(): boolean {
    return this.gizli
  }
}

/** Metin modunda sistem prompt'una eklenen araç listesi (şema yerine okunabilir özet) */
export function metinModuAracListesi(araclar: ToolDef[]): string {
  const satirlar = araclar.map((t) => {
    const ozel: Record<string, string> = {
      write_file: '  parametre: path; içerik <content> etiketinde',
      create_sketch: '  parametre: name, group(opsiyonel); ana kod <content> etiketinde',
      edit_file: '  parametre: path; eski metin <old>, yeni metin <new> etiketinde'
    }
    if (ozel[t.name]) return `- ${t.name}: ${t.description.split('. ')[0]}.\n${ozel[t.name]}`
    const p = Object.entries(t.parameters.properties)
      .map(([k]) => (t.parameters.required?.includes(k) ? k : `${k}(opsiyonel)`))
      .join(', ')
    return `- ${t.name}: ${t.description.split('. ')[0]}.${p ? `\n  parametre: ${p}` : ''}`
  })
  return `KULLANABİLECEĞİN ARAÇLAR:\n${satirlar.join('\n')}`
}
