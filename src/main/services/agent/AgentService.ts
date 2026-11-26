import { randomUUID } from 'crypto'
import { basename, join } from 'path'
import type {
  AgentEvent,
  AgentPermissionMode,
  AgentReply,
  AgentRunParams,
  AgentToolStep,
  AgentUndoResult,
  AIProviderId,
  ProviderTestResult
} from '@shared/types'
import type { ArduinoCliService } from '../ArduinoCliService'
import type { BoardContext, BoardSkillEngine } from '../BoardSkillEngine'
import type { DeviceLock } from '../DeviceLock'
import type { SecretsService } from '../SecretsService'
import type { SerialService } from '../SerialService'
import type { SettingsService } from '../SettingsService'
import type { SketchService } from '../SketchService'
import { AgentWorkspace, CheckpointStore } from './AgentWorkspace'
import { ProviderError, type LlmMessage, type ResolvedProvider, type ToolCall, type ToolDef } from './llmTypes'
import { saglayiciyiSina } from './models'
import { METIN_PROTOKOLU, sistemPromptuOlustur } from './prompt'
import { isCustomProvider } from '@shared/ozelSaglayici'
import { aracDestegiYokHatasiMi, iptalMi, resolveProvider, streamChat } from './providers'
import { MetinAkisSuzgeci, metinAraclariniAyikla, metinModuAracListesi } from './textProtocol'
import { TEXT_MODE_TOOL_NAMES, TOOL_DEFS, type ApprovalResult, type ToolContext } from './tools'
import { aracCagrilariniCalistir, degisenleriDerle } from './runSteps'
import type { HistoryService } from '../HistoryService'
import { derlemeyiGecmiseIsle } from '../derlemeGecmisi'

interface CalismaDurumu {
  abort: AbortController
  bekleyenler: Map<string, (r: ApprovalResult) => void>
}

export interface AgentServiceBagimliliklari {
  secrets: SecretsService
  settings: SettingsService
  arduino: ArduinoCliService
  boardSkills: BoardSkillEngine
  /** Derleme/yükleme karşılıklı dışlaması (UI ile çakışmayı önler) */
  deviceLock: DeviceLock
  sketchService: SketchService
  /** Açık seri portları okuma/yazma araçları için opsiyonel servis */
  serial?: SerialService
  /** Belgelerim/Cloud_IDE_Sketches */
  sketchbookDir: string
  userDataDir: string
  /** Verilirse agent çalışmasından önce proje anlık görüntüsü alınır */
  history?: HistoryService
}

function karakterSayisi(m: LlmMessage): number {
  if (m.role === 'assistant') return m.content.length + (m.toolCalls ? JSON.stringify(m.toolCalls).length : 0)
  return m.content.length
}

function zamanAsimliBekle<T>(p: Promise<T>, ms: number, varsayilan: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(varsayilan), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      () => {
        clearTimeout(t)
        resolve(varsayilan)
      }
    )
  })
}

function kisalt(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}\n…[kısaltıldı]`
}

/**
 * Mesaj geçmişini karakter bütçesine sığdırır:
 * 1) eski araç sonuçlarını ve eski büyük dosya yazma argümanlarını özetler,
 * 2) hâlâ büyükse en eski mesajları (araç çağrı/sonuç çiftlerini bozmadan) atar.
 */
function butceyeSigdir(mesajlar: LlmMessage[], butce: number): void {
  const toplam = (): number => mesajlar.reduce((a, m) => a + karakterSayisi(m), 0)
  if (toplam() <= butce) return

  const koru = 6
  for (let i = 0; i < mesajlar.length - koru && toplam() > butce; i++) {
    const m = mesajlar[i]
    if (m.role === 'tool' && m.content.length > 500) {
      m.content = `${m.content.slice(0, 350)}\n…[eski araç sonucu bağlam tasarrufu için kısaltıldı]`
    } else if (m.role === 'user' && m.content.startsWith('[ARAÇ SONUCU') && m.content.length > 500) {
      m.content = `${m.content.slice(0, 350)}\n…[eski araç sonucu kısaltıldı]`
    } else if (m.role === 'assistant' && m.toolCalls?.length) {
      for (const c of m.toolCalls) {
        for (const k of ['content', 'code', 'new_text', 'old_text']) {
          const v = c.args[k]
          if (typeof v === 'string' && v.length > 400) c.args[k] = `[${v.length} karakter — kısaltıldı]`
        }
      }
    } else if (m.role === 'assistant' && m.content.length > 1500) {
      m.content = `${m.content.slice(0, 1200)}\n…[kısaltıldı]`
    }
  }
  if (toplam() <= butce) return

  let sonKullanici = -1
  for (let i = mesajlar.length - 1; i >= 0; i--) {
    if (mesajlar[i].role === 'user' && !mesajlar[i].content.startsWith('[ARAÇ SONUCU') && !mesajlar[i].content.startsWith('[SİSTEM')) {
      sonKullanici = i
      break
    }
  }
  let atildi = false
  while (toplam() > butce && mesajlar.length > 2) {
    // Kullanıcının son gerçek isteğinden önceki mesajları at; yoksa en eskiden başla
    if (sonKullanici > 0) {
      mesajlar.shift()
      sonKullanici--
    } else {
      // Son istekten sonraki adımlardan en eski assistant(+tool) grubunu at
      const i = mesajlar.findIndex((m, idx) => idx > Math.max(sonKullanici, 0) && m.role === 'assistant')
      if (i < 0) break
      let son = i + 1
      while (son < mesajlar.length && (mesajlar[son].role === 'tool' || (mesajlar[son].role === 'user' && mesajlar[son].content.startsWith('[ARAÇ SONUCU')))) son++
      if (son >= mesajlar.length) break
      mesajlar.splice(i, son - i)
    }
    atildi = true
  }
  while (mesajlar.length > 1 && mesajlar[0].role !== 'user') mesajlar.shift()
  if (atildi && mesajlar[0]?.role === 'user' && !mesajlar[0].content.startsWith('[Bağlam')) {
    mesajlar[0] = { role: 'user', content: `[Bağlam sınırı nedeniyle eski mesajlar/adımlar kırpıldı]\n${mesajlar[0].content}` }
  }
}

function sonKullaniciMetni(p: AgentRunParams): string {
  for (let i = p.messages.length - 1; i >= 0; i--) if (p.messages[i].rol === 'kullanici') return p.messages[i].metin
  return ''
}

export class AgentService {
  private calismalar = new Map<string, CalismaDurumu>()
  private checkpoints: CheckpointStore
  /** Araç çağırma desteği olmadığı anlaşılan "sağlayıcı:model" çiftleri (metin protokolü kullanılır) */
  private metinModuModelleri = new Set<string>()

  constructor(private d: AgentServiceBagimliliklari) {
    this.checkpoints = new CheckpointStore(join(d.userDataDir, 'agent-checkpoints'))
  }

  abort(runId: string): void {
    const c = this.calismalar.get(runId)
    if (!c) return
    c.abort.abort()
    for (const cozucu of c.bekleyenler.values()) cozucu({ approved: false })
    c.bekleyenler.clear()
  }

  reply(runId: string, callId: string, reply: AgentReply): void {
    const c = this.calismalar.get(runId)
    const cozucu = c?.bekleyenler.get(callId)
    if (!c || !cozucu) return
    c.bekleyenler.delete(callId)
    cozucu({ approved: reply.approved, answer: reply.answer })
  }

  async undo(checkpointId: string): Promise<AgentUndoResult> {
    return this.checkpoints.geriAl(checkpointId)
  }

  testProvider(id: AIProviderId, model?: string): Promise<ProviderTestResult> {
    return saglayiciyiSina(id, model, this.d.secrets, this.d.settings)
  }

  /** Agent dosyalara dokunmadan önce çalışma alanındaki projelerin anlık görüntüsünü alır (en iyi çaba). */
  private async calismaOncesiAnlikGoruntu(projeler: string[]): Promise<void> {
    const history = this.d.history
    if (!history || this.d.settings.get('historyAutoSnapshot') === false) return
    for (const p of projeler.slice(0, 10)) {
      try {
        const sonuc = await history.commit(p, '', 'agent-oncesi')
        if (sonuc) await history.prune(p, this.d.settings.get('historyMaxAuto') ?? 50)
      } catch {
        // Geçmiş alınamazsa agent çalışması engellenmez
      }
    }
  }

  async run(params: AgentRunParams, emit: (e: AgentEvent) => void): Promise<void> {
    const runId = params.runId
    const durumKaydi: CalismaDurumu = { abort: new AbortController(), bekleyenler: new Map() }
    this.calismalar.set(runId, durumKaydi)
    const sinyal = durumKaydi.abort.signal

    const adimlar: AgentToolStep[] = []
    const tumMetin: string[] = []
    await this.calismaOncesiAnlikGoruntu(params.workspace.sketchPaths)
    const cp = this.checkpoints.baslat()
    const ws = new AgentWorkspace(this.d.sketchbookDir, this.d.sketchService, cp)
    ws.kapsamAyarla(params.workspace.activeSketchPath, params.workspace.sketchPaths)

    const bitir = async (ok: boolean, error?: string, aborted?: boolean): Promise<void> => {
      await this.checkpoints.kaydet(cp)
      this.calismalar.delete(runId)
      emit({
        runId,
        type: 'done',
        ok,
        text: tumMetin.join('\n\n').trim(),
        error,
        aborted,
        changes: [...ws.degisiklikler],
        steps: adimlar,
        checkpointId: cp.ops.length ? cp.id : undefined
      })
    }

    try {
      const ayarlar = this.d.settings.getAll()
      // İzin modu yalnızca ana süreçteki ayarlardan okunur; çalıştırma parametresiyle yükseltilemez.
      const izin: AgentPermissionMode = ayarlar.agentPermissionMode ?? 'ask'
      const otoDerleme = params.autoCompile ?? ayarlar.agentAutoCompile ?? true

      let saglayici: ResolvedProvider
      try {
        saglayici = resolveProvider(params.provider, params.model, this.d.secrets, this.d.settings)
      } catch (e) {
        await bitir(false, (e as Error).message)
        return
      }
      const yerel = saglayici.isLocal
      const modelAnahtari = `${saglayici.id}:${saglayici.model}`

      // Araç çağırma biçimi: yerel modellerde ayara/algıya göre native ya da metin protokolü
      let metinModu = false
      if (yerel) {
        const mod = ayarlar.localToolMode ?? 'auto'
        metinModu = mod === 'text' || (mod === 'auto' && this.metinModuModelleri.has(modelAnahtari))
      } else if (isCustomProvider(saglayici.id)) {
        metinModu = this.metinModuModelleri.has(modelAnahtari)
      }
      const araclar: ToolDef[] = yerel ? TOOL_DEFS.filter((t) => TEXT_MODE_TOOL_NAMES.includes(t.name)) : TOOL_DEFS
      const izinliAraclar = new Set(araclar.map((t) => t.name))

      // Bağlam bütçesi
      const baglamPenceresi = Math.max(
        2048,
        params.contextWindow ?? ayarlar.customContextLimits?.[saglayici.id] ?? (yerel ? 16384 : 100000)
      )
      const maxTokens = yerel ? 6144 : saglayici.kind === 'gemini' ? 16384 : 8192
      const maksSonucKarakter = yerel ? Math.max(2500, Math.min(7000, Math.floor(baglamPenceresi * 0.1))) : 24000
      const sicaklik = yerel ? 0.2 : 0.3

      // Sistem prompt'u (kart profili + RAG + çalışma alanı)
      emit({ runId, type: 'status', message: 'Çalışma alanı ve bilgi tabanı hazırlanıyor…' })
      const board: BoardContext | undefined = params.board
      const kullaniciIstegi = sonKullaniciMetni(params)
      const [kartProfili, ragBaglami] = await Promise.all([
        zamanAsimliBekle(this.d.boardSkills.getBoardSkillProfile(board), 5000, ''),
        // Bulut modeller bilgi tabanını `search_docs` aracıyla kendileri sorgular (çift enjeksiyon olmasın);
        // araç çağırmakta zayıf olan yerel modellere ilgili kayıtlar baştan verilir.
        yerel
          ? zamanAsimliBekle(this.d.boardSkills.getRelevantExamplesContext(kullaniciIstegi, board, { topK: 3 }), 8000, '')
          : Promise.resolve('')
      ])
      const calismaAlani = await this.calismaAlaniOzeti(ws, params, yerel)
      let sistem = sistemPromptuOlustur({
        yerel,
        metinModu,
        muhakeme: params.reasoningEffort,
        izin,
        otoDerleme,
        kartProfili: kisalt(kartProfili, yerel ? 1800 : 6000),
        ragBaglami: kisalt(ragBaglami, yerel ? 2500 : 7000),
        calismaAlani,
        secim: this.secimBilgisi(params)
      })
      if (metinModu) sistem += `\n\n${metinModuAracListesi(araclar)}`

      // Sohbet geçmişi
      const mesajlar: LlmMessage[] = []
      const gecmisLimit = yerel ? 1800 : 5000
      params.messages.forEach((m, i) => {
        const sonMu = i === params.messages.length - 1
        const metin = sonMu ? m.metin : kisalt(m.metin, gecmisLimit)
        mesajlar.push(m.rol === 'kullanici' ? { role: 'user', content: metin } : { role: 'assistant', content: metin })
      })
      while (mesajlar.length > 1 && mesajlar[0].role !== 'user') mesajlar.shift()
      if (mesajlar.length === 0 || mesajlar[mesajlar.length - 1].role !== 'user') {
        await bitir(false, 'Gönderilecek kullanıcı mesajı bulunamadı.')
        return
      }

      const istekOnay: ToolContext['istekOnay'] = (kind, name, message, options, diff) =>
        new Promise<ApprovalResult>((resolve) => {
          if (sinyal.aborted) return resolve({ approved: false })
          const callId = `ap_${randomUUID().slice(0, 8)}`
          durumKaydi.bekleyenler.set(callId, resolve)
          emit({ runId, type: 'approval', callId, kind, name, message, options, diff })
        })

      const ctx: ToolContext = {
        runId,
        ws,
        arduino: this.d.arduino,
        kilit: this.d.deviceLock,
        serial: this.d.serial,
        derlemeyiKaydet: this.d.history
          ? (klasor, fqbn, sonuc) => derlemeyiGecmiseIsle(this.d.history!, this.d.settings, klasor, fqbn, sonuc)
          : undefined,
        boardSkills: this.d.boardSkills,
        board,
        permission: izin,
        signal: sinyal,
        emit,
        istekOnay,
        maksSonucKarakter,
        durum: { derlenmemis: new Set<string>(), derlemeSayaci: 0 }
      }

      const maxAdim = yerel ? 30 : 60
      const maxOtoDerleme = yerel ? 3 : 4
      let otoDerlemeDenemesi = 0
      let kodSohbeteYazildiUyarisi = false
      let kesilmeDenemesi = 0
      let bosYanitUyarisi = false
      let metinModuDenemesiYapildi = false
      const cagriSayac = new Map<string, number>()
      const butce = (): number => Math.max(6000, Math.floor((baglamPenceresi - maxTokens - 1500) * 3 - sistem.length))

      for (let adim = 0; adim < maxAdim; adim++) {
        if (sinyal.aborted) throw new DOMException('abort', 'AbortError')
        butceyeSigdir(mesajlar, butce())
        emit({ runId, type: 'status', message: adim === 0 ? 'Düşünüyor…' : 'Devam ediyor…' })

        // ── Model turu ──
        let metin = ''
        let dusunce = ''
        let cagrilar: ToolCall[] = []
        let bitisNedeni = ''
        const suzgec = metinModu || yerel ? new MetinAkisSuzgeci() : null
        const oncekiMetinVar = tumMetin.length > 0
        let ayracGonderildi = false
        const metinYay = (parca: string): void => {
          if (!parca) return
          if (!ayracGonderildi && oncekiMetinVar) {
            ayracGonderildi = true
            emit({ runId, type: 'text', delta: '\n\n' })
          }
          emit({ runId, type: 'text', delta: parca })
        }

        try {
          for await (const ev of streamChat(
            saglayici,
            {
              system: sistem,
              messages: mesajlar,
              tools: metinModu ? undefined : araclar,
              maxTokens,
              temperature: sicaklik,
              reasoningEffort: params.reasoningEffort,
              numCtx: yerel ? Math.min(baglamPenceresi, 131072) : undefined
            },
            sinyal
          )) {
            if (ev.type === 'text') {
              metin += ev.delta
              metinYay(suzgec ? suzgec.isle(ev.delta) : ev.delta)
            } else if (ev.type === 'reasoning') {
              dusunce += ev.delta
              emit({ runId, type: 'reasoning', delta: ev.delta })
            } else if (ev.type === 'tool_calls') {
              cagrilar = ev.calls
            } else if (ev.type === 'finish') {
              bitisNedeni = ev.reason
            }
          }
          if (suzgec) metinYay(suzgec.bosalt())
        } catch (err) {
          if (iptalMi(err) || sinyal.aborted) throw err
          // Model araç çağırmayı desteklemiyorsa metin protokolüne geç ve aynı adımı yeniden dene
          // Özel sağlayıcıdaki model de araç çağırmayı desteklemeyebilir
          if ((yerel || isCustomProvider(saglayici.id)) && !metinModu && !metinModuDenemesiYapildi && aracDestegiYokHatasiMi(err)) {
            metinModuDenemesiYapildi = true
            metinModu = true
            if (!yerel || (ayarlar.localToolMode ?? 'auto') === 'auto') this.metinModuModelleri.add(modelAnahtari)
            sistem += `\n\n${METIN_PROTOKOLU}\n\n${metinModuAracListesi(araclar)}`
            emit({
              runId,
              type: 'status',
              message: 'Bu model yerel araç çağırmayı desteklemiyor; metin protokolüne geçildi.',
              warning: true
            })
            adim--
            continue
          }
          throw err
        }

        const kesildi = /length|max_tokens|MAX_TOKENS/.test(bitisNedeni)
        if (kesildi) {
          emit({ runId, type: 'status', message: 'Yanıt token sınırında kesildi; gerekirse dosyayı parçalara bölerek yazmasını isteyin.', warning: true })
        }
        // Token sınırında kesilen turda araç argümanları yarım olabilir (ör. eksik dosya içeriği).
        // Onarılmış yarım JSON ile dosya yazmamak için bu turun araç çağrılarını çalıştırmıyoruz.
        if (kesildi && cagrilar.length > 0) {
          if (kesilmeDenemesi >= 2) {
            await bitir(false, 'Yanıt tekrar tekrar token sınırında kesildi. Daha küçük bir adım isteyin veya dosyayı parçalara bölün.')
            return
          }
          kesilmeDenemesi++
          mesajlar.push({ role: 'assistant', content: metin.trim() || '(yanıt kesildi)' })
          mesajlar.push({
            role: 'user',
            content:
              '[SİSTEM] Yanıtın token sınırında kesildi ve araç çağrıların çalıştırılmadı. Aynı işi daha küçük adımlarla yap: büyük dosyaları write_file yerine birkaç edit_file çağrısıyla, tek seferde az içerikle güncelle.'
          })
          continue
        }

        // Metin modu: araç çağrılarını metinden çıkar. Yerel native modda model aracı metne yazdıysa onu da yakala.
        let gorunurMetin = metin
        if (metinModu || (yerel && cagrilar.length === 0)) {
          const ay = metinAraclariniAyikla(metin, izinliAraclar)
          if (ay.calls.length) {
            cagrilar = ay.calls
            gorunurMetin = ay.temiz
          }
        }

        const asistanMesaji: LlmMessage = metinModu
          ? { role: 'assistant', content: metin }
          : { role: 'assistant', content: gorunurMetin, toolCalls: cagrilar.length ? cagrilar : undefined, reasoning: dusunce || undefined }
        mesajlar.push(asistanMesaji)
        if (gorunurMetin.trim()) tumMetin.push(gorunurMetin.trim())

        // ── Araç çağrısı yoksa: bitiş denetimleri ──
        if (cagrilar.length === 0) {
          // 1) Boş yanıt
          if (!metin.trim() && !bosYanitUyarisi) {
            bosYanitUyarisi = true
            mesajlar.pop()
            mesajlar.push({ role: 'assistant', content: '(yanıt boş)' })
            mesajlar.push({ role: 'user', content: '[SİSTEM] Yanıtın boş geldi. İsteği yerine getirmek için gerekli aracı çağır veya cevabını yaz.' })
            continue
          }
          // 2) Kodu sohbete yazıp dosyaya yazmama (yerel modellerde sık)
          const kodBloguVar = /```(?:cpp|c\+\+|arduino|ino|c)\s*\n[\s\S]{250,}?```/i.test(metin)
          if (kodBloguVar && ws.degisiklikler.length === 0 && !kodSohbeteYazildiUyarisi && izinliAraclar.has('write_file')) {
            kodSohbeteYazildiUyarisi = true
            mesajlar.push({
              role: 'user',
              content:
                '[SİSTEM] Kodu sohbet mesajına yazdın ama editördeki dosyalara yazmadın. Lütfen kodu write_file / edit_file (mevcut sketch) veya create_sketch (yeni proje) aracıyla dosyaya yaz; ardından compile ile doğrula.'
            })
            emit({ runId, type: 'status', message: 'Kod dosyaya yazılmamış; ajan yönlendiriliyor…', warning: true })
            continue
          }
          // 3) Otomatik derleme + düzeltme döngüsü
          if (otoDerleme && ctx.durum.derlenmemis.size > 0) {
            const fqbn = (board?.fqbn ?? '').trim()
            if (!fqbn) {
              emit({ runId, type: 'status', message: 'Kart seçili olmadığı için otomatik derleme atlandı.', warning: true })
              ctx.durum.derlenmemis.clear()
            } else if (otoDerlemeDenemesi < maxOtoDerleme) {
              otoDerlemeDenemesi++
              const hatalar = await degisenleriDerle({ ctx, ws, runId, adimlar })
              if (hatalar.length) {
                mesajlar.push({
                  role: 'user',
                  content: `[SİSTEM — OTOMATİK DERLEME ${otoDerlemeDenemesi}/${maxOtoDerleme}] Derleme başarısız oldu. Hataları oku, ilgili dosyayı düzelt ve compile ile tekrar doğrula.\n\n${hatalar.join('\n\n')}`
                })
                continue
              }
            } else {
              emit({
                runId,
                type: 'status',
                message: 'Otomatik derleme-düzeltme deneme sınırına ulaşıldı; kalan hataları elle inceleyin.',
                warning: true
              })
              tumMetin.push('⚠️ Otomatik derleme-düzeltme sınırına ulaşıldı; derleme hâlâ hata veriyor olabilir. Derleme çıktısına bakıp birlikte devam edebiliriz.')
            }
          }
          await bitir(true)
          return
        }

        // ── Araçları çalıştır ──
        const sonuclar = await aracCagrilariniCalistir(cagrilar, { ctx, ws, runId, sinyal, izinliAraclar, cagriSayac, adimlar })

        if (metinModu) {
          mesajlar.push({
            role: 'user',
            content: sonuclar.map((s) => `[ARAÇ SONUCU: ${s.call.name}]\n${s.cikti}`).join('\n\n')
          })
        } else {
          for (const s of sonuclar) {
            mesajlar.push({ role: 'tool', toolCallId: s.call.id, name: s.call.name, content: s.cikti })
          }
        }
      }

      tumMetin.push(`⚠️ Adım sınırına (${maxAdim}) ulaşıldı. Devam etmemi isterseniz "devam et" yazın.`)
      await bitir(true)
    } catch (err) {
      if (iptalMi(err) || sinyal.aborted) {
        await bitir(false, undefined, true)
        return
      }
      const mesaj = err instanceof ProviderError ? err.message : `Beklenmeyen hata: ${(err as Error).message}`
      console.error('[AgentService] Çalışma hatası:', err)
      await bitir(false, mesaj)
    }
  }

  private secimBilgisi(p: AgentRunParams): string {
    const s = p.workspace.selection
    if (!s || !s.text.trim()) return ''
    return `KULLANICININ EDİTÖRDE SEÇTİĞİ KOD (${basename(s.filePath)}, satır ${s.startLine}-${s.endLine}):\n\`\`\`cpp\n${kisalt(s.text, 4000)}\n\`\`\`\nKullanıcı "bunu", "şunu", "seçili kısmı" diyorsa bu parçadan bahsediyor; değişikliği edit_file ile yalnızca bu bölgede yap.`
  }

  private async calismaAlaniOzeti(ws: AgentWorkspace, p: AgentRunParams, yerel: boolean): Promise<string> {
    const satirlar: string[] = []
    const aktif = ws.getAktifSketch()
    satirlar.push(`Aktif sketch: ${aktif ? basename(aktif) : '(yok)'}`)
    const b = p.board
    satirlar.push(`Seçili kart: ${b?.name || '(seçilmedi)'}${b?.fqbn ? ` [${b.fqbn}]` : ''}${b?.platformName ? ` — ${b.platformName}` : ''}`)
    if (p.port) satirlar.push(`Seçili port: ${p.port}`)
    const acikSeri = this.d.serial?.acikPortlar() ?? []
    if (acikSeri.length > 0) {
      satirlar.push(`Açık seri portlar: ${acikSeri.map((s) => `${s.port} @ ${s.baud}`).join(', ')}`)
    }
    const klasorler = ws.bilinenSketchKlasorleri()
    satirlar.push(`Açık sketch sayısı: ${klasorler.length}`)
    for (const k of klasorler.slice(0, 12)) {
      try {
        const o = await ws.sketchOzeti(k)
        satirlar.push(`- ${o.name}${k === aktif ? ' (aktif)' : ''}: ${o.files.map((f) => f.name).join(', ')}`)
      } catch {
        satirlar.push(`- ${basename(k)} (okunamadı)`)
      }
    }
    // Aktif dosyanın içeriği: araç çağrısı harcamadan bağlam sağlar
    const aktifDosya = p.workspace.activeFilePath
    if (aktifDosya) {
      try {
        const yol = ws.yolCoz(aktifDosya)
        const icerik = await ws.oku(yol)
        const limit = yerel ? 4000 : 14000
        satirlar.push(`\nAKTİF DOSYA: ${basename(yol)} (${icerik.split('\n').length} satır)\n\`\`\`cpp\n${kisalt(icerik, limit)}\n\`\`\``)
      } catch {
        satirlar.push(`\nAKTİF DOSYA: ${basename(aktifDosya)}`)
      }
    }
    return satirlar.join('\n')
  }
}
