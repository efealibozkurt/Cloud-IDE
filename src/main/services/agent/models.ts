import type { AIProviderId, ProviderTestResult } from '@shared/types'
import { isCustomProvider } from '@shared/ozelSaglayici'
import type { SecretsService } from '../SecretsService'
import type { SettingsService } from '../SettingsService'
import type { ResolvedProvider, ToolDef } from './llmTypes'
import { ProviderError } from './llmTypes'
import { aracDestegiYokHatasiMi, resolveProvider, streamChat } from './providers'
import { geminiModelleriniSirala } from './staticModels'

async function getirJson<T>(url: string, basliklar: Record<string, string>, zamanAsimiMs = 8000): Promise<T> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), zamanAsimiMs)
  try {
    const res = await fetch(url, { headers: basliklar, signal: ac.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}

/** Çözümlenmiş sağlayıcıdan canlı model listesini çeker; başarısızsa hata fırlatır */
export async function canliModelleriListele(p: ResolvedProvider): Promise<string[]> {
  const auth: Record<string, string> = p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}
  switch (p.kind) {
    case 'ollama': {
      const j = await getirJson<{ models?: Array<{ name?: string; model?: string }> }>(`${p.baseUrl}/api/tags`, auth)
      return (j.models ?? []).map((m) => m.name || m.model || '').filter(Boolean)
    }
    case 'gemini': {
      const j = await getirJson<{ models?: Array<{ name: string; supportedGenerationMethods?: string[] }> }>(
        `${p.baseUrl}/models?pageSize=200`,
        { 'x-goog-api-key': p.apiKey }
      )
      // Ekranlar seçim yokken listedeki ilk modeli aldığı için önerilenler başa alınır
      return geminiModelleriniSirala(
        (j.models ?? [])
          .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && /gemini/i.test(m.name))
          .map((m) => m.name.replace(/^models\//, ''))
      )
    }
    case 'anthropic': {
      const j = await getirJson<{ data?: Array<{ id: string }> }>(`${p.baseUrl}/v1/models?limit=100`, {
        'x-api-key': p.apiKey,
        'anthropic-version': '2023-06-01'
      })
      return (j.data ?? []).map((m) => m.id)
    }
    default: {
      const j = await getirJson<{ data?: Array<{ id: string }> }>(`${p.baseUrl}/models`, auth)
      const ids = (j.data ?? []).map((m) => m.id)
      return p.id === 'openai' ? ids.filter((id) => /^(gpt-|o\d|chatgpt)/i.test(id)).sort() : ids.sort()
    }
  }
}

export async function modelleriListele(id: AIProviderId, secrets: SecretsService, settings: SettingsService): Promise<string[]> {
  // Model henüz seçilmemiş olabilir; çözümleme için geçici bir ad ver
  const p = resolveProvider(id, 'x', secrets, settings)
  return canliModelleriListele({ ...p, model: '' })
}

const PING_ARACI: ToolDef = {
  name: 'ping',
  description: 'Bağlantı testi için çağrılır. Mesajı aynen geri döndürür.',
  parameters: {
    type: 'object',
    properties: { mesaj: { type: 'string', description: 'Geri döndürülecek kısa mesaj' } },
    required: ['mesaj']
  }
}

interface OllamaShow {
  model_info?: Record<string, unknown>
  capabilities?: string[]
  details?: { parameter_size?: string; family?: string }
}

/** Sağlayıcı bağlantısını, model varlığını, bağlam uzunluğunu, araç desteğini ve hızı sınar */
export async function saglayiciyiSina(
  id: AIProviderId,
  model: string | undefined,
  secrets: SecretsService,
  settings: SettingsService
): Promise<ProviderTestResult> {
  const detaylar: string[] = []
  let p: ResolvedProvider
  try {
    p = resolveProvider(id, model, secrets, settings)
  } catch (e) {
    return { ok: false, message: (e as Error).message, details: detaylar }
  }
  detaylar.push(`Adres: ${p.baseUrl}`)

  // 1) Bağlantı + model listesi
  let modeller: string[] = []
  try {
    modeller = await canliModelleriListele(p)
    detaylar.push(`Sunucuya bağlanıldı, ${modeller.length} model listelendi.`)
  } catch (e) {
    // Özel sağlayıcılar model listesi vermeyebilir; asıl sınama üretim isteğidir
    if (p.isLocal && !isCustomProvider(id)) {
      return {
        ok: false,
        message: `Yerel sunucuya bağlanılamadı (${p.baseUrl}). ${id === 'ollama' ? 'Ollama\'nın çalıştığından emin olun (ollama serve).' : 'LM Studio > Developer > Start Server ile sunucuyu başlatın.'}`,
        details: [...detaylar, (e as Error).message]
      }
    }
    detaylar.push(`Model listesi alınamadı (${(e as Error).message}); doğrudan istek deneniyor.`)
  }
  if (p.isLocal && !isCustomProvider(id) && modeller.length === 0) {
    return {
      ok: false,
      message: id === 'ollama' ? 'Ollama çalışıyor ama hiç model yüklü değil. `ollama pull <model>` ile bir model indirin.' : 'LM Studio\'da yüklü model bulunamadı.',
      details: detaylar
    }
  }
  if (modeller.length && !modeller.includes(p.model)) {
    const yakin = modeller.find((m) => m.split(':')[0] === p.model.split(':')[0])
    if (p.isLocal && !isCustomProvider(id)) {
      return {
        ok: false,
        message: `"${p.model}" modeli sunucuda yok.${yakin ? ` Belki "${yakin}" demek istediniz.` : ''}`,
        details: [...detaylar, `Mevcut modeller: ${modeller.slice(0, 12).join(', ')}`]
      }
    }
    detaylar.push(`Uyarı: "${p.model}" listede görünmüyor (yine de denenecek).`)
  }

  // 2) Ollama: bağlam uzunluğu ve yetenekler
  let baglam: number | undefined
  let yetenekAraclar: boolean | undefined
  if (p.kind === 'ollama') {
    try {
      const ac = new AbortController()
      const t = setTimeout(() => ac.abort(), 8000)
      const res = await fetch(`${p.baseUrl}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: p.model }),
        signal: ac.signal
      })
      clearTimeout(t)
      if (res.ok) {
        const j = (await res.json()) as OllamaShow
        for (const [k, v] of Object.entries(j.model_info ?? {})) {
          if (k.endsWith('.context_length') && typeof v === 'number') baglam = v
        }
        if (Array.isArray(j.capabilities)) yetenekAraclar = j.capabilities.includes('tools')
        if (j.details?.parameter_size) detaylar.push(`Model boyutu: ${j.details.parameter_size}`)
      }
    } catch {
      // Eski Ollama sürümlerinde /api/show farklı olabilir; sorun değil
    }
    if (baglam) detaylar.push(`Modelin desteklediği azami bağlam: ${baglam.toLocaleString('tr-TR')} token`)
    if (yetenekAraclar === false) detaylar.push('Ollama bu modeli araç çağırmayı desteklemiyor olarak işaretlemiş → metin protokolü kullanılacak.')
  }

  // 3) Üretim + hız + araç çağırma testi
  const sinyal = new AbortController()
  const zamanlayici = setTimeout(() => sinyal.abort(), p.isLocal ? 180_000 : 60_000)
  let supportsTools: boolean | undefined = yetenekAraclar
  let tokensPerSecond: number | undefined
  try {
    const bas = Date.now()
    let metin = ''
    let cikti: number | undefined
    for await (const ev of streamChat(
      p,
      {
        system: 'Kısa ve öz cevap ver.',
        messages: [{ role: 'user', content: 'Sadece "tamam" yaz.' }],
        maxTokens: 48,
        temperature: 0.1,
        numCtx: 2048
      },
      sinyal.signal
    )) {
      if (ev.type === 'text') metin += ev.delta
      else if (ev.type === 'usage' && ev.outputTokens) cikti = ev.outputTokens
    }
    const sure = (Date.now() - bas) / 1000
    const tokenSayisi = cikti ?? Math.max(1, Math.round(metin.length / 4))
    tokensPerSecond = sure > 0 ? Math.round((tokenSayisi / sure) * 10) / 10 : undefined
    detaylar.push(`Üretim testi başarılı (${sure.toFixed(1)} sn${tokensPerSecond ? `, ~${tokensPerSecond} token/sn` : ''}; ilk istek model yükleme süresini içerebilir).`)
  } catch (e) {
    clearTimeout(zamanlayici)
    const msg = e instanceof ProviderError ? e.message : (e as Error).message
    return { ok: false, message: `Model yanıt veremedi: ${msg}`, details: detaylar, contextLength: baglam }
  }

  if (supportsTools !== false) {
    try {
      let cagrildi = false
      for await (const ev of streamChat(
        p,
        {
          system: 'Kullanıcı bir aracı çağırmanı istediğinde mutlaka aracı çağır.',
          messages: [{ role: 'user', content: 'ping aracını mesaj="merhaba" ile çağır.' }],
          tools: [PING_ARACI],
          maxTokens: 96,
          temperature: 0.1,
          numCtx: 2048
        },
        sinyal.signal
      )) {
        if (ev.type === 'tool_calls' && ev.calls.some((c) => c.name === 'ping')) cagrildi = true
      }
      supportsTools = cagrildi
      detaylar.push(cagrildi ? 'Araç çağırma (function calling) çalışıyor.' : 'Model araç çağırmayı denemedi → metin protokolü önerilir.')
    } catch (e) {
      supportsTools = aracDestegiYokHatasiMi(e) ? false : supportsTools
      detaylar.push(`Araç çağırma testi başarısız: ${(e as Error).message.slice(0, 160)}`)
    }
  }
  clearTimeout(zamanlayici)

  const mesaj =
    supportsTools === false && p.isLocal
      ? 'Bağlantı başarılı. Bu model yerel araç çağırmayı desteklemiyor; Agent "metin protokolü" ile çalışacak (daha az güvenilir olabilir).'
      : 'Bağlantı ve model başarılı; Agent tam yetenekle çalışabilir.'
  return { ok: true, message: mesaj, details: detaylar, contextLength: baglam, supportsTools, tokensPerSecond }
}
