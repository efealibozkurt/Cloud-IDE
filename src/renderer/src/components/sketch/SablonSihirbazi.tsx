import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { pinleriDenetle } from '@shared/pinCheck'
import {
  AILE_ADI,
  SABLONLAR,
  alanHatasi,
  kartAilesiBul,
  tumAlanlarGecerliMi,
  varsayilanDegerler,
  type Degerler,
  type Sablon,
  type SablonKategorisi
} from '@shared/sablonlar'
import { useAppState } from '../../state/AppStateContext'
import { useToast } from '../../state/ToastContext'
import { Tus } from '../common/Tus'

const KATEGORILER: SablonKategorisi[] = ['Temel', 'Sensör', 'Hareket', 'Ekran', 'Kablosuz']

/**
 * "Şablondan proje" sihirbazı: hazır bir proje seçilir, pin ve ayarlar doldurulur, seçili karta uygun
 * çalışan kod, bağlantı şeması ve gerekli kütüphanelerle birlikte yeni proje olarak oluşturulur.
 */
function SablonSihirbazi({ onKapat }: { onKapat: () => void }): ReactElement {
  const { state, addSketchToWorkspace } = useAppState()
  const { toastGoster } = useToast()
  const fqbn = state.arduinoCli.selectedFqbn
  const { aile, taninan } = useMemo(() => kartAilesiBul(fqbn), [fqbn])

  const [secili, setSecili] = useState<Sablon | null>(null)
  const [degerler, setDegerler] = useState<Degerler>({})
  const [ad, setAd] = useState('')
  const [kurulu, setKurulu] = useState<Set<string> | null>(null)
  const [kodGoster, setKodGoster] = useState(false)
  const [mesgul, setMesgul] = useState<string | null>(null)

  useEffect(() => {
    const tus = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !mesgul) onKapat()
    }
    window.addEventListener('keydown', tus)
    return () => window.removeEventListener('keydown', tus)
  }, [onKapat, mesgul])

  useEffect(() => {
    window.api.arduinoCli
      .listLibraries()
      .then((l) => setKurulu(new Set(l.map((k) => k.name))))
      .catch(() => setKurulu(new Set()))
  }, [])

  const sec = (s: Sablon): void => {
    setSecili(s)
    setDegerler(varsayilanDegerler(s, aile))
    setAd(s.projeAdi)
    setKodGoster(false)
  }

  const uyumlu = secili ? secili.uyumlu.includes(aile) : false
  const kod = useMemo(() => (secili && uyumlu && tumAlanlarGecerliMi(secili, degerler) ? secili.kod(degerler, aile) : ''), [secili, uyumlu, degerler, aile])
  const sorunlar = useMemo(() => (kod ? pinleriDenetle([{ dosya: 'sablon.ino', icerik: kod }], fqbn) : []), [kod, fqbn])
  const eksikler = secili && kurulu ? secili.kutuphaneler(aile).filter((k) => !kurulu.has(k)) : []
  const adGecerli = /^[A-Za-z0-9_]{1,60}$/.test(ad)

  const olustur = async (): Promise<void> => {
    if (!secili || !kod || !adGecerli) return
    try {
      for (const k of eksikler) {
        setMesgul(`“${k}” kuruluyor…`)
        await window.api.arduinoCli.installLibrary(k, undefined, crypto.randomUUID())
      }
      setMesgul('Proje oluşturuluyor…')
      const info = await window.api.sketch.createFromTemplate(ad, kod)
      await addSketchToWorkspace(info)
      toastGoster(`“${info.name}” oluşturuldu. Kartı ve portu seçip Yükle’ye basabilirsiniz.`, 'basari')
      onKapat()
    } catch (hata) {
      toastGoster(hata instanceof Error ? hata.message : 'Proje oluşturulamadı', 'hata')
      setMesgul(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !mesgul) onKapat()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Şablondan proje" className="flex h-full max-h-[680px] w-full max-w-4xl overflow-hidden rounded-[8px] border border-panel-border bg-panel shadow-2xl">
        {/* Sol: şablon listesi */}
        <div className="flex w-64 shrink-0 flex-col border-r border-panel-border bg-panel-light">
          <div className="border-b border-panel-border px-3 py-2.5">
            <h2 className="text-[13px] font-semibold text-gray-100">Şablondan proje</h2>
            <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
              Kart: <span className="text-gray-300">{fqbn ? AILE_ADI[aile] : 'seçilmedi'}</span>
              {!taninan && ' · Arduino (AVR) varsayıldı'}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {KATEGORILER.map((kat) => {
              const liste = SABLONLAR.filter((s) => s.kategori === kat)
              if (liste.length === 0) return null
              return (
                <div key={kat} className="mb-1">
                  <div className="px-3 pb-0.5 pt-2 text-[10.5px] font-medium uppercase tracking-wide text-gray-600">{kat}</div>
                  {liste.map((s) => {
                    const ok = s.uyumlu.includes(aile)
                    const aktif = secili?.id === s.id
                    return (
                      <button
                        key={s.id}
                        onClick={() => sec(s)}
                        className={`relative block w-full px-3 py-1.5 text-left text-[12.5px] transition-colors ${aktif ? 'bg-white/[0.07] text-gray-100' : 'text-gray-300 hover:bg-white/[0.04]'} ${ok ? '' : 'opacity-45'}`}
                      >
                        {aktif && <span className="absolute inset-y-1 left-0 w-0.5 bg-accent" />}
                        {s.ad}
                        {!ok && <span className="ml-1.5 text-[10px] text-gray-500">{s.uyumlu.map((u) => AILE_ADI[u]).join(' / ')} gerekir</span>}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {/* Sağ: ayrıntı ve form */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-panel-border px-4">
            <h3 className="truncate text-sm font-semibold text-gray-100">{secili ? secili.ad : 'Bir şablon seçin'}</h3>
            <button onClick={onKapat} disabled={Boolean(mesgul)} aria-label="Kapat" className="flex h-6 w-6 items-center justify-center rounded-[4px] text-gray-500 hover:bg-white/[0.08] hover:text-gray-200 disabled:opacity-40">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          {!secili ? (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <p className="text-[13px] text-gray-300">Hazır, çalışan projelerle başlayın.</p>
              <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-gray-500">
                Soldan bir şablon seçin; pinleri kendi bağlantınıza göre ayarlayın. Kod seçili kartınıza uyarlanır, bağlantı şeması ve gerekli kütüphaneler hazır gelir.
              </p>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-xs">
                <p className="mb-3 leading-relaxed text-gray-400">{secili.ozet}</p>

                {!uyumlu ? (
                  <div className="rounded-[6px] border-l-2 border-amber-400/70 bg-amber-400/[0.06] px-3 py-2 leading-relaxed text-amber-100/90">
                    Bu şablon {secili.uyumlu.map((u) => AILE_ADI[u]).join(' veya ')} kartları için hazırlandı. Üst çubuktan uygun bir kart seçin.
                  </div>
                ) : (
                  <>
                    {secili.alanlar.length > 0 && (
                      <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3">
                        {secili.alanlar.map((a) => {
                          const hata = alanHatasi(a, degerler[a.id] ?? '')
                          return (
                            <label key={a.id} className="block">
                              <span className="text-gray-300">{a.etiket}</span>
                              {a.tur === 'secim' ? (
                                <select
                                  value={degerler[a.id] ?? ''}
                                  onChange={(e) => setDegerler((d) => ({ ...d, [a.id]: e.target.value }))}
                                  className="mt-1 block h-7 w-full rounded-[5px] border border-panel-border bg-panel px-2 text-gray-100 outline-none focus:border-accent"
                                >
                                  {a.secenekler?.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  value={degerler[a.id] ?? ''}
                                  onChange={(e) => setDegerler((d) => ({ ...d, [a.id]: e.target.value }))}
                                  className={`mt-1 block h-7 w-full rounded-[5px] border bg-panel px-2 text-gray-100 outline-none ${hata ? 'border-red-500/70' : 'border-panel-border focus:border-accent'}`}
                                />
                              )}
                              {hata ? <span className="mt-0.5 block text-[11px] text-red-400">{hata}</span> : a.ipucu && <span className="mt-0.5 block text-[11px] text-gray-600">{a.ipucu}</span>}
                            </label>
                          )
                        })}
                      </div>
                    )}

                    <h4 className="mb-1 font-medium text-gray-200">Bağlantı</h4>
                    <ul className="mb-3 space-y-1 text-gray-400">
                      {secili.baglanti(degerler, aile).map((b, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gray-600" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>

                    {(secili.notlar?.(aile).length ?? 0) > 0 && (
                      <div className="mb-3 rounded-[6px] border-l-2 border-accent bg-accent/[0.08] px-3 py-2 leading-relaxed text-gray-300">
                        {secili.notlar?.(aile).map((n, i) => <p key={i}>{n}</p>)}
                      </div>
                    )}

                    {sorunlar.length > 0 && (
                      <div className="mb-3 rounded-[6px] border-l-2 border-amber-400/70 bg-amber-400/[0.06] px-3 py-2 leading-relaxed text-amber-100/90">
                        <p className="mb-1 font-medium">Pin denetimi</p>
                        {sorunlar.map((s, i) => (
                          <p key={i}>{s.tur === 'error' ? '✕' : '⚠'} {s.mesaj}</p>
                        ))}
                      </div>
                    )}

                    {secili.kutuphaneler(aile).length > 0 && (
                      <div className="mb-3">
                        <h4 className="mb-1 font-medium text-gray-200">Gerekli kütüphaneler</h4>
                        <ul className="space-y-0.5">
                          {secili.kutuphaneler(aile).map((k) => {
                            const var_ = kurulu?.has(k)
                            return (
                              <li key={k} className="flex items-center gap-2 text-gray-400">
                                <span className={`h-1.5 w-1.5 rounded-full ${kurulu === null ? 'bg-gray-600' : var_ ? 'bg-[#3ddc84]' : 'bg-amber-400'}`} />
                                {k}
                                <span className="text-[11px] text-gray-600">{kurulu === null ? '' : var_ ? 'kurulu' : 'oluştururken kurulacak'}</span>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}

                    <button onClick={() => setKodGoster((g) => !g)} className="text-accent hover:underline">
                      {kodGoster ? 'Kodu gizle' : 'Kodu önizle'}
                    </button>
                    {kodGoster && kod && (
                      <pre className="mt-2 max-h-64 overflow-auto rounded-[6px] border border-panel-border bg-panel-light p-3 font-mono text-[11.5px] leading-relaxed text-gray-300">{kod}</pre>
                    )}
                  </>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3 border-t border-panel-border px-4 py-2.5">
                <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-gray-400">
                  Proje adı
                  <input
                    value={ad}
                    onChange={(e) => setAd(e.target.value)}
                    maxLength={60}
                    className={`h-7 min-w-0 flex-1 rounded-[5px] border bg-panel px-2 font-mono text-gray-100 outline-none ${adGecerli ? 'border-panel-border focus:border-accent' : 'border-red-500/70'}`}
                  />
                </label>
                {mesgul && <span className="text-xs text-gray-400">{mesgul}</span>}
                <Tus tur="birincil" onClick={() => void olustur()} disabled={!kod || !adGecerli || Boolean(mesgul)}>
                  {eksikler.length > 0 ? 'Kütüphaneleri kur ve oluştur' : 'Projeyi oluştur'}
                </Tus>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SablonSihirbazi
