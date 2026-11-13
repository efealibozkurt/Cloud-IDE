import { useEffect, useState, type ReactElement } from 'react'
import type { PinSorunu } from '@shared/pinCheck'
import { eksikBaslikBul } from '@shared/errorHints'
import type { DerlemeHatasi, LibrarySuggestionResult } from '@shared/types'
import { useAppState } from '../../state/AppStateContext'
import { useToast } from '../../state/ToastContext'
import { ayniDosyaMi } from '../../utils/paths'

/** Dosya adını yoldan çıkarır (hem / hem \ ayraçlarını destekler) */
function dosyaAdi(yol: string): string {
  return yol.split(/[\\/]/).pop() ?? yol
}

const TUR_RENGI: Record<string, string> = {
  error: 'text-red-400',
  warning: 'text-amber-400',
  note: 'text-gray-500'
}
const TUR_ETIKETI: Record<string, string> = {
  error: 'Hata',
  warning: 'Uyarı',
  note: 'Not'
}

const KUCUK_DUGME =
  'rounded border border-panel-border px-2 py-0.5 text-[11px] text-gray-300 transition-colors hover:enabled:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Alt panelin "Problems" sekmesi: son derlemedeki hata/uyarıları listeler.
 * Bir satıra tıklamak, dosyayı (sketch içindeyse) açıp o satıra gider. Her hatada "Açıkla" ile
 * Cloud AI'a hata ve çevresindeki kod gönderilir; eksik kütüphane hatalarında tek tıkla kurulum önerilir.
 */
function ProblemsPanel({ pinSorunlari }: { pinSorunlari: PinSorunu[] }): ReactElement {
  const { state, requestReveal } = useAppState()
  const { errors, currentOperation } = state.build

  if (currentOperation === 'compile') {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-xs text-gray-500">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        Derleniyor...
      </div>
    )
  }

  if (errors.length === 0 && pinSorunlari.length === 0) {
    return <p className="p-2 text-xs text-gray-500">Sorun bulunamadı. Derlemek için Ctrl+R kullanın.</p>
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden text-xs">
      {errors.map((hata, i) => (
        <HataSatiri key={i} hata={hata} onGit={() => hata.dosya && void requestReveal(hata.dosya, hata.satir)} />
      ))}
      {pinSorunlari.length > 0 && (
        <>
          <div className="sticky top-0 border-b border-panel-border bg-panel-light px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Pin denetimi · seçili karta göre
          </div>
          {pinSorunlari.map((s, i) => (
            <button
              key={`pin-${i}`}
              onClick={() => void requestReveal(s.dosya, s.satir)}
              className="flex w-full items-start gap-2 border-b border-panel-border px-2 py-1.5 text-left hover:bg-panel-border/50"
            >
              <span className={`shrink-0 font-semibold ${TUR_RENGI[s.tur]}`}>{TUR_ETIKETI[s.tur]}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-gray-300 [overflow-wrap:anywhere]">{s.mesaj}</span>
                <span className="block truncate text-gray-500">
                  {dosyaAdi(s.dosya)}:{s.satir}:{s.sutun}
                </span>
              </span>
            </button>
          ))}
        </>
      )}
    </div>
  )
}

function HataSatiri({ hata, onGit }: { hata: DerlemeHatasi; onGit: () => void }): ReactElement {
  const { state, askDretAi } = useAppState()
  const baslik = hata.tur === 'error' ? eksikBaslikBul(hata.mesaj, hata.hamMetin) : null

  const aiyaSor = async (): Promise<void> => {
    const acik = state.sketch.tabs.find((t) => ayniDosyaMi(t.path, hata.dosya))
    let icerik = acik?.content
    if (icerik === undefined) {
      try {
        icerik = await window.api.sketch.readFile(hata.dosya)
      } catch {
        icerik = ''
      }
    }
    const satirlar = icerik.split('\n')
    const bas = Math.max(1, hata.satir - 8)
    const son = Math.min(satirlar.length, hata.satir + 8)
    const parca = satirlar.slice(bas - 1, son).join('\n')
    const kart = state.arduinoCli.selectedFqbn ? `\nKart: ${state.arduinoCli.selectedFqbn}` : ''
    askDretAi(
      parca,
      `Derleme hatası (${dosyaAdi(hata.dosya)}:${hata.satir}): ${hata.mesaj}${kart}\n\nBu hata ne anlama geliyor? Önce nedenini kısaca açıkla, sonra nasıl düzelteceğimi göster.`,
      { filePath: hata.dosya, startLine: bas, endLine: son, startColumn: 1, endColumn: (satirlar[son - 1]?.length ?? 0) + 1 }
    )
  }

  return (
    <div className="border-b border-panel-border">
      <div className="flex items-start gap-2 px-2 py-1.5 hover:bg-panel-border/50">
        <button onClick={onGit} className="flex min-w-0 flex-1 items-start gap-2 text-left">
          <span className={`shrink-0 font-semibold ${TUR_RENGI[hata.tur]}`}>{TUR_ETIKETI[hata.tur]}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-gray-300 [overflow-wrap:anywhere]">{hata.mesaj}</span>
            {hata.dosya && (
              <span className="block truncate text-gray-500">
                {dosyaAdi(hata.dosya)}:{hata.satir}:{hata.sutun}
              </span>
            )}
          </span>
        </button>
        {hata.tur !== 'note' && hata.dosya && (
          <button onClick={() => void aiyaSor()} className={KUCUK_DUGME} title="Hatayı ve çevresindeki kodu Cloud AI'a gönder">
            Açıkla
          </button>
        )}
      </div>
      {baslik && <EksikKutuphane baslik={baslik} />}
    </div>
  )
}

/** "X.h bulunamadı" hatası için kurulabilecek kütüphaneleri getirir; tek tıkla kurar ve derler. */
function EksikKutuphane({ baslik }: { baslik: string }): ReactElement {
  const { compileActive } = useAppState()
  const { toastGoster } = useToast()
  const [sonuc, setSonuc] = useState<LibrarySuggestionResult | null | 'hata'>(null)
  const [kuruluyor, setKuruluyor] = useState<string | null>(null)

  useEffect(() => {
    let iptal = false
    window.api.arduinoCli
      .suggestLibrary(baslik)
      .then((s) => !iptal && setSonuc(s))
      .catch(() => !iptal && setSonuc('hata'))
    return () => {
      iptal = true
    }
  }, [baslik])

  const kur = async (ad: string, sonraDerle: boolean): Promise<void> => {
    setKuruluyor(ad)
    try {
      await window.api.arduinoCli.installLibrary(ad, undefined, crypto.randomUUID())
      toastGoster(`“${ad}” kuruldu`, 'basari')
      setSonuc((s) => (s && s !== 'hata' ? { ...s, adaylar: s.adaylar.map((a) => (a.name === ad ? { ...a, installed: true } : a)) } : s))
      if (sonraDerle) await compileActive()
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : `“${ad}” kurulamadı`, 'hata')
    } finally {
      setKuruluyor(null)
    }
  }

  const kutu = 'mx-2 mb-2 rounded-[6px] border border-accent/40 bg-accent/[0.07] px-2.5 py-2 text-gray-300'

  if (sonuc === null) return <div className={`${kutu} text-gray-500`}>“{baslik}” için kütüphane aranıyor…</div>
  if (sonuc === 'hata') {
    return <div className={`${kutu} text-gray-400`}>“{baslik}” için öneri alınamadı. Kütüphane yöneticisinden elle arayabilirsiniz.</div>
  }
  if (sonuc.kartPaketiBasligi) {
    return (
      <div className={kutu}>
        “{baslik}” kart paketiyle birlikte gelir. Seçili kartın doğru olduğundan ve kart paketinin kurulu olduğundan emin olun (Kart yöneticisi).
      </div>
    )
  }
  if (sonuc.adaylar.length === 0) {
    return <div className={`${kutu} text-gray-400`}>“{baslik}” kütüphane dizininde bulunamadı. Kütüphaneyi GitHub’dan .zip olarak elle eklemeniz gerekebilir.</div>
  }
  return (
    <div className={kutu}>
      <p className="mb-1.5 text-gray-400">“{baslik}” için kurulabilecek kütüphane:</p>
      <ul className="space-y-1.5">
        {sonuc.adaylar.map((a, i) => (
          <li key={a.name} className="flex items-center gap-2">
            <span className="min-w-0 flex-1">
              <span className="font-medium text-gray-100">{a.name}</span>
              {i === 0 && <span className="ml-1.5 text-[10.5px] text-accent">önerilen</span>}
              {a.sentence && <span className="block truncate text-[11px] text-gray-500">{a.sentence}</span>}
            </span>
            {a.installed ? (
              <button onClick={() => void compileActive()} className={KUCUK_DUGME}>
                Kurulu · derle
              </button>
            ) : (
              <>
                <button onClick={() => void kur(a.name, true)} disabled={kuruluyor !== null} className={`${KUCUK_DUGME} !border-accent !text-accent-hover`}>
                  {kuruluyor === a.name ? 'Kuruluyor…' : 'Kur ve derle'}
                </button>
                <button onClick={() => void kur(a.name, false)} disabled={kuruluyor !== null} className={KUCUK_DUGME}>
                  Yalnız kur
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ProblemsPanel
