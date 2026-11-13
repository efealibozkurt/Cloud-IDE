import type { AIProviderId, ReasoningEffort } from '@shared/types'

/** Araç parametre şeması (OpenAI/Anthropic/Gemini/Ollama için ortak, JSON Schema alt kümesi) */
export interface JsonSchemaProp {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
  description?: string
  enum?: string[]
  items?: JsonSchemaProp
  properties?: Record<string, JsonSchemaProp>
  required?: string[]
}

export interface ToolDef {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, JsonSchemaProp>
    required?: string[]
  }
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  /** Sağlayıcıya özgü, bir sonraki turda geri gönderilmesi gereken veriler (örn. Gemini thoughtSignature) */
  extra?: Record<string, unknown>
}

export type LlmMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[]; reasoning?: string }
  | { role: 'tool'; toolCallId: string; name: string; content: string }

export type ProviderKind = 'openai' | 'anthropic' | 'gemini' | 'ollama'

export interface ResolvedProvider {
  id: AIProviderId
  kind: ProviderKind
  /** openai türünde `.../v1`, ollama türünde sunucu kökü (http://127.0.0.1:11434) */
  baseUrl: string
  apiKey: string
  model: string
  isLocal: boolean
}

export interface ChatRequest {
  system: string
  messages: LlmMessage[]
  tools?: ToolDef[]
  maxTokens: number
  temperature: number
  reasoningEffort?: ReasoningEffort
  /** Yalnızca Ollama: istek başına bağlam penceresi (num_ctx) */
  numCtx?: number
}

export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'tool_calls'; calls: ToolCall[] }
  | { type: 'usage'; inputTokens?: number; outputTokens?: number }
  | { type: 'finish'; reason: string }

export type ProviderErrorKind =
  | 'auth'
  | 'quota'
  | 'overload'
  | 'network'
  | 'bad_request'
  | 'not_found'
  | 'timeout'
  | 'other'

/** Sağlayıcı katmanının tek tip hata sınıfı; kullanıcıya Türkçe, anlaşılır mesaj taşır */
export class ProviderError extends Error {
  readonly kind: ProviderErrorKind
  readonly status?: number
  readonly retryable: boolean

  constructor(message: string, opts: { kind: ProviderErrorKind; status?: number; retryable?: boolean }) {
    super(message)
    this.name = 'ProviderError'
    this.kind = opts.kind
    this.status = opts.status
    this.retryable = opts.retryable ?? false
  }
}
