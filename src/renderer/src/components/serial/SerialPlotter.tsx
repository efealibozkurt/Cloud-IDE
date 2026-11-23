import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { seriOrnekleriniTopla } from '../../utils/seriCizici'
import { useT } from '../../i18n'

const RENKLER = ['#4fb3f0', '#f0a24f', '#5fd68a', '#e86a8a', '#c9b24f', '#4fd1c5', '#e0794f', '#a3b1c2']
const PENCERELER = [100, 300, 1000]
/** Ayrıştırılacak en fazla satır sayısı (son satırlar): çok uzun oturumlarda çizimi hızlı tutar */
const MAKS_SATIR = 4000

function sayiMetni(n: number): string {
  if (!Number.isFinite(n)) return '–'
  const mutlak = Math.abs(n)
  if (mutlak >= 1000) return n.toFixed(0)
  if (mutlak >= 100) return n.toFixed(1)
  return n.toFixed(2).replace(/\.?0+$/, '')
}

/**
 * Seri monitöre gelen sayıları canlı çizgi grafiğe çevirir. Kodda `Serial.println(deger)`,
 * `Serial.println("a:1 b:2")` ya da `1,2,3` biçimi kullanılabilir. Y ekseni kendiliğinden ölçeklenir.
 */
function SerialPlotter({ satirlar }: { satirlar: string[] }): ReactElement {
  const t = useT()
  const [pencere, setPencere] = useState(300)
  const [durdu, setDurdu] = useState(false)
  const [gizli, setGizli] = useState<Set<string>>(new Set())
  const donmus = useRef<string[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const kapRef = useRef<HTMLDivElement>(null)
  const [boyut, setBoyut] = useState({ w: 400, h: 160 })

  if (!durdu) donmus.current = satirlar
  const kaynak = durdu ? donmus.current : satirlar

  const seriler = useMemo(() => seriOrnekleriniTopla(kaynak.slice(-MAKS_SATIR), pencere), [kaynak, pencere])
  const gorunur = seriler.filter((s) => !gizli.has(s.ad))

  useEffect(() => {
    const el = kapRef.current
    if (!el) return
    const gozlemci = new ResizeObserver((e) => {
      const r = e[0]?.contentRect
      if (r && r.width > 0 && r.height > 0) setBoyut({ w: Math.floor(r.width), h: Math.floor(r.height) })
    })
    gozlemci.observe(el)
    return () => gozlemci.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = boyut.w * dpr
    canvas.height = boyut.h * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, boyut.w, boyut.h)

    const sol = 46
    const sag = 8
    const ust = 8
    const alt = 8
    const gw = boyut.w - sol - sag
    const gh = boyut.h - ust - alt
    if (gw <= 0 || gh <= 0) return

    const tum = gorunur.flatMap((s) => s.noktalar)
    let min = tum.length ? Math.min(...tum) : 0
    let max = tum.length ? Math.max(...tum) : 1
    if (min === max) {
      min -= 1
      max += 1
    }
    const bosluk = (max - min) * 0.08
    min -= bosluk
    max += bosluk

    ctx.font = '10px ui-monospace, Consolas, monospace'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'right'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = ust + (gh * i) / 4
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'
      ctx.beginPath()
      ctx.moveTo(sol, y + 0.5)
      ctx.lineTo(sol + gw, y + 0.5)
      ctx.stroke()
      ctx.fillStyle = 'rgba(160,168,180,0.9)'
      ctx.fillText(sayiMetni(max - ((max - min) * i) / 4), sol - 6, y)
    }

    gorunur.forEach((s) => {
      const renk = RENKLER[seriler.indexOf(s) % RENKLER.length]
      ctx.strokeStyle = renk
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'
      ctx.beginPath()
      const n = s.noktalar.length
      s.noktalar.forEach((v, i) => {
        // En yeni nokta sağda; pencere dolmadıysa grafik soldan sağa dolar
        const x = sol + (gw * (pencere - n + i)) / Math.max(1, pencere - 1)
        const y = ust + gh - ((v - min) / (max - min)) * gh
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    })
  }, [gorunur, seriler, boyut, pencere])

  const bos = seriler.length === 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-panel-border px-2 py-1">
        {seriler.map((s, i) => {
          const kapali = gizli.has(s.ad)
          const son = s.noktalar[s.noktalar.length - 1]
          return (
            <button
              key={s.ad}
              onClick={() =>
                setGizli((g) => {
                  const y = new Set(g)
                  if (y.has(s.ad)) y.delete(s.ad)
                  else y.add(s.ad)
                  return y
                })
              }
              title={kapali ? t('Çizgiyi göster') : t('Çizgiyi gizle')}
              className={`flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] hover:bg-white/[0.06] ${kapali ? 'opacity-40' : ''}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: RENKLER[i % RENKLER.length] }} />
              <span className="text-gray-300">{s.ad}</span>
              <span className="font-mono text-gray-500">{sayiMetni(son)}</span>
            </button>
          )
        })}
        <div className="flex-1" />
        <label className="flex items-center gap-1 text-[11px] text-gray-500">
          {t('Pencere')}
          <select
            value={pencere}
            onChange={(e) => setPencere(Number(e.target.value))}
            className="rounded border border-panel-border bg-panel px-1 py-0.5 text-gray-300"
          >
            {PENCERELER.map((p) => (
              <option key={p} value={p}>
                {t('{n} örnek', { n: p })}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => setDurdu((d) => !d)}
          className={`rounded border px-2 py-0.5 text-[11px] ${durdu ? 'border-amber-500/60 text-amber-300' : 'border-panel-border text-gray-400 hover:bg-panel-border'}`}
        >
          {durdu ? t('Devam') : t('Duraklat')}
        </button>
      </div>
      <div ref={kapRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} style={{ width: boyut.w, height: boyut.h }} className="absolute inset-0" />
        {bos && (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs leading-relaxed text-gray-600">
            {t('Çizilecek sayı bekleniyor. Kodunuzda Serial.println(deger) ya da Serial.println("sicaklik:" + String(t)) gibi sayı gönderin; birden çok değeri virgül veya boşlukla ayırabilirsiniz.')}
          </p>
        )}
      </div>
    </div>
  )
}

export default SerialPlotter
