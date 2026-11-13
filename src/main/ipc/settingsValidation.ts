import { AI_PROVIDERS, type AIProviderId, type AppSettings } from '@shared/types'

const SAGLAYICILAR = new Set<string>(AI_PROVIDERS.map((p) => p.id))
const YEREL_SAGLAYICILAR = new Set<string>(['lmstudio', 'ollama'])

function metinMi(v: unknown, maks = 1024): v is string {
  return typeof v === 'string' && v.length <= maks
}

function sayiMi(v: unknown, min: number, maks: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= maks
}

/** Sağlayıcı → değer eşlemelerinde anahtarların geçerli sağlayıcı kimliği olmasını doğrular. */
function saglayiciHaritasi(v: unknown, deger: (x: unknown, id: AIProviderId) => boolean): boolean {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  return Object.entries(v as Record<string, unknown>).every(
    ([k, x]) => SAGLAYICILAR.has(k) && deger(x, k as AIProviderId)
  )
}

/** Geçerli bir adres mi? Bulut sağlayıcılarda API anahtarı gideceği için yalnızca https kabul edilir. */
function adresGecerli(x: unknown, id: AIProviderId): boolean {
  if (x === '' || x === undefined) return true
  if (!metinMi(x, 300)) return false
  try {
    const u = new URL(x)
    if (u.protocol === 'https:') return true
    return u.protocol === 'http:' && YEREL_SAGLAYICILAR.has(id)
  } catch {
    return false
  }
}

type Dogrulayici = (v: unknown) => boolean

const DOGRULAYICILAR: { [K in keyof AppSettings]?: Dogrulayici } = {
  arduinoCliPath: (v) => v === null || metinMi(v, 600),
  boardManagerUrls: (v) => Array.isArray(v) && v.length <= 50 && v.every((x) => metinMi(x, 500)),
  selectedFqbn: (v) => v === null || metinMi(v, 200),
  selectedPort: (v) => v === null || metinMi(v, 200),
  selectedBaud: (v) => sayiMi(v, 300, 4_000_000),
  recentSketches: (v) => Array.isArray(v) && v.length <= 50 && v.every((x) => metinMi(x, 600)),
  lastOpenedSketch: (v) => v === null || metinMi(v, 600),
  editorFontSize: (v) => sayiMi(v, 8, 40),
  editorTheme: (v) => metinMi(v, 50),
  selectedAiProvider: (v) => v === null || (typeof v === 'string' && SAGLAYICILAR.has(v)),
  selectedModelPerProvider: (v) => saglayiciHaritasi(v, (x) => metinMi(x, 200)),
  selectedReasoningEffort: (v) => v === 'low' || v === 'medium' || v === 'high',
  customContextLimits: (v) => saglayiciHaritasi(v, (x) => sayiMi(x, 1024, 10_000_000)),
  aiBaseUrls: (v) => saglayiciHaritasi(v, adresGecerli),
  agentPermissionMode: (v) => v === 'ask' || v === 'auto-edit' || v === 'full-auto',
  agentAutoCompile: (v) => typeof v === 'boolean',
  localToolMode: (v) => v === 'auto' || v === 'native' || v === 'text',
  historyAutoSnapshot: (v) => typeof v === 'boolean',
  historyMaxAuto: (v) => sayiMi(v, 10, 500),
  autoUpdateCheck: (v) => typeof v === 'boolean',
  boardOptions: (v) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false
    const kartlar = Object.entries(v as Record<string, unknown>)
    if (kartlar.length > 200) return false
    const guvenli = /^[A-Za-z0-9_.-]{1,80}$/
    return kartlar.every(([fqbn, secenekler]) => {
      if (!/^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+$/.test(fqbn)) return false
      if (!secenekler || typeof secenekler !== 'object' || Array.isArray(secenekler)) return false
      const girdiler = Object.entries(secenekler as Record<string, unknown>)
      return girdiler.length <= 40 && girdiler.every(([ad, deger]) => guvenli.test(ad) && typeof deger === 'string' && guvenli.test(deger))
    })
  }
}

/** `settings:set` için anahtar ve değeri doğrular; geçersizse Error fırlatır. */
export function ayarDegeriniDogrula(key: unknown, value: unknown): asserts key is keyof AppSettings {
  if (typeof key !== 'string' || !(key in DOGRULAYICILAR)) {
    throw new Error(`Bilinmeyen ayar anahtarı: ${String(key)}`)
  }
  const dogrula = DOGRULAYICILAR[key as keyof AppSettings]
  if (!dogrula || !dogrula(value)) throw new Error(`Geçersiz ayar değeri: ${key}`)
}
