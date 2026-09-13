import { useEffect, useRef, useState, type ReactElement } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
// main.tsx'te yüklenen daraltılmış monaco örneğiyle aynı modülü kullanır
// (bkz. main.tsx'teki not); tekrar tüm dil paketini içe aktarmaz.
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import { DEFAULT_EDITOR_FONT_SIZE, DEFAULT_EDITOR_THEME, type DerlemeHatasi } from '@shared/types'
import { useAppState } from '../../state/AppStateContext'
import cloudIcon from '../../assets/icon.png'

interface CodeEditorProps {
  filePath: string
  value: string
  onChange: (value: string) => void
  errors: DerlemeHatasi[]
  /** Problems panelinden tıklanınca gidilmesi istenen satır (bu dosyaya aitse) */
  revealLine?: number
  onRevealed?: () => void
  /** Sketch dışından açılan (ör. kütüphane/çekirdek) dosyalar düzenlenemez */
  readOnly?: boolean
}

/** Windows ters eğik çizgili mutlak yolu, Monaco'nun model kayıt defterinde anahtar olarak kullanılabilecek geçerli bir file:// URI'sine çevirir */
function monacoYolunaCevir(osYolu: string): string {
  return `file:///${osYolu.replace(/\\/g, '/')}`
}

/** Karşılaştırma için yol biçimini sadeleştirir (ayraç yönü ve büyük/küçük harf farkını yok sayar) */
function normalizeYol(yol: string): string {
  return yol.replace(/^\//, '').replace(/\\/g, '/').toLowerCase()
}

function siddetToMonaco(tur: DerlemeHatasi['tur']): monaco.MarkerSeverity {
  if (tur === 'error') return monaco.MarkerSeverity.Error
  if (tur === 'warning') return monaco.MarkerSeverity.Warning
  return monaco.MarkerSeverity.Hint
}

interface SecimBilgisi {
  metin: string
  /** Editörün içerik alanına göre, seçimin BAŞLADIĞI noktanın piksel konumu */
  top: number
  left: number
  startLine: number
  endLine: number
  startColumn: number
  endColumn: number
}

/**
 * Monaco tabanlı kod editörü. Aynı <Editor> örneği, `path` prop'u
 * değiştirilerek sekmeler arasında geçiş yapar; Monaco her dosya için
 * ayrı bir model (ayrı undo geçmişi) tutar. Derleme hataları/uyarıları
 * bu bileşende satır altı marker olarak gösterilir.
 */
function CodeEditor({
  filePath,
  value,
  onChange,
  errors,
  revealLine,
  onRevealed,
  readOnly
}: CodeEditorProps): ReactElement {
  const {
    state,
    askDretAi,
    acceptAiDiff,
    rejectAiDiff,
    setAiDiffWritingFinished
  } = useAppState()
  const fontSize = state.settings?.editorFontSize ?? DEFAULT_EDITOR_FONT_SIZE
  const theme = state.settings?.editorTheme ?? DEFAULT_EDITOR_THEME
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const decorationsRef = useRef<string[]>([])
  const errorsRef = useRef(errors)
  errorsRef.current = errors
  const [secim, setSecim] = useState<SecimBilgisi | null>(null)

  const aiReview = state.aiDiffReview
  const buDosyaAktifReview =
    aiReview && normalizeYol(aiReview.filePath) === normalizeYol(filePath)

  const markerlariUygula = (): void => {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!model) return
    const buDosya = normalizeYol(model.uri.path)
    const ilgiliHatalar = errorsRef.current.filter((h) => normalizeYol(h.dosya) === buDosya)
    const markerlar: monaco.editor.IMarkerData[] = ilgiliHatalar.map((h) => ({
      severity: siddetToMonaco(h.tur),
      message: h.mesaj,
      startLineNumber: h.satir,
      startColumn: h.sutun || 1,
      endLineNumber: h.satir,
      endColumn: (h.sutun || 1) + 1
    }))
    monaco.editor.setModelMarkers(model, 'dret-derleme', markerlar)
  }

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor
    editor.onDidChangeModel(markerlariUygula)
    markerlariUygula()

    // Seçim değiştikçe "AI ile Düzelt"/"Prompt Gir" araç çubuğunun
    // konumunu/görünürlüğünü güncelle.
    editor.onDidChangeCursorSelection((e) => {
      const model = editor.getModel()
      if (!model || e.selection.isEmpty()) {
        setSecim(null)
        return
      }
      const metin = model.getValueInRange(e.selection)
      if (!metin.trim()) {
        setSecim(null)
        return
      }
      const konum = editor.getScrolledVisiblePosition({
        lineNumber: e.selection.startLineNumber,
        column: e.selection.startColumn
      })
      if (!konum) {
        setSecim(null)
        return
      }
      setSecim({
        metin,
        top: konum.top,
        left: konum.left,
        startLine: e.selection.startLineNumber,
        endLine: e.selection.endLineNumber,
        startColumn: e.selection.startColumn,
        endColumn: e.selection.endColumn
      })
    })
  }

  /** Seçili kodu ve satır koordinatlarını, Dret AI paneline gönderir */
  const aiIleDuzelt = (): void => {
    if (!secim) return
    askDretAi(secim.metin, 'Bu kodu düzelt', {
      filePath,
      startLine: secim.startLine,
      endLine: secim.endLine,
      startColumn: secim.startColumn,
      endColumn: secim.endColumn
    })
    setSecim(null)
  }

  /** Kodu ek olarak gönderir; kullanıcı kendi isteğini yazsın diye istem boş bırakılır */
  const promptGir = (): void => {
    if (!secim) return
    askDretAi(secim.metin, '', {
      filePath,
      startLine: secim.startLine,
      endLine: secim.endLine,
      startColumn: secim.startColumn,
      endColumn: secim.endColumn
    })
    setSecim(null)
  }

  // ── AI Tarafından Kod Düzenlendiğinde: Yeni Nesil Lazer Uçlu & Işıltılı (Shimmer) Yazım Animasyonu ──
  useEffect(() => {
    if (!buDosyaAktifReview || !aiReview?.isWriting) return
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!editor || !model) return

    let iptal = false
    const hedefKod = aiReview.newCode.trim()
    const hedefSatirlar = hedefKod.split('\n')
    const totalLines = hedefSatirlar.length

    const targetRange = aiReview.targetRange
    const orijinalSatirlar = aiReview.originalContent.split('\n')

    let currentLine = 0
    // Akıcı ve canlı ritim: ~40ms aralıkla satırlar lazer ucu eşliğinde akar
    const stepSize = totalLines > 60 ? 2 : 1
    const intervalMs = totalLines > 60 ? 32 : 42

    const timer = setInterval(() => {
      if (iptal) {
        clearInterval(timer)
        return
      }

      currentLine += stepSize
      const suAnkiSatirSayisi = Math.min(currentLine, totalLines)
      const yazilanKisim = hedefSatirlar.slice(0, suAnkiSatirSayisi).join('\n')

      let yeniIcerik = ''
      let highlightStart = 1
      let highlightEnd = suAnkiSatirSayisi

      if (targetRange && targetRange.startLine > 0 && targetRange.endLine >= targetRange.startLine) {
        const bas = orijinalSatirlar.slice(0, targetRange.startLine - 1)
        const son = orijinalSatirlar.slice(targetRange.endLine)
        yeniIcerik = [...bas, yazilanKisim, ...son].join('\n')
        highlightStart = targetRange.startLine
        highlightEnd = targetRange.startLine + suAnkiSatirSayisi - 1
      } else {
        yeniIcerik = yazilanKisim
      }

      // Editör içeriğini güncelle
      onChange(yeniIcerik)

      // İkili Lazer Dekorasyonu:
      // 1. Eklenen bloğun tamamı için zarif koyu cam diff aurası
      // 2. Anlık yazılan en uç satır için parlak siyan-indigo lazer hüzmesi
      const currentTotalLines = model.getLineCount()
      const safeEndLine = Math.min(highlightEnd, currentTotalLines)
      const maxCol = model.getLineMaxColumn(safeEndLine)

      const yeniDekorasyonlar: monaco.editor.IModelDeltaDecoration[] = [
        {
          range: new monaco.Range(highlightStart, 1, safeEndLine, maxCol),
          options: {
            isWholeLine: true,
            className: 'ai-code-block-highlight',
            marginClassName: 'ai-code-block-margin',
            overviewRuler: {
              color: '#818cf8',
              position: monaco.editor.OverviewRulerLane.Full
            }
          }
        },
        {
          range: new monaco.Range(safeEndLine, 1, safeEndLine, maxCol),
          options: {
            isWholeLine: true,
            className: 'ai-code-active-line',
            marginClassName: 'ai-code-active-margin'
          }
        }
      ]

      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, yeniDekorasyonlar)

      // Yazılan son satıra yumuşakça odaklan
      editor.revealLine(safeEndLine)

      // Yazım tamamlandı mı?
      if (suAnkiSatirSayisi >= totalLines) {
        clearInterval(timer)
        setAiDiffWritingFinished()

        // Yazım bitti: Blok üzerinden pürüzsüz tek seferlik shimmer ışık dalgası akıt
        const shimmerMaxCol = model.getLineMaxColumn(safeEndLine)
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
          {
            range: new monaco.Range(highlightStart, 1, safeEndLine, shimmerMaxCol),
            options: {
              isWholeLine: true,
              className: 'ai-code-shimmer-done',
              marginClassName: 'ai-code-block-margin',
              overviewRuler: {
                color: '#34d399',
                position: monaco.editor.OverviewRulerLane.Full
              }
            }
          }
        ])

        // 1.5 saniye sonra sakin resting (ince diff kenarlığı) durumuna geç
        setTimeout(() => {
          if (!iptal && editorRef.current) {
            decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, [
              {
                range: new monaco.Range(highlightStart, 1, safeEndLine, shimmerMaxCol),
                options: {
                  isWholeLine: true,
                  className: 'ai-code-block-highlight',
                  marginClassName: 'ai-code-block-margin'
                }
              }
            ])
          }
        }, 1500)
      }
    }, intervalMs)

    return () => {
      iptal = true
      clearInterval(timer)
    }
  }, [buDosyaAktifReview, aiReview?.isWriting])

  // Klavye ile Onay (Enter) / Reddet (Esc)
  useEffect(() => {
    if (!buDosyaAktifReview || aiReview?.isWriting) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        rejectAiDiff()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [buDosyaAktifReview, aiReview?.isWriting, rejectAiDiff])

  // Genel highlight desteği
  useEffect(() => {
    const highlight = state.editorHighlight
    if (!highlight) return
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!editor || !model) return

    const buDosya = normalizeYol(model.uri.path)
    const hedefDosya = normalizeYol(highlight.filePath)
    if (buDosya !== hedefDosya) return

    const maxCol = model.getLineMaxColumn(Math.min(highlight.endLine, model.getLineCount()))
    const newDecorations = editor.deltaDecorations(decorationsRef.current, [
      {
        range: new monaco.Range(highlight.startLine, 1, highlight.endLine, maxCol),
        options: {
          isWholeLine: true,
          className: 'ai-code-shimmer-done',
          marginClassName: 'ai-code-active-margin',
          overviewRuler: {
            color: '#818cf8',
            position: monaco.editor.OverviewRulerLane.Full
          }
        }
      }
    ])
    decorationsRef.current = newDecorations
    editor.revealLinesInCenter(highlight.startLine, highlight.endLine)

    const zamanlayici = setTimeout(() => {
      if (editorRef.current) {
        decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, [])
      }
    }, 4500)

    return () => clearTimeout(zamanlayici)
  }, [state.editorHighlight])

  useEffect(() => {
    markerlariUygula()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors, filePath])

  useEffect(() => {
    if (revealLine == null) return
    const editor = editorRef.current
    if (!editor) return
    editor.revealLineInCenter(revealLine)
    editor.setPosition({ lineNumber: revealLine, column: 1 })
    editor.focus()
    onRevealed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealLine])

  return (
    <div className="relative h-full w-full">
      <Editor
        path={monacoYolunaCevir(filePath)}
        language="cpp"
        theme={theme}
        value={value}
        onChange={(v) => onChange(v ?? '')}
        onMount={handleMount}
        options={{
          fontSize,
          minimap: { enabled: true },
          automaticLayout: true,
          tabSize: 2,
          scrollBeyondLastLine: false,
          readOnly: Boolean(readOnly)
        }}
      />

      {/* ── AI Değişiklik İnceleme Onay (✓) / Reddet (✕) Yüzen Çubuğu ── */}
      {buDosyaAktifReview && (
        <div className="ai-diff-floating-bar absolute right-6 top-3 z-30 flex items-center gap-3 rounded-xl px-3 py-2 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300 select-none">
          <div className="flex items-center gap-2.5 border-r border-white/10 pr-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/15 p-1">
              <img src={cloudIcon} alt="Cloud AI" className="h-full w-full object-contain" />
            </span>
            <div className="flex flex-col">
              <span className="text-[11.5px] font-medium text-gray-200">
                {aiReview.isWriting ? 'Cloud AI Kodu Düzenliyor...' : 'Cloud AI Kodu Uygulandı'}
              </span>
              <span className="text-[10px] text-gray-400">
                {aiReview.isWriting ? 'Ritmik akışla yazılıyor' : 'Kodu onayla veya eski haline dön'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={acceptAiDiff}
              disabled={aiReview.isWriting}
              title="Değişiklikleri onayla (Enter)"
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 transition-all hover:bg-emerald-500/25 hover:border-emerald-500/50 disabled:opacity-40"
            >
              <CheckIcon />
              <span>Onayla</span>
              <kbd className="rounded bg-emerald-500/20 px-1 py-0.2 text-[9px] font-mono text-emerald-200">↵</kbd>
            </button>

            <button
              onClick={rejectAiDiff}
              disabled={aiReview.isWriting}
              title="Eski kodu geri getir ve iptal et (Esc)"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-gray-300 transition-all hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-200 disabled:opacity-40"
            >
              <CancelIcon />
              <span>Geri Al</span>
              <kbd className="rounded bg-white/10 px-1 py-0.2 text-[9px] font-mono text-gray-400">Esc</kbd>
            </button>
          </div>
        </div>
      )}

      {secim && (
        <div
          className="absolute z-20 flex items-center gap-1 rounded-lg border border-panel-border bg-panel-light p-1 shadow-xl"
          style={{ top: Math.max(4, secim.top - 42), left: Math.min(secim.left, window.innerWidth - 260) }}
        >
          <button
            onClick={aiIleDuzelt}
            title="Seçili kodu Cloud AI ile düzeltmeyi iste"
            className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium text-[#93a5fb] hover:bg-panel-border"
          >
            <FixIcon />
            AI ile Düzelt
          </button>
          <div className="h-4 w-px bg-panel-border" />
          <button
            onClick={promptGir}
            title="Seçili kodu Cloud AI'a gönder, kendi isteğini yaz"
            className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-panel-border"
          >
            <PromptIcon />
            Prompt Gir
          </button>
        </div>
      )}
    </div>
  )
}


function CheckIcon(): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function CancelIcon(): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function FixIcon(): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2.5c.35 3.32 1.1 5.63 2.25 6.9 1.15 1.28 3.3 2.1 6.25 2.6-2.95.5-5.1 1.32-6.25 2.6-1.15 1.27-1.9 3.58-2.25 6.9-.35-3.32-1.1-5.63-2.25-6.9-1.15-1.28-3.3-2.1-6.25-2.6 2.95-.5 5.1-1.32 6.25-2.6 1.15-1.27 1.9-3.58 2.25-6.9Z" />
    </svg>
  )
}

function PromptIcon(): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9Z" />
      <path d="M8 9h8M8 12.5h5" />
    </svg>
  )
}

export default CodeEditor
