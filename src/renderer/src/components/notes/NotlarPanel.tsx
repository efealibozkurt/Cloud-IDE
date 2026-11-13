import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { pinOzetiCikar } from '@shared/pinCheck'
import { fqbnSecenekleriyle, temelFqbn } from '@shared/boardFqbn'
import { useAppState } from '../../state/AppStateContext'
import { useToast } from '../../state/ToastContext'
import { Tus } from '../common/Tus'
import {
  NOTLAR_DOSYA_ADI,
  NOTLAR_SABLONU,
  koddanOzetBlogu,
  kutuIlerlemesi,
  kutuphaneBaslikliklariniBul,
  kutuyuDegistir,
  notSatirlariniAyir
} from '../../utils/notlar'

const KAYIT_GECIKMESI_MS = 700
const KAYNAK_TURLERI = new Set(['ino', 'h', 'hpp', 'cpp', 'c'])

function notYolu(klasor: string): string {
  return `${klasor.replace(/[\\/]+$/, '')}/${NOTLAR_DOSYA_ADI}`
}

/**
 * Proje notları: bağlantılar, kullanılan parçalar, yapılacaklar. Projenin klasöründe NOTLAR.md olarak durur;
 * sürüm geçmişine ve .zip paketine kodla birlikte girer. Yazdıkça kendiliğinden kaydedilir.
 */
function NotlarPanel(): ReactElement {
  const { state } = useAppState()
  const { toastGoster } = useToast()
  const proje = state.sketch.activeSketchPath || state.sketch.info?.folderPath || null

  const [metin, setMetin] = useState('')
  const [yuklendi, setYuklendi] = useState(false)
  const [duzenle, setDuzenle] = useState(false)
  const [durum, setDurum] = useState<'kaydedildi' | 'kaydediliyor' | 'hata'>('kaydedildi')

  const metinRef = useRef('')
  const kirliRef = useRef(false)
  const projeRef = useRef<string | null>(null)
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null)

  const kaydet = useCallback(async (): Promise<void> => {
    const klasor = projeRef.current
    if (!klasor || !kirliRef.current) return
    kirliRef.current = false
    setDurum('kaydediliyor')
    try {
      await window.api.sketch.writeFile(notYolu(klasor), metinRef.current)
      setDurum('kaydedildi')
    } catch {
      kirliRef.current = true
      setDurum('hata')
    }
  }, [])

  // Proje değişince önce eskisinin bekleyen notunu yaz, sonra yenisini oku
  useEffect(() => {
    let iptal = false
    const gec = async (): Promise<void> => {
      if (zamanlayici.current) clearTimeout(zamanlayici.current)
      await kaydet()
      projeRef.current = proje
      setYuklendi(false)
      if (!proje) return
      let icerik = ''
      try {
        icerik = await window.api.sketch.readFile(notYolu(proje))
      } catch {
        icerik = '' // dosya henüz yok
      }
      if (iptal) return
      metinRef.current = icerik
      kirliRef.current = false
      setMetin(icerik)
      setDuzenle(icerik.trim() === '')
      setDurum('kaydedildi')
      setYuklendi(true)
    }
    void gec()
    return () => {
      iptal = true
    }
  }, [proje, kaydet])

  // Panel kapanırken bekleyen notu kaybetme
  useEffect(() => {
    return () => {
      if (zamanlayici.current) clearTimeout(zamanlayici.current)
      void kaydet()
    }
  }, [kaydet])

  const degistir = (yeni: string): void => {
    metinRef.current = yeni
    kirliRef.current = true
    setMetin(yeni)
    setDurum('kaydediliyor')
    if (zamanlayici.current) clearTimeout(zamanlayici.current)
    zamanlayici.current = setTimeout(() => void kaydet(), KAYIT_GECIKMESI_MS)
  }

  const koddanDoldur = async (): Promise<void> => {
    const bilgi = state.sketch.workspaceSketches.find((s) => s.folderPath === proje) ?? state.sketch.info
    if (!bilgi) return
    const dosyalar: Array<{ dosya: string; icerik: string }> = []
    for (const f of bilgi.files) {
      if (!KAYNAK_TURLERI.has(f.kind)) continue
      const acik = state.sketch.tabs.find((t) => t.path === f.path)
      try {
        dosyalar.push({ dosya: f.path, icerik: acik ? acik.content : await window.api.sketch.readFile(f.path) })
      } catch {
        // okunamayan dosya atlanır
      }
    }
    const fqbn = state.arduinoCli.selectedFqbn
    const tamFqbn = fqbn ? fqbnSecenekleriyle(fqbn, state.settings?.boardOptions?.[temelFqbn(fqbn)]) : null
    const ozet = pinOzetiCikar(dosyalar, fqbn)
    const blok = koddanOzetBlogu(
      kutuphaneBaslikliklariniBul(dosyalar.map((d) => d.icerik)),
      ozet.kullanimlar.map((k) => ({ pin: k.pin, roller: k.roller })),
      tamFqbn
    )
    degistir(metinRef.current.trim() ? `${metinRef.current.replace(/\s+$/, '')}\n\n${blok}\n` : `${blok}\n`)
    toastGoster('Koddan çıkarılan bilgiler notlara eklendi', 'basari')
  }

  if (!proje) return <p className="px-3 py-4 text-xs text-gray-500">Notlar için önce bir proje açın.</p>

  const ilerleme = kutuIlerlemesi(metin)
  const satirlar = notSatirlariniAyir(metin)

  return (
    <div className="flex h-full flex-col text-xs">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-panel-border px-3 py-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-gray-200" title={proje}>
            {proje.split(/[\\/]/).filter(Boolean).pop()}
          </div>
          <div className="text-[11px] text-gray-500">
            {durum === 'kaydediliyor' ? 'Kaydediliyor…' : durum === 'hata' ? 'Kaydedilemedi' : metin.trim() ? 'Kaydedildi' : 'Henüz not yok'}
            {ilerleme.toplam > 0 && ` · ${ilerleme.yapilan}/${ilerleme.toplam} yapıldı`}
          </div>
        </div>
        <div role="tablist" aria-label="Görünüm" className="flex shrink-0 gap-0.5 rounded-[5px] border border-panel-border bg-panel p-0.5">
          {[
            [false, 'Önizle'],
            [true, 'Düzenle']
          ].map(([deger, ad]) => (
            <button
              key={String(ad)}
              role="tab"
              aria-selected={duzenle === deger}
              onClick={() => setDuzenle(deger as boolean)}
              className={`rounded-[3px] px-2 py-0.5 text-[11px] ${duzenle === deger ? 'bg-panel-light text-gray-100' : 'text-gray-500 hover:text-gray-200'}`}
            >
              {ad as string}
            </button>
          ))}
        </div>
      </div>

      {ilerleme.toplam > 0 && (
        <div className="h-0.5 shrink-0 bg-white/10" aria-hidden="true">
          <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${(ilerleme.yapilan / ilerleme.toplam) * 100}%` }} />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {!yuklendi ? (
          <p className="px-3 py-3 text-gray-500">Yükleniyor…</p>
        ) : duzenle ? (
          <textarea
            value={metin}
            onChange={(e) => degistir(e.target.value)}
            spellCheck={false}
            placeholder={'Bağlantı notları, kullandığınız parçalar, yapılacaklar…\n\n- [ ] ile onay kutusu yazabilirsiniz.'}
            aria-label="Proje notları"
            className="h-full w-full resize-none bg-transparent px-3 py-3 font-mono text-[12px] leading-relaxed text-gray-200 outline-none placeholder:text-gray-600"
          />
        ) : metin.trim() === '' ? (
          <div className="px-3 py-4">
            <p className="leading-relaxed text-gray-500">Bu proje için not yok. Hangi parçayı nereye bağladığınızı ya da neyin kaldığını yazın; sonradan çok işe yarar.</p>
          </div>
        ) : (
          <div className="px-3 py-3 [overflow-wrap:anywhere]">
            {satirlar.map((s, i) => {
              if (s.tur === 'bos') return <div key={i} className="h-2" />
              if (s.tur === 'baslik1') return <h3 key={i} className="mb-1 mt-1 text-[14px] font-semibold text-gray-100">{s.metin}</h3>
              if (s.tur === 'baslik2') return <h4 key={i} className="mb-1 mt-3 text-[12.5px] font-semibold text-gray-200">{s.metin}</h4>
              if (s.tur === 'kutu') {
                return (
                  <label key={i} className="flex cursor-pointer items-start gap-2 py-0.5 text-gray-300 hover:text-gray-100">
                    <input type="checkbox" checked={s.isaretli} onChange={() => degistir(kutuyuDegistir(metinRef.current, s.satir))} className="mt-0.5 accent-accent" />
                    <span className={`min-w-0 flex-1 ${s.isaretli ? 'text-gray-500 line-through' : ''}`}>{s.metin || <span className="text-gray-600">(boş)</span>}</span>
                  </label>
                )
              }
              if (s.tur === 'madde') {
                return (
                  <div key={i} className="flex gap-2 py-0.5 text-gray-300">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gray-600" />
                    <span className="min-w-0 flex-1">{s.metin || <span className="text-gray-600">(boş)</span>}</span>
                  </div>
                )
              }
              return <p key={i} className="py-0.5 leading-relaxed text-gray-300">{s.metin}</p>
            })}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-panel-border px-3 py-2">
        {yuklendi && metin.trim() === '' && (
          <Tus
            onClick={() => {
              degistir(NOTLAR_SABLONU)
              setDuzenle(true)
            }}
          >
            Şablonla başla
          </Tus>
        )}
        <Tus onClick={() => void koddanDoldur()} disabled={!yuklendi} title="Kodda kullanılan kütüphaneleri ve pinleri notlara ekler">
          Koddan doldur
        </Tus>
      </div>
      <p className="shrink-0 px-3 pb-2 text-[10.5px] leading-snug text-gray-600">{NOTLAR_DOSYA_ADI} olarak proje klasöründe durur; sürüm geçmişine ve .zip paketine girer.</p>
    </div>
  )
}

export default NotlarPanel
