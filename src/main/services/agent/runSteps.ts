import { randomUUID } from 'crypto'
import { basename } from 'path'
import type { AgentChangeItem, AgentToolStep } from '@shared/types'
import type { ToolCall } from './llmTypes'
import { aracCalistir, aracEtiketi, derle, type ToolContext } from './tools'
import type { AgentWorkspace } from './AgentWorkspace'

/** Dosya sistemini değiştiren araçlar: ardından renderer'a `changes` olayı gönderilir */
export const YAZMA_ARACLARI = new Set([
  'write_file',
  'edit_file',
  'create_sketch',
  'delete_file',
  'rename_file',
  'delete_sketch',
  'rename_sketch'
])

/** Aynı çağrı bu sayıya ulaşınca (compile hariç) reddedilir: model aynı şeyi döngüye alıyor demektir. */
export const TEKRAR_SINIRI = 4

export interface AracSonucu {
  call: ToolCall
  cikti: string
}

interface AdimBagimliliklari {
  ctx: ToolContext
  ws: AgentWorkspace
  runId: string
  sinyal: AbortSignal
  izinliAraclar: Set<string>
  cagriSayac: Map<string, number>
  adimlar: AgentToolStep[]
}

/** Aynı araç çağrısının kaçıncı tekrarı olduğunu sayar ve tekrar sınırını aşıp aşmadığını söyler. */
export function tekrarMi(cagriSayac: Map<string, number>, call: ToolCall): { sayi: number; asildi: boolean } {
  const imza = `${call.name}:${JSON.stringify(call.args)}`
  const sayi = (cagriSayac.get(imza) ?? 0) + 1
  cagriSayac.set(imza, sayi)
  return { sayi, asildi: sayi >= TEKRAR_SINIRI && call.name !== 'compile' }
}

/**
 * Modelin istediği araç çağrılarını sırayla çalıştırır, olayları yayar ve adım geçmişine ekler.
 * İptal edilirse AbortError fırlatır.
 */
export async function aracCagrilariniCalistir(cagrilar: ToolCall[], d: AdimBagimliliklari): Promise<AracSonucu[]> {
  const sonuclar: AracSonucu[] = []
  for (const c of cagrilar) {
    if (d.sinyal.aborted) throw new DOMException('abort', 'AbortError')
    const etiket = aracEtiketi(c.name, c.args)
    d.ctx.emit({ runId: d.runId, type: 'tool_start', callId: c.id, name: c.name, label: etiket })

    const { sayi, asildi } = tekrarMi(d.cagriSayac, c)

    let ok: boolean
    let etiketSon = etiket
    let ayrinti: string | undefined
    let cikti: string
    if (!d.izinliAraclar.has(c.name)) {
      ok = false
      cikti = `Bilinmeyen/kullanılamayan araç: "${c.name}". Kullanılabilir araçlar: ${[...d.izinliAraclar].join(', ')}`
    } else if (asildi) {
      ok = false
      cikti = `UYARI: Aynı araç çağrısını ${sayi}. kez yapıyorsun ve sonuç değişmiyor. Farklı bir yaklaşım dene ya da kullanıcıya durumu açıkla.`
    } else {
      const r = await aracCalistir(d.ctx, c.name, c.args)
      ok = r.ok
      etiketSon = r.label
      ayrinti = r.detail
      cikti = r.output
    }
    d.ctx.emit({ runId: d.runId, type: 'tool_end', callId: c.id, name: c.name, ok, label: etiketSon, detail: ayrinti })
    d.adimlar.push({ callId: c.id, name: c.name, label: etiketSon, ok, detail: ayrinti })
    sonuclar.push({ call: c, cikti })

    if (YAZMA_ARACLARI.has(c.name) && ok) {
      d.ctx.emit({ runId: d.runId, type: 'changes', changes: [...d.ws.degisiklikler] as AgentChangeItem[] })
    }
  }
  return sonuclar
}

/**
 * Değişen ama henüz derlenmemiş sketch'leri derler. Başarısız olanların hata özetlerini döndürür;
 * boş dizi "hepsi derlendi" demektir.
 */
export async function degisenleriDerle(d: Pick<AdimBagimliliklari, 'ctx' | 'ws' | 'runId' | 'adimlar'>): Promise<string[]> {
  const hatalar: string[] = []
  for (const klasor of [...d.ctx.durum.derlenmemis]) {
    if (!d.ws.sketchMi(klasor)) {
      d.ctx.durum.derlenmemis.delete(klasor)
      continue
    }
    const ad = basename(klasor)
    d.ctx.emit({ runId: d.runId, type: 'status', message: `Derleniyor: ${ad}…` })
    const callId = `auto_${randomUUID().slice(0, 6)}`
    d.ctx.emit({ runId: d.runId, type: 'tool_start', callId, name: 'compile', label: `Otomatik derleme: ${ad}` })
    const r = await derle(d.ctx, klasor)
    const etiket = `${r.ok ? 'Derlendi' : 'Derleme hatası'}: ${ad}`
    d.ctx.emit({
      runId: d.runId,
      type: 'tool_end',
      callId,
      name: 'compile',
      ok: r.ok,
      label: etiket,
      detail: r.sonuc ? `${r.sonuc.errors.filter((e) => e.tur === 'error').length} hata` : undefined
    })
    d.adimlar.push({ callId, name: 'compile', label: etiket, ok: r.ok })
    if (!r.ok) hatalar.push(`### ${ad}\n${r.mesaj}`)
  }
  return hatalar
}
