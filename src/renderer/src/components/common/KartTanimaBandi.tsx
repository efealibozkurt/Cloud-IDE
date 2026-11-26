import { useEffect, useRef, useState, type ReactElement } from 'react'
import { temelFqbn } from '@shared/boardFqbn'
import { usbCipiBul } from '@shared/usbCipleri'
import { portTuru } from '@shared/portTanima'
import { useToast } from '../../state/ToastContext'
import { useAppState } from '../../state/AppStateContext'
import { Tus } from './Tus'
import { useT } from '../../i18n'

interface Oneri {
  port: string
  /** Kesin tanınan kart (kart paketi kurulu); yoksa yalnızca çip bilgisi gösterilir */
  kart?: { name: string; fqbn: string }
  cip?: { ad: string; aciklama: string }
}

/** {ad} biçimindeki yer tutucuları kalın metinle değiştirir */
function Yerlestir(metin: string, degerler: Record<string, string>): ReactElement {
  const parcalar = metin.split(/(\{\w+\})/)
  return (
    <>
      {parcalar.map((p, i) => {
        const m = /^\{(\w+)\}$/.exec(p)
        return m && m[1] in degerler ? (
          <span key={i} className="font-medium text-gray-100">
            {degerler[m[1]]}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      })}
    </>
  )
}

/**
 * Yeni bir kart USB'ye takılınca ekranın üstünde küçük bir öneri gösterir:
 *  - kart tanınıyorsa (ilgili kart paketi kurulu) "Uno bulundu, kullanılsın mı?"
 *  - tanınmıyorsa USB çipinden (CH340, CP210x…) ne tür bir kart olabileceğini söyler.
 * Dahili ve Bluetooth portları yok sayılır. Kartı kendiliğinden değiştirmez; yalnızca seçili port bir
 * kart portu değilse yeni takılan kartın portunu seçer ve bildirir.
 */
function KartTanimaBandi(): ReactElement | null {
  const t = useT()
  const { toastGoster } = useToast()
  const { state, selectFqbn, selectPort } = useAppState()
  const { ports, selectedFqbn, selectedPort } = state.arduinoCli
  const [oneri, setOneri] = useState<Oneri | null>(null)
  const oncekiPortlar = useRef<Set<string> | null>(null)
  const reddedilen = useRef<Set<string>>(new Set())

  useEffect(() => {
    const simdiki = new Set(ports.map((p) => p.address))
    const onceki = oncekiPortlar.current
    oncekiPortlar.current = simdiki

    // İlk liste açılışta gelir: kart takılıyken uygulamayı açan kullanıcıya yalnızca kart seçili değilse öneri yapılır
    const kartPortlari = ports.filter((p) => portTuru(p) === 'kart')

    // Seçili port bir kart değilse (boş, çıkarılmış, COM1 ya da Bluetooth) yeni gelen kartı seç
    const gelen = kartPortlari.find((p) => !onceki?.has(p.address))
    if (gelen && !kartPortlari.some((p) => p.address === selectedPort)) {
      selectPort(gelen.address)
      toastGoster(t('Kartınız {port} portunda bulundu ve seçildi.', { port: gelen.address }), 'bilgi')
    }

    const yeni = kartPortlari.filter((p) => p.protocol === 'serial' && (onceki ? !onceki.has(p.address) : !selectedFqbn) && !reddedilen.current.has(p.address))
    if (yeni.length === 0) {
      // Önerilen port çıkarıldıysa öneriyi kaldır
      setOneri((o) => (o && !simdiki.has(o.port) ? null : o))
      return
    }
    const p = yeni[0]
    const eslesen = p.matchingBoards.find((b) => b.fqbn)

    if (eslesen) {
      // Seçili kart zaten bu portun kartlarından biriyse söylenecek bir şey yok
      if (selectedFqbn && p.matchingBoards.some((b) => b.fqbn && temelFqbn(b.fqbn) === temelFqbn(selectedFqbn))) return
      setOneri({ port: p.address, kart: { name: eslesen.name, fqbn: eslesen.fqbn as string } })
      return
    }

    // Kart tanınmadı: USB çipinden ipucu ver
    void window.api.serial
      .listPorts()
      .then((liste) => {
        const bilgi = liste.find((x) => x.path === p.address)
        const cip = usbCipiBul(bilgi?.vendorId, bilgi?.productId)
        if (cip) setOneri({ port: p.address, cip })
      })
      .catch(() => undefined)
    // yalnızca port listesi değiştiğinde çalışsın
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ports])

  // Öneri 25 saniye sonra kendiliğinden kapanır
  useEffect(() => {
    if (!oneri) return
    const z = setTimeout(() => setOneri(null), 25_000)
    return () => clearTimeout(z)
  }, [oneri])

  if (!oneri) return null

  const kapat = (): void => {
    reddedilen.current.add(oneri.port)
    setOneri(null)
  }

  return (
    <div role="status" className="flex shrink-0 items-center gap-3 border-b border-accent/30 bg-accent/[0.09] px-4 py-2 text-xs">
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#7cc4f0]" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-gray-300">
        {oneri.kart ? (
          <>
            {Yerlestir(t('{port} portunda {kart} bulundu.'), { port: oneri.port, kart: oneri.kart.name })}
            {selectedFqbn && ` ${t('Seçili kart farklı.')}`}
          </>
        ) : (
          <>
            {Yerlestir(t('{port} portuna {cip} olan bir kart bağlandı.'), { port: oneri.port, cip: oneri.cip?.ad ?? '' })}{' '}
            <span className="text-gray-400">{oneri.cip?.aciklama}</span>
          </>
        )}
      </div>
      {oneri.kart && (
        <Tus
          tur="birincil"
          onClick={() => {
            selectFqbn(oneri.kart!.fqbn)
            selectPort(oneri.port)
            setOneri(null)
          }}
        >
          {t('Bu kartı kullan')}
        </Tus>
      )}
      <Tus onClick={kapat}>{t('Kapat')}</Tus>
    </div>
  )
}

export default KartTanimaBandi
