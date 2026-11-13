import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import { fqbnSecenekleriyle, temelFqbn } from '@shared/boardFqbn'
import {
  AI_PROVIDERS,
  getModelContextLimit,
  type AgentChangeItem,
  type AgentDiffPreview,
  type AgentEvent,
  type AgentPlanItem,
  type AgentRunParams,
  type AgentToolStep,
  type ChatMessage,
  type ChatSession,
  type ChatSessionSummary,
  type CompileResult
} from '@shared/types'
import { tumKartlariDuzlestir, useAppState } from './AppStateContext'
import { useToast } from './ToastContext'
import { yeniKimlik } from '../utils/paths'

export interface CanliAdim {
  callId: string
  name: string
  label: string
  durum: 'calisiyor' | 'tamam' | 'hata'
  detail?: string
}

export interface BekleyenOnay {
  callId: string
  kind: 'permission' | 'question'
  name: string
  message: string
  options?: string[]
  diff?: AgentDiffPreview
}

/** Çalışmakta olan (henüz bitmemiş) bir agent turunun canlı durumu */
export interface CanliCalisma {
  runId: string
  metin: string
  dusunce: string
  durum: string
  uyari: boolean
  adimlar: CanliAdim[]
  plan: AgentPlanItem[]
  onay: BekleyenOnay | null
  derleme: CompileResult | null
}

export interface EklenenKod {
  kod: string
  aralik?: { filePath: string; startLine: number; endLine: number }
}

interface AgentBaglami {
  /** Aktif sketch'e ait sohbet oturumları (özet) */
  oturumlar: ChatSessionSummary[]
  aktifOturum: ChatSession | null
  mesajlar: ChatMessage[]
  calisma: CanliCalisma | null
  calisiyor: boolean
  ozetleniyor: boolean
  bildirim: string | null
  gonder: (metin: string, ek?: EklenenKod | null) => Promise<void>
  durdur: () => void
  onayCevapla: (approved: boolean, answer?: string) => void
  geriAl: (mesajId: string) => Promise<void>
  yeniSohbet: () => void
  oturumSec: (id: string) => Promise<void>
  oturumSil: (id: string) => Promise<void>
  gecmisiOzetle: () => Promise<void>
}

const Baglam = createContext<AgentBaglami | null>(null)

function bos(runId: string): CanliCalisma {
  return { runId, metin: '', dusunce: '', durum: 'Başlatılıyor…', uyari: false, adimlar: [], plan: [], onay: null, derleme: null }
}

function gecicibaslik(metin: string): string {
  const temiz = metin.replace(/\s+/g, ' ').trim()
  if (!temiz) return 'Yeni sohbet'
  return temiz.length > 40 ? `${temiz.slice(0, 38)}…` : temiz
}

/**
 * Agent oturumunu ve canlı çalışma durumunu panelden bağımsız tutar: panel
 * kapansa da çalışma devam eder, sonuç kaydedilir ve dosya değişiklikleri
 * editöre yansıtılır.
 */
export function AgentProvider({ children }: { children: ReactNode }): ReactElement {
  const { state, newSketch, syncAgentChanges, reloadSketchFolders } = useAppState()
  const { toastGoster } = useToast()

  const [oturumlar, setOturumlar] = useState<ChatSessionSummary[]>([])
  const [aktifOturum, setAktifOturum] = useState<ChatSession | null>(null)
  const [calisma, setCalisma] = useState<CanliCalisma | null>(null)
  const [ozetleniyor, setOzetleniyor] = useState(false)
  const [bildirim, setBildirim] = useState<string | null>(null)

  const stateRef = useRef(state)
  stateRef.current = state
  const oturumRef = useRef(aktifOturum)
  oturumRef.current = aktifOturum
  const calismaRef = useRef(calisma)
  calismaRef.current = calisma
  const senkronSayisiRef = useRef(0)
  /** Başlığı henüz yapay zekâ ile üretilmemiş, bu oturumda açılan yeni sohbetin kimliği */
  const baslikBekleyenRef = useRef<string | null>(null)
  const syncRef = useRef(syncAgentChanges)
  syncRef.current = syncAgentChanges

  const mesajlar = aktifOturum?.mesajlar ?? []
  const aktifKlasor = state.sketch.info?.folderPath ?? null

  const oturumKaydet = useCallback(async (oturum: ChatSession): Promise<void> => {
    try {
      await window.api.chat.saveSession(oturum)
    } catch (err) {
      console.error('[agent] Oturum kaydedilemedi:', err)
    }
  }, [])

  const listeyiYenile = useCallback(async (klasor: string): Promise<ChatSessionSummary[]> => {
    const liste = await window.api.chat.getSessions(klasor)
    setOturumlar(liste)
    return liste
  }, [])

  // Aktif sketch değişince o projeye ait oturumları yükle (çalışma sürerken mevcut oturum korunur)
  useEffect(() => {
    if (calismaRef.current) return
    if (!aktifKlasor) {
      setOturumlar([])
      setAktifOturum(null)
      return
    }
    let iptal = false
    void (async () => {
      try {
        const liste = await window.api.chat.getSessions(aktifKlasor)
        if (iptal) return
        setOturumlar(liste)
        const mevcut = oturumRef.current
        if (mevcut && mevcut.mesajlar.length > 0 && !liste.some((o) => o.id === mevcut.id)) {
          // Sketch yeniden adlandırıldı/taşındı: açık sohbeti koru ve yeni konuma bağla
          const guncel = { ...mevcut, sketchPath: aktifKlasor, sketchName: stateRef.current.sketch.info?.name ?? mevcut.sketchName }
          setAktifOturum(guncel)
          void oturumKaydet(guncel)
          return
        }
        if (liste.length > 0) {
          const hedef = mevcut && liste.some((o) => o.id === mevcut.id) ? mevcut.id : liste[0].id
          if (mevcut?.id === hedef) return
          const s = await window.api.chat.getSession(hedef)
          if (!iptal) setAktifOturum(s)
        } else {
          setAktifOturum(null)
        }
      } catch (err) {
        console.error('[agent] Sohbet geçmişi yüklenemedi:', err)
      }
    })()
    return () => {
      iptal = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktifKlasor])

  const olayIsle = useCallback(
    (e: AgentEvent): void => {
      const aktif = calismaRef.current
      if (!aktif || e.runId !== aktif.runId) return

      switch (e.type) {
        case 'text':
          setCalisma((c) => (c ? { ...c, metin: c.metin + e.delta } : c))
          break
        case 'reasoning':
          setCalisma((c) => (c ? { ...c, dusunce: c.dusunce + e.delta } : c))
          break
        case 'status':
          setCalisma((c) => (c ? { ...c, durum: e.message, uyari: Boolean(e.warning) } : c))
          break
        case 'tool_start':
          setCalisma((c) =>
            c
              ? { ...c, adimlar: [...c.adimlar, { callId: e.callId, name: e.name, label: e.label, durum: 'calisiyor' }] }
              : c
          )
          break
        case 'tool_end':
          setCalisma((c) =>
            c
              ? {
                  ...c,
                  adimlar: c.adimlar.map((a) =>
                    a.callId === e.callId ? { ...a, label: e.label, detail: e.detail, durum: e.ok ? 'tamam' : 'hata' } : a
                  )
                }
              : c
          )
          break
        case 'plan':
          setCalisma((c) => (c ? { ...c, plan: e.todos } : c))
          break
        case 'approval':
          setCalisma((c) =>
            c ? { ...c, onay: { callId: e.callId, kind: e.kind, name: e.name, message: e.message, options: e.options, diff: e.diff } } : c
          )
          break
        case 'compile_result':
          setCalisma((c) => (c ? { ...c, derleme: e.result } : c))
          break
        case 'changes': {
          // Yalnızca yeni eklenen değişiklikleri editöre yansıt (liste kümülatif gelir)
          const yeni: AgentChangeItem[] = e.changes.slice(senkronSayisiRef.current)
          senkronSayisiRef.current = e.changes.length
          if (yeni.length > 0) void syncRef.current(yeni)
          break
        }
        case 'done': {
          const oturum = oturumRef.current
          const kalan: AgentChangeItem[] = e.changes.slice(senkronSayisiRef.current)
          senkronSayisiRef.current = 0
          if (kalan.length > 0) void syncRef.current(kalan)

          const hataMi = !e.ok && !e.aborted
          const metin =
            e.text.trim() ||
            (e.aborted ? 'Çalışma durduruldu.' : e.error ? '' : e.steps.length > 0 ? 'İşlem tamamlandı.' : '')
          const govde = hataMi && e.error ? `${metin ? `${metin}\n\n` : ''}${e.error}` : e.aborted && e.error ? e.error : metin
          const asistan: ChatMessage = {
            id: yeniKimlik('msg'),
            rol: 'asistan',
            metin: govde || 'Yanıt alınamadı.',
            timestamp: Date.now(),
            isError: hataMi,
            toolSteps: e.steps as AgentToolStep[],
            checkpointId: e.checkpointId
          }
          if (oturum) {
            const guncel = { ...oturum, mesajlar: [...oturum.mesajlar, asistan], guncellemeTarihi: Date.now() }
            setAktifOturum(guncel)
            void oturumKaydet(guncel).then(async () => {
              if (guncel.sketchPath) void listeyiYenile(guncel.sketchPath)
              // İlk yanıt geldiyse: ilk mesajı kırpan geçici başlık yerine anlamlı bir başlık üret
              if (baslikBekleyenRef.current === guncel.id && e.ok && !e.aborted) {
                baslikBekleyenRef.current = null
                const ayarlar = stateRef.current.settings
                const saglayici = ayarlar?.selectedAiProvider ?? AI_PROVIDERS[0].id
                try {
                  const baslik = await window.api.chat.generateTitle({
                    sessionId: guncel.id,
                    provider: saglayici,
                    model: ayarlar?.selectedModelPerProvider?.[saglayici]
                  })
                  if (baslik) {
                    setAktifOturum((o) => (o && o.id === guncel.id ? { ...o, baslik } : o))
                    if (guncel.sketchPath) void listeyiYenile(guncel.sketchPath)
                  }
                } catch (err) {
                  console.warn('[agent] Başlık üretilemedi:', err)
                }
              }
            })
          }
          setCalisma(null)
          break
        }
      }
    },
    [listeyiYenile, oturumKaydet]
  )

  useEffect(() => window.api.agent.onEvent(olayIsle), [olayIsle])

  const gonder = useCallback(
    async (metin: string, ek?: EklenenKod | null): Promise<void> => {
      if (calismaRef.current) return
      const temiz = metin.trim()
      if (!temiz && !ek) return

      let sketch = stateRef.current.sketch.info
      if (!sketch) {
        sketch = await newSketch()
        if (!sketch) return
      }
      const ayarlar = stateRef.current.settings
      const saglayici = ayarlar?.selectedAiProvider ?? AI_PROVIDERS[0].id
      const model = ayarlar?.selectedModelPerProvider?.[saglayici]

      const govde = ek ? `${temiz ? `${temiz}\n\n` : ''}\`\`\`cpp\n${ek.kod}\n\`\`\`` : temiz
      const kullanici: ChatMessage = { id: yeniKimlik('msg'), rol: 'kullanici', metin: govde, timestamp: Date.now() }

      let oturum = oturumRef.current
      if (!oturum) {
        baslikBekleyenRef.current = null
        oturum = await window.api.chat.createSession(sketch.folderPath, sketch.name, gecicibaslik(temiz || 'Kod inceleme'))
      }
      if (oturum.mesajlar.length === 0) baslikBekleyenRef.current = oturum.id
      const guncel: ChatSession = { ...oturum, mesajlar: [...oturum.mesajlar, kullanici], guncellemeTarihi: Date.now() }
      oturumRef.current = guncel
      setAktifOturum(guncel)
      await oturumKaydet(guncel)

      const st = stateRef.current
      const aktifSekme = st.sketch.tabs.find((t) => t.path === st.sketch.activeTabPath) ?? st.sketch.tabs[0]
      const kartlar = tumKartlariDuzlestir(st.arduinoCli.platforms)
      const kart = kartlar.find((k) => k.fqbn === st.arduinoCli.selectedFqbn)
      const sketchYollari =
        st.sketch.workspaceSketches.length > 0 ? st.sketch.workspaceSketches.map((s) => s.folderPath) : [sketch.folderPath]

      const runId = yeniKimlik('run')
      const params: AgentRunParams = {
        runId,
        provider: saglayici,
        model,
        reasoningEffort: ayarlar?.selectedReasoningEffort ?? 'medium',
        messages: guncel.mesajlar
          .filter((m) => !m.isError)
          .map((m) => ({ rol: m.rol, metin: m.metin })),
        workspace: {
          activeSketchPath: st.sketch.activeSketchPath ?? sketch.folderPath,
          sketchPaths: sketchYollari,
          activeFilePath: aktifSekme?.path,
          selection: ek?.aralik
            ? { filePath: ek.aralik.filePath, startLine: ek.aralik.startLine, endLine: ek.aralik.endLine, text: ek.kod }
            : undefined
        },
        // Kart seçenekleri (işlemci, bölüm şeması…) FQBN'ye eklenir; asistanın derlemesi de kullanıcınınkiyle aynı olsun
        board: kart
          ? { name: kart.name, fqbn: fqbnSecenekleriyle(kart.fqbn, ayarlar?.boardOptions?.[temelFqbn(kart.fqbn)]), platformName: kart.platformName }
          : st.arduinoCli.selectedFqbn
          ? { fqbn: fqbnSecenekleriyle(st.arduinoCli.selectedFqbn, ayarlar?.boardOptions?.[temelFqbn(st.arduinoCli.selectedFqbn)]) }
          : undefined,
        port: st.arduinoCli.selectedPort,
        contextWindow: getModelContextLimit(saglayici, model ?? '', ayarlar?.customContextLimits),
        autoCompile: ayarlar?.agentAutoCompile ?? true
      }

      senkronSayisiRef.current = 0
      const baslangic = bos(runId)
      calismaRef.current = baslangic
      setCalisma(baslangic)
      try {
        await window.api.agent.run(params)
      } catch (err) {
        calismaRef.current = null
        setCalisma(null)
        toastGoster(err instanceof Error ? err.message : 'Agent başlatılamadı', 'hata')
      }
    },
    [newSketch, oturumKaydet, toastGoster]
  )

  const durdur = useCallback((): void => {
    const c = calismaRef.current
    if (c) void window.api.agent.abort(c.runId)
  }, [])

  const onayCevapla = useCallback((approved: boolean, answer?: string): void => {
    const c = calismaRef.current
    if (!c?.onay) return
    const callId = c.onay.callId
    setCalisma((x) => (x ? { ...x, onay: null } : x))
    void window.api.agent.reply(c.runId, callId, { approved, answer })
  }, [])

  const geriAl = useCallback(
    async (mesajId: string): Promise<void> => {
      const oturum = oturumRef.current
      const mesaj = oturum?.mesajlar.find((m) => m.id === mesajId)
      if (!oturum || !mesaj?.checkpointId || mesaj.undone) return
      try {
        const sonuc = await window.api.agent.undo(mesaj.checkpointId)
        if (sonuc.affectedFolders.length > 0) await reloadSketchFolders(sonuc.affectedFolders)
        if (!sonuc.ok) {
          toastGoster(sonuc.error ?? 'Bazı değişiklikler geri alınamadı', 'hata')
          return
        }
        const guncel = { ...oturum, mesajlar: oturum.mesajlar.map((m) => (m.id === mesajId ? { ...m, undone: true } : m)) }
        setAktifOturum(guncel)
        await oturumKaydet(guncel)
        toastGoster('Değişiklikler geri alındı', 'basari')
      } catch (err) {
        toastGoster(err instanceof Error ? err.message : 'Geri alma başarısız', 'hata')
      }
    },
    [oturumKaydet, reloadSketchFolders, toastGoster]
  )

  const yeniSohbet = useCallback((): void => {
    if (calismaRef.current) return
    setAktifOturum(null)
  }, [])

  const oturumSec = useCallback(async (id: string): Promise<void> => {
    if (calismaRef.current) return
    try {
      const s = await window.api.chat.getSession(id)
      if (s) setAktifOturum(s)
    } catch (err) {
      console.error('[agent] Oturum açılamadı:', err)
    }
  }, [])

  const oturumSil = useCallback(
    async (id: string): Promise<void> => {
      try {
        await window.api.chat.deleteSession(id)
        const klasor = stateRef.current.sketch.info?.folderPath
        const liste = klasor ? await listeyiYenile(klasor) : []
        if (oturumRef.current?.id === id) {
          if (liste.length > 0) await oturumSec(liste[0].id)
          else setAktifOturum(null)
        }
      } catch (err) {
        console.error('[agent] Oturum silinemedi:', err)
      }
    },
    [listeyiYenile, oturumSec]
  )

  const gecmisiOzetle = useCallback(async (): Promise<void> => {
    const oturum = oturumRef.current
    if (!oturum || calismaRef.current || ozetleniyor) return
    const ayarlar = stateRef.current.settings
    const saglayici = ayarlar?.selectedAiProvider ?? AI_PROVIDERS[0].id
    const model = ayarlar?.selectedModelPerProvider?.[saglayici] ?? ''
    setOzetleniyor(true)
    setBildirim('Eski mesajlar özetleniyor…')
    try {
      const res = await window.api.chat.compactSession({ sessionId: oturum.id, provider: saglayici, model })
      if (res.success && res.session) {
        setAktifOturum(res.session)
        setBildirim('Eski mesajlar özetlendi.')
      } else {
        setBildirim(res.error ?? 'Özetleme tamamlanamadı.')
      }
    } catch (err) {
      setBildirim(`Özetleme başarısız: ${err instanceof Error ? err.message : 'bilinmeyen hata'}`)
    } finally {
      setOzetleniyor(false)
      setTimeout(() => setBildirim(null), 4000)
    }
  }, [ozetleniyor])

  const deger = useMemo<AgentBaglami>(
    () => ({
      oturumlar,
      aktifOturum,
      mesajlar,
      calisma,
      calisiyor: calisma !== null,
      ozetleniyor,
      bildirim,
      gonder,
      durdur,
      onayCevapla,
      geriAl,
      yeniSohbet,
      oturumSec,
      oturumSil,
      gecmisiOzetle
    }),
    [oturumlar, aktifOturum, mesajlar, calisma, ozetleniyor, bildirim, gonder, durdur, onayCevapla, geriAl, yeniSohbet, oturumSec, oturumSil, gecmisiOzetle]
  )

  return <Baglam.Provider value={deger}>{children}</Baglam.Provider>
}

export function useAgent(): AgentBaglami {
  const b = useContext(Baglam)
  if (!b) throw new Error('useAgent, AgentProvider içinde kullanılmalı')
  return b
}
