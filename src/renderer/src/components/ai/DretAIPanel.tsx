import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import {
  AI_PROVIDERS,
  ADJUSTABLE_CONTEXT_PRESETS,
  estimateTokens,
  getModelContextLimit,
  type AgentActionItem,
  type ChatMessage,
  type ChatSession,
  type ChatSessionSummary,
  type ReasoningEffort,
  type SketchFile
} from '@shared/types'
import { useAppState, tumKartlariDuzlestir } from '../../state/AppStateContext'
import { MarkdownRenderer } from './MarkdownRenderer'
import { ReasoningLevelSwitch } from './ReasoningLevelSwitch'
import { RagSkillsModal } from './RagSkillsModal'
import cloudIcon from '../../assets/icon.png'

/** Sidebar'a sığacak kadar kısa, Arduino/gömülü bağlama uygun örnek istemler (bkz. AIModeScreen'deki ONERILER ile aynı marka sesi) */
const ONERILER = ['Blink LED örneği oluştur', 'Bu derleme hatasını açıkla', 'WiFi ile veri gönderen kod yaz']

function ayniDosyaMi(a: string, b: string): boolean {
  return a.trim().replace(/\\/g, '/').toLowerCase() === b.trim().replace(/\\/g, '/').toLowerCase()
}

interface ParsedAgentAction {
  type: 'replace_selection' | 'replace_file' | 'create_file'
  filename?: string
  rename?: string
  summary: string
  code: string
}

interface ParsedAgentResult {
  explanation: string
  actions: ParsedAgentAction[]
  action: ParsedAgentAction | null
}

/**
 * AI yanıtını Akıllı Agent Protokolü'ne göre ayrıştırır:
 * - <explanation>: Kullanıcıya chatte gösterilecek teknik açıklama
 * - <editor_action>: Editöre veya projeye aktarılacak kod, dosya adı ve özet (tekli veya çoklu)
 */
function parseAgentResponse(rawText: string, hasSelection: boolean): ParsedAgentResult {
  const actions: ParsedAgentAction[] = []
  const actionRegex = /<editor_action\b([^>]*)>([\s\S]*?)<\/editor_action>/gi
  let match: RegExpExecArray | null

  while ((match = actionRegex.exec(rawText)) !== null) {
    const attrString = match[1] || ''
    const inner = match[2].trim()

    const typeMatch = /type=["']?([^"'\s>]+)["']?/i.exec(attrString)
    const filenameMatch = /(?:filename|file|target|dosya|name|path)=["']?([^"'\s>]+)["']?/i.exec(attrString)
    const renameMatch = /(?:rename|rename_file|rename_to|yeniden_adlandir)=["']?([^"'\s>]+)["']?/i.exec(attrString)
    const summaryMatch = /(?:summary|ozet)=["']([^"']*)["']/i.exec(attrString)

    const rawType = (typeMatch?.[1] || '').trim().toLowerCase()
    const filename = (filenameMatch?.[1] || '').trim() || undefined
    const rename = (renameMatch?.[1] || '').trim() || undefined

    let type: 'replace_selection' | 'replace_file' | 'create_file'
    if (rawType === 'create_file') {
      type = 'create_file'
    } else if (rawType === 'replace_file') {
      type = 'replace_file'
    } else if (rawType === 'replace_selection') {
      type = 'replace_selection'
    } else if (hasSelection) {
      type = 'replace_selection'
    } else if (filename) {
      type = 'create_file'
    } else {
      type = 'replace_file'
    }

    const defaultSummary =
      type === 'create_file'
        ? `${filename || 'Yeni dosya'} oluşturuldu`
        : type === 'replace_selection'
        ? 'Seçili kod parçası güncellendi'
        : 'Kod dosyaya uygulandı'

    const summary = (summaryMatch?.[1] || '').trim() || defaultSummary

    // Kod bloğunu ayıkla
    const codeBlockMatch = /```[\w+]*\n([\s\S]*?)```/.exec(inner)
    const code = codeBlockMatch
      ? codeBlockMatch[1].trim()
      : inner.replace(/^```[\w+]*\n?/, '').replace(/```$/, '').trim()

    if (code) {
      actions.push({ type, filename, rename, summary, code })
    }
  }

  // <explanation>...</explanation> bloğunu ara
  const explRegex = /<explanation>([\s\S]*?)<\/explanation>/i
  const explMatch = explRegex.exec(rawText)

  let explanation = ''
  if (explMatch) {
    explanation = explMatch[1].trim()
  } else {
    explanation = rawText
      .replace(/<editor_action\b[^>]*>[\s\S]*?<\/editor_action>/gi, '')
      .replace(/<\/?explanation>/gi, '')
      .trim()
  }

  if (actions.length > 0) {
    return {
      explanation: explanation || 'İşlem tamamlandı.',
      actions,
      action: actions[0]
    }
  }

  if (explMatch) {
    return {
      explanation: explMatch[1].trim(),
      actions: [],
      action: null
    }
  }

  // Fallback: Model etiketleri unuttuysa ve tek bir kod bloğu + seçim varsa:
  const codeBlocks: Array<{ match: RegExpExecArray; code: string }> = []
  const blockRegex = /```[\w+]*\n([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = blockRegex.exec(rawText))) {
    codeBlocks.push({ match: m, code: m[1].trim() })
  }

  if (codeBlocks.length === 1 && hasSelection) {
    const single = codeBlocks[0]
    const textBefore = rawText.slice(0, single.match.index).trim()
    const textAfter = rawText.slice(single.match.index + single.match[0].length).trim()
    const expl = [textBefore, textAfter].filter(Boolean).join('\n\n')
    const fallbackAction: ParsedAgentAction = {
      type: 'replace_selection',
      summary: 'Seçili satırlara uygulandı',
      code: single.code
    }
    return {
      explanation: expl || 'Seçili kod güncellendi.',
      actions: [fallbackAction],
      action: fallbackAction
    }
  }

  return {
    explanation: rawText.replace(/<\/?explanation>/gi, '').trim(),
    actions: [],
    action: null
  }
}

function tarihBicimlendir(timestamp: number): string {
  const simdi = new Date()
  const tarih = new Date(timestamp)
  const ayniGun =
    simdi.getFullYear() === tarih.getFullYear() &&
    simdi.getMonth() === tarih.getMonth() &&
    simdi.getDate() === tarih.getDate()

  const saatDakika = tarih.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  if (ayniGun) {
    return `Bugün ${saatDakika}`
  }
  return `${tarih.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${saatDakika}`
}

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return (count / 1_000_000).toFixed(count % 1_000_000 === 0 ? 0 : 1) + 'M'
  }
  if (count >= 1_000) {
    return (count / 1_000).toFixed(count >= 10_000 ? 0 : 1) + 'k'
  }
  return count.toString()
}

interface DretAIPanelProps {
  onClose: () => void
}

/**
 * "Dret AI" — Proje bazlı izole edilmiş, geçmiş sohbetleri saklayan ve
 * oturum yönetimi sunan kalıcı sohbet paneli.
 */
function DretAIPanel({ onClose }: DretAIPanelProps): ReactElement {
  const {
    state,
    clearDretAiSeed,
    openSketchDialog,
    newSketch,
    renameFile,
    updateFileContent,
    startAiDiffReview,
    createFileWithContent,
    openFileInTab,
    setSelectedAiProvider,
    setSelectedAiModel,
    setCustomContextLimit,
    requestReveal
  } = useAppState()
  const aktifSketch = state.sketch.info

  const tumKartlar = tumKartlariDuzlestir(state.arduinoCli.platforms)
  const aktifKart = tumKartlar.find((k) => k.fqbn === state.arduinoCli.selectedFqbn)

  const [oturumlar, setOturumlar] = useState<ChatSessionSummary[]>([])
  const [aktifOturum, setAktifOturum] = useState<ChatSession | null>(null)
  const [mesajlar, setMesajlar] = useState<ChatMessage[]>([])
  const [girdi, setGirdi] = useState('')
  const [ekliKod, setEkliKod] = useState<string | null>(null)
  const [yaziyor, setYaziyor] = useState(false)
  const [gecmisAcik, setGecmisAcik] = useState(false)
  const [aramaMetni, setAramaMetni] = useState('')
  const [modeller, setModeller] = useState<string[]>([])
  const [modellerYukleniyor, setModellerYukleniyor] = useState(false)
  const [hedefSecimAraligi, setHedefSecimAraligi] = useState<{
    filePath: string
    startLine: number
    endLine: number
  } | undefined>(undefined)

  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(
    state.settings?.selectedReasoningEffort ?? 'medium'
  )
  const [isSkillsModalOpen, setIsSkillsModalOpen] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [streamingReasoning, setStreamingReasoning] = useState('')

  // Bağlam Telemetrisi Detay Popover'ı ve AI Optimizasyon Durumu
  const [isContextDetailsOpen, setIsContextDetailsOpen] = useState(false)
  const [isCompacting, setIsCompacting] = useState(false)
  const [compactionToast, setCompactionToast] = useState<string | null>(null)

  const currentStreamIdRef = useRef<string | null>(null)
  const streamTextAccumulatorRef = useRef<string>('')
  const streamReasoningAccumulatorRef = useRef<string>('')
  const pendingAgentActionRef = useRef<{
    aktifSekme: any
    hedefAralik?: { startLine: number; endLine: number }
  } | null>(null)

  const secilenSaglayici = state.settings?.selectedAiProvider ?? AI_PROVIDERS[0].id
  const aktifModel =
    state.settings?.selectedModelPerProvider?.[secilenSaglayici] ?? modeller[0] ?? ''

  const listeSonuRef = useRef<HTMLDivElement>(null)
  const girdiRef = useRef<HTMLTextAreaElement>(null)
  const aktifOturumRef = useRef(aktifOturum)
  aktifOturumRef.current = aktifOturum

  const aktifSketchRef = useRef(aktifSketch)
  aktifSketchRef.current = aktifSketch
  const stateRef = useRef(state)
  stateRef.current = state
  const createFileWithContentRef = useRef(createFileWithContent)
  createFileWithContentRef.current = createFileWithContent
  const renameFileRef = useRef(renameFile)
  renameFileRef.current = renameFile
  const updateFileContentRef = useRef(updateFileContent)
  updateFileContentRef.current = updateFileContent
  const openFileInTabRef = useRef(openFileInTab)
  openFileInTabRef.current = openFileInTab
  const startAiDiffReviewRef = useRef(startAiDiffReview)
  startAiDiffReviewRef.current = startAiDiffReview

  // Panel yüklendiğinde veya proje değiştiğinde giriş kutusuna odaklan
  useEffect(() => {
    const timer = setTimeout(() => {
      girdiRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [aktifSketch])

  // Yazıyor durumu için watchdog: beklenmeyen takılmalarda kilitlenmeyi önler
  useEffect(() => {
    if (!yaziyor) return
    const timer = setTimeout(() => {
      console.warn('[DretAIPanel] Yazıyor durumu zaman aşımına uğradı, kilit çözülüyor.')
      setYaziyor(false)
      setStreamingText('')
      setStreamingReasoning('')
      currentStreamIdRef.current = null
      pendingAgentActionRef.current = null
    }, 60000)
    return () => clearTimeout(timer)
  }, [yaziyor])

  // Canlı Bağlam (Context Window) ve Token Kullanım Telemetrisi
  const contextTelemetry = useMemo(() => {
    // 1. Sistem promptu + donanım profili + RAG yaklaşık taban tüketimi
    const systemAndBoardTokens = 1500

    // 2. Açık olan aktif sketch dosyası (en fazla 16.000 karakter aktarılıyor)
    const aktifSekme =
      state.sketch.tabs.find((t) => ayniDosyaMi(t.path, state.sketch.activeTabPath ?? '')) ||
      state.sketch.tabs[0]
    const activeCodeLength = aktifSekme?.content ? Math.min(aktifSekme.content.length, 16000) : 0
    const codeTokens = Math.ceil(activeCodeLength / 3.8)

    // 3. Sohbet mesajları tokenları
    let rawMessagesTokens = 0
    let compactedMessagesTokens = 0

    for (let i = 0; i < mesajlar.length; i++) {
      const msgTokens = estimateTokens(mesajlar[i].metin)
      rawMessagesTokens += msgTokens

      // Sıkıştırma devredeyse eski mesajlar budandıktan sonra ortalama ~40-50 token kalır
      if (i < mesajlar.length - 6) {
        compactedMessagesTokens += Math.min(msgTokens, 50)
      } else {
        compactedMessagesTokens += msgTokens
      }
    }

    const maxContextTokens = getModelContextLimit(secilenSaglayici, aktifModel, state.settings?.customContextLimits)
    const rawTotalEstimatedTokens = systemAndBoardTokens + codeTokens + rawMessagesTokens
    const rawUsagePercent = Math.min(100, Math.max(0.1, (rawTotalEstimatedTokens / maxContextTokens) * 100))

    // Kural: %70 veya üzeri dolulukta otomatik sıkıştırma devreye girer
    const isCompactionActive = rawUsagePercent >= 70

    const currentMessagesTokens = isCompactionActive ? compactedMessagesTokens : rawMessagesTokens
    const totalEstimatedTokens = systemAndBoardTokens + codeTokens + currentMessagesTokens
    const usagePercent = Math.min(100, Math.max(0.1, (totalEstimatedTokens / maxContextTokens) * 100))

    return {
      systemTokens: systemAndBoardTokens,
      codeTokens,
      messagesTokens: currentMessagesTokens,
      rawMessagesTokens,
      totalTokens: totalEstimatedTokens,
      maxTokens: maxContextTokens,
      usagePercent: Number(usagePercent.toFixed(1)),
      rawUsagePercent: Number(rawUsagePercent.toFixed(1)),
      isCompactionActive,
      isAutoTriggered: rawUsagePercent >= 70,
      isManualTriggered: false,
      savedTokens: isCompactionActive ? Math.max(0, rawMessagesTokens - compactedMessagesTokens) : 0,
      activeFileName: aktifSekme?.name ?? null,
      activeCodeLength
    }
  }, [state.sketch.tabs, state.sketch.activeTabPath, mesajlar, secilenSaglayici, aktifModel, state.settings?.customContextLimits])

  // Gerçek zamanlı API Streaming olay dinleyicisi
  useEffect(() => {
    const unsub = window.api.chat.onStreamChunk(async (event) => {
      if (event.streamId !== currentStreamIdRef.current) return

      if (event.error) {
        setYaziyor(false)
        const partialText = streamTextAccumulatorRef.current.trim()

        let hataMetni = `Hata: ${event.error}`
        if (event.error.includes('high demand') || event.error.includes('503')) {
          hataMetni = `[Google Gemini Yoğunluğu]: Bu model şu anda küresel olarak aşırı talep alıyor (high demand). Lütfen birkaç saniye sonra tekrar deneyin veya farklı bir model seçin.`
        }

        if (partialText) {
          const hasSelection = Boolean(
            pendingAgentActionRef.current?.hedefAralik &&
              pendingAgentActionRef.current.hedefAralik.startLine > 0
          )
          const parsed = parseAgentResponse(partialText, hasSelection)
          const actionItems: AgentActionItem[] = parsed.actions.map((act) => ({
            type: act.type,
            filename: act.filename,
            rename: act.rename,
            summary: act.summary,
            linesCount: act.code.split('\n').length,
            applied: false,
            targetRange:
              act.type === 'replace_selection' && pendingAgentActionRef.current?.hedefAralik
                ? pendingAgentActionRef.current.hedefAralik
                : undefined
          }))
          const kurtarilanMesaj: ChatMessage = {
            id: 'msg_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now(),
            rol: 'asistan',
            metin: `${parsed.explanation}\n\n---\n${hataMetni}`,
            timestamp: Date.now(),
            agentAction: actionItems[0] || undefined,
            agentActions: actionItems.length > 0 ? actionItems : undefined
          }
          setMesajlar((prev) => [...prev, kurtarilanMesaj])
        } else {
          const hataMesaji: ChatMessage = {
            id: 'msg_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now(),
            rol: 'asistan',
            metin: hataMetni,
            timestamp: Date.now(),
            isError: true
          }
          setMesajlar((prev) => [...prev, hataMesaji])
        }

        setStreamingText('')
        setStreamingReasoning('')
        currentStreamIdRef.current = null
        pendingAgentActionRef.current = null
        return
      }

      if (event.chunk) {
        streamTextAccumulatorRef.current += event.chunk
        setStreamingText(streamTextAccumulatorRef.current)
      }

      if (event.reasoningChunk) {
        streamReasoningAccumulatorRef.current += event.reasoningChunk
        setStreamingReasoning(streamReasoningAccumulatorRef.current)
      }

      if (event.done) {
        try {
          const rawText = streamTextAccumulatorRef.current || 'Model yanıt üretti ancak boş döndü.'
          const hasSelection = Boolean(
            pendingAgentActionRef.current?.hedefAralik &&
              pendingAgentActionRef.current.hedefAralik.startLine > 0
          )
          const parsed = parseAgentResponse(rawText, hasSelection)

          const actionItems: AgentActionItem[] = parsed.actions.map((act) => ({
            type: act.type,
            filename: act.filename,
            rename: act.rename,
            summary: act.summary,
            linesCount: act.code.split('\n').length,
            applied: true,
            targetRange:
              act.type === 'replace_selection' && pendingAgentActionRef.current?.hedefAralik
                ? pendingAgentActionRef.current.hedefAralik
                : undefined
          }))

          const asistanMesaji: ChatMessage = {
            id: 'msg_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now(),
            rol: 'asistan',
            metin: parsed.explanation,
            timestamp: Date.now(),
            agentAction: actionItems[0] || undefined,
            agentActions: actionItems.length > 0 ? actionItems : undefined
          }

          setMesajlar((prev) => {
            const guncel = [...prev, asistanMesaji]
            if (aktifOturumRef.current) {
              aktifOturumRef.current.mesajlar = guncel
              void window.api.chat.saveSession(aktifOturumRef.current)
              if (aktifSketchRef.current) {
                void window.api.chat.getSessions(aktifSketchRef.current.folderPath).then(setOturumlar)
              }
            }
            return guncel
          })

          // AI Kod Eylemlerini Uygula
          const isMultiAction = parsed.actions.length > 1

          for (const act of parsed.actions) {
            try {
              if (act.type === 'create_file') {
                let dosyaAdi = (act.filename || 'yeni_dosya.ino').trim()
                if (!/\.(ino|h|hpp|cpp|c)$/i.test(dosyaAdi)) {
                  dosyaAdi += '.ino'
                }
                await createFileWithContentRef.current(dosyaAdi, act.code)
              } else {
                // replace_file veya replace_selection
                let hedefYol = pendingAgentActionRef.current?.aktifSekme?.path
                let hedefAd = pendingAgentActionRef.current?.aktifSekme?.name || ''

                const guncelFiles = aktifSketchRef.current?.files || []
                let bulunan: SketchFile | undefined = undefined

                // 1. Doğrudan act.filename eşleşmesi (uzantılı veya uzantısız)
                if (act.filename && guncelFiles.length > 0) {
                  const arananAd = act.filename.trim().toLowerCase()
                  bulunan = guncelFiles.find(
                    (f) =>
                      f.name.toLowerCase() === arananAd ||
                      f.name.toLowerCase() === `${arananAd}.ino` ||
                      f.name.replace(/\.[^/.]+$/, '').toLowerCase() === arananAd.replace(/\.[^/.]+$/, '')
                  )
                }

                // 2. Eğer act.filename ile bulunamadıysa, summary veya kodun ilk satırlarında proje dosyası geçiyor mu?
                if (!bulunan && guncelFiles.length > 0) {
                  const aramaHavuzu = [
                    act.filename || '',
                    act.summary || '',
                    act.code.slice(0, 300)
                  ].join(' ').toLowerCase()

                  for (const f of guncelFiles) {
                    const dosyaKoku = f.name.replace(/\.[^/.]+$/, '').toLowerCase()
                    if (dosyaKoku.length >= 3 && aramaHavuzu.includes(dosyaKoku)) {
                      if (!ayniDosyaMi(f.path, hedefYol || '')) {
                        bulunan = f
                        break
                      }
                    }
                  }
                }

                if (bulunan) {
                  hedefYol = bulunan.path
                  hedefAd = bulunan.name
                }

                if (hedefYol) {
                  // AI mevcut dosyanın adını/başlığını değiştirmek istiyorsa (örn. sketch_... -> verici.ino)
                  const hedefYeniAd =
                    act.rename?.trim() ||
                    (!bulunan && act.filename ? act.filename.trim() : '')

                  if (hedefYeniAd) {
                    let temizYeniAd = hedefYeniAd
                    if (!/\.(ino|h|hpp|cpp|c)$/i.test(temizYeniAd)) {
                      temizYeniAd += '.ino'
                    }
                    if (hedefAd.toLowerCase() !== temizYeniAd.toLowerCase()) {
                      const yenidenAdlandirildi = await renameFileRef.current(hedefYol, temizYeniAd)
                      if (yenidenAdlandirildi?.path) {
                        hedefYol = yenidenAdlandirildi.path
                        hedefAd = yenidenAdlandirildi.name
                        const norm = hedefYol.replace(/\\/g, '/')
                        const sonIdx = norm.lastIndexOf('/')
                        const yeniKlasor = sonIdx > -1 ? hedefYol.slice(0, sonIdx) : hedefYol
                        const yeniKlasorAdi = sonIdx > -1 ? norm.slice(sonIdx + 1).replace(/\.ino$/i, '') : hedefAd
                        if (aktifSketchRef.current) {
                          aktifSketchRef.current = {
                            ...aktifSketchRef.current,
                            folderPath: yeniKlasor,
                            name: yeniKlasorAdi
                          }
                        }
                        if (aktifOturumRef.current) {
                          aktifOturumRef.current.sketchPath = yeniKlasor
                          aktifOturumRef.current.sketchName = yeniKlasorAdi
                          await window.api.chat.saveSession(aktifOturumRef.current)
                        }
                      }
                    }
                  }

                  const aktifSekmeYolu =
                    stateRef.current.sketch.activeTabPath ||
                    pendingAgentActionRef.current?.aktifSekme?.path ||
                    ''
                  const isAktifSekme = ayniDosyaMi(hedefYol, aktifSekmeYolu)

                  // EĞER hedef dosya aktif sekme DEĞİLSE, VEYA çoklu işlem varsa, VEYA dosya yeniden adlandırıldıysa:
                  // İçeriği doğrudan diske ve sekmeye kaydet, ardından hedef sekmeyi açıp odağa al.
                  if (!isAktifSekme || isMultiAction || act.rename || hedefYeniAd) {
                    await updateFileContentRef.current(hedefYol, act.code)
                    const isMain =
                      bulunan?.isMainFile ??
                      (aktifSketchRef.current?.files.find((f) => ayniDosyaMi(f.path, hedefYol))?.isMainFile ?? false)
                    await openFileInTabRef.current(hedefYol, hedefAd, isMain)
                  } else {
                    startAiDiffReviewRef.current(
                      hedefYol,
                      act.code,
                      pendingAgentActionRef.current?.hedefAralik
                    )
                  }
                } else if (act.filename) {
                  let dosyaAdi = act.filename.trim()
                  if (!/\.(ino|h|hpp|cpp|c)$/i.test(dosyaAdi)) {
                    dosyaAdi += '.ino'
                  }
                  await createFileWithContentRef.current(dosyaAdi, act.code)
                }
              }
            } catch (actErr) {
              console.error('AI eylemi uygulanamadı:', act, actErr)
            }
          }
        } catch (doneErr) {
          console.error('Akış tamamlama hatası:', doneErr)
        } finally {
          setYaziyor(false)
          setStreamingText('')
          setStreamingReasoning('')
          currentStreamIdRef.current = null
          pendingAgentActionRef.current = null
        }
      }
    })

    return unsub
  }, [])

  // Sağlayıcı veya kayıtlı anahtarlar değiştiğinde modelleri dinamik yükle
  useEffect(() => {
    let iptal = false
    async function modelleriGetir(): Promise<void> {
      setModellerYukleniyor(true)
      try {
        const liste = await window.api.chat.getProviderModels(secilenSaglayici)
        if (iptal) return
        setModeller(liste)
        const mevcutModel = state.settings?.selectedModelPerProvider?.[secilenSaglayici]
        if (liste.length > 0 && (!mevcutModel || !liste.includes(mevcutModel))) {
          void setSelectedAiModel(secilenSaglayici, liste[0])
        }
      } catch (err) {
        console.error('Modeller getirilemedi:', err)
      } finally {
        if (!iptal) setModellerYukleniyor(false)
      }
    }
    void modelleriGetir()
    return () => {
      iptal = true
    }
  }, [secilenSaglayici, state.configuredAiProviders])

  // 1. Proje (Sketch) açıldığında veya değiştiğinde o projeye ait oturumları yükle
  useEffect(() => {
    let iptal = false
    if (!aktifSketch) {
      setOturumlar([])
      setAktifOturum(null)
      setMesajlar([])
      setGecmisAcik(false)
      return
    }

    async function sketchOturumlariniYukle(): Promise<void> {
      try {
        const liste = await window.api.chat.getSessions(aktifSketch!.folderPath)
        if (iptal) return
        setOturumlar(liste)
        if (liste.length > 0) {
          const aktifId = aktifOturumRef.current?.id
          const hedefId = aktifId && liste.some((o) => o.id === aktifId) ? aktifId : liste[0].id
          const son = await window.api.chat.getSession(hedefId)
          if (iptal) return
          if (son) {
            setAktifOturum(son)
            setMesajlar(son.mesajlar)
            return
          }
        }
        // Eğer bellekte aktif bir oturum ve mesajlar varsa (örneğin isim değiştirme esnasında), onu koru
        if (aktifOturumRef.current && aktifOturumRef.current.mesajlar.length > 0) {
          aktifOturumRef.current.sketchPath = aktifSketch!.folderPath
          aktifOturumRef.current.sketchName = aktifSketch!.name
          void window.api.chat.saveSession(aktifOturumRef.current)
          setAktifOturum({ ...aktifOturumRef.current })
          return
        }
        setAktifOturum(null)
        setMesajlar([])
      } catch (err) {
        console.error('Sohbet geçmişi yüklenemedi:', err)
      }
    }

    void sketchOturumlariniYukle()

    return () => {
      iptal = true
    }
  }, [aktifSketch?.folderPath])

  // 2. CodeEditor'dan gelen kod seçim istemini tüket
  useEffect(() => {
    if (!state.dretAi.seed) return
    setEkliKod(state.dretAi.seed.kod)
    setGirdi(state.dretAi.seed.istem)
    if (state.dretAi.seed.secimAraligi) {
      setHedefSecimAraligi({
        filePath: state.dretAi.seed.secimAraligi.filePath,
        startLine: state.dretAi.seed.secimAraligi.startLine,
        endLine: state.dretAi.seed.secimAraligi.endLine
      })
    }
    clearDretAiSeed()
    setGecmisAcik(false)
    requestAnimationFrame(() => {
      girdiRef.current?.focus()
      girdiRef.current?.setSelectionRange(girdiRef.current.value.length, girdiRef.current.value.length)
    })
  }, [state.dretAi.seed, clearDretAiSeed])

  // 3. Mesajlar veya akış değiştikçe otomatik alta kaydır
  useEffect(() => {
    listeSonuRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mesajlar, yaziyor, streamingText, gecmisAcik])

  // Yeni sohbet oturumu başlatma
  const yeniSohbetBaslat = (): void => {
    setAktifOturum(null)
    setMesajlar([])
    setGirdi('')
    setEkliKod(null)
    setHedefSecimAraligi(undefined)
    setGecmisAcik(false)
    setIsContextDetailsOpen(false)
    requestAnimationFrame(() => girdiRef.current?.focus())
  }

  // Geçmişten bir oturumu seçip yükleme
  const oturumSec = async (sessionId: string): Promise<void> => {
    try {
      const secilen = await window.api.chat.getSession(sessionId)
      if (secilen) {
        setAktifOturum(secilen)
        setMesajlar(secilen.mesajlar)
        setGecmisAcik(false)
        setIsContextDetailsOpen(false)
      }
    } catch (err) {
      console.error('Oturum açılamadı:', err)
    }
  }

  // Kullanıcı butona bastığında AI ile tek seferlik hafıza özetleme ve bağlam optimizasyonu
  const handleManualCompaction = async (): Promise<void> => {
    if (isCompacting || yaziyor) return

    if (mesajlar.length <= 4) {
      setCompactionToast('Sohbet geçmişi henüz çok kısa (4 mesaj veya daha az). Özetlemeye gerek yok.')
      setTimeout(() => setCompactionToast(null), 3500)
      return
    }

    if (!aktifOturum?.id) {
      setCompactionToast('Aktif bir sohbet oturumu bulunamadı.')
      setTimeout(() => setCompactionToast(null), 3000)
      return
    }

    setIsCompacting(true)
    setCompactionToast('AI ile konuşma bağlamı özetleniyor...')

    try {
      const res = await window.api.chat.compactSession({
        sessionId: aktifOturum.id,
        provider: secilenSaglayici,
        model: aktifModel
      })

      if (res.success && res.session) {
        setAktifOturum(res.session)
        setMesajlar(res.session.mesajlar)
        setCompactionToast('✨ Bağlam AI ile başarıyla özetlendi ve hafızaya alındı!')
        setTimeout(() => setCompactionToast(null), 4000)
        if (aktifSketch) {
          const guncel = await window.api.chat.getSessions(aktifSketch.folderPath)
          setOturumlar(guncel)
        }
      } else {
        setCompactionToast(res.error || 'Özetleme işlemi tamamlanamadı.')
        setTimeout(() => setCompactionToast(null), 4000)
      }
    } catch (err: any) {
      setCompactionToast(`Özetleme hatası: ${err?.message || 'Bilinmeyen hata'}`)
      setTimeout(() => setCompactionToast(null), 4000)
    } finally {
      setIsCompacting(false)
    }
  }

  // Bir oturumu silme
  const oturumSil = async (e: React.MouseEvent, sessionId: string): Promise<void> => {
    e.stopPropagation()
    try {
      await window.api.chat.deleteSession(sessionId)
      if (aktifSketch) {
        const guncel = await window.api.chat.getSessions(aktifSketch.folderPath)
        setOturumlar(guncel)
        if (aktifOturum?.id === sessionId) {
          if (guncel.length > 0) {
            void oturumSec(guncel[0].id)
          } else {
            yeniSohbetBaslat()
          }
        }
      }
    } catch (err) {
      console.error('Oturum silinemedi:', err)
    }
  }

  // Aktif sekme kapandığında veya değiştiğinde, eğer hedef seçim aralığı o eski dosyaya aitse temizle
  useEffect(() => {
    if (hedefSecimAraligi) {
      const dosyaHalaAcik = state.sketch.tabs.some((t) => ayniDosyaMi(t.path, hedefSecimAraligi.filePath))
      if (!dosyaHalaAcik) {
        setHedefSecimAraligi(undefined)
        setEkliKod(null)
      }
    }
  }, [state.sketch.tabs, hedefSecimAraligi])

  // Gerçek AI Mesajı gönderme ve akış başlatma
  const gonder = async (): Promise<void> => {
    if (yaziyor) return
    const metin = girdi.trim()
    if (!metin && !ekliKod) return

    let currentSketch = aktifSketch
    if (!currentSketch) {
      currentSketch = await newSketch()
      if (!currentSketch) return
    }

    const gonderilecekMetin = ekliKod
      ? `${metin ? `${metin}\n\n` : ''}\`\`\`cpp\n${ekliKod}\n\`\`\``
      : metin

    const yeniKullaniciMesaji: ChatMessage = {
      id: 'msg_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now(),
      rol: 'kullanici',
      metin: gonderilecekMetin,
      timestamp: Date.now()
    }

    const guncelMesajlar = [...mesajlar, yeniKullaniciMesaji]
    setMesajlar(guncelMesajlar)
    setGirdi('')
    setEkliKod(null)
    setYaziyor(true)

    const streamId = 'stream_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now()
    currentStreamIdRef.current = streamId
    streamTextAccumulatorRef.current = ''
    streamReasoningAccumulatorRef.current = ''
    setStreamingText('')
    setStreamingReasoning('')

    // Oturum yoksa yeni oturum oluştur, varsa mevcut oturumu güncelle
    let mevcutOturum = aktifOturumRef.current
    if (!mevcutOturum) {
      let otomatikBaslik = metin.replace(/\n/g, ' ').trim()
      if (otomatikBaslik.length > 32) {
        otomatikBaslik = otomatikBaslik.slice(0, 30) + '...'
      }
      if (!otomatikBaslik) otomatikBaslik = 'Kod İnceleme'

      mevcutOturum = await window.api.chat.createSession(currentSketch.folderPath, currentSketch.name, otomatikBaslik)
      setAktifOturum(mevcutOturum)
    }

    mevcutOturum.mesajlar = guncelMesajlar
    await window.api.chat.saveSession(mevcutOturum)

    // Aktif dosya ve kart bağlamı
    let aktifSekme =
      state.sketch.tabs.find((t) => ayniDosyaMi(t.path, state.sketch.activeTabPath ?? '')) ||
      state.sketch.tabs[0]

    let activeContent = aktifSekme?.content
    let activePath = aktifSekme?.path
    let activeName = aktifSekme?.name

    if (!activePath && currentSketch.files.length > 0) {
      const ana = currentSketch.files.find((f) => f.isMainFile) || currentSketch.files[0]
      if (ana) {
        try {
          activeContent = await window.api.sketch.readFile(ana.path)
          activePath = ana.path
          activeName = ana.name
        } catch {
          // ignore
        }
      }
    }

    const projeDosyalari = await Promise.all(
      currentSketch.files.map(async (f) => {
        let icerik: string | undefined = undefined
        if (activePath && ayniDosyaMi(f.path, activePath)) {
          icerik = activeContent
        } else {
          const acikTab = stateRef.current.sketch.tabs.find((t) => ayniDosyaMi(t.path, f.path))
          if (acikTab) {
            icerik = acikTab.content
          } else {
            try {
              icerik = await window.api.sketch.readFile(f.path)
            } catch {
              icerik = undefined
            }
          }
        }
        return {
          name: f.name,
          path: f.path,
          isMainFile: f.isMainFile,
          content: icerik
        }
      })
    )

    const activeCodeContext = activePath
      ? {
          filePath: activePath,
          fileName: activeName || 'sketch.ino',
          content: activeContent || '',
          selectedCode: ekliKod ?? undefined,
          selectionRange:
            hedefSecimAraligi && hedefSecimAraligi.startLine > 0
              ? {
                  startLine: hedefSecimAraligi.startLine,
                  endLine: hedefSecimAraligi.endLine
                }
              : undefined,
          boardContext: aktifKart
            ? {
                name: aktifKart.name,
                fqbn: aktifKart.fqbn,
                platformName: aktifKart.platformName,
                platformId: aktifKart.platformId
              }
            : state.arduinoCli.selectedFqbn
            ? { fqbn: state.arduinoCli.selectedFqbn }
            : undefined,
          sketchName: currentSketch.name,
          projectFiles: projeDosyalari
        }
      : undefined

    pendingAgentActionRef.current = {
      aktifSekme: aktifSekme || (activePath ? { path: activePath, name: activeName || 'sketch.ino' } : undefined),
      hedefAralik:
        hedefSecimAraligi && hedefSecimAraligi.startLine > 0
          ? { startLine: hedefSecimAraligi.startLine, endLine: hedefSecimAraligi.endLine }
          : undefined
    }

    try {
      await window.api.chat.sendAiMessageStream({
        streamId,
        provider: secilenSaglayici,
        model: aktifModel,
        reasoningEffort,
        forceCompaction: contextTelemetry.rawUsagePercent >= 70,
        messages: guncelMesajlar.map((m) => ({
          rol: m.rol,
          metin: m.metin
        })),
        activeCodeContext
      })
    } catch (err: any) {
      setYaziyor(false)
      const hataMesaji: ChatMessage = {
        id: 'msg_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now(),
        rol: 'asistan',
        metin: `Bağlantı hatası: ${err?.message || 'Model sunucusuna ulaşılamadı.'}`,
        timestamp: Date.now(),
        isError: true
      }
      setMesajlar([...guncelMesajlar, hataMesaji])
      currentStreamIdRef.current = null
      pendingAgentActionRef.current = null
    }
  }

  // Filtrelenmiş oturumlar
  const filtrelenmisOturumlar = oturumlar.filter((o) =>
    o.baslik.toLowerCase().includes(aramaMetni.toLowerCase()) ||
    (o.sonMesaj && o.sonMesaj.toLowerCase().includes(aramaMetni.toLowerCase()))
  )

  return (
    <aside className="relative flex w-[350px] shrink-0 flex-col border-l border-panel-border bg-panel-light">
      {/* ── Üst Çubuk ── */}
      <div className="relative flex h-10 shrink-0 items-center gap-1.5 overflow-hidden border-b border-panel-border px-3">
        <div className="pointer-events-none absolute -left-3 -top-8 h-16 w-16 rounded-full bg-gradient-to-br from-[#3b82f6]/25 to-[#8b5cf6]/25 blur-xl" />
        <img src={cloudIcon} alt="Cloud AI" className="relative h-4 w-4 object-contain shrink-0 drop-shadow-[0_0_4px_rgba(147,165,251,0.5)]" />
        <span className="relative bg-gradient-to-r from-[#93a5fb] via-[#c4b5fd] to-[#93a5fb] bg-clip-text text-xs font-semibold text-transparent">
          Cloud AI
        </span>

        {aktifSketch && (
          <span
            title={`Aktif Proje: ${aktifSketch.folderPath}`}
            className="relative ml-1 flex max-w-[110px] items-center gap-1 truncate rounded-full bg-panel-border/80 px-2 py-0.5 text-[10px] font-medium text-gray-400"
          >
            <FolderIcon className="shrink-0 text-gray-400" />
            <span className="truncate">{aktifSketch.name}</span>
          </span>
        )}

        <div className="flex-1" />

        {aktifSketch && (
          <>
            <button
              onClick={() => setGecmisAcik((prev) => !prev)}
              title={gecmisAcik ? 'Sohbete Dön' : 'Geçmiş Sohbetler'}
              className={`relative flex h-6 items-center gap-1 rounded px-1.5 text-xs transition-colors ${
                gecmisAcik
                  ? 'bg-accent/20 text-[#93a5fb]'
                  : 'text-gray-400 hover:bg-panel-border hover:text-gray-200'
              }`}
            >
              <HistoryIcon />
              {oturumlar.length > 0 && (
                <span className="rounded-full bg-panel-border px-1 text-[9px] font-medium text-gray-300">
                  {oturumlar.length}
                </span>
              )}
            </button>

            <button
              onClick={yeniSohbetBaslat}
              title="Yeni Sohbet Başlat"
              className="relative flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-panel-border hover:text-gray-200"
            >
              <PlusIcon />
            </button>
          </>
        )}

        <button
          onClick={onClose}
          title="Cloud AI panelini kapat"
          className="relative flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-panel-border hover:text-gray-200"
        >
          <CloseIcon />
        </button>
      </div>

      {/* ── AI Sağlayıcı ve Model Hızlı Seçici ── */}
      <div className="flex items-center gap-1.5 border-b border-panel-border/80 bg-panel/60 px-2.5 py-1.5 text-[11px]">
        {/* Sağlayıcı */}
        <select
          value={secilenSaglayici}
          onChange={(e) => setSelectedAiProvider(e.target.value as any)}
          title="Yapay Zekâ Sağlayıcısı"
          className="h-6 flex-1 rounded border border-panel-border bg-panel px-1.5 text-[10.5px] font-medium text-gray-200 outline-none focus:border-accent"
        >
          {AI_PROVIDERS.map((p) => {
            const ayarli = state.configuredAiProviders.includes(p.id)
            return (
              <option key={p.id} value={p.id}>
                {p.name} {ayarli ? '(Hazır)' : ''}
              </option>
            )
          })}
        </select>

        {/* Model */}
        <select
          value={aktifModel}
          onChange={(e) => void setSelectedAiModel(secilenSaglayici, e.target.value)}
          disabled={modellerYukleniyor || modeller.length === 0}
          title={modellerYukleniyor ? 'Modeller listeleniyor...' : `Aktif Model: ${aktifModel}`}
          className="h-6 max-w-[130px] rounded border border-panel-border bg-panel px-1.5 text-[10.5px] font-medium text-[#c4b5fd] outline-none focus:border-accent disabled:opacity-50"
        >
          {modeller.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* ── Aktif Kart ve Donanım Becerileri (Skills) Göstergesi ── */}
      <div className="flex items-center justify-between border-b border-panel-border/60 bg-panel/40 px-2.5 py-1.5 text-[10px]">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate text-gray-400">
          <CpuIcon className="shrink-0 text-[#93a5fb]" />
          <span className="truncate font-medium text-gray-300">
            {aktifKart ? aktifKart.name : state.arduinoCli.selectedFqbn ? state.arduinoCli.selectedFqbn : 'Kart Seçilmedi'}
          </span>
        </div>
        <button
          onClick={() => setIsSkillsModalOpen(true)}
          title="Donanım Laboratuvarı, Pinout Haritası ve Semantik Kod İndeksi"
          className="shrink-0 ml-2 flex items-center gap-1.5 rounded border border-[#2b3142] bg-[#161924] px-2 py-0.5 text-[9.5px] font-mono text-gray-300 hover:border-[#3d465e] hover:bg-[#1e2333] hover:text-white transition-colors"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
          <span>Donanım & RAG</span>
        </button>
      </div>

      {/* ── Canlı Bağlam (Token) ve Akıllı Sıkıştırma Telemetrisi ── */}
      <div className="relative border-b border-panel-border/60 bg-[#0d0f17] text-[10px]">
        <div className="flex items-center justify-between px-2.5 py-1">
          {/* Token sayacı & Doluluk çubuğu & Detay açıcı buton */}
          <button
            type="button"
            onClick={() => setIsContextDetailsOpen((prev) => !prev)}
            title="Bağlam Dökümünü ve Bellek Optimizasyonunu Aç"
            className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-white/[0.04] transition-colors group cursor-pointer text-left select-none"
          >
            <GaugeIcon className="h-3 w-3 text-amber-400 shrink-0 drop-shadow-[0_0_4px_rgba(251,191,36,0.4)]" />
            <div className="flex items-center gap-1">
              <span className="font-mono text-gray-200 font-medium group-hover:text-white transition-colors">
                ~{formatTokenCount(contextTelemetry.totalTokens)}
              </span>
              <span className="text-gray-600 font-mono text-[9px]">/</span>
              {secilenSaglayici === 'nvidia' || secilenSaglayici === 'lmstudio' ? (
                <select
                  value={contextTelemetry.maxTokens}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => void setCustomContextLimit(secilenSaglayici, Number(e.target.value))}
                  title={`${secilenSaglayici.toUpperCase()} için bağlam sınırını seçin`}
                  className="h-4 rounded border border-[#3b82f6]/40 bg-[#161924] px-1 py-0 text-[9.5px] font-mono text-[#93a5fb] outline-none cursor-pointer hover:border-[#3b82f6] hover:bg-[#1e2333] transition-colors"
                >
                  {ADJUSTABLE_CONTEXT_PRESETS.map((p) => (
                    <option key={p.value} value={p.value} className="bg-[#12141c] text-gray-200">
                      {p.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-mono text-gray-400 text-[9.5px]">
                  1M
                </span>
              )}
            </div>

            {/* Mini doluluk barı */}
            <div className="ml-1 h-1.5 w-9 rounded-full bg-[#1b1f2d] overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  contextTelemetry.usagePercent >= 70
                    ? 'bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.6)]'
                    : contextTelemetry.usagePercent > 40
                    ? 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.6)]'
                    : 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]'
                }`}
                style={{ width: `${Math.min(100, Math.max(6, contextTelemetry.usagePercent))}%` }}
              />
            </div>

            <span className="font-mono text-[9px] text-gray-400">
              %{contextTelemetry.usagePercent}
            </span>

            <ChevronDownIcon
              className={`h-2.5 w-2.5 text-gray-500 transition-transform duration-200 ${
                isContextDetailsOpen ? 'rotate-180 text-[#93a5fb]' : 'group-hover:text-gray-300'
              }`}
            />
          </button>

          {/* Sıkıştırma Durum Rozeti */}
          {contextTelemetry.isCompactionActive ? (
            <button
              type="button"
              onClick={() => setIsContextDetailsOpen(true)}
              title={
                contextTelemetry.isAutoTriggered
                  ? `%70 Doluluk Eşiği Aşıldı: Otomatik Sıkıştırma Aktif (~${formatTokenCount(contextTelemetry.savedTokens)} tasarruf)`
                  : `Manuel Optimizasyon Aktif (~${formatTokenCount(contextTelemetry.savedTokens)} tasarruf)`
              }
              className="flex items-center gap-1 text-[9px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 rounded px-1.5 py-0.5 hover:bg-emerald-950/60 transition-colors"
            >
              <ShieldCheckIcon className="h-3 w-3 text-emerald-400 shrink-0" />
              <span>Sıkıştırma Aktif</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsContextDetailsOpen(true)}
              title="Bağlam henüz %70 eşiğine ulaşmadı. Tüm mesajlar eksiksiz iletiliyor."
              className="flex items-center gap-1 text-[9px] text-gray-400 hover:text-gray-200 rounded px-1.5 py-0.5 hover:bg-white/[0.03] transition-colors"
            >
              <CheckCircleIcon className="h-2.5 w-2.5 text-gray-500 shrink-0" />
              <span>Tam Bağlam</span>
            </button>
          )}
        </div>

        {/* ── Context Inspector Popover (Gelişmiş Bağlam Paneli) ── */}
        {isContextDetailsOpen && (
          <>
            {/* Arka plan tıklandığında kapatma katmanı */}
            <div
              className="fixed inset-0 z-30"
              onClick={() => setIsContextDetailsOpen(false)}
            />

            {/* Popover Kartı */}
            <div className="absolute left-2 right-2 top-full z-40 mt-1 overflow-hidden rounded-xl border border-[#2b334a] bg-[#0c0f18]/98 p-3 shadow-[0_12px_32px_rgba(0,0,0,0.85)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
              {/* Başlık */}
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md border border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#93a5fb]">
                    <LayersIcon className="h-3 w-3" />
                  </span>
                  <div>
                    <h4 className="text-[11px] font-semibold text-white tracking-wide">
                      Bağlam & Bellek Telemetrisi
                    </h4>
                    <p className="text-[9px] text-gray-500">
                      Model bağlam penceresi ve sıkıştırma denetleyicisi
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsContextDetailsOpen(false)}
                  className="rounded p-1 text-gray-500 hover:bg-white/[0.06] hover:text-gray-200 transition-colors"
                >
                  <CloseIcon />
                </button>
              </div>

              {/* Doluluk ve %70 Eşik Çubuğu */}
              <div className="mt-2.5 rounded-lg border border-white/[0.04] bg-black/40 p-2.5">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-sm font-bold text-white">
                      ~{formatTokenCount(contextTelemetry.totalTokens)}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">/</span>
                    <span className="font-mono text-xs text-gray-400">
                      {formatTokenCount(contextTelemetry.maxTokens)} token
                    </span>
                  </div>
                  <span
                    className={`font-mono text-xs font-semibold ${
                      contextTelemetry.usagePercent >= 70
                        ? 'text-rose-400'
                        : contextTelemetry.usagePercent > 40
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    %{contextTelemetry.usagePercent}
                  </span>
                </div>

                {/* Görsel Segment Bar + 70% Eşik Çizgisi */}
                <div className="relative mt-2 h-2.5 w-full rounded-full bg-[#181c2b] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      contextTelemetry.usagePercent >= 70
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                        : contextTelemetry.usagePercent > 40
                        ? 'bg-gradient-to-r from-emerald-500 to-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                        : 'bg-gradient-to-r from-blue-500 to-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(3, contextTelemetry.usagePercent))}%` }}
                  />
                  {/* %70 Eşik Göstergesi */}
                  <div
                    className="absolute top-0 bottom-0 w-[2px] bg-rose-400/80 pointer-events-none"
                    style={{ left: '70%' }}
                    title="Otomatik Sıkıştırma Eşiği (%70)"
                  />
                </div>
                <div className="relative mt-1 flex justify-between text-[8px] text-gray-500 font-mono">
                  <span>0</span>
                  <span className="absolute left-[70%] -translate-x-1/2 text-rose-400/90 font-medium">
                    %70 Eşik
                  </span>
                  <span>{formatTokenCount(contextTelemetry.maxTokens)}</span>
                </div>
              </div>

              {/* Dağılım Kartları (2x2 Grid) */}
              <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                {/* 1. Sistem & Donanım */}
                <div className="rounded-lg border border-white/[0.04] bg-[#121622] p-2">
                  <div className="flex items-center gap-1 text-gray-400">
                    <CpuIcon className="h-2.5 w-2.5 text-[#93a5fb] shrink-0" />
                    <span className="text-[9.5px] font-medium text-gray-300 truncate">Sistem & RAG</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] font-semibold text-gray-200">
                    ~{formatTokenCount(contextTelemetry.systemTokens)}
                  </div>
                  <div className="text-[8.5px] text-gray-500 truncate">Sistem promptu & kart</div>
                </div>

                {/* 2. Aktif Kod */}
                <div className="rounded-lg border border-white/[0.04] bg-[#121622] p-2">
                  <div className="flex items-center gap-1 text-gray-400">
                    <CodeIcon className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                    <span className="text-[9.5px] font-medium text-gray-300 truncate">Aktif Sketch</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] font-semibold text-gray-200">
                    ~{formatTokenCount(contextTelemetry.codeTokens)}
                  </div>
                  <div className="text-[8.5px] text-gray-500 truncate">
                    {contextTelemetry.activeFileName || 'Dosya açık değil'}
                  </div>
                </div>

                {/* 3. Sohbet Geçmişi */}
                <div className="rounded-lg border border-white/[0.04] bg-[#121622] p-2">
                  <div className="flex items-center gap-1 text-gray-400">
                    <MessageSquareIcon className="h-2.5 w-2.5 text-purple-400 shrink-0" />
                    <span className="text-[9.5px] font-medium text-gray-300 truncate">Sohbet Geçmişi</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] font-semibold text-gray-200">
                    ~{formatTokenCount(contextTelemetry.messagesTokens)}
                  </div>
                  <div className="text-[8.5px] text-gray-500 truncate">
                    {mesajlar.length} mesaj {contextTelemetry.isCompactionActive && `(Ham: ~${formatTokenCount(contextTelemetry.rawMessagesTokens)})`}
                  </div>
                </div>

                {/* 4. Model Limiti */}
                <div className="rounded-lg border border-white/[0.04] bg-[#121622] p-2">
                  <div className="flex items-center gap-1 text-gray-400">
                    <LayersIcon className="h-2.5 w-2.5 text-amber-400 shrink-0" />
                    <span className="text-[9.5px] font-medium text-gray-300 truncate">Model Penceresi</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] font-semibold text-gray-200">
                    {formatTokenCount(contextTelemetry.maxTokens)}
                  </div>
                  <div className="text-[8.5px] text-gray-500 truncate">
                    {secilenSaglayici.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Sıkıştırma Politikası ve Manuel Tetikleme Butonu */}
              <div className="mt-2.5 rounded-lg border border-white/[0.05] bg-black/30 p-2 text-[9.5px]">
                <div className="flex items-start gap-1.5">
                  <InfoIcon className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed text-gray-400 text-[9px]">
                    Bağlam doluluğu <span className="text-gray-300 font-medium">%70</span> eşiğine ulaştığında veya siz aşağıdaki butona bastığınızda, eski mesajlar yapay zekâ ile teknik bir hafıza özetine dönüştürülür.
                  </p>
                </div>

                {/* Bildirim / Toast */}
                {compactionToast && (
                  <div className="mt-2 rounded border border-[#3b82f6]/30 bg-[#3b82f6]/10 px-2 py-1.5 text-[9.5px] text-[#c4b5fd]">
                    {compactionToast}
                  </div>
                )}

                {/* Buton Alanı */}
                <div className="mt-2 pt-2 border-t border-white/[0.04]">
                  {contextTelemetry.isAutoTriggered && (
                    <div className="mb-2 flex items-center justify-center gap-1.5 rounded-md border border-rose-800/40 bg-rose-950/20 py-1.5 text-[9.5px] font-medium text-rose-300">
                      <ShieldCheckIcon className="h-3 w-3 text-rose-400" />
                      <span>%70 Eşik Aşıldı: Otomatik Sıkıştırma Devrede</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleManualCompaction()}
                    disabled={isCompacting || yaziyor || mesajlar.length <= 4}
                    title={mesajlar.length <= 4 ? 'Sohbet geçmişi henüz kısa (4 mesaj veya daha az)' : 'Geçmişi AI ile özetle ve bağlamı ferahlat'}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[#3b82f6]/40 bg-[#3b82f6]/15 py-1.5 text-[10px] font-medium text-[#93a5fb] hover:bg-[#3b82f6]/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isCompacting ? (
                      <>
                        <div className="h-3 w-3 animate-spin rounded-full border border-[#93a5fb] border-t-transparent" />
                        <span>AI ile Özetleniyor...</span>
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="h-3 w-3 text-[#93a5fb]" />
                        <span>Bağlamı Optimize Et (AI ile Özetle)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Gövde Alanı ── */}
      {gecmisAcik ? (
        <DretAIGecmisListesi
          sketchName={aktifSketch?.name ?? 'Proje'}
          oturumlar={filtrelenmisOturumlar}
          aktifOturumId={aktifOturum?.id}
          aramaMetni={aramaMetni}
          onAramaChange={setAramaMetni}
          onOturumSec={oturumSec}
          onOturumSil={oturumSil}
          onYeniSohbet={yeniSohbetBaslat}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {!aktifSketch ? (
            <DretAIProjeYok onOpenSketch={openSketchDialog} onNewSketch={newSketch} />
          ) : mesajlar.length === 0 ? (
            <DretAIHosgeldin
              sketchName={aktifSketch.name}
              onOneriSec={(oneri) => {
                setGirdi(oneri)
                requestAnimationFrame(() => girdiRef.current?.focus())
              }}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {aktifOturum && (
                <div className="flex items-center justify-between border-b border-panel-border/50 pb-2 text-[10.5px] text-gray-500">
                  <span className="truncate font-medium text-gray-400">{aktifOturum.baslik}</span>
                  <span className="shrink-0">{tarihBicimlendir(aktifOturum.olusturmaTarihi)}</span>
                </div>
              )}
              {mesajlar.map((m) => (
                <MesajBalonu
                  key={m.id}
                  mesaj={m}
                  onRevealLine={(satir) => {
                    const aktifSekme =
                      state.sketch.tabs.find((t) => ayniDosyaMi(t.path, state.sketch.activeTabPath ?? '')) ||
                      state.sketch.tabs[0]
                    if (aktifSekme) {
                      void requestReveal(aktifSekme.path, satir)
                    }
                  }}
                  onOpenFile={(fileName) => {
                    const cleanName = fileName.replace(/^[\\/]+/, '').toLowerCase()
                    const f = state.sketch.info?.files.find(
                      (file) =>
                        file.name.toLowerCase() === cleanName ||
                        file.name.toLowerCase() === cleanName + '.ino'
                    )
                    if (f) {
                      void openFileInTab(f.path, f.name, f.isMainFile)
                    }
                  }}
                />
              ))}
              {yaziyor && (
                <CanliYaziyorAlani
                  streamingText={streamingText}
                  streamingReasoning={streamingReasoning}
                  reasoningEffort={reasoningEffort}
                />
              )}
              <div ref={listeSonuRef} />
            </div>
          )}
        </div>
      )}

      {/* ── Alt Giriş Alanı: Daima görünür ve her koşulda yazılabilir ── */}
      <div className="shrink-0 border-t border-panel-border p-2.5">
        {ekliKod && (
          <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-[#3b82f6]/25 bg-gradient-to-r from-[#3b82f6]/10 via-[#8b5cf6]/10 to-[#3b82f6]/10 px-2.5 py-1.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-black/30 text-[#93a5fb]">
              <CodeIcon />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-medium text-[#c4b5fd]">
                Seçili kod eklendi · {ekliKod.split('\n').length} satır
              </div>
              <div className="truncate font-mono text-[10.5px] text-gray-500">{ekliKod.trim().split('\n')[0]}</div>
            </div>
            <button
              onClick={() => setEkliKod(null)}
              title="Eklenen kodu kaldır"
              className="shrink-0 text-gray-500 hover:text-gray-200"
            >
              <CloseIcon />
            </button>
          </div>
        )}

        {/* Birleşik Chat Giriş Kutusu */}
        <div
          onClick={() => girdiRef.current?.focus()}
          className="flex flex-col rounded-xl border border-panel-border bg-panel p-2 focus-within:border-[#3b82f6]/60 focus-within:ring-1 focus-within:ring-[#3b82f6]/25 transition-all shadow-sm cursor-text"
        >
          <textarea
            ref={girdiRef}
            value={girdi}
            onChange={(e) => setGirdi(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && yaziyor) {
                e.preventDefault()
                setYaziyor(false)
                setStreamingText('')
                setStreamingReasoning('')
                currentStreamIdRef.current = null
                pendingAgentActionRef.current = null
                return
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (!yaziyor) void gonder()
              }
            }}
            placeholder={
              !aktifSketch
                ? 'İstediğin projeyi tarif et, otomatik oluşturulsun...'
                : ekliKod
                ? 'Bu kod hakkında ne yapmak istersin?'
                : 'Hayalindeki özelliği anlat...'
            }
            rows={2}
            className="max-h-40 min-h-[36px] w-full resize-none bg-transparent text-xs text-gray-200 outline-none placeholder:text-gray-500"
          />

          {/* Alt Araç Çubuğu: Sol tarafta sürüklenebilir kompakt switch, sağ tarafta gönder/durdur butonu */}
          <div className="mt-1.5 flex items-center justify-between pt-1 border-t border-white/[0.04]">
            <ReasoningLevelSwitch
              value={reasoningEffort}
              onChange={(newEffort) => {
                setReasoningEffort(newEffort)
                void window.api.settings.set('selectedReasoningEffort', newEffort)
              }}
              disabled={yaziyor}
            />

            {yaziyor ? (
              <button
                onClick={() => {
                  setYaziyor(false)
                  setStreamingText('')
                  setStreamingReasoning('')
                  currentStreamIdRef.current = null
                  pendingAgentActionRef.current = null
                }}
                title="İşlemi durdur / Giriş kutusunu sıfırla (Esc)"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-600/80 text-white transition-opacity hover:bg-rose-500 hover:shadow-md"
              >
                <StopIcon />
              </button>
            ) : (
              <button
                onClick={() => void gonder()}
                disabled={(!girdi.trim() && !ekliKod) || yaziyor}
                title="Gönder (Enter)"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] text-white transition-opacity disabled:opacity-30 hover:shadow-md"
              >
                <ArrowUpIcon />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── RAG ve Donanım Becerileri Yönetim Modalı ── */}
      <RagSkillsModal
        isOpen={isSkillsModalOpen}
        onClose={() => setIsSkillsModalOpen(false)}
        activeBoardContext={
          aktifKart
            ? { name: aktifKart.name, fqbn: aktifKart.fqbn, platformName: aktifKart.platformName }
            : state.arduinoCli.selectedFqbn
            ? { fqbn: state.arduinoCli.selectedFqbn }
            : undefined
        }
      />
    </aside>
  )
}

/**
 * Geçmiş Sohbetler Listesi Görünümü
 */
function DretAIGecmisListesi({
  sketchName,
  oturumlar,
  aktifOturumId,
  aramaMetni,
  onAramaChange,
  onOturumSec,
  onOturumSil,
  onYeniSohbet
}: {
  sketchName: string
  oturumlar: ChatSessionSummary[]
  aktifOturumId?: string
  aramaMetni: string
  onAramaChange: (text: string) => void
  onOturumSec: (id: string) => void
  onOturumSil: (e: React.MouseEvent, id: string) => void
  onYeniSohbet: () => void
}): ReactElement {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-gray-200">Geçmiş Sohbetler</h3>
          <p className="text-[10px] text-gray-500">{sketchName} projesine ait kayıtlar</p>
        </div>
        <button
          onClick={onYeniSohbet}
          className="flex items-center gap-1 rounded border border-[#3b82f6]/30 bg-[#3b82f6]/10 px-2 py-1 text-[11px] font-medium text-[#93a5fb] hover:bg-[#3b82f6]/20"
        >
          <PlusIcon />
          <span>Yeni</span>
        </button>
      </div>

      <div className="mb-2">
        <input
          type="text"
          value={aramaMetni}
          onChange={(e) => onAramaChange(e.target.value)}
          placeholder="Sohbetlerde ara..."
          className="w-full rounded-md border border-panel-border bg-panel px-2.5 py-1 text-xs text-gray-200 outline-none placeholder:text-gray-600 focus:border-accent"
        />
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        {oturumlar.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center text-center text-gray-500">
            <HistoryIcon className="mb-2 h-6 w-6 opacity-40" />
            <span className="text-xs">
              {aramaMetni ? 'Aramayla eşleşen sohbet bulunamadı.' : 'Henüz bu projede geçmiş sohbet yok.'}
            </span>
          </div>
        ) : (
          oturumlar.map((o) => {
            const aktif = o.id === aktifOturumId
            return (
              <div
                key={o.id}
                onClick={() => onOturumSec(o.id)}
                className={`group relative flex cursor-pointer flex-col gap-1 rounded-lg border p-2.5 transition-colors ${
                  aktif
                    ? 'border-accent/40 bg-accent/10'
                    : 'border-panel-border bg-panel/60 hover:border-gray-600 hover:bg-panel'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className={`text-xs font-medium ${aktif ? 'text-white' : 'text-gray-300'}`}>
                    {o.baslik}
                  </span>
                  <button
                    onClick={(e) => onOturumSil(e, o.id)}
                    title="Bu sohbeti sil"
                    className="shrink-0 text-gray-500 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  >
                    <TrashIcon />
                  </button>
                </div>

                {o.sonMesaj && (
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-gray-500">{o.sonMesaj}</p>
                )}

                <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                  <span>{tarihBicimlendir(o.guncellemeTarihi)}</span>
                  <span className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[9.5px]">
                    {o.mesajSayisi} mesaj
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

/**
 * Hiçbir sketch (proje) açık olmadığında gösterilen ekran
 */
function DretAIProjeYok({
  onOpenSketch,
  onNewSketch
}: {
  onOpenSketch: () => Promise<unknown>
  onNewSketch: () => Promise<unknown>
}): ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-[#3b82f6]/20 to-[#8b5cf6]/20">
        <FolderIcon className="h-6 w-6 text-[#93a5fb]" />
      </div>

      <h3 className="text-sm font-semibold text-gray-200">Açık Bir Proje Bulunamadı</h3>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-gray-500">
        Cloud AI sohbet geçmişi ve oturumları açılan projeye (sketch) özel saklanır. Sohbet başlatmak veya geçmişi görmek için lütfen bir sketch açın.
      </p>

      <div className="mt-4 flex w-full flex-col gap-2">
        <button
          onClick={() => void onOpenSketch()}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-panel-border bg-panel py-2 text-xs font-medium text-gray-300 transition-colors hover:border-[#3b82f6]/50 hover:bg-[#3b82f6]/10 hover:text-white"
        >
          <FolderOpenIcon />
          <span>Mevcut Sketch Aç (Ctrl+O)</span>
        </button>

        <button
          onClick={() => void onNewSketch()}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-panel-border bg-panel py-2 text-xs font-medium text-gray-300 transition-colors hover:border-[#3b82f6]/50 hover:bg-[#3b82f6]/10 hover:text-white"
        >
          <PlusIcon />
          <span>Yeni Sketch Oluştur (Ctrl+N)</span>
        </button>
      </div>
    </div>
  )
}

/**
 * Boş sohbet hâlinde gösterilen karşılama ekranı.
 */
function DretAIHosgeldin({
  sketchName,
  onOneriSec
}: {
  sketchName: string
  onOneriSec: (metin: string) => void
}): ReactElement {
  return (
    <div className="relative flex h-full flex-col items-center justify-center px-1 py-6 text-center">
      <div className="pointer-events-none absolute left-1/2 top-4 h-40 w-40 -translate-x-1/2 rounded-full bg-gradient-to-br from-[#3b82f6]/20 to-[#8b5cf6]/20 blur-[50px]" />

      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-[#3b82f6]/20 to-[#8b5cf6]/20 p-2">
        <img src={cloudIcon} alt="Cloud AI" className="h-7 w-7 object-contain drop-shadow-[0_2px_8px_rgba(147,165,251,0.4)]" />
      </div>

      <h2 className="relative mt-3 bg-gradient-to-r from-[#93a5fb] via-[#c4b5fd] to-[#93a5fb] bg-clip-text text-[15px] font-semibold text-transparent">
        Hayalindekini yaz.
      </h2>

      <p className="relative mt-1 text-[11px] text-gray-400">
        <span className="font-mono text-[#c4b5fd]">{sketchName}</span> projesi için yardımcı olmaya hazır.
      </p>

      <p className="relative mt-1.5 max-w-[250px] text-[11px] leading-relaxed text-gray-500">
        Kod editöründe bir seçim yapıp <span className="text-gray-400">&quot;AI ile Düzelt&quot;</span> ya da{' '}
        <span className="text-gray-400">&quot;Prompt Gir&quot;</span>e bas, ya da aşağıya doğrudan yaz.
      </p>

      <div className="relative mt-4 flex w-full flex-col gap-1.5">
        {ONERILER.map((oneri) => (
          <button
            key={oneri}
            onClick={() => onOneriSec(oneri)}
            className="rounded-lg border border-panel-border bg-panel px-2.5 py-1.5 text-left text-[11px] text-gray-400 transition-colors hover:border-[#3b82f6]/40 hover:text-gray-200"
          >
            {oneri}
          </button>
        ))}
      </div>
    </div>
  )
}

function AgentEylemKarti({
  action,
  onReveal,
  onOpenFile
}: {
  action: NonNullable<ChatMessage['agentAction']>
  onReveal?: (line: number) => void
  onOpenFile?: (fileName: string) => void
}): ReactElement {
  const isCreateFile = action.type === 'create_file' || Boolean(action.filename && action.type !== 'replace_file')
  const hedefDosya = action.rename || action.filename

  return (
    <div
      className={`my-2 overflow-hidden rounded-xl border p-2.5 shadow-md transition-all ${
        action.rename
          ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-blue-500/5'
          : isCreateFile
          ? 'border-indigo-500/40 bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-blue-500/5'
          : 'border-[#8b5cf6]/35 bg-gradient-to-br from-[#3b82f6]/10 via-[#8b5cf6]/15 to-[#3b82f6]/5'
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[#8b5cf6]/30 bg-panel p-0.5 shadow-sm">
            <img src={cloudIcon} alt="Cloud AI" className="h-full w-full object-contain" />
          </span>
          <span className="text-[11px] font-semibold text-white truncate">
            {action.rename
              ? 'Dosya Yeniden Adlandırıldı & Güncellendi'
              : isCreateFile
              ? 'Yeni Dosya Oluşturuldu'
              : 'Agent Editöre Uyguladı'}
          </span>
          {action.filename && !action.rename && (
            <span className="shrink-0 rounded bg-indigo-500/25 px-1.5 py-0.5 font-mono text-[10px] font-medium text-indigo-200 border border-indigo-500/40">
              {action.filename}
            </span>
          )}
          {action.rename && (
            <span className="shrink-0 flex items-center gap-1 rounded bg-amber-500/25 px-1.5 py-0.5 font-mono text-[10px] font-medium text-amber-200 border border-amber-500/40">
              <span>➜</span>
              <span>{action.rename}</span>
            </span>
          )}
        </div>
        <span className="shrink-0 flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9.5px] font-medium text-emerald-300 border border-emerald-500/30">
          <CheckSmallIcon className="h-2.5 w-2.5" />
          <span>{action.applied ? 'Uygulandı' : 'Hazırlandı'}</span>
        </span>
      </div>

      <p className="mt-1.5 text-[11.5px] font-medium text-gray-200 leading-snug">
        {action.summary}
      </p>

      <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-gray-300">
            {action.linesCount} satır
          </span>
          {action.targetRange && (
            <span className="font-mono text-[#c4b5fd]">
              Satır {action.targetRange.startLine}–{action.targetRange.endLine}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {hedefDosya && onOpenFile && (
            <button
              onClick={() => onOpenFile(hedefDosya)}
              className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                action.rename
                  ? 'border-amber-500/30 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 hover:text-white'
                  : 'border-indigo-500/30 bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30 hover:text-white'
              }`}
            >
              <span>Dosyayı Aç</span>
              <ArrowRightSmallIcon />
            </button>
          )}

          {action.targetRange && onReveal && (
            <button
              onClick={() => onReveal(action.targetRange!.startLine)}
              className="flex items-center gap-1 rounded border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-gray-200 transition-colors hover:bg-white/10 hover:text-white"
            >
              <span>Editörde Göster</span>
              <ArrowRightSmallIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function MesajBalonu({
  mesaj,
  onRevealLine,
  onOpenFile
}: {
  mesaj: ChatMessage
  onRevealLine?: (satir: number) => void
  onOpenFile?: (fileName: string) => void
}): ReactElement {
  const kullanici = mesaj.rol === 'kullanici'
  const isError =
    !kullanici &&
    Boolean(
      mesaj.isError ||
        mesaj.metin.startsWith('Hata: ') ||
        mesaj.metin.startsWith('Bağlantı hatası: ')
    )

  if (isError) {
    const errorText = mesaj.metin.replace(/^(Hata:\s*|Bağlantı hatası:\s*)/, '')
    return (
      <div className="flex justify-start">
        <div className="max-w-[92%] rounded-xl border border-red-800/60 bg-red-950/40 p-3 text-[12px] leading-relaxed text-red-200 shadow-lg">
          <div className="flex items-start gap-2">
            <AlertTriangleIcon className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">{errorText}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isSummary = !kullanici && Boolean(mesaj.isCompactedSummary)
  return (
    <div className={`flex ${kullanici ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
          kullanici
            ? 'border border-[#3b82f6]/40 bg-[#3b82f6]/20 text-gray-100 shadow-sm'
            : isSummary
            ? 'border border-purple-500/40 bg-gradient-to-br from-purple-950/30 via-panel to-blue-950/30 text-gray-200 shadow-md ring-1 ring-purple-500/20'
            : 'border border-panel-border bg-panel text-gray-200 shadow-md'
        }`}
      >
        {kullanici ? (
          <span className="whitespace-pre-wrap">{mesaj.metin}</span>
        ) : (
          <>
            {isSummary && (
              <div className="mb-2 flex items-center gap-1.5 border-b border-purple-500/20 pb-1 text-[10px] font-medium text-purple-300">
                <BrainIcon className="h-3 w-3 text-purple-400" />
                <span>AI Bağlam ve Hafıza Özeti</span>
              </div>
            )}
            <MarkdownRenderer content={mesaj.metin} />
            {mesaj.agentActions && mesaj.agentActions.length > 0 ? (
              mesaj.agentActions.map((act, idx) => (
                <AgentEylemKarti
                  key={idx}
                  action={act}
                  onReveal={onRevealLine}
                  onOpenFile={onOpenFile}
                />
              ))
            ) : mesaj.agentAction ? (
              <AgentEylemKarti
                action={mesaj.agentAction}
                onReveal={onRevealLine}
                onOpenFile={onOpenFile}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

function CpuIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M15 2v2M9 2v2M15 20v2M9 20v2M2 15h2M2 9h2M20 15h2M20 9h2" />
    </svg>
  )
}

function ArrowRightSmallIcon(): ReactElement {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

interface CanliYaziyorAlaniProps {
  streamingText: string
  streamingReasoning: string
  reasoningEffort: ReasoningEffort
}

function CanliYaziyorAlani({
  streamingText,
  streamingReasoning,
  reasoningEffort
}: CanliYaziyorAlaniProps): ReactElement {
  // Eğer henüz metin gelmediyse: Gelişmiş Düşünme / Muhakeme Işıltılı Kartı
  if (!streamingText) {
    const reasoningTitle =
      reasoningEffort === 'high'
        ? 'Derin Mimari Muhakeme Yapılıyor...'
        : reasoningEffort === 'low'
        ? 'Hızlı Yanıt Hazırlanıyor...'
        : 'Muhakeme Ediliyor ve Kod İnceleniyor...'

    return (
      <div className="flex justify-start animate-in fade-in duration-200">
        <div className="relative max-w-[95%] overflow-hidden rounded-2xl border border-[#3b82f6]/30 bg-gradient-to-br from-[#3b82f6]/10 via-[#8b5cf6]/15 to-[#3b82f6]/5 p-3 shadow-lg">
          <div className="pointer-events-none absolute -inset-x-full top-0 h-full w-[200%] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent animate-pulse" />

          <div className="flex items-center gap-2.5">
            <span className="relative flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-[#3b82f6]/30 to-[#8b5cf6]/30 p-1">
              <img src={cloudIcon} alt="Cloud AI" className="h-full w-full object-contain animate-pulse" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white tracking-wide">{reasoningTitle}</span>
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#93a5fb] animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-[#c4b5fd] animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-[#93a5fb] animate-bounce" />
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-gray-400">
                multilingual-e5-small RAG ve donanım becerileri doğrulanıyor
              </p>
            </div>
          </div>

          {streamingReasoning && (
            <div className="mt-2.5 rounded-lg border border-white/5 bg-black/40 p-2 text-[10.5px] font-mono text-gray-400 leading-relaxed max-h-24 overflow-y-auto">
              <div className="flex items-center gap-1.5 text-[9.5px] font-semibold text-purple-300 mb-1">
                <BrainIcon className="h-3 w-3 text-purple-300" />
                <span>Düşünce Akışı:</span>
              </div>
              {streamingReasoning}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Tokenlar akarken: Canlı Markdown + Fütüristik Yanıp Sönen İmleç
  const explMatch = /<explanation>([\s\S]*)/i.exec(streamingText)
  const displayContent = explMatch
    ? explMatch[1].replace(/<\/explanation>[\s\S]*/i, '')
    : streamingText.replace(/<editor_action[\s\S]*/i, '').replace(/<\/?explanation>/gi, '')

  return (
    <div className="flex justify-start animate-in fade-in duration-100">
      <div className="max-w-[94%] rounded-xl border border-[#3b82f6]/35 bg-panel p-3 text-[12px] leading-relaxed text-gray-200 shadow-md">
        <MarkdownRenderer content={displayContent} />
        <span className="inline-block h-3.5 w-1.5 ml-1 bg-[#93a5fb] animate-pulse rounded-sm align-middle shadow-[0_0_8px_#93a5fb]" />
      </div>
    </div>
  )
}

function CloseIcon(): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

function ArrowUpIcon(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}

function StopIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  )
}


function CodeIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

function HistoryIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function FolderIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function FolderOpenIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 2h6l2 2h6a2 2 0 0 1 2 2v2H6V2z" />
      <path d="M2 10h20l-3 10H5L2 10z" />
    </svg>
  )
}

function CheckSmallIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function AlertTriangleIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function BrainIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-5.04Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-5.04Z" />
    </svg>
  )
}

function GaugeIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </svg>
  )
}

function ShieldCheckIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function CheckCircleIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
}

function LayersIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

function MessageSquareIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function InfoIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function SparklesIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  )
}

export default DretAIPanel
