import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
// main.tsx'te yüklenen daraltılmış monaco örneğiyle aynı modülü kullanır
// (bkz. main.tsx'teki not); tekrar tüm dil paketini içe aktarmaz.
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import { DEFAULT_EDITOR_FONT_SIZE, DEFAULT_EDITOR_THEME, type DerlemeHatasi } from '@shared/types'
import { satirTaramaPlani, type SatirTaramaPlani, type TaramaAdimi } from '@shared/yazimPlani'
import { useAppState } from '../../state/AppStateContext'
import cloudIcon from '../../assets/icon.png'
import { normalizeYol } from '../../utils/paths'
import { useI18n } from '../../i18n'
import AiYazimOverlay, { type AiYazimOverlayDurum } from './AiYazimOverlay'
import {
  aktifKartFqbnAyarla,
  arduinoIntelliSenseKur,
  kutuphaneSembolleriniYenile,
  projeBasliklariniAyarla
} from './arduinoIntelliSense'

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

function siddetToMonaco(tur: DerlemeHatasi['tur']): monaco.MarkerSeverity {
  if (tur === 'error') return monaco.MarkerSeverity.Error
  if (tur === 'warning') return monaco.MarkerSeverity.Warning
  return monaco.MarkerSeverity.Hint
}

function metinNormalizeEt(metin: string): string {
  return metin.replace(/\r\n/g, '\n')
}

interface ZamanliTaramaAdimi {
  adim: TaramaAdimi
  basSureMs: number
  sureMs: number
  girinti: number
}

function zamanliTaramaAdimlariOlustur(plan: SatirTaramaPlani): {
  adimlar: ZamanliTaramaAdimi[]
  toplamSureMs: number
} {
  const hedefSureMs = Math.min(
    2800,
    Math.max(600, 380 + plan.degisenSatirSayisi * 42 + plan.eklenenVeyaDegisenKarakter * 0.45)
  )
  const agirliklar: number[] = []
  let ardisikGec = 0
  let toplamAgirlik = 0

  for (const adim of plan.adimlar) {
    let agirlik = 0
    if (adim.tur === 'gec') {
      ardisikGec += 1
      agirlik = ardisikGec > 12 ? 0.04 : 0.16
    } else if (adim.tur === 'sil') {
      ardisikGec = 0
      agirlik = 0.32
    } else {
      ardisikGec = 0
      const icerikUzunlugu = adim.yeni.trimStart().length
      agirlik = icerikUzunlugu === 0 ? 0.24 : 1.0 + icerikUzunlugu * 0.045
    }
    agirliklar.push(agirlik)
    toplamAgirlik += agirlik
  }

  const payda = toplamAgirlik > 0 ? toplamAgirlik : 1
  const zamanli: ZamanliTaramaAdimi[] = []
  let birikenMs = 0

  for (let i = 0; i < plan.adimlar.length; i++) {
    const adim = plan.adimlar[i]
    const sureMs = (agirliklar[i] / payda) * hedefSureMs
    let girinti = 0
    if (adim.tur === 'degistir' || adim.tur === 'ekle') {
      const eslesme = adim.yeni.match(/^[ \t]*/)
      girinti = eslesme ? eslesme[0].length : 0
    }
    zamanli.push({ adim, basSureMs: birikenMs, sureMs, girinti })
    birikenMs += sureMs
  }

  return { adimlar: zamanli, toplamSureMs: birikenMs }
}

function planDegisenHedefSatirlari(plan: SatirTaramaPlani): Set<number> {
  const satirlar = new Set<number>()
  let satirNo = plan.baslangicSatiri
  for (const adim of plan.adimlar) {
    if (adim.tur === 'gec') {
      satirNo++
    } else if (adim.tur === 'degistir' || adim.tur === 'ekle') {
      satirlar.add(satirNo)
      satirNo++
    }
  }
  return satirlar
}

function satirAraliklari(satirlar: Set<number>, maxSatir: number): Array<{ bas: number; son: number }> {
  const sirali = [...satirlar].filter((s) => s >= 1 && s <= maxSatir).sort((a, b) => a - b)
  const araliklar: Array<{ bas: number; son: number }> = []
  for (const s of sirali) {
    const sonAralik = araliklar[araliklar.length - 1]
    if (sonAralik && s === sonAralik.son + 1) {
      sonAralik.son = s
    } else {
      araliklar.push({ bas: s, son: s })
    }
  }
  return araliklar
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
    setAiDiffWritingFinished,
    aiYazimBitti
  } = useAppState()
  const { dil, t } = useI18n()
  const yazim =
    state.aiYazim && normalizeYol(state.aiYazim.filePath) === normalizeYol(filePath) ? state.aiYazim : null
  const yazimId = yazim?.id ?? null
  const yazimRef = useRef(yazim)
  yazimRef.current = yazim
  const fontSize = state.settings?.editorFontSize ?? DEFAULT_EDITOR_FONT_SIZE
  const theme = state.settings?.editorTheme ?? DEFAULT_EDITOR_THEME
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const decorationsRef = useRef<string[]>([])
  const errorsRef = useRef(errors)
  errorsRef.current = errors
  const [secim, setSecim] = useState<SecimBilgisi | null>(null)
  const [overlayDurum, setOverlayDurum] = useState<AiYazimOverlayDurum>('bosta')
  const [overlayToplam, setOverlayToplam] = useState(0)

  const bitisTemizleRef = useRef<number | null>(null)
  const hudKapatRef = useRef<number | null>(null)
  const yazimAtlaRef = useRef<(() => void) | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const beamRef = useRef<HTMLDivElement>(null)
  const caretRef = useRef<HTMLDivElement>(null)
  const progressFillRef = useRef<HTMLDivElement>(null)
  const sayacRef = useRef<HTMLSpanElement>(null)

  const aiReview = state.aiDiffReview
  const aiReviewRef = useRef(aiReview)
  aiReviewRef.current = aiReview
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const setAiDiffWritingFinishedRef = useRef(setAiDiffWritingFinished)
  setAiDiffWritingFinishedRef.current = setAiDiffWritingFinished
  const buDosyaAktifReview = Boolean(
    aiReview && normalizeYol(aiReview.filePath) === normalizeYol(filePath)
  )

  const yazimAtla = useCallback(() => {
    yazimAtlaRef.current?.()
  }, [])

  useEffect(() => {
    return () => {
      if (bitisTemizleRef.current !== null) window.clearTimeout(bitisTemizleRef.current)
      if (hudKapatRef.current !== null) window.clearTimeout(hudKapatRef.current)
    }
  }, [])

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
    arduinoIntelliSenseKur()
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
    askDretAi(secim.metin, t('Bu kodu düzelt'), {
      filePath,
      startLine: secim.startLine,
      endLine: secim.endLine,
      startColumn: secim.startColumn,
      endColumn: secim.endColumn
    })
    setSecim(null)
  }

  /** Seçili kodu satır satır, başlangıç seviyesine uygun anlatması için asistana gönderir */
  const kodAciklat = (): void => {
    if (!secim) return
    askDretAi(
      secim.metin,
      dil === 'en'
        ? 'Explain this code line by line so that someone new to programming can understand it, in English. First say what it does in one sentence, then explain every important line (pin, function, variable). Do not change the code.'
        : 'Bu kodu satır satır, programlamaya yeni başlayan biri anlayacak şekilde Türkçe açıkla. Önce tek cümleyle ne yaptığını söyle, sonra her önemli satırı (pin, fonksiyon, değişken) anlat. Kodu değiştirme.',
      {
        filePath,
        startLine: secim.startLine,
        endLine: secim.endLine,
        startColumn: secim.startColumn,
        endColumn: secim.endColumn
      }
    )
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

  // ── AI Tarafından Kod Düzenlendiğinde: İnceleme Akışı ──
  useEffect(() => {
    const aktifReview = aiReviewRef.current
    if (!buDosyaAktifReview || !aktifReview?.isWriting) return
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!editor || !model) return

    let iptal = false
    const hedefKod = aktifReview.newCode.trim()
    const hedefSatirlar = hedefKod.split('\n')
    const totalLines = hedefSatirlar.length

    const targetRange = aktifReview.targetRange
    const orijinalSatirlar = aktifReview.originalContent.split('\n')

    let currentLine = 0
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

      onChangeRef.current(yeniIcerik)

      const currentTotalLines = model.getLineCount()
      const safeEndLine = Math.min(highlightEnd, currentTotalLines)
      const maxCol = model.getLineMaxColumn(safeEndLine)

      const yeniDekorasyonlar: monaco.editor.IModelDeltaDecoration[] = [
        {
          range: new monaco.Range(highlightStart, 1, safeEndLine, maxCol),
          options: {
            isWholeLine: true,
            className: 'ai-stream-block',
            linesDecorationsClassName: 'ai-rail-block',
            overviewRuler: {
              color: '#38bdf8',
              position: monaco.editor.OverviewRulerLane.Full
            }
          }
        },
        {
          range: new monaco.Range(safeEndLine, 1, safeEndLine, maxCol),
          options: {
            isWholeLine: true,
            className: 'ai-stream-line-active',
            linesDecorationsClassName: 'ai-rail-active'
          }
        }
      ]

      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, yeniDekorasyonlar)
      editor.revealLine(safeEndLine)

      if (suAnkiSatirSayisi >= totalLines) {
        clearInterval(timer)
        setAiDiffWritingFinishedRef.current()

        const shimmerMaxCol = model.getLineMaxColumn(safeEndLine)
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
          {
            range: new monaco.Range(highlightStart, 1, safeEndLine, shimmerMaxCol),
            options: {
              isWholeLine: true,
              className: 'ai-stream-done-fade',
              linesDecorationsClassName: 'ai-rail-done',
              overviewRuler: {
                color: '#34d399',
                position: monaco.editor.OverviewRulerLane.Full
              }
            }
          }
        ])

        setTimeout(() => {
          if (!iptal && editorRef.current) {
            decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, [
              {
                range: new monaco.Range(highlightStart, 1, safeEndLine, shimmerMaxCol),
                options: {
                  isWholeLine: true,
                  className: 'ai-stream-block',
                  linesDecorationsClassName: 'ai-rail-block'
                }
              }
            ])
          }
        }, 1600)
      }
    }, intervalMs)

    return () => {
      iptal = true
      clearInterval(timer)
    }
  }, [buDosyaAktifReview, aiReview?.isWriting])

  // ── Ajanın yazdığı kod: Cloud Stream optik satır tarama & fosfor izli akış ──
  useEffect(() => {
    const aktifYazim = yazimRef.current
    if (!aktifYazim) return

    if (bitisTemizleRef.current !== null) {
      window.clearTimeout(bitisTemizleRef.current)
      bitisTemizleRef.current = null
    }
    if (hudKapatRef.current !== null) {
      window.clearTimeout(hudKapatRef.current)
      hudKapatRef.current = null
    }

    const editor = editorRef.current
    const model = editor?.getModel()
    const { id, onceki, hedef } = aktifYazim
    if (!editor || !model || metinNormalizeEt(model.getValue()) !== metinNormalizeEt(onceki)) {
      if (model && !model.isDisposed() && model.getValue() !== hedef) {
        model.setValue(hedef)
      }
      setOverlayDurum('bosta')
      aiYazimBitti(id)
      return
    }

    const plan = satirTaramaPlani(onceki, hedef)
    if (plan.adimlar.length === 0) {
      if (model.getValue() !== hedef) model.setValue(hedef)
      setOverlayDurum('bosta')
      aiYazimBitti(id)
      return
    }

    const { adimlar: zamanliAdimlar, toplamSureMs } = zamanliTaramaAdimlariOlustur(plan)
    const eol = model.getEOL()
    let iptal = false
    let tamamlandi = false
    let kare = 0

    let adimIndeks = 0
    let imlecSatir = plan.baslangicSatiri
    let adimBaslatildi = false
    let yazilanKarakter = 0
    let degisenTamamlanan = 0
    let sonDekorasyonAnahtari = ''
    let sonAcilanSatir = -1
    const izSatirlari: number[] = []

    let aktifSatir = plan.baslangicSatiri
    let aktifSutun = 1
    let aktifImlecGoster = false
    let aktifTur: TaramaAdimi['tur'] = zamanliAdimlar[0].adim.tur
    let sonIlerleme = 0

    setOverlayToplam(plan.degisenSatirSayisi)
    setOverlayDurum('yaziyor')

    const izEkle = (satir: number): void => {
      const mevcutIdx = izSatirlari.indexOf(satir)
      if (mevcutIdx !== -1) izSatirlari.splice(mevcutIdx, 1)
      izSatirlari.push(satir)
      if (izSatirlari.length > 5) izSatirlari.shift()
    }

    const satirDegistir = (satir: number, metin: string): void => {
      const guvenliSatir = Math.min(Math.max(1, satir), model.getLineCount())
      const maxCol = model.getLineMaxColumn(guvenliSatir)
      model.applyEdits([
        { range: new monaco.Range(guvenliSatir, 1, guvenliSatir, maxCol), text: metin }
      ])
    }

    const satirSonunaEkle = (satir: number, parca: string): void => {
      if (!parca) return
      const guvenliSatir = Math.min(Math.max(1, satir), model.getLineCount())
      const col = model.getLineMaxColumn(guvenliSatir)
      model.applyEdits([
        { range: new monaco.Range(guvenliSatir, col, guvenliSatir, col), text: parca }
      ])
    }

    const yeniSatirAc = (satir: number, baslangicMetin: string): void => {
      const toplamSatir = model.getLineCount()
      if (satir <= toplamSatir) {
        model.applyEdits([
          { range: new monaco.Range(satir, 1, satir, 1), text: baslangicMetin + eol }
        ])
      } else {
        const sonSatir = Math.max(1, toplamSatir)
        const col = model.getLineMaxColumn(sonSatir)
        model.applyEdits([
          { range: new monaco.Range(sonSatir, col, sonSatir, col), text: eol + baslangicMetin }
        ])
      }
    }

    const satirSil = (satir: number): void => {
      const toplamSatir = model.getLineCount()
      if (toplamSatir <= 1) {
        satirDegistir(1, '')
        return
      }
      const guvenliSatir = Math.min(Math.max(1, satir), toplamSatir)
      if (guvenliSatir < toplamSatir) {
        model.applyEdits([
          { range: new monaco.Range(guvenliSatir, 1, guvenliSatir + 1, 1), text: '' }
        ])
      } else {
        const oncekiSatir = guvenliSatir - 1
        model.applyEdits([
          {
            range: new monaco.Range(
              oncekiSatir,
              model.getLineMaxColumn(oncekiSatir),
              guvenliSatir,
              model.getLineMaxColumn(guvenliSatir)
            ),
            text: ''
          }
        ])
      }
    }

    const sayacGuncelle = (): void => {
      if (sayacRef.current) {
        const guncel = Math.min(degisenTamamlanan, plan.degisenSatirSayisi)
        sayacRef.current.textContent = `${guncel} / ${plan.degisenSatirSayisi} ${t('satır')}`
      }
    }

    const overlayGuncelle = (): void => {
      if (iptal || tamamlandi || model.isDisposed()) return
      if (progressFillRef.current) {
        progressFillRef.current.style.transform = `scaleX(${sonIlerleme})`
      }
      const viewportEl = viewportRef.current
      const beamEl = beamRef.current
      const caretEl = caretRef.current
      if (!viewportEl || !beamEl || !caretEl) return

      const layout = editor.getLayoutInfo()
      viewportEl.style.left = `${layout.contentLeft}px`
      viewportEl.style.width = `${Math.max(0, layout.contentWidth)}px`
      viewportEl.style.height = `${Math.max(0, layout.height)}px`

      const maxLine = Math.max(1, model.getLineCount())
      const guvenliSatir = Math.min(Math.max(1, aktifSatir), maxLine)
      const maxCol = model.getLineMaxColumn(guvenliSatir)
      const guvenliSutun = Math.min(Math.max(1, aktifSutun), maxCol)
      const pos = editor.getScrolledVisiblePosition({
        lineNumber: guvenliSatir,
        column: guvenliSutun
      })
      if (!pos) {
        beamEl.style.opacity = '0'
        caretEl.style.opacity = '0'
        return
      }

      const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight) || pos.height || 19
      beamEl.style.opacity = '1'
      beamEl.style.transform = `translate3d(0, ${pos.top + lineHeight - 1}px, 0)`

      const caretX = pos.left - layout.contentLeft
      if (aktifImlecGoster && caretX >= -4 && caretX <= layout.contentWidth + 4) {
        caretEl.style.opacity = '1'
        caretEl.style.height = `${lineHeight}px`
        caretEl.style.transform = `translate3d(${caretX}px, ${pos.top}px, 0)`
      } else {
        caretEl.style.opacity = '0'
      }
    }

    const dekorasyonlariGuncelle = (): void => {
      const toplamSatir = model.getLineCount()
      const guvenliAktif = Math.min(Math.max(1, aktifSatir), toplamSatir)
      const dekorasyonlar: monaco.editor.IModelDeltaDecoration[] = []
      const kullanilan = new Set<number>([guvenliAktif])

      dekorasyonlar.push({
        range: new monaco.Range(guvenliAktif, 1, guvenliAktif, model.getLineMaxColumn(guvenliAktif)),
        options: {
          isWholeLine: true,
          className: aktifTur === 'sil' ? 'ai-stream-deleting' : 'ai-stream-line-active',
          linesDecorationsClassName: aktifTur === 'sil' ? 'ai-rail-delete' : 'ai-rail-active',
          overviewRuler: {
            color: '#38bdf8',
            position: monaco.editor.OverviewRulerLane.Full
          }
        }
      })

      const oncekiIzler = izSatirlari.filter((s) => s !== guvenliAktif && s >= 1 && s <= toplamSatir)
      let izMesafe = 0
      for (let idx = oncekiIzler.length - 1; idx >= 0 && izMesafe < 4; idx--) {
        const satir = oncekiIzler[idx]
        if (kullanilan.has(satir)) continue
        kullanilan.add(satir)
        izMesafe++
        dekorasyonlar.push({
          range: new monaco.Range(satir, 1, satir, model.getLineMaxColumn(satir)),
          options: {
            isWholeLine: true,
            className: `ai-stream-trail-${izMesafe}`,
            linesDecorationsClassName: izMesafe <= 3 ? `ai-rail-trail-${izMesafe}` : undefined
          }
        })
      }

      let modelSatir = imlecSatir + 1
      let bekleyenSayisi = 0
      for (let k = adimIndeks + 1; k < zamanliAdimlar.length && bekleyenSayisi < 20; k++) {
        const tur = zamanliAdimlar[k].adim.tur
        if (tur === 'degistir' || tur === 'sil') {
          if (modelSatir >= 1 && modelSatir <= toplamSatir && !kullanilan.has(modelSatir)) {
            kullanilan.add(modelSatir)
            bekleyenSayisi++
            dekorasyonlar.push({
              range: new monaco.Range(modelSatir, 1, modelSatir, model.getLineMaxColumn(modelSatir)),
              options: { isWholeLine: true, className: 'ai-stream-pending' }
            })
          }
          modelSatir++
        } else if (tur === 'gec') {
          modelSatir++
        }
      }

      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, dekorasyonlar)
    }

    const scrollDinleyici = editor.onDidScrollChange(overlayGuncelle)
    const layoutDinleyici = editor.onDidLayoutChange(overlayGuncelle)

    const temizle = (): void => {
      cancelAnimationFrame(kare)
      scrollDinleyici.dispose()
      layoutDinleyici.dispose()
      window.removeEventListener('keydown', handleEsc)
      yazimAtlaRef.current = null
    }

    const bitir = (): void => {
      if (tamamlandi || iptal) return
      tamamlandi = true
      temizle()

      if (!model.isDisposed() && model.getValue() !== hedef) {
        model.setValue(hedef)
      }

      if (editorRef.current && !model.isDisposed()) {
        const toplamSatir = model.getLineCount()
        const degisenSet = planDegisenHedefSatirlari(plan)
        const araliklar = satirAraliklari(degisenSet, toplamSatir)

        if (araliklar.length > 0) {
          const bitisDekorasyonlari: monaco.editor.IModelDeltaDecoration[] = araliklar.map((r) => ({
            range: new monaco.Range(r.bas, 1, r.son, model.getLineMaxColumn(r.son)),
            options: {
              isWholeLine: true,
              className: 'ai-stream-done-fade',
              linesDecorationsClassName: 'ai-rail-done',
              overviewRuler: {
                color: '#34d399',
                position: monaco.editor.OverviewRulerLane.Full
              }
            }
          }))
          decorationsRef.current = editorRef.current.deltaDecorations(
            decorationsRef.current,
            bitisDekorasyonlari
          )
          bitisTemizleRef.current = window.setTimeout(() => {
            bitisTemizleRef.current = null
            if (editorRef.current) {
              decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, [])
            }
          }, 1750)
        } else {
          decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, [])
        }
      }

      setOverlayDurum('tamam')
      hudKapatRef.current = window.setTimeout(() => {
        hudKapatRef.current = null
        setOverlayDurum('bosta')
      }, 1350)

      aiYazimBitti(id)
    }

    yazimAtlaRef.current = bitir

    function handleEsc(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        bitir()
      }
    }
    window.addEventListener('keydown', handleEsc)

    const baslangicMs = performance.now()

    const adim = (simdi: number): void => {
      if (iptal || tamamlandi || model.isDisposed()) return
      const gecenMs = Math.max(0, simdi - baslangicMs)
      sonIlerleme = toplamSureMs > 0 ? Math.min(1, gecenMs / toplamSureMs) : 1

      while (adimIndeks < zamanliAdimlar.length) {
        const z = zamanliAdimlar[adimIndeks]
        const bitisMs = z.basSureMs + z.sureMs
        const bittiMi = gecenMs >= bitisMs

        if (z.adim.tur === 'gec') {
          aktifSatir = imlecSatir
          aktifSutun = 1
          aktifImlecGoster = false
          aktifTur = 'gec'
          izEkle(imlecSatir)
          if (!bittiMi) break
          imlecSatir++
          adimIndeks++
          adimBaslatildi = false
          yazilanKarakter = 0
          continue
        }

        if (z.adim.tur === 'sil') {
          aktifSatir = imlecSatir
          aktifSutun = 1
          aktifImlecGoster = false
          aktifTur = 'sil'
          if (!adimBaslatildi) adimBaslatildi = true
          if (!bittiMi) break
          satirSil(imlecSatir)
          degisenTamamlanan++
          adimIndeks++
          adimBaslatildi = false
          yazilanKarakter = 0
          continue
        }

        const hedefSatir = z.adim.yeni
        aktifSatir = imlecSatir
        aktifTur = z.adim.tur

        if (!adimBaslatildi) {
          adimBaslatildi = true
          const baslangicMetni = bittiMi ? hedefSatir : hedefSatir.slice(0, z.girinti)
          if (z.adim.tur === 'degistir') {
            satirDegistir(imlecSatir, baslangicMetni)
          } else {
            yeniSatirAc(imlecSatir, baslangicMetni)
          }
          yazilanKarakter = baslangicMetni.length
          izEkle(imlecSatir)
        }

        if (bittiMi) {
          if (yazilanKarakter < hedefSatir.length) {
            satirSonunaEkle(imlecSatir, hedefSatir.slice(yazilanKarakter))
            yazilanKarakter = hedefSatir.length
          }
          aktifSutun = yazilanKarakter + 1
          aktifImlecGoster = true
          degisenTamamlanan++
          imlecSatir++
          adimIndeks++
          adimBaslatildi = false
          yazilanKarakter = 0
          continue
        }

        const oran =
          z.sureMs > 0 ? Math.min(1, Math.max(0, (gecenMs - z.basSureMs) / z.sureMs)) : 1
        const govdeUzunluk = Math.max(0, hedefSatir.length - z.girinti)
        const hedefKarakter = z.girinti + Math.round(govdeUzunluk * oran)
        if (hedefKarakter > yazilanKarakter) {
          satirSonunaEkle(imlecSatir, hedefSatir.slice(yazilanKarakter, hedefKarakter))
          yazilanKarakter = hedefKarakter
        }
        aktifSutun = yazilanKarakter + 1
        aktifImlecGoster = true
        break
      }

      sayacGuncelle()

      if (adimIndeks >= zamanliAdimlar.length) {
        bitir()
        return
      }

      const dekorasyonAnahtari = `${adimIndeks}:${aktifSatir}:${aktifTur}`
      if (sonDekorasyonAnahtari !== dekorasyonAnahtari) {
        sonDekorasyonAnahtari = dekorasyonAnahtari
        dekorasyonlariGuncelle()
      }

      if (sonAcilanSatir !== aktifSatir) {
        sonAcilanSatir = aktifSatir
        editor.revealLineInCenterIfOutsideViewport(aktifSatir, monaco.editor.ScrollType.Smooth)
      }

      overlayGuncelle()
      kare = requestAnimationFrame(adim)
    }

    kare = requestAnimationFrame(adim)

    return () => {
      iptal = true
      temizle()
      if (!tamamlandi) {
        setOverlayDurum('bosta')
        if (editorRef.current) {
          decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, [])
        }
        if (!model.isDisposed() && model.getValue() !== hedef) {
          model.setValue(hedef)
        }
      }
    }
  }, [yazimId, aiYazimBitti])

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
          className: 'ai-stream-done-fade',
          linesDecorationsClassName: 'ai-rail-done',
          overviewRuler: {
            color: '#38bdf8',
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
    }, 1800)

    return () => clearTimeout(zamanlayici)
  }, [state.editorHighlight])

  useEffect(() => {
    aktifKartFqbnAyarla(state.arduinoCli.selectedFqbn)
  }, [state.arduinoCli.selectedFqbn])

  useEffect(() => {
    const aktifSketch =
      state.sketch.workspaceSketches.find((s) => s.folderPath === state.sketch.activeSketchPath) ?? state.sketch.info
    const basliklar = (aktifSketch?.files ?? [])
      .filter((f) => f.kind === 'h' || f.kind === 'hpp')
      .map((f) => f.name)
    projeBasliklariniAyarla(basliklar)
  }, [state.sketch.workspaceSketches, state.sketch.activeSketchPath, state.sketch.info])

  useEffect(() => {
    if (state.arduinoCli.status?.found) {
      void kutuphaneSembolleriniYenile(false)
    }
  }, [state.arduinoCli.status?.found])

  useEffect(() => {
    markerlariUygula()
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

  // Dışarıdan (örneğin AI kodu uyguladığında veya dosya değiştiğinde) value prop'u
  // güncellendiğinde Monaco modelinin içeriğini senkronize et
  useEffect(() => {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!editor || !model) return
    if (yazimRef.current) return // yazım efekti içeriği kendisi akıtır
    if (model.getValue() !== value) {
      editor.executeEdits('external-sync', [
        {
          range: model.getFullModelRange(),
          text: value,
          forceMoveMarkers: true
        }
      ])
      editor.pushUndoStop()
    }
  }, [value])

  return (
    <div className="ai-editor-host relative h-full w-full overflow-hidden" data-editor-theme={theme}>
      <Editor
        path={monacoYolunaCevir(filePath)}
        language="cpp"
        theme={theme}
        value={yazim ? yazim.onceki : value}
        onChange={(v) => {
          if (yazimRef.current) return // efekt sırasındaki ara içerikler duruma yazılmaz
          onChange(v ?? '')
        }}
        onMount={handleMount}
        options={{
          fontSize,
          minimap: { enabled: true },
          automaticLayout: true,
          tabSize: 2,
          scrollBeyondLastLine: false,
          readOnly: Boolean(readOnly) || Boolean(yazim),
          quickSuggestions: { other: true, comments: false, strings: false },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          tabCompletion: 'on',
          snippetSuggestions: 'inline',
          wordBasedSuggestions: 'off',
          parameterHints: { enabled: true, cycle: true },
          hover: { enabled: true, delay: 300 },
          suggest: { preview: true, snippetsPreventQuickSuggestions: false }
        }}
      />

      <AiYazimOverlay
        durum={overlayDurum}
        toplamDegisen={overlayToplam}
        hudGoster={!buDosyaAktifReview}
        onAtla={yazimAtla}
        viewportRef={viewportRef}
        beamRef={beamRef}
        caretRef={caretRef}
        progressFillRef={progressFillRef}
        sayacRef={sayacRef}
      />

      {/* ── AI Değişiklik İnceleme Onay (✓) / Reddet (✕) Yüzen Çubuğu ── */}
      {buDosyaAktifReview && aiReview && (
        <div className="ai-diff-floating-bar absolute right-6 top-3 z-30 flex items-center gap-3 rounded-xl px-3 py-2 shadow-2xl select-none">
          <div className="flex items-center gap-2.5 border-r border-white/10 pr-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/15 p-1">
              <img src={cloudIcon} alt="Cloud AI" className="h-full w-full object-contain" />
            </span>
            <div className="flex flex-col">
              <span className="text-[11.5px] font-medium">
                {aiReview.isWriting ? t('Cloud AI Kodu Düzenliyor...') : t('Cloud AI Kodu Uygulandı')}
              </span>
              <span className="ai-stream-hud-muted text-[10px]">
                {aiReview.isWriting ? t('Ritmik akışla yazılıyor') : t('Kodu onayla veya eski haline dön')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={acceptAiDiff}
              disabled={aiReview.isWriting}
              title={t('Değişiklikleri onayla (Enter)')}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 transition-all hover:bg-emerald-500/25 hover:border-emerald-500/50 disabled:opacity-40"
            >
              <CheckIcon />
              <span>{t('Onayla')}</span>
              <kbd className="rounded bg-emerald-500/20 px-1 py-0.2 text-[9px] font-mono text-emerald-200">↵</kbd>
            </button>

            <button
              onClick={rejectAiDiff}
              disabled={aiReview.isWriting}
              title={t('Eski kodu geri getir ve iptal et (Esc)')}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-gray-300 transition-all hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-200 disabled:opacity-40"
            >
              <CancelIcon />
              <span>{t('Geri Al')}</span>
              <kbd className="rounded bg-white/10 px-1 py-0.2 text-[9px] font-mono text-gray-400">Esc</kbd>
            </button>
          </div>
        </div>
      )}

      {secim && (
        <div
          role="toolbar"
          aria-label={t('Seçili kod işlemleri')}
          className="absolute z-20 animate-in fade-in slide-in-from-bottom-1 duration-150"
          style={{ top: Math.max(6, secim.top - 52), left: Math.min(Math.max(8, secim.left - 8), window.innerWidth - 300) }}
        >
          <div className="relative flex items-center gap-1 rounded-full border border-white/10 bg-[#161923]/95 p-1 shadow-[0_10px_30px_rgba(0,0,0,0.55),0_0_0_1px_rgba(14,127,196,0.25)] backdrop-blur-md">
            <button
              onClick={aiIleDuzelt}
              title={t('Seçili kodu Cloud AI ile düzeltmeyi iste')}
              className="group flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#0e7fc4] to-[#2aa8f2] py-1.5 pl-2.5 pr-3.5 text-[12px] font-semibold text-white shadow-[0_2px_12px_rgba(14,127,196,0.55)] transition-all hover:brightness-110 hover:shadow-[0_2px_18px_rgba(14,127,196,0.7)] active:scale-[0.97]"
            >
              <FixIcon />
              {t('AI ile Düzelt')}
            </button>
            <button
              onClick={kodAciklat}
              title={t("Seçili kodun ne yaptığını Cloud AI'a açıklat")}
              className="flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-3 text-[12px] font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ExplainIcon />
              {t('Açıkla')}
            </button>
            <button
              onClick={promptGir}
              title={t("Seçili kodu Cloud AI'a gönder, kendi isteğini yaz")}
              className="flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-3 text-[12px] font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <PromptIcon />
              {t('Prompt Gir')}
            </button>
            {/* Seçime bakan küçük ok */}
            <span className="pointer-events-none absolute -bottom-1 left-6 h-2 w-2 rotate-45 border-b border-r border-white/10 bg-[#161923]" />
          </div>
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
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="drop-shadow-[0_0_4px_rgba(124,196,240,0.8)]">
      <path d="M12 2.5c.35 3.32 1.1 5.63 2.25 6.9 1.15 1.28 3.3 2.1 6.25 2.6-2.95.5-5.1 1.32-6.25 2.6-1.15 1.27-1.9 3.58-2.25 6.9-.35-3.32-1.1-5.63-2.25-6.9-1.15-1.28-3.3-2.1-6.25-2.6 2.95-.5 5.1-1.32 6.25-2.6 1.15-1.27 1.9-3.58 2.25-6.9Z" />
    </svg>
  )
}

function ExplainIcon(): ReactElement {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
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
