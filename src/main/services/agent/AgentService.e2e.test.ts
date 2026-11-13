import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import type { AddressInfo } from 'net'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { AgentEvent, AgentPermissionMode, AgentRunParams } from '@shared/types'
import { AgentService } from './AgentService'
import { SketchService } from '../SketchService'

// ────────────────────────────────────────────────────────────────────────
// Sahte OpenAI uyumlu model sunucusu: her istek için sıradaki senaryo yanıtını akıtır
// ────────────────────────────────────────────────────────────────────────

type SahteYanit =
  | { tur: 'metin'; metin: string }
  | { tur: 'arac'; cagrilar: Array<{ ad: string; args: Record<string, unknown> }>; bitis?: string }
  | { tur: 'asili' } // akış açık kalır, hiç bitmez (iptal testi için)

let sunucu: Server
let port = 0
const kuyruk: SahteYanit[] = []
const istekler: Array<{ messages: Array<{ role: string; content?: string | null }> }> = []

function sse(res: ServerResponse, veri: unknown): void {
  res.write(`data: ${JSON.stringify(veri)}\n\n`)
}

function yanitla(req: IncomingMessage, res: ServerResponse): void {
  let govde = ''
  req.on('data', (c) => (govde += c))
  req.on('end', () => {
    try {
      istekler.push(JSON.parse(govde))
    } catch {
      /* geçersiz gövde */
    }
    const y = kuyruk.shift()
    res.writeHead(200, { 'Content-Type': 'text/event-stream' })
    if (!y) {
      sse(res, { choices: [{ index: 0, delta: { content: '(senaryo bitti)' }, finish_reason: null }] })
      sse(res, { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })
      res.end('data: [DONE]\n\n')
      return
    }
    if (y.tur === 'metin') {
      sse(res, { choices: [{ index: 0, delta: { content: y.metin }, finish_reason: null }] })
      sse(res, { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })
      res.end('data: [DONE]\n\n')
    } else if (y.tur === 'arac') {
      y.cagrilar.forEach((c, i) => {
        sse(res, {
          choices: [
            {
              index: 0,
              delta: { tool_calls: [{ index: i, id: `call_${i}_${Date.now()}`, type: 'function', function: { name: c.ad, arguments: JSON.stringify(c.args) } }] },
              finish_reason: null
            }
          ]
        })
      })
      sse(res, { choices: [{ index: 0, delta: {}, finish_reason: y.bitis ?? 'tool_calls' }] })
      res.end('data: [DONE]\n\n')
    } else {
      sse(res, { choices: [{ index: 0, delta: { content: 'başlıyorum…' }, finish_reason: null }] })
      // akışı kapatma: istemci iptal edene kadar açık kalır
    }
  })
}

// ────────────────────────────────────────────────────────────────────────
// Test ortamı
// ────────────────────────────────────────────────────────────────────────

let kok = ''
let sketchbook = ''
let userData = ''
let blinkKlasoru = ''
let blinkIno = ''
const ORIJINAL_INO = 'void setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n}\n'

let derlemeSonuclari: Array<{ success: boolean; log: string; errors: Array<{ dosya: string; satir: number; sutun: number; mesaj: string; hamMetin: string; tur: 'error' | 'warning' }> }> = []
let derlemeCagrisi = 0
let kilitHatasi: string | null = null

function servisKur(izin: AgentPermissionMode, otoDerleme = false): AgentService {
  const ayarlar: Record<string, unknown> = {
    aiBaseUrls: { openai: `http://127.0.0.1:${port}/v1`, lmstudio: `http://127.0.0.1:${port}/v1` },
    selectedModelPerProvider: { openai: 'gpt-4o', lmstudio: 'local-model' },
    localToolMode: 'auto',
    agentPermissionMode: izin,
    agentAutoCompile: otoDerleme,
    customContextLimits: {}
  }
  const settings = { get: (k: string) => ayarlar[k], getAll: () => ayarlar }
  const secrets = { getDecryptedApiKey: () => 'sk-test' }
  const arduino = {
    compile: async () => {
      derlemeCagrisi++
      return derlemeSonuclari.shift() ?? { success: true, errors: [], log: '' }
    },
    cancelOperation: () => true,
    searchLibraries: async () => []
  }
  const boardSkills = { getBoardSkillProfile: async () => '', getRelevantExamplesContext: async () => '' }
  const deviceLock = {
    runExclusive: async <T,>(is: () => Promise<T>): Promise<T> => {
      if (kilitHatasi) throw new Error(kilitHatasi)
      return is()
    }
  }
  return new AgentService({
    secrets,
    settings,
    arduino,
    boardSkills,
    deviceLock,
    sketchService: new SketchService(),
    sketchbookDir: sketchbook,
    userDataDir: userData
  } as unknown as ConstructorParameters<typeof AgentService>[0])
}

interface Kosu {
  olaylar: AgentEvent[]
  done: Extract<AgentEvent, { type: 'done' }>
}

/** Agent'ı çalıştırır; onay isteklerine `onay` fonksiyonu ile cevap verir. */
async function kos(
  servis: AgentService,
  mesaj: string,
  opts: {
    onay?: (e: Extract<AgentEvent, { type: 'approval' }>) => { approved: boolean; answer?: string }
    olayda?: (e: AgentEvent, runId: string) => void
    board?: AgentRunParams['board']
    provider?: AgentRunParams['provider']
  } = {}
): Promise<Kosu> {
  const runId = `run_${Math.random().toString(36).slice(2, 8)}`
  const olaylar: AgentEvent[] = []
  const params: AgentRunParams = {
    runId,
    provider: opts.provider ?? 'openai',
    model: opts.provider === 'lmstudio' ? 'local-model' : 'gpt-4o',
    messages: [{ rol: 'kullanici', metin: mesaj }],
    workspace: { activeSketchPath: blinkKlasoru, sketchPaths: [blinkKlasoru], activeFilePath: blinkIno },
    board: opts.board
  }
  await new Promise<void>((coz) => {
    const emit = (e: AgentEvent): void => {
      olaylar.push(e)
      opts.olayda?.(e, runId)
      if (e.type === 'approval' && opts.onay) {
        const cevap = opts.onay(e)
        setImmediate(() => servis.reply(runId, e.callId, cevap))
      }
      if (e.type === 'done') coz()
    }
    void servis.run(params, emit)
  })
  const done = olaylar.find((e) => e.type === 'done') as Kosu['done']
  return { olaylar, done }
}

beforeAll(async () => {
  sunucu = createServer(yanitla)
  await new Promise<void>((r) => sunucu.listen(0, '127.0.0.1', r))
  port = (sunucu.address() as AddressInfo).port
})

afterAll(async () => {
  sunucu.closeAllConnections()
  await new Promise<void>((r) => sunucu.close(() => r()))
  if (kok) rmSync(kok, { recursive: true, force: true })
})

beforeEach(() => {
  if (kok) rmSync(kok, { recursive: true, force: true })
  kok = mkdtempSync(join(tmpdir(), 'cloudide-e2e-'))
  sketchbook = join(kok, 'sketchbook')
  userData = join(kok, 'userdata')
  blinkKlasoru = join(sketchbook, 'Blink')
  blinkIno = join(blinkKlasoru, 'Blink.ino')
  mkdirSync(blinkKlasoru, { recursive: true })
  mkdirSync(userData, { recursive: true })
  writeFileSync(blinkIno, ORIJINAL_INO)
  kuyruk.length = 0
  istekler.length = 0
  derlemeSonuclari = []
  derlemeCagrisi = 0
  kilitHatasi = null
})

// ────────────────────────────────────────────────────────────────────────
// Senaryolar
// ────────────────────────────────────────────────────────────────────────

describe('AgentService uçtan uca (sahte model sunucusu)', () => {
  it('basit metin yanıtını akıtır ve başarıyla biter', async () => {
    kuyruk.push({ tur: 'metin', metin: 'Merhaba! Nasıl yardımcı olabilirim?' })
    const { olaylar, done } = await kos(servisKur('ask'), 'Selam')
    expect(done.ok).toBe(true)
    expect(done.text).toContain('Merhaba')
    expect(olaylar.some((e) => e.type === 'text')).toBe(true)
    expect(done.changes).toHaveLength(0)
  })

  it('onaylı modda yeni dosya yazmadan önce diff ile onay ister; onaylanınca yazar ve geri alınabilir', async () => {
    const hedef = join(blinkKlasoru, 'led.h')
    kuyruk.push({ tur: 'arac', cagrilar: [{ ad: 'write_file', args: { path: 'Blink/led.h', content: '#pragma once\nconst int LED = 13;\n' } }] })
    kuyruk.push({ tur: 'metin', metin: 'led.h dosyasını oluşturdum.' })

    const servis = servisKur('ask')
    const { olaylar, done } = await kos(servis, 'led.h ekle', { onay: () => ({ approved: true }) })

    const onay = olaylar.find((e) => e.type === 'approval') as Extract<AgentEvent, { type: 'approval' }>
    expect(onay).toBeDefined()
    expect(onay.diff?.isNew).toBe(true)
    expect(onay.diff?.after).toContain('const int LED = 13;')
    expect(existsSync(hedef)).toBe(true)
    expect(readFileSync(hedef, 'utf8')).toContain('LED = 13')
    expect(done.ok).toBe(true)
    expect(done.changes).toHaveLength(1)
    expect(done.checkpointId).toBeTruthy()

    // Geri alma dosyayı kaldırır
    const sonuc = await servis.undo(done.checkpointId as string)
    expect(sonuc.ok).toBe(true)
    expect(existsSync(hedef)).toBe(false)
  })

  it('kullanıcı reddederse dosya yazılmaz ve model bunu araç sonucunda görür', async () => {
    const hedef = join(blinkKlasoru, 'ret.h')
    kuyruk.push({ tur: 'arac', cagrilar: [{ ad: 'write_file', args: { path: 'Blink/ret.h', content: 'int x;\n' } }] })
    kuyruk.push({ tur: 'metin', metin: 'Anladım, yazmadım.' })

    const { done } = await kos(servisKur('ask'), 'ret.h ekle', { onay: () => ({ approved: false }) })
    expect(existsSync(hedef)).toBe(false)
    expect(done.changes).toHaveLength(0)
    const ikinciIstek = istekler[1]
    const araçSonucu = ikinciIstek.messages.find((m) => m.role === 'tool')
    expect(araçSonucu?.content).toMatch(/reddetti/i)
  })

  it('edit_file mevcut dosyayı düzenler, diff önceki/sonraki içeriği taşır ve geri alma orijinali döndürür', async () => {
    kuyruk.push({
      tur: 'arac',
      cagrilar: [{ ad: 'edit_file', args: { path: 'Blink/Blink.ino', old_text: 'delay(1000);', new_text: 'delay(250);' } }]
    })
    kuyruk.push({ tur: 'metin', metin: 'Gecikmeyi 250 ms yaptım.' })

    const servis = servisKur('ask')
    const { olaylar, done } = await kos(servis, 'daha hızlı yansın', { onay: () => ({ approved: true }) })
    const onay = olaylar.find((e) => e.type === 'approval') as Extract<AgentEvent, { type: 'approval' }>
    expect(onay.diff?.before).toBe(ORIJINAL_INO)
    expect(onay.diff?.after).toContain('delay(250);')
    expect(readFileSync(blinkIno, 'utf8')).toContain('delay(250);')

    const geri = await servis.undo(done.checkpointId as string)
    expect(geri.ok).toBe(true)
    expect(readFileSync(blinkIno, 'utf8')).toBe(ORIJINAL_INO)
  })

  it('edit_file eşleşme bulamazsa onay İSTEMEZ ve hatayı modele döner', async () => {
    kuyruk.push({
      tur: 'arac',
      cagrilar: [{ ad: 'edit_file', args: { path: 'Blink/Blink.ino', old_text: 'bu metin dosyada yok', new_text: 'x' } }]
    })
    kuyruk.push({ tur: 'metin', metin: 'Eşleşme bulunamadı, tekrar bakacağım.' })
    const { olaylar } = await kos(servisKur('ask'), 'bir şey değiştir', { onay: () => ({ approved: true }) })
    expect(olaylar.some((e) => e.type === 'approval')).toBe(false)
    expect(readFileSync(blinkIno, 'utf8')).toBe(ORIJINAL_INO)
    const sonuc = istekler[1].messages.find((m) => m.role === 'tool')
    expect(sonuc?.content).toMatch(/bulunamadı/i)
  })

  it('yarı otomatik modda yazma onaysız yapılır, silme yine sorar', async () => {
    kuyruk.push({ tur: 'arac', cagrilar: [{ ad: 'write_file', args: { path: 'Blink/oto.h', content: 'int a;\n' } }] })
    kuyruk.push({ tur: 'arac', cagrilar: [{ ad: 'delete_file', args: { path: 'Blink/oto.h' } }] })
    kuyruk.push({ tur: 'metin', metin: 'Bitti.' })
    const sorulan: string[] = []
    const { done } = await kos(servisKur('auto-edit'), 'oto.h ekle sonra sil', {
      onay: (e) => {
        sorulan.push(e.name)
        return { approved: true }
      }
    })
    expect(sorulan).toEqual(['delete_file']) // yazma sormadı, silme sordu
    expect(existsSync(join(blinkKlasoru, 'oto.h'))).toBe(false)
    expect(done.ok).toBe(true)
  })

  it('token sınırında kesilen yarım araç çağrısını ÇALIŞTIRMAZ ve modeli küçük adımlara yönlendirir', async () => {
    const hedef = join(blinkKlasoru, 'yarim.h')
    kuyruk.push({
      tur: 'arac',
      bitis: 'length',
      cagrilar: [{ ad: 'write_file', args: { path: 'Blink/yarim.h', content: 'int yarim_icerik' } }]
    })
    kuyruk.push({ tur: 'metin', metin: 'Daha küçük adımlarla ilerleyeceğim.' })
    const { done } = await kos(servisKur('full-auto'), 'büyük dosya yaz')
    expect(existsSync(hedef)).toBe(false)
    expect(done.changes).toHaveLength(0)
    const sistemMesaji = istekler[1].messages.map((m) => m.content ?? '').join('\n')
    expect(sistemMesaji).toMatch(/token sınırında kesildi/)
  })

  it('çalışma alanı dışına yazma ve okuma girişimlerini reddeder', async () => {
    const disDosya = join(kok, 'disarida.txt')
    kuyruk.push({ tur: 'arac', cagrilar: [{ ad: 'write_file', args: { path: disDosya.replace(/\\/g, '/'), content: 'sızdı' } }] })
    kuyruk.push({ tur: 'arac', cagrilar: [{ ad: 'write_file', args: { path: '../../disarida2.txt', content: 'sızdı' } }] })
    kuyruk.push({ tur: 'arac', cagrilar: [{ ad: 'read_file', args: { path: join(kok, 'userdata').replace(/\\/g, '/') } }] })
    kuyruk.push({ tur: 'metin', metin: 'Yapamadım.' })
    const { done } = await kos(servisKur('full-auto'), 'dışarı yaz')
    expect(existsSync(disDosya)).toBe(false)
    expect(existsSync(join(kok, '..', 'disarida2.txt'))).toBe(false)
    expect(done.steps.filter((s) => !s.ok).length).toBeGreaterThanOrEqual(3)
  })

  it('yürütülebilir/izinli olmayan uzantıya yazmayı reddeder (.exe)', async () => {
    kuyruk.push({ tur: 'arac', cagrilar: [{ ad: 'write_file', args: { path: 'Blink/kotu.exe', content: 'MZ' } }] })
    kuyruk.push({ tur: 'metin', metin: 'Tamam.' })
    await kos(servisKur('full-auto'), 'exe yaz')
    expect(existsSync(join(blinkKlasoru, 'kotu.exe'))).toBe(false)
  })

  it('izin parametresi çalıştırma isteğiyle yükseltilemez (ayar "ask" ise onay istenir)', async () => {
    kuyruk.push({ tur: 'arac', cagrilar: [{ ad: 'write_file', args: { path: 'Blink/zorla.h', content: 'int z;\n' } }] })
    kuyruk.push({ tur: 'metin', metin: 'Bitti.' })
    const servis = servisKur('ask')
    const runId = 'run_izin'
    const olaylar: AgentEvent[] = []
    // permissionMode alanı tipte yok; renderer yine de gönderse bile yok sayılmalı
    const params = {
      runId,
      provider: 'openai',
      model: 'gpt-4o',
      messages: [{ rol: 'kullanici', metin: 'zorla' }],
      workspace: { activeSketchPath: blinkKlasoru, sketchPaths: [blinkKlasoru] },
      permissionMode: 'full-auto'
    } as unknown as AgentRunParams
    await new Promise<void>((coz) => {
      void servis.run(params, (e) => {
        olaylar.push(e)
        if (e.type === 'approval') setImmediate(() => servis.reply(runId, e.callId, { approved: false }))
        if (e.type === 'done') coz()
      })
    })
    expect(olaylar.some((e) => e.type === 'approval')).toBe(true)
    expect(existsSync(join(blinkKlasoru, 'zorla.h'))).toBe(false)
  })


  it('sketch içindeki bir symlink/junction ile çalışma alanı dışına yazmayı engeller', async () => {
    const dis = join(kok, 'dis-klasor')
    mkdirSync(dis, { recursive: true })
    try {
      symlinkSync(dis, join(blinkKlasoru, 'kacis'), 'junction')
    } catch {
      return // bu ortamda symlink oluşturulamıyorsa test atlanır
    }
    kuyruk.push({ tur: 'arac', cagrilar: [{ ad: 'write_file', args: { path: 'Blink/kacis/x.h', content: 'int sizinti;\n' } }] })
    kuyruk.push({ tur: 'metin', metin: 'Olmadı.' })
    const { done } = await kos(servisKur('full-auto'), 'symlink üzerinden yaz')
    expect(existsSync(join(dis, 'x.h'))).toBe(false)
    expect(done.steps.some((s) => !s.ok)).toBe(true)
  })

  it('yerel modelin metin protokolüyle yazdığı araç bloğunu çalıştırır ve etiketi kullanıcıya sızdırmaz', async () => {
    kuyruk.push({
      tur: 'metin',
      metin: 'Dosyayı oluşturuyorum.\n<tool name="write_file"><arg name="path">Blink/yerel.h</arg><content>\nint yerel = 1;\n</content></tool>'
    })
    kuyruk.push({ tur: 'metin', metin: 'Hazır.' })
    const { olaylar, done } = await kos(servisKur('full-auto'), 'yerel.h ekle', { provider: 'lmstudio' })
    expect(readFileSync(join(blinkKlasoru, 'yerel.h'), 'utf8')).toContain('int yerel = 1;')
    const akanMetin = olaylar
      .filter((e): e is Extract<AgentEvent, { type: 'text' }> => e.type === 'text')
      .map((e) => e.delta)
      .join('')
    expect(akanMetin).not.toContain('<tool')
    expect(akanMetin).toContain('Dosyayı oluşturuyorum.')
    expect(done.changes).toHaveLength(1)
  })

  it('yerel modelin yanıtındaki "#include <toolbar.h>" gibi metin kullanıcıdan kaybolmaz', async () => {
    kuyruk.push({ tur: 'metin', metin: 'Şunu ekleyin: #include <toolbar.h> ve sonra derleyin.' })
    const { done } = await kos(servisKur('ask'), 'örnek ver', { provider: 'lmstudio' })
    expect(done.text).toContain('derleyin')
    expect(done.text).toContain('<toolbar.h>')
  })

  it('ask_user sorusunu kullanıcıya iletir ve yanıtı modele döner', async () => {
    kuyruk.push({ tur: 'arac', cagrilar: [{ ad: 'ask_user', args: { question: 'Hangi pin kullanılsın?', options: ['D2', 'D3'] } }] })
    kuyruk.push({ tur: 'metin', metin: 'D3 pinini kullanacağım.' })
    const { olaylar } = await kos(servisKur('ask'), 'led bağla', { onay: () => ({ approved: true, answer: 'D3' }) })
    const soru = olaylar.find((e) => e.type === 'approval') as Extract<AgentEvent, { type: 'approval' }>
    expect(soru.kind).toBe('question')
    expect(soru.options).toEqual(['D2', 'D3'])
    const sonuc = istekler[1].messages.find((m) => m.role === 'tool')
    expect(sonuc?.content).toContain('D3')
  })

  it('iptal edilince akışı keser ve "aborted" ile biter', async () => {
    kuyruk.push({ tur: 'asili' })
    const servis = servisKur('ask')
    const { done } = await kos(servis, 'uzun iş', {
      olayda: (e, runId) => {
        if (e.type === 'text') setTimeout(() => servis.abort(runId), 50)
      }
    })
    expect(done.aborted).toBe(true)
    expect(done.ok).toBe(false)
  })

  it('otomatik derleme: hata alırsa modele bildirir, düzeltince başarıyla biter', async () => {
    derlemeSonuclari = [
      { success: false, log: '', errors: [{ dosya: blinkIno, satir: 2, sutun: 3, mesaj: "'LED_X' was not declared", hamMetin: "error: 'LED_X' was not declared", tur: 'error' }] },
      { success: true, errors: [], log: '' }
    ]
    kuyruk.push({
      tur: 'arac',
      cagrilar: [{ ad: 'edit_file', args: { path: 'Blink/Blink.ino', old_text: 'LED_BUILTIN, OUTPUT', new_text: 'LED_X, OUTPUT' } }]
    })
    kuyruk.push({ tur: 'metin', metin: 'Değiştirdim.' }) // ilk bitiş → otomatik derleme (hata)
    kuyruk.push({
      tur: 'arac',
      cagrilar: [{ ad: 'edit_file', args: { path: 'Blink/Blink.ino', old_text: 'LED_X, OUTPUT', new_text: 'LED_BUILTIN, OUTPUT' } }]
    })
    kuyruk.push({ tur: 'metin', metin: 'Düzelttim.' }) // ikinci bitiş → otomatik derleme (başarılı)
    const { done, olaylar } = await kos(servisKur('full-auto', true), 'pini değiştir', {
      board: { name: 'Test Kart', fqbn: 'arduino:avr:uno' }
    })
    expect(derlemeCagrisi).toBe(2)
    expect(done.ok).toBe(true)
    const bildirim = istekler.flatMap((i) => i.messages).map((m) => m.content ?? '').join('\n')
    expect(bildirim).toMatch(/OTOMATİK DERLEME 1\//)
    expect(bildirim).toMatch(/LED_X/)
    expect(olaylar.filter((e) => e.type === 'compile_result').length).toBeGreaterThanOrEqual(2)
    expect(readFileSync(blinkIno, 'utf8')).toBe(ORIJINAL_INO)
  })

  it('derleme kilidi doluysa (UI derliyor) araç hata döner, agent çökmez', async () => {
    kilitHatasi = 'Zaten devam eden bir derleme veya yükleme işlemi var'
    kuyruk.push({ tur: 'arac', cagrilar: [{ ad: 'compile', args: {} }] })
    kuyruk.push({ tur: 'metin', metin: 'Şu an derleyemedim.' })
    const { done } = await kos(servisKur('full-auto'), 'derle', { board: { name: 'Test Kart', fqbn: 'arduino:avr:uno' } })
    expect(done.ok).toBe(true)
    const sonuc = istekler[1].messages.find((m) => m.role === 'tool')
    expect(sonuc?.content).toMatch(/Derleme başlatılamadı/)
    expect(derlemeCagrisi).toBe(0)
  })

  it('aynı araç çağrısını sonsuz döngüye sokan modeli durdurur', async () => {
    for (let i = 0; i < 6; i++) kuyruk.push({ tur: 'arac', cagrilar: [{ ad: 'read_file', args: { path: 'Blink/Blink.ino' } }] })
    kuyruk.push({ tur: 'metin', metin: 'Vazgeçtim.' })
    const { done } = await kos(servisKur('full-auto'), 'oku')
    const reddedilen = done.steps.filter((s) => !s.ok)
    expect(reddedilen.length).toBeGreaterThanOrEqual(1)
    const mesajlar = istekler.flatMap((i) => i.messages).map((m) => m.content ?? '').join('\n')
    expect(mesajlar).toMatch(/Aynı araç çağrısını/)
  })

  it('sağlayıcı hatasında (401) anlaşılır bir hata ile biter', async () => {
    // Gerçek bir 401 için sunucuya özel istek yerine geçersiz adres: bağlantı reddi
    const ayarlar: Record<string, unknown> = {
      aiBaseUrls: { openai: 'http://127.0.0.1:1/v1' },
      selectedModelPerProvider: { openai: 'gpt-4o' },
      agentPermissionMode: 'ask',
      customContextLimits: {}
    }
    const servis = new AgentService({
      secrets: { getDecryptedApiKey: () => 'sk-test' },
      settings: { get: (k: string) => ayarlar[k], getAll: () => ayarlar },
      arduino: {},
      boardSkills: { getBoardSkillProfile: async () => '', getRelevantExamplesContext: async () => '' },
      deviceLock: { runExclusive: async (f: () => Promise<unknown>) => f() },
      sketchService: new SketchService(),
      sketchbookDir: sketchbook,
      userDataDir: userData
    } as unknown as ConstructorParameters<typeof AgentService>[0])
    const { done } = await kos(servis, 'merhaba')
    expect(done.ok).toBe(false)
    expect(done.error).toBeTruthy()
  }, 60_000)
})
