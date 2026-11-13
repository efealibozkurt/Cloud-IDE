import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactElement } from 'react'
import { Tus } from '../common/Tus'

export const TUR_GORULDU_ANAHTARI = 'cloud_ide_tur_goruldu'

interface TurAdimi {
  /** `data-tur` özniteliği; yoksa adım ekranın ortasında gösterilir */
  hedef?: string
  baslik: string
  metin: string
  /** Kartın hedefe göre yeri */
  yer?: 'alt' | 'sag' | 'ust'
}

const ADIMLAR: TurAdimi[] = [
  {
    baslik: 'Cloud IDE’ye hoş geldiniz',
    metin: 'En önemli yerleri 30 saniyede gösterelim. İstediğiniz an “Atla” diyebilir, turu sonradan Yardım penceresinden yeniden başlatabilirsiniz.'
  },
  {
    hedef: 'kart',
    yer: 'alt',
    baslik: '1 · Kartınızı seçin',
    metin: 'Önce hangi kartı kullandığınızı söyleyin. Listede yoksa soldaki Kart yöneticisinden kartınızın paketini kurun.'
  },
  {
    hedef: 'port',
    yer: 'alt',
    baslik: '2 · Portu seçin',
    metin: 'Kartı USB ile bağlayınca burada yeni bir port (ör. COM3) belirir. Liste kendiliğinden yenilenir.'
  },
  {
    hedef: 'yancubuk',
    yer: 'sag',
    baslik: 'Yan çubuk',
    metin: 'Projeleriniz, sürüm geçmişi, kart yöneticisi ve kütüphane yöneticisi burada. Simgeye tekrar tıklamak paneli daraltır.'
  },
  {
    hedef: 'sablon',
    yer: 'sag',
    baslik: 'Hazır projelerle başlayın',
    metin: 'Şablondan proje: LED, sensör, ekran, Wi-Fi gibi çalışan projeler; pinler ve bağlantı şemasıyla birlikte gelir.'
  },
  {
    hedef: 'derle',
    yer: 'alt',
    baslik: '3 · Derleyin ve yükleyin',
    metin: 'Derle kodu denetler (Ctrl+R), Yükle önce derler sonra karta gönderir (Ctrl+U). Hatalar altta Problems sekmesinde görünür.'
  },
  {
    hedef: 'ornekler',
    yer: 'alt',
    baslik: 'Örnekler',
    metin: 'Kurduğunuz kart ve kütüphanelerin hazır örnekleri burada. Yeni bir kütüphaneyi denemenin en kolay yolu.'
  },
  {
    hedef: 'cloudai',
    yer: 'alt',
    baslik: 'Cloud AI asistanı',
    metin: 'Kod yazdırın, hata açıklatın, derleyip düzelttirin. Dosyaya yazmadan önce size farkı gösterir; isterseniz her değişikliği geri alabilirsiniz.'
  },
  {
    hedef: 'yardim',
    yer: 'alt',
    baslik: 'Her an yanınızda',
    metin: 'Takıldığınız yerde bu düğmeye ya da F1’e basın; bölüm başlıklarındaki küçük ? düğmeleri doğrudan o bölümün yardımını açar. İyi çalışmalar!'
  }
]

interface Kutu {
  top: number
  left: number
  width: number
  height: number
}

/**
 * İlk açılış turu: ekranın önemli yerlerini sırayla aydınlatır. Hedef öğeler `data-tur` özniteliğiyle
 * işaretlidir; ekranda bulunmayan (ör. kapalı bir panel) adımlar kendiliğinden atlanır.
 */
function TurRehberi({ onBitti }: { onBitti: () => void }): ReactElement | null {
  const [sira, setSira] = useState(0)
  const [kutu, setKutu] = useState<Kutu | null>(null)
  const [olcum, setOlcum] = useState(0)

  const gorunenAdimlar = useMemo(
    () => ADIMLAR.filter((a) => !a.hedef || document.querySelector(`[data-tur="${a.hedef}"]`)),
    // Tur açıldığı anda ekranda olan hedefler esas alınır
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const adim = gorunenAdimlar[sira]

  const bitir = useCallback(() => {
    try {
      localStorage.setItem(TUR_GORULDU_ANAHTARI, '1')
    } catch {
      // depolama kullanılamıyorsa tur bir sonraki açılışta yeniden çıkabilir
    }
    onBitti()
  }, [onBitti])

  const ileri = useCallback(() => {
    if (sira >= gorunenAdimlar.length - 1) bitir()
    else setSira((s) => s + 1)
  }, [sira, gorunenAdimlar.length, bitir])

  const geri = useCallback(() => setSira((s) => Math.max(0, s - 1)), [])

  useLayoutEffect(() => {
    if (!adim?.hedef) {
      setKutu(null)
      return
    }
    const el = document.querySelector(`[data-tur="${adim.hedef}"]`)
    if (!el) {
      setKutu(null)
      return
    }
    const r = el.getBoundingClientRect()
    setKutu({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [adim, olcum])

  useEffect(() => {
    const yenile = (): void => setOlcum((o) => o + 1)
    window.addEventListener('resize', yenile)
    return () => window.removeEventListener('resize', yenile)
  }, [])

  useEffect(() => {
    const tus = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') bitir()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        ileri()
      } else if (e.key === 'ArrowLeft') geri()
    }
    window.addEventListener('keydown', tus)
    return () => window.removeEventListener('keydown', tus)
  }, [bitir, ileri, geri])

  if (!adim) return null

  const KART_GENISLIK = 320
  const pad = 6
  let kartStil: { top: number; left: number }
  if (kutu) {
    const yer = adim.yer ?? 'alt'
    let top = yer === 'ust' ? kutu.top - 150 : yer === 'sag' ? kutu.top : kutu.top + kutu.height + 14
    let left = yer === 'sag' ? kutu.left + kutu.width + 14 : kutu.left
    left = Math.min(Math.max(12, left), window.innerWidth - KART_GENISLIK - 12)
    top = Math.min(Math.max(12, top), window.innerHeight - 190)
    kartStil = { top, left }
  } else {
    kartStil = { top: window.innerHeight / 2 - 90, left: window.innerWidth / 2 - KART_GENISLIK / 2 }
  }

  return (
    <div className="fixed inset-0 z-[85]" role="dialog" aria-modal="true" aria-label="Başlangıç turu">
      {kutu ? (
        <div
          className="pointer-events-none absolute rounded-[8px] ring-2 ring-[#7cc4f0]"
          style={{
            top: kutu.top - pad,
            left: kutu.left - pad,
            width: kutu.width + pad * 2,
            height: kutu.height + pad * 2,
            boxShadow: '0 0 0 9999px rgba(6, 10, 16, 0.68), 0 0 22px 2px rgba(124,196,240,0.35)',
            transition: 'all 220ms ease'
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[#060a10]/70" />
      )}

      <div
        className="absolute rounded-[8px] border border-panel-border bg-panel-light p-4 shadow-2xl"
        style={{ ...kartStil, width: KART_GENISLIK, transition: 'top 220ms ease, left 220ms ease' }}
      >
        <p className="font-mono text-[10.5px] tracking-wide text-gray-500">
          {sira + 1} / {gorunenAdimlar.length}
        </p>
        <h3 className="mt-1 text-[14px] font-semibold text-gray-100">{adim.baslik}</h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-400">{adim.metin}</p>
        <div className="mt-4 flex items-center justify-between">
          <button onClick={bitir} className="text-[12px] text-gray-500 hover:text-gray-200">
            Atla
          </button>
          <div className="flex gap-2">
            {sira > 0 && <Tus onClick={geri}>Geri</Tus>}
            <Tus tur="birincil" onClick={ileri} autoFocus>
              {sira >= gorunenAdimlar.length - 1 ? 'Bitir' : 'İleri'}
            </Tus>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TurRehberi
