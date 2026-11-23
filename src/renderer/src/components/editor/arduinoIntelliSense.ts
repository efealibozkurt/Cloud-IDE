import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import type { KutuphaneSembolIndeksi } from '@shared/types'
import {
  hoverBilgisiBul,
  imzaYardimiBul,
  tamamlamaOnerileriUret,
  type OneriTuru
} from '@shared/kodTamamlama'

let kuruldu = false
let aktifFqbn: string | null = null
let aktifProjeBasliklari: string[] = []
let kutuphaneIndeksi: KutuphaneSembolIndeksi | null = null
let yenilemeSozu: Promise<void> | null = null

function oneriTuruToMonaco(tur: OneriTuru): monaco.languages.CompletionItemKind {
  switch (tur) {
    case 'fonksiyon':
      return monaco.languages.CompletionItemKind.Function
    case 'metot':
      return monaco.languages.CompletionItemKind.Method
    case 'sinif':
      return monaco.languages.CompletionItemKind.Class
    case 'degisken':
      return monaco.languages.CompletionItemKind.Variable
    case 'sabit':
    case 'makro':
      return monaco.languages.CompletionItemKind.Constant
    case 'snippet':
      return monaco.languages.CompletionItemKind.Snippet
    case 'dosya':
      return monaco.languages.CompletionItemKind.File
    case 'anahtar':
      return monaco.languages.CompletionItemKind.Keyword
  }
}

export function aktifKartFqbnAyarla(fqbn: string | null): void {
  aktifFqbn = fqbn
}

export function projeBasliklariniAyarla(basliklar: string[]): void {
  aktifProjeBasliklari = [...new Set(basliklar)]
}

/** Main süreçten kurulu kütüphanelerin sembol indeksini getirip önbelleği günceller. */
export async function kutuphaneSembolleriniYenile(force = false): Promise<void> {
  if (!force && yenilemeSozu) return yenilemeSozu

  const gorev = (async () => {
    try {
      kutuphaneIndeksi = await window.api.arduinoCli.getLibrarySymbols(force)
    } catch {
      // Çevrimdışı veya arduino-cli hazır değilken editör akışı kesintiye uğramaz
    }
  })()

  yenilemeSozu = gorev
  try {
    await gorev
  } finally {
    if (yenilemeSozu === gorev) {
      yenilemeSozu = null
    }
  }
}

/** Monaco C++ dili için çevrimdışı otomatik tamamlama, hover ve imza yardımı sağlayıcılarını bir kez kaydeder. */
export function arduinoIntelliSenseKur(): void {
  if (kuruldu) return
  kuruldu = true

  monaco.languages.registerCompletionItemProvider('cpp', {
    triggerCharacters: ['.', '>', '<', '"', '/'],
    provideCompletionItems(model, position) {
      const kod = model.getValue()
      const satir = position.lineNumber
      const sutun = position.column
      const kelime = model.getWordUntilPosition(position)
      const varsayilanAralik: monaco.IRange = {
        startLineNumber: satir,
        endLineNumber: satir,
        startColumn: kelime.startColumn,
        endColumn: kelime.endColumn
      }

      const oneriler = tamamlamaOnerileriUret({
        kod,
        satir,
        sutun,
        fqbn: aktifFqbn,
        kutuphaneIndeksi,
        projeBasliklari: aktifProjeBasliklari
      })

      const suggestions: monaco.languages.CompletionItem[] = oneriler.map((o) => {
        const range: monaco.IRange =
          o.includeDegistirmeMetni !== undefined
            ? {
                startLineNumber: satir,
                endLineNumber: satir,
                startColumn: Math.max(1, sutun - o.includeDegistirmeMetni.length),
                endColumn: sutun
              }
            : varsayilanAralik

        return {
          label: o.etiket,
          kind: oneriTuruToMonaco(o.tur),
          detail: o.detay,
          documentation: o.aciklama ? { value: o.aciklama } : undefined,
          sortText: o.siraOnceligi,
          filterText: o.includeDegistirmeMetni !== undefined ? o.etiket : undefined,
          insertText: o.ekleMetni,
          insertTextRules: o.snippetMi ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
          range
        }
      })

      return { suggestions }
    }
  })

  monaco.languages.registerHoverProvider('cpp', {
    provideHover(model, position) {
      const bilgi = hoverBilgisiBul({
        kod: model.getValue(),
        satir: position.lineNumber,
        sutun: position.column,
        fqbn: aktifFqbn,
        kutuphaneIndeksi
      })
      if (!bilgi) return null

      const contents: monaco.IMarkdownString[] = []
      if (bilgi.imza) {
        contents.push({ value: `\`\`\`cpp\n${bilgi.imza}\n\`\`\`` })
      }
      contents.push({ value: bilgi.aciklama })
      contents.push({ value: `*Kaynak: ${bilgi.kaynak}*` })

      return { contents }
    }
  })

  monaco.languages.registerSignatureHelpProvider('cpp', {
    signatureHelpTriggerCharacters: ['(', ','],
    signatureHelpRetriggerCharacters: [','],
    provideSignatureHelp(model, position) {
      const yardim = imzaYardimiBul({
        kod: model.getValue(),
        satir: position.lineNumber,
        sutun: position.column,
        kutuphaneIndeksi
      })
      if (!yardim) return null

      return {
        value: {
          activeSignature: yardim.aktifImza,
          activeParameter: yardim.aktifParametre,
          signatures: yardim.imzalar.map((imza) => ({
            label: imza.etiket,
            documentation: imza.aciklama,
            parameters: imza.parametreler.map((p) => ({
              label: p.etiket,
              documentation: p.aciklama
            }))
          }))
        },
        dispose: () => {}
      }
    }
  })
}
