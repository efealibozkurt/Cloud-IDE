import type { AIProviderId } from '@shared/types'
import { isLocalProvider } from '@shared/types'
import type { SecretsService } from '../SecretsService'
import type { SettingsService } from '../SettingsService'
import {
  ProviderError,
  type ChatRequest,
  type JsonSchemaProp,
  type LlmMessage,
  type ProviderErrorKind,
  type ProviderKind,
  type ResolvedProvider,
  type StreamEvent,
  type ToolCall,
  type ToolDef
} from './llmTypes'

// ────────────────────────────────────────────────────────────────────────
// Sağlayıcı çözümleme (adres, anahtar, model)
// ────────────────────────────────────────────────────────────────────────

const VARSAYILAN_ADRESLER: Record<AIProviderId, string> = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com',
  kimi: 'https://api.moonshot.ai/v1',
  nvidia: 'https://integrate.api.nvidia.com/v1',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  lmstudio: 'http://127.0.0.1:1234/v1',
  ollama: 'http://127.0.0.1:11434'
}

const VARSAYILAN_MODELLER: Partial<Record<AIProviderId, string>> = {
  openai: 'gpt-4o',
  deepseek: 'deepseek-chat',
  kimi: 'kimi-k2.5',
  nvidia: 'meta/llama-3.3-70b-instruct',
  anthropic: 'claude-3-5-sonnet-latest',
  gemini: 'gemini-2.5-flash',
  lmstudio: 'local-model'
}

function sagKesikSil(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

/** OpenAI uyumlu taban adresi: `/chat/completions` ve `/models` ekleri atılır, yol yoksa `/v1` eklenir */
export function openAiTabanAdresiniDuzelt(ham: string): string {
  let url = sagKesikSil(ham)
  url = url.replace(/\/chat\/completions$/i, '').replace(/\/models$/i, '')
  url = sagKesikSil(url)
  try {
    const u = new URL(url)
    if (u.pathname === '' || u.pathname === '/') url = `${u.origin}/v1`
  } catch {
    // Geçersiz URL; çağıran taraf bağlantı hatasında anlamlı mesaj alır
  }
  return url
}

/** Ollama sunucu kökü: `/v1`, `/api/...` gibi ekler atılır */
export function ollamaKokAdresiniDuzelt(ham: string): string {
  let url = sagKesikSil(ham)
  url = url.replace(/\/api(\/.*)?$/i, '').replace(/\/v1(\/.*)?$/i, '')
  return sagKesikSil(url)
}

export function saglayiciTuru(id: AIProviderId): ProviderKind {
  if (id === 'anthropic') return 'anthropic'
  if (id === 'gemini') return 'gemini'
  if (id === 'ollama') return 'ollama'
  return 'openai'
}

export function resolveProvider(
  id: AIProviderId,
  model: string | undefined,
  secrets: SecretsService,
  settings: SettingsService
): ResolvedProvider {
  const kind = saglayiciTuru(id)
  const yerel = isLocalProvider(id)
  const kayitliAnahtar = secrets.getDecryptedApiKey(id)
  const ayarAdresi = settings.get('aiBaseUrls')?.[id]?.trim()
  const secilenModel = (model || settings.get('selectedModelPerProvider')?.[id] || VARSAYILAN_MODELLER[id] || '').trim()

  let baseUrl = VARSAYILAN_ADRESLER[id]
  let apiKey = kayitliAnahtar ?? ''

  if (yerel) {
    // Eski sürümlerde sunucu adresi "API anahtarı" alanına yazılıyordu; geriye dönük uyum
    const eskiAdres = kayitliAnahtar && /^https?:\/\//i.test(kayitliAnahtar) ? kayitliAnahtar : ''
    const adres = ayarAdresi || eskiAdres || VARSAYILAN_ADRESLER[id]
    baseUrl = kind === 'ollama' ? ollamaKokAdresiniDuzelt(adres) : openAiTabanAdresiniDuzelt(adres)
    apiKey = eskiAdres ? '' : (kayitliAnahtar ?? '')
    if (id === 'lmstudio' && !apiKey) apiKey = 'lm-studio'
  } else {
    if (!apiKey.trim()) {
      throw new ProviderError(`${id} için API anahtarı girilmemiş. Ayarlar > Yapay Zekâ bölümünden ekleyin.`, {
        kind: 'auth'
      })
    }
    if (ayarAdresi) baseUrl = kind === 'openai' ? openAiTabanAdresiniDuzelt(ayarAdresi) : sagKesikSil(ayarAdresi)
  }

  if (!secilenModel) {
    throw new ProviderError(
      id === 'ollama'
        ? 'Ollama için model seçilmedi. Önce `ollama pull <model>` ile bir model indirip listeden seçin.'
        : 'Model seçilmedi.',
      { kind: 'bad_request' }
    )
  }

  return { id, kind, baseUrl, apiKey: apiKey.trim(), model: secilenModel, isLocal: yerel }
}

// ────────────────────────────────────────────────────────────────────────
// Ortak yardımcılar
// ────────────────────────────────────────────────────────────────────────

export class AbortedError extends Error {
  constructor() {
    super('İstek kullanıcı tarafından durduruldu')
    this.name = 'AbortedError'
  }
}

export function iptalMi(err: unknown): boolean {
  return err instanceof AbortedError || (err instanceof Error && err.name === 'AbortError')
}

interface ZamanAsimi {
  ilkTokenMs: number
  sessizlikMs: number
}

function zamanAsimiBelirle(p: ResolvedProvider): ZamanAsimi {
  // Yerel modellerde istem işleme (prompt eval) tek başına dakikalar sürebilir
  return p.isLocal ? { ilkTokenMs: 10 * 60_000, sessizlikMs: 3 * 60_000 } : { ilkTokenMs: 4 * 60_000, sessizlikMs: 2 * 60_000 }
}

function hataSiniflandir(status: number, govde: string, p: ResolvedProvider): ProviderError {
  let mesaj = govde.slice(0, 600)
  try {
    const j = JSON.parse(govde) as { error?: { message?: string } | string; message?: string }
    const e = typeof j.error === 'string' ? j.error : j.error?.message
    mesaj = e || j.message || mesaj
  } catch {
    // Düz metin yanıt
  }
  const kucuk = `${govde}`.toLowerCase()
  let kind: ProviderErrorKind = 'other'
  let retryable = false
  let oneki = ''

  if (status === 401 || status === 403) {
    kind = 'auth'
    oneki = 'Kimlik doğrulama başarısız (API anahtarı hatalı veya yetkisiz). '
  } else if (status === 402 || (status === 429 && /quota|insufficient|billing|credit|exceeded your current/.test(kucuk))) {
    kind = 'quota'
    oneki = 'Kota/bakiye yetersiz. '
  } else if (status === 429 || status === 503 || status === 529 || status === 500 || status === 502 || status === 504) {
    kind = 'overload'
    retryable = true
    oneki = 'Sağlayıcı şu an yoğun veya geçici hata veriyor. '
  } else if (status === 404) {
    kind = 'not_found'
    oneki =
      p.id === 'ollama'
        ? `Model bulunamadı: "${p.model}". "ollama pull ${p.model}" ile indirin. `
        : `Model veya uç nokta bulunamadı ("${p.model}"). `
  } else if (status === 400 || status === 413 || status === 422) {
    kind = 'bad_request'
  }
  return new ProviderError(`${oneki}${mesaj}`.trim() || `HTTP ${status}`, { kind, status, retryable })
}


function bekle(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new AbortedError())
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(t)
      reject(new AbortedError())
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/** Bağlantı kurma + durum kontrolü; geçici hatalarda üstel geri çekilmeyle yeniden dener (akış başlamadan önce) */
async function baglan(
  p: ResolvedProvider,
  url: string,
  init: RequestInit,
  disSinyal: AbortSignal,
  zaman: ZamanAsimi
): Promise<{ res: Response; kapat: () => void; zamanlayiciKur: (ms: number) => void }> {
  const denemeSayisi = 3
  let sonHata: unknown
  for (let deneme = 0; deneme < denemeSayisi; deneme++) {
    if (disSinyal.aborted) throw new AbortedError()
    const ac = new AbortController()
    let zamanAsimiOldu = false
    let timer: NodeJS.Timeout | null = null
    const zamanlayiciKur = (ms: number): void => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        zamanAsimiOldu = true
        ac.abort()
      }, ms)
    }
    const disIptal = (): void => ac.abort()
    disSinyal.addEventListener('abort', disIptal, { once: true })
    const kapat = (): void => {
      if (timer) clearTimeout(timer)
      disSinyal.removeEventListener('abort', disIptal)
    }
    zamanlayiciKur(zaman.ilkTokenMs)
    try {
      const res = await fetch(url, { ...init, signal: ac.signal })
      if (!res.ok) {
        const govde = await res.text().catch(() => '')
        kapat()
        throw hataSiniflandir(res.status, govde, p)
      }
      // Gövde akışı çağıran tarafta okunur; zamanlayıcı orada sessizlik süresine göre yenilenir
      ;(res as Response & { __zamanAsimiOldu?: () => boolean }).__zamanAsimiOldu = () => zamanAsimiOldu
      return { res, kapat, zamanlayiciKur }
    } catch (err) {
      kapat()
      if (disSinyal.aborted) throw new AbortedError()
      if (zamanAsimiOldu) {
        throw new ProviderError(
          `Sağlayıcıdan ${Math.round(zaman.ilkTokenMs / 1000)} sn içinde yanıt gelmedi (zaman aşımı).` +
            (p.isLocal ? ' Model yüklenirken veya istem işlenirken uzun sürmüş olabilir; bağlam penceresini küçültmeyi deneyin.' : ''),
          { kind: 'timeout', retryable: false }
        )
      }
      if (err instanceof ProviderError) {
        sonHata = err
        if (err.retryable && deneme < denemeSayisi - 1) {
          await bekle(1000 * Math.pow(3, deneme), disSinyal)
          continue
        }
        throw err
      }
      const kok = (err as { cause?: { code?: string; message?: string } })?.cause
      const ayrinti = kok?.code || kok?.message || (err as Error)?.message || String(err)
      sonHata = new ProviderError(
        p.isLocal
          ? `Yerel sunucuya bağlanılamadı (${p.baseUrl}). Sunucunun açık ve adresin doğru olduğundan emin olun. [${ayrinti}]`
          : `Ağ hatası: ${ayrinti}`,
        { kind: 'network', retryable: !p.isLocal }
      )
      if (!p.isLocal && deneme < denemeSayisi - 1) {
        await bekle(1000 * Math.pow(3, deneme), disSinyal)
        continue
      }
      throw sonHata
    }
  }
  throw sonHata instanceof Error ? sonHata : new ProviderError('Bilinmeyen bağlantı hatası', { kind: 'other' })
}

/** Yanıt gövdesini satır satır okur; her parçada sessizlik zamanlayıcısını yeniler */
async function* satirlariOku(
  res: Response,
  disSinyal: AbortSignal,
  zamanlayiciKur: (ms: number) => void,
  zaman: ZamanAsimi
): AsyncGenerator<string> {
  if (!res.body) throw new ProviderError('Sağlayıcı boş yanıt gövdesi döndürdü', { kind: 'other' })
  const reader = res.body.getReader()
  const dec = new TextDecoder('utf-8')
  let tampon = ''
  const zamanAsimiOldu = (res as Response & { __zamanAsimiOldu?: () => boolean }).__zamanAsimiOldu
  try {
    for (;;) {
      zamanlayiciKur(zaman.sessizlikMs)
      let parca: Awaited<ReturnType<typeof reader.read>>
      try {
        parca = await reader.read()
      } catch (err) {
        if (disSinyal.aborted) throw new AbortedError()
        if (zamanAsimiOldu?.()) {
          throw new ProviderError(
            `Akış ${Math.round(zaman.sessizlikMs / 1000)} sn boyunca sessiz kaldı ve kesildi.`,
            { kind: 'timeout' }
          )
        }
        throw new ProviderError(`Akış bağlantısı koptu: ${(err as Error).message}`, { kind: 'network' })
      }
      if (parca.done) break
      tampon += dec.decode(parca.value, { stream: true })
      let idx: number
      while ((idx = tampon.indexOf('\n')) >= 0) {
        const satir = tampon.slice(0, idx).replace(/\r$/, '')
        tampon = tampon.slice(idx + 1)
        yield satir
      }
    }
    tampon += dec.decode()
    if (tampon.trim()) yield tampon.replace(/\r$/, '')
  } finally {
    try {
      await reader.cancel()
    } catch {
      // zaten kapalı
    }
  }
}

async function* sseOku(
  res: Response,
  disSinyal: AbortSignal,
  zamanlayiciKur: (ms: number) => void,
  zaman: ZamanAsimi
): AsyncGenerator<string> {
  for await (const satir of satirlariOku(res, disSinyal, zamanlayiciKur, zaman)) {
    if (!satir.startsWith('data:')) continue
    const veri = satir.slice(5).trim()
    if (veri) yield veri
  }
}

/** Bozuk/yarım JSON argümanlarını onarmayı dener */
export function argumanlariAyristir(ham: string | Record<string, unknown> | undefined | null): Record<string, unknown> {
  if (ham == null) return {}
  if (typeof ham === 'object') return ham
  let metin = ham.trim()
  if (!metin) return {}
  const dene = (s: string): Record<string, unknown> | null => {
    try {
      const v = JSON.parse(s)
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
      return null
    } catch {
      return null
    }
  }
  metin = metin.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let sonuc = dene(metin)
  if (sonuc) return sonuc
  // Kapanmamış parantezleri/tırnakları tamamla
  let acik = 0
  let koseli = 0
  let tirnak = false
  let kacis = false
  for (const ch of metin) {
    if (kacis) {
      kacis = false
      continue
    }
    if (ch === '\\') {
      kacis = true
      continue
    }
    if (ch === '"') tirnak = !tirnak
    if (tirnak) continue
    if (ch === '{') acik++
    else if (ch === '}') acik--
    else if (ch === '[') koseli++
    else if (ch === ']') koseli--
  }
  let onarilmis = metin + (tirnak ? '"' : '') + ']'.repeat(Math.max(0, koseli)) + '}'.repeat(Math.max(0, acik))
  sonuc = dene(onarilmis)
  if (sonuc) return sonuc
  onarilmis = metin.replace(/,\s*([}\]])/g, '$1')
  sonuc = dene(onarilmis)
  if (sonuc) return sonuc
  return { __parse_error: ham.slice(0, 500) }
}

/** `<think>...</think>` etiketlerini akışta metin ve muhakeme olarak ayırır (Qwen3, DeepSeek-R1 türevleri) */
class DusunceEtiketiSuzgeci {
  private icinde = false
  private artik = ''

  isle(parca: string): StreamEvent[] {
    const olaylar: StreamEvent[] = []
    let metin = this.artik + parca
    this.artik = ''
    for (;;) {
      const etiket = this.icinde ? '</think>' : '<think>'
      const i = metin.indexOf(etiket)
      if (i >= 0) {
        const once = metin.slice(0, i)
        if (once) olaylar.push({ type: this.icinde ? 'reasoning' : 'text', delta: once })
        metin = metin.slice(i + etiket.length)
        this.icinde = !this.icinde
        continue
      }
      // Etiketin başı chunk sonunda kalmış olabilir: tut
      let tut = 0
      for (let k = Math.min(etiket.length - 1, metin.length); k > 0; k--) {
        if (etiket.startsWith(metin.slice(metin.length - k))) {
          tut = k
          break
        }
      }
      const gonder = metin.slice(0, metin.length - tut)
      this.artik = metin.slice(metin.length - tut)
      if (gonder) olaylar.push({ type: this.icinde ? 'reasoning' : 'text', delta: gonder })
      break
    }
    return olaylar
  }

  bosalt(): StreamEvent[] {
    const o: StreamEvent[] = this.artik ? [{ type: this.icinde ? 'reasoning' : 'text', delta: this.artik }] : []
    this.artik = ''
    return o
  }
}

let cagriSayaci = 0
function cagriKimligi(): string {
  cagriSayaci++
  return `call_${Date.now().toString(36)}_${cagriSayaci}`
}

// ────────────────────────────────────────────────────────────────────────
// OpenAI uyumlu (OpenAI, DeepSeek, Kimi, NVIDIA, LM Studio)
// ────────────────────────────────────────────────────────────────────────

function openAiMesajlari(req: ChatRequest, p: ResolvedProvider): unknown[] {
  const cikti: unknown[] = []
  if (req.system) cikti.push({ role: 'system', content: req.system })
  const reasoningGeriGonder = p.id === 'deepseek' || p.id === 'kimi'
  for (const m of req.messages) {
    if (m.role === 'user') {
      cikti.push({ role: 'user', content: m.content })
    } else if (m.role === 'assistant') {
      const o: Record<string, unknown> = { role: 'assistant', content: m.content || (m.toolCalls?.length ? null : '') }
      if (m.toolCalls?.length) {
        o.tool_calls = m.toolCalls.map((c) => ({
          id: c.id,
          type: 'function',
          function: { name: c.name, arguments: JSON.stringify(c.args) }
        }))
        if (reasoningGeriGonder && m.reasoning) o.reasoning_content = m.reasoning
      }
      cikti.push(o)
    } else {
      cikti.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content })
    }
  }
  return cikti
}

function openAiAraclari(araclar?: ToolDef[]): unknown[] | undefined {
  if (!araclar?.length) return undefined
  return araclar.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters }
  }))
}

function muhakemeModeliMi(model: string): boolean {
  return /^(o\d|gpt-5)/i.test(model)
}

async function* openAiAkisi(p: ResolvedProvider, req: ChatRequest, sinyal: AbortSignal): AsyncGenerator<StreamEvent> {
  const zaman = zamanAsimiBelirle(p)
  const govde: Record<string, unknown> = {
    model: p.model,
    messages: openAiMesajlari(req, p),
    stream: true
  }
  if (p.id !== 'lmstudio') govde.stream_options = { include_usage: true }
  const araclar = openAiAraclari(req.tools)
  if (araclar) {
    govde.tools = araclar
    govde.tool_choice = 'auto'
  }
  if (p.id === 'openai' && muhakemeModeliMi(p.model)) {
    govde.max_completion_tokens = req.maxTokens
    if (req.reasoningEffort) govde.reasoning_effort = req.reasoningEffort
  } else {
    govde.max_tokens = req.maxTokens
    const kimiSabit = p.id === 'kimi' && /k2\.5|k3|thinking/i.test(p.model)
    govde.temperature = kimiSabit ? 1 : req.temperature
  }
  if (p.isLocal) {
    govde.repeat_penalty = 1.05
  }

  const basliklar: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'text/event-stream' }
  if (p.apiKey) basliklar.Authorization = `Bearer ${p.apiKey}`

  const { res, kapat, zamanlayiciKur } = await baglan(
    p,
    `${p.baseUrl}/chat/completions`,
    { method: 'POST', headers: basliklar, body: JSON.stringify(govde) },
    sinyal,
    zaman
  )

  const suzgec = p.isLocal ? new DusunceEtiketiSuzgeci() : null
  const cagrilar = new Map<number, { id: string; name: string; args: string }>()
  let bitisNedeni = 'stop'
  let cagriEmitEdildi = false
  const cagrilariBosalt = function* (): Generator<StreamEvent> {
    if (cagriEmitEdildi || cagrilar.size === 0) return
    cagriEmitEdildi = true
    const liste: ToolCall[] = [...cagrilar.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, c]) => ({ id: c.id || cagriKimligi(), name: c.name, args: argumanlariAyristir(c.args) }))
      .filter((c) => c.name)
    if (liste.length) yield { type: 'tool_calls', calls: liste }
  }

  try {
    for await (const veri of sseOku(res, sinyal, zamanlayiciKur, zaman)) {
      if (veri === '[DONE]') break
      let j: {
        choices?: Array<{
          delta?: {
            content?: string | null
            reasoning_content?: string | null
            reasoning?: string | null
            tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>
          }
          message?: { content?: string; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> }
          finish_reason?: string | null
        }>
        usage?: { prompt_tokens?: number; completion_tokens?: number }
        error?: { message?: string }
      }
      try {
        j = JSON.parse(veri)
      } catch {
        continue
      }
      if (j.error?.message) throw new ProviderError(j.error.message, { kind: 'other' })
      if (j.usage) yield { type: 'usage', inputTokens: j.usage.prompt_tokens, outputTokens: j.usage.completion_tokens }
      const secenek = j.choices?.[0]
      if (!secenek) continue
      const d = secenek.delta ?? secenek.message
      if (d) {
        const dusunce = (d as { reasoning_content?: string | null }).reasoning_content ?? (d as { reasoning?: string | null }).reasoning
        if (dusunce) yield { type: 'reasoning', delta: dusunce }
        if (d.content) {
          if (suzgec) for (const o of suzgec.isle(d.content)) yield o
          else yield { type: 'text', delta: d.content }
        }
        const tcler = (d as { tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> }).tool_calls
        if (tcler) {
          tcler.forEach((tc, sira) => {
            const idx = tc.index ?? sira
            const cur = cagrilar.get(idx) ?? { id: '', name: '', args: '' }
            if (tc.id && !cur.id) cur.id = tc.id
            const ad = tc.function?.name
            if (ad) cur.name = cur.name ? (cur.name === ad ? cur.name : cur.name + ad) : ad
            if (tc.function?.arguments) cur.args += tc.function.arguments
            cagrilar.set(idx, cur)
          })
        }
      }
      if (secenek.finish_reason) {
        bitisNedeni = secenek.finish_reason
        if (secenek.finish_reason === 'tool_calls' || secenek.finish_reason === 'stop' || secenek.finish_reason === 'length') {
          for (const o of cagrilariBosalt()) yield o
        }
      }
    }
    if (suzgec) for (const o of suzgec.bosalt()) yield o
    for (const o of cagrilariBosalt()) yield o
    yield { type: 'finish', reason: bitisNedeni }
  } finally {
    kapat()
  }
}

// ────────────────────────────────────────────────────────────────────────
// Anthropic
// ────────────────────────────────────────────────────────────────────────

function anthropicMesajlari(req: ChatRequest): unknown[] {
  const cikti: Array<{ role: 'user' | 'assistant'; content: unknown[] }> = []
  const ekle = (rol: 'user' | 'assistant', blok: unknown): void => {
    const son = cikti[cikti.length - 1]
    if (son && son.role === rol) son.content.push(blok)
    else cikti.push({ role: rol, content: [blok] })
  }
  for (const m of req.messages) {
    if (m.role === 'user') {
      ekle('user', { type: 'text', text: m.content || '(boş)' })
    } else if (m.role === 'assistant') {
      if (m.content?.trim()) ekle('assistant', { type: 'text', text: m.content })
      for (const c of m.toolCalls ?? []) ekle('assistant', { type: 'tool_use', id: c.id, name: c.name, input: c.args })
      if (!m.content?.trim() && !m.toolCalls?.length) ekle('assistant', { type: 'text', text: '(boş)' })
    } else {
      ekle('user', { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content })
    }
  }
  return cikti
}

function anthropicMaxToken(model: string, istenen: number): number {
  const m = model.toLowerCase()
  if (m.includes('3-5') || m.includes('3-opus') || m.includes('3-haiku')) return Math.min(istenen, 8192)
  return Math.min(istenen, 32000)
}

async function* anthropicAkisi(p: ResolvedProvider, req: ChatRequest, sinyal: AbortSignal): AsyncGenerator<StreamEvent> {
  const zaman = zamanAsimiBelirle(p)
  const govde: Record<string, unknown> = {
    model: p.model,
    max_tokens: anthropicMaxToken(p.model, req.maxTokens),
    temperature: Math.min(1, req.temperature),
    stream: true,
    system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
    messages: anthropicMesajlari(req)
  }
  if (req.tools?.length) {
    govde.tools = req.tools.map((t, i, a) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
      ...(i === a.length - 1 ? { cache_control: { type: 'ephemeral' } } : {})
    }))
    govde.tool_choice = { type: 'auto' }
  }
  const { res, kapat, zamanlayiciKur } = await baglan(
    p,
    `${p.baseUrl}/v1/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': p.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(govde)
    },
    sinyal,
    zaman
  )

  const bloklar = new Map<number, { tur: string; id: string; name: string; json: string }>()
  const cagrilar: ToolCall[] = []
  let girdi = 0
  let cikti = 0
  let bitis = 'end_turn'
  try {
    for await (const veri of sseOku(res, sinyal, zamanlayiciKur, zaman)) {
      let j: {
        type?: string
        index?: number
        message?: { usage?: { input_tokens?: number; output_tokens?: number } }
        content_block?: { type?: string; id?: string; name?: string }
        delta?: { type?: string; text?: string; thinking?: string; partial_json?: string; stop_reason?: string }
        usage?: { output_tokens?: number }
        error?: { message?: string }
      }
      try {
        j = JSON.parse(veri)
      } catch {
        continue
      }
      switch (j.type) {
        case 'message_start':
          girdi = j.message?.usage?.input_tokens ?? 0
          break
        case 'content_block_start':
          bloklar.set(j.index ?? 0, {
            tur: j.content_block?.type ?? 'text',
            id: j.content_block?.id ?? '',
            name: j.content_block?.name ?? '',
            json: ''
          })
          break
        case 'content_block_delta': {
          const b = bloklar.get(j.index ?? 0)
          if (j.delta?.type === 'text_delta' && j.delta.text) yield { type: 'text', delta: j.delta.text }
          else if (j.delta?.type === 'thinking_delta' && j.delta.thinking) yield { type: 'reasoning', delta: j.delta.thinking }
          else if (j.delta?.type === 'input_json_delta' && b) b.json += j.delta.partial_json ?? ''
          break
        }
        case 'content_block_stop': {
          const b = bloklar.get(j.index ?? 0)
          if (b?.tur === 'tool_use') {
            cagrilar.push({ id: b.id || cagriKimligi(), name: b.name, args: argumanlariAyristir(b.json) })
          }
          break
        }
        case 'message_delta':
          if (j.delta?.stop_reason) bitis = j.delta.stop_reason
          if (j.usage?.output_tokens != null) cikti = j.usage.output_tokens
          break
        case 'error':
          throw new ProviderError(j.error?.message || 'Anthropic akış hatası', { kind: 'overload', retryable: false })
        default:
          break
      }
    }
    yield { type: 'usage', inputTokens: girdi, outputTokens: cikti }
    if (cagrilar.length) yield { type: 'tool_calls', calls: cagrilar }
    yield { type: 'finish', reason: bitis }
  } finally {
    kapat()
  }
}

// ────────────────────────────────────────────────────────────────────────
// Gemini
// ────────────────────────────────────────────────────────────────────────

function geminiSemasi(s: JsonSchemaProp): Record<string, unknown> {
  const o: Record<string, unknown> = { type: s.type.toUpperCase() }
  if (s.description) o.description = s.description
  if (s.enum) o.enum = s.enum
  if (s.items) o.items = geminiSemasi(s.items)
  if (s.properties) {
    o.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, geminiSemasi(v)]))
    if (s.required?.length) o.required = s.required
  }
  return o
}

function geminiIcerik(req: ChatRequest): unknown[] {
  const cikti: Array<{ role: 'user' | 'model'; parts: unknown[] }> = []
  const ekle = (rol: 'user' | 'model', parca: unknown): void => {
    const son = cikti[cikti.length - 1]
    if (son && son.role === rol) son.parts.push(parca)
    else cikti.push({ role: rol, parts: [parca] })
  }
  for (const m of req.messages) {
    if (m.role === 'user') {
      ekle('user', { text: m.content || '(boş)' })
    } else if (m.role === 'assistant') {
      if (m.content?.trim()) ekle('model', { text: m.content })
      for (const c of m.toolCalls ?? []) {
        const part: Record<string, unknown> = { functionCall: { name: c.name, args: c.args } }
        const imza = c.extra?.thoughtSignature
        if (imza) part.thoughtSignature = imza
        ekle('model', part)
      }
      if (!m.content?.trim() && !m.toolCalls?.length) ekle('model', { text: '(boş)' })
    } else {
      ekle('user', { functionResponse: { name: m.name, response: { output: m.content } } })
    }
  }
  return cikti
}

async function* geminiAkisi(p: ResolvedProvider, req: ChatRequest, sinyal: AbortSignal): AsyncGenerator<StreamEvent> {
  const zaman = zamanAsimiBelirle(p)
  const uretim: Record<string, unknown> = { maxOutputTokens: req.maxTokens, temperature: req.temperature }
  if (/gemini-(2\.5|3)/i.test(p.model)) {
    const butce = req.reasoningEffort === 'low' ? 1024 : req.reasoningEffort === 'high' ? 16384 : 6144
    uretim.thinkingConfig = /gemini-2\.5/i.test(p.model)
      ? { includeThoughts: true, thinkingBudget: butce }
      : { includeThoughts: true }
  }
  const govde: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: geminiIcerik(req),
    generationConfig: uretim
  }
  if (req.tools?.length) {
    govde.tools = [
      {
        functionDeclarations: req.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: geminiSemasi({ ...t.parameters, type: 'object' })
        }))
      }
    ]
    govde.toolConfig = { functionCallingConfig: { mode: 'AUTO' } }
  }
  const { res, kapat, zamanlayiciKur } = await baglan(
    p,
    `${p.baseUrl}/models/${encodeURIComponent(p.model)}:streamGenerateContent?alt=sse`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': p.apiKey },
      body: JSON.stringify(govde)
    },
    sinyal,
    zaman
  )

  const cagrilar: ToolCall[] = []
  let bitis = 'STOP'
  let sonKullanim: { in?: number; out?: number } | null = null
  try {
    for await (const veri of sseOku(res, sinyal, zamanlayiciKur, zaman)) {
      let j: {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string
              thought?: boolean
              thoughtSignature?: string
              functionCall?: { name: string; args?: Record<string, unknown> }
            }>
          }
          finishReason?: string
        }>
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
        promptFeedback?: { blockReason?: string }
        error?: { message?: string }
      }
      try {
        j = JSON.parse(veri)
      } catch {
        continue
      }
      if (j.error?.message) throw new ProviderError(j.error.message, { kind: 'other' })
      if (j.promptFeedback?.blockReason) {
        throw new ProviderError(`İstek Gemini tarafından engellendi: ${j.promptFeedback.blockReason}`, { kind: 'bad_request' })
      }
      if (j.usageMetadata) sonKullanim = { in: j.usageMetadata.promptTokenCount, out: j.usageMetadata.candidatesTokenCount }
      const aday = j.candidates?.[0]
      for (const part of aday?.content?.parts ?? []) {
        if (part.functionCall) {
          cagrilar.push({
            id: cagriKimligi(),
            name: part.functionCall.name,
            args: part.functionCall.args ?? {},
            ...(part.thoughtSignature ? { extra: { thoughtSignature: part.thoughtSignature } } : {})
          })
        } else if (part.text) {
          yield { type: part.thought ? 'reasoning' : 'text', delta: part.text }
        }
      }
      if (aday?.finishReason) bitis = aday.finishReason
    }
    if (sonKullanim) yield { type: 'usage', inputTokens: sonKullanim.in, outputTokens: sonKullanim.out }
    if (cagrilar.length) yield { type: 'tool_calls', calls: cagrilar }
    yield { type: 'finish', reason: bitis }
  } finally {
    kapat()
  }
}

// ────────────────────────────────────────────────────────────────────────
// Ollama (yerel /api/chat)
// ────────────────────────────────────────────────────────────────────────

function ollamaMesajlari(req: ChatRequest): unknown[] {
  const cikti: unknown[] = []
  if (req.system) cikti.push({ role: 'system', content: req.system })
  for (const m of req.messages as LlmMessage[]) {
    if (m.role === 'user') cikti.push({ role: 'user', content: m.content })
    else if (m.role === 'assistant') {
      const o: Record<string, unknown> = { role: 'assistant', content: m.content ?? '' }
      if (m.toolCalls?.length) {
        o.tool_calls = m.toolCalls.map((c) => ({ function: { name: c.name, arguments: c.args } }))
      }
      cikti.push(o)
    } else cikti.push({ role: 'tool', tool_name: m.name, content: m.content })
  }
  return cikti
}

async function* ollamaAkisi(p: ResolvedProvider, req: ChatRequest, sinyal: AbortSignal): AsyncGenerator<StreamEvent> {
  const zaman = zamanAsimiBelirle(p)
  const govde: Record<string, unknown> = {
    model: p.model,
    messages: ollamaMesajlari(req),
    stream: true,
    keep_alive: '30m',
    options: {
      num_ctx: req.numCtx ?? 16384,
      num_predict: req.maxTokens,
      temperature: req.temperature,
      repeat_penalty: 1.05
    }
  }
  if (req.tools?.length) {
    govde.tools = req.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters }
    }))
  }
  const basliklar: Record<string, string> = { 'Content-Type': 'application/json' }
  if (p.apiKey) basliklar.Authorization = `Bearer ${p.apiKey}`
  const { res, kapat, zamanlayiciKur } = await baglan(
    p,
    `${p.baseUrl}/api/chat`,
    { method: 'POST', headers: basliklar, body: JSON.stringify(govde) },
    sinyal,
    zaman
  )

  const suzgec = new DusunceEtiketiSuzgeci()
  const cagrilar: ToolCall[] = []
  let bitis = 'stop'
  try {
    for await (const satir of satirlariOku(res, sinyal, zamanlayiciKur, zaman)) {
      if (!satir.trim()) continue
      let j: {
        message?: {
          content?: string
          thinking?: string
          tool_calls?: Array<{ function?: { name?: string; arguments?: Record<string, unknown> | string } }>
        }
        done?: boolean
        done_reason?: string
        prompt_eval_count?: number
        eval_count?: number
        error?: string
      }
      try {
        j = JSON.parse(satir)
      } catch {
        continue
      }
      if (j.error) throw hataSiniflandir(j.error.toLowerCase().includes('not found') ? 404 : 400, j.error, p)
      if (j.message?.thinking) yield { type: 'reasoning', delta: j.message.thinking }
      if (j.message?.content) for (const o of suzgec.isle(j.message.content)) yield o
      for (const tc of j.message?.tool_calls ?? []) {
        if (tc.function?.name) {
          cagrilar.push({ id: cagriKimligi(), name: tc.function.name, args: argumanlariAyristir(tc.function.arguments) })
        }
      }
      if (j.done) {
        if (j.done_reason) bitis = j.done_reason
        yield { type: 'usage', inputTokens: j.prompt_eval_count, outputTokens: j.eval_count }
      }
    }
    for (const o of suzgec.bosalt()) yield o
    if (cagrilar.length) yield { type: 'tool_calls', calls: cagrilar }
    yield { type: 'finish', reason: bitis }
  } finally {
    kapat()
  }
}

// ────────────────────────────────────────────────────────────────────────
// Dış arayüz
// ────────────────────────────────────────────────────────────────────────

export function streamChat(p: ResolvedProvider, req: ChatRequest, sinyal: AbortSignal): AsyncGenerator<StreamEvent> {
  switch (p.kind) {
    case 'anthropic':
      return anthropicAkisi(p, req, sinyal)
    case 'gemini':
      return geminiAkisi(p, req, sinyal)
    case 'ollama':
      return ollamaAkisi(p, req, sinyal)
    default:
      return openAiAkisi(p, req, sinyal)
  }
}

/** Sağlayıcı "bu model araç çağırmayı desteklemiyor" dediğinde true döner (metin protokolüne geçiş için) */
export function aracDestegiYokHatasiMi(err: unknown): boolean {
  if (!(err instanceof ProviderError)) return false
  return /does not support tools|tool use is not supported|tools? (are|is) not supported|does not support function|tool_choice|"tools"|unsupported.*tool|tool.*unsupported/i.test(
    err.message
  )
}
