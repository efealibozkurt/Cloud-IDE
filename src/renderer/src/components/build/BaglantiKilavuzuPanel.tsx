import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  BAGLANTI_DOSYA_ADI,
  KABLO_RENK_HEX,
  baglantiKilavuzuDogrula,
  koddanBaglantiCikar,
  type BaglantiKilavuzu
} from '@shared/baglantiKilavuzu'
import type { PinKaynakDosya } from '@shared/pinCheck'
import { useAppState } from '../../state/AppStateContext'
import { useAgent } from '../../state/AgentContext'
import { useToast } from '../../state/ToastContext'
import { ayniDosyaMi } from '../../utils/paths'
import KartSemasiSvg from './KartSemasiSvg'
import { useI18n } from '../../i18n'

const KAYNAK_TURLERI = new Set(['ino', 'h', 'hpp', 'cpp', 'c'])

function baglantiDosyaYolu(klasor: string): string {
  return `${klasor.replace(/[\\/]+$/, '')}/${BAGLANTI_DOSYA_ADI}`
}

function statikDepoAnahtari(klasor: string): string {
  return `cloud_ide_baglanti_tamam_${klasor.toLowerCase()}`
}

function statikTamamlananOku(klasor: string | null): string[] {
  if (!klasor) return []
  try {
    const ham = localStorage.getItem(statikDepoAnahtari(klasor))
    if (!ham) return []
    const parsed = JSON.parse(ham) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * Alt panelin "Bağlantı Kılavuzu" sekmesi: açık proje kodunu seçili karta göre anında
 * kablolama şemasına dönüştürür; istenirse Cloud AI ile donanım kurallarına göre
 * zenginleştirilip BAGLANTI.json olarak proje içine kaydedilir.
 */
function BaglantiKilavuzuPanel(): ReactElement {
  const { dil, t } = useI18n()
  const { state, toggleDretAi } = useAppState()
  const agent = useAgent()
  const { toastGoster } = useToast()

  const { info, workspaceSketches, activeSketchPath, tabs } = state.sketch
  const fqbn = state.arduinoCli.selectedFqbn

  const aktifSketch = useMemo(
    () =>
      (activeSketchPath ? workspaceSketches.find((s) => ayniDosyaMi(s.folderPath, activeSketchPath)) : null) ?? info,
    [activeSketchPath, workspaceSketches, info]
  )
  const projeKlasoru = aktifSketch?.folderPath ?? null

  const [statikKilavuz, setStatikKilavuz] = useState<BaglantiKilavuzu>(() => koddanBaglantiCikar([], fqbn))
  const [aiKilavuzu, setAiKilavuzu] = useState<BaglantiKilavuzu | null>(null)
  const [gorunumModu, setGorunumModu] = useState<'otomatik' | 'statik'>('otomatik')
  const [statikTamamlanan, setStatikTamamlanan] = useState<string[]>([])
  const [vurguluHatId, setVurguluHatId] = useState<string | null>(null)
  const [vurguluBilesen, setVurguluBilesen] = useState<string | null>(null)
  const [buyutulmus, setBuyutulmus] = useState(false)

  const imza = aktifSketch
    ? tabs
        .filter((sekme) => sekme.sketchFolderPath && ayniDosyaMi(sekme.sketchFolderPath, aktifSketch.folderPath))
        .map((sekme) => `${sekme.path}:${sekme.content.length}:${sekme.content.slice(0, 40)}:${sekme.content.slice(-40)}`)
        .join('|')
    : ''

  // Statik kod analizini 600ms gecikmeyle güncelle
  useEffect(() => {
    if (!aktifSketch) {
      setStatikKilavuz(koddanBaglantiCikar([], fqbn))
      return
    }
    let iptal = false
    const zamanlayici = setTimeout(() => {
      void (async () => {
        const dosyalar: PinKaynakDosya[] = []
        for (const f of aktifSketch.files) {
          if (!KAYNAK_TURLERI.has(f.kind)) continue
          const acik = tabs.find((sekme) => ayniDosyaMi(sekme.path, f.path))
          try {
            dosyalar.push({
              dosya: f.path,
              icerik: acik ? acik.content : await window.api.sketch.readFile(f.path)
            })
          } catch {
            // okunamayan dosya atlanır
          }
        }
        if (!iptal) setStatikKilavuz(koddanBaglantiCikar(dosyalar, fqbn))
      })()
    }, 500)
    return () => {
      iptal = true
      clearTimeout(zamanlayici)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktifSketch, fqbn, imza])

  // Proje değiştikçe statik tamamlamaları oku
  useEffect(() => {
    setStatikTamamlanan(statikTamamlananOku(projeKlasoru))
    setVurguluHatId(null)
    setVurguluBilesen(null)
  }, [projeKlasoru])

  // Diskteki BAGLANTI.json dosyasını oku
  useEffect(() => {
    if (!projeKlasoru) {
      setAiKilavuzu(null)
      return
    }
    let iptal = false
    void (async () => {
      try {
        const ham = await window.api.sketch.readFile(baglantiDosyaYolu(projeKlasoru))
        if (iptal) return
        const dogrulanmis = baglantiKilavuzuDogrula(JSON.parse(ham), aktifSketch?.name ?? 'Seçili kart', fqbn ?? undefined)
        setAiKilavuzu(dogrulanmis)
      } catch {
        if (!iptal) setAiKilavuzu(null)
      }
    })()
    return () => {
      iptal = true
    }
  }, [projeKlasoru, aktifSketch?.name, fqbn, state.baglantiSurumu])

  // Yeni BAGLANTI.json kaydedildiğinde otomatik görünümü öne getir
  useEffect(() => {
    if (state.baglantiSurumu > 0) setGorunumModu('otomatik')
  }, [state.baglantiSurumu])

  // Büyütülmüş modalı Esc ile kapat
  useEffect(() => {
    if (!buyutulmus) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setBuyutulmus(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [buyutulmus])

  const aktifKilavuz = gorunumModu === 'otomatik' && aiKilavuzu ? aiKilavuzu : statikKilavuz
  const aiAktifMi = Boolean(gorunumModu === 'otomatik' && aiKilavuzu)

  const tamamlananlar = useMemo(() => {
    if (aiAktifMi && aiKilavuzu) return new Set(aiKilavuzu.tamamlananlar ?? [])
    return new Set(statikTamamlanan)
  }, [aiAktifMi, aiKilavuzu, statikTamamlanan])

  const hatDurumDegistir = useCallback(
    (hatId: string) => {
      if (!projeKlasoru) return
      const guncel = new Set(tamamlananlar)
      if (guncel.has(hatId)) guncel.delete(hatId)
      else guncel.add(hatId)
      const dizi = [...guncel]

      if (aiAktifMi && aiKilavuzu) {
        const yeniAi: BaglantiKilavuzu = { ...aiKilavuzu, tamamlananlar: dizi }
        setAiKilavuzu(yeniAi)
        void window.api.sketch.writeFile(baglantiDosyaYolu(projeKlasoru), JSON.stringify(yeniAi, null, 2)).catch(() => {
          toastGoster(t('Bağlantı işareti kaydedilemedi'), 'hata')
        })
      } else {
        setStatikTamamlanan(dizi)
        try {
          localStorage.setItem(statikDepoAnahtari(projeKlasoru), JSON.stringify(dizi))
        } catch {
          // depolama kullanılamıyorsa yalnızca oturum içi tutulur
        }
      }
    },
    [projeKlasoru, tamamlananlar, aiAktifMi, aiKilavuzu, toastGoster, t]
  )

  const aiIleOlustur = (): void => {
    if (!aktifSketch || agent.calisiyor) return
    if (!state.dretAi.open) toggleDretAi()
    if (dil === 'en') {
      const kartEn = fqbn ? `Selected board FQBN: ${fqbn}` : 'No board selected yet'
      void agent.gonder(
        `Read the source files of the active project ("${aktifSketch.name}") (${kartEn}). First verify the pin and voltage (3.3V or 5V) rules with the get_board_info and check_pins tools. Then save a complete English wiring guide for every sensor, display, motor and component in the code (VCC, GND, signal pins, required resistors, pull-up/down, 5V→3.3V voltage divider or external power warnings included) by calling the save_wiring_guide tool. Do not change the code.`
      )
      return
    }
    const kartBilgisi = fqbn ? `Seçili kart FQBN: ${fqbn}` : 'Henüz kart seçilmedi'
    const istem = `Aktif projedeki ("${aktifSketch.name}") kaynak dosyalarını oku (${kartBilgisi}). Önce get_board_info ve check_pins araçlarıyla pin/voltaj (3.3V veya 5V) kurallarını doğrula. Ardından koddaki tüm sensör, ekran, motor ve bileşenlerin eksiksiz Türkçe kablolama rehberini (VCC, GND, sinyal pinleri, gerekli dirençler, pull-up/down, 5V→3.3V gerilim bölücü veya harici güç uyarıları dahil) save_wiring_guide aracını çağırarak kaydet. Kodu değiştirme.`
    void agent.gonder(istem)
  }

  if (!aktifSketch) {
    return <p className="p-3 text-xs text-gray-500">{t('Bağlantı kılavuzu için önce bir proje açın.')}</p>
  }

  const toplamHat = aktifKilavuz.baglantilar.length
  const bitenHat = aktifKilavuz.baglantilar.filter((h) => tamamlananlar.has(h.id)).length
  const ilerlemeYuzde = toplamHat > 0 ? Math.round((bitenHat / toplamHat) * 100) : 0

  const icerik = (modalMi: boolean): ReactElement => (
    <div className="flex h-full min-h-0 flex-col text-xs">
      {/* Üst araç çubuğu */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-panel-border px-3 py-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
            aiAktifMi
              ? 'border-accent/40 bg-accent/15 text-[#7cc4f0]'
              : 'border-panel-border bg-panel text-gray-300'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${aiAktifMi ? 'bg-[#38bdf8]' : 'bg-gray-400'}`} />
          {aiAktifMi ? t('Cloud AI kılavuzu') : t('Koddan otomatik')}
        </span>

        <span className="rounded border border-panel-border bg-panel px-2 py-0.5 font-mono text-[10.5px] text-gray-300">
          {aktifKilavuz.kartAdi} · {aktifKilavuz.mantikVoltaj}
        </span>

        {toplamHat > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-gray-400" title={t('Tamamlanan kablo bağlantıları')}>
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.08]">
              <span
                className="block h-full bg-emerald-400 transition-all duration-200"
                style={{ width: `${ilerlemeYuzde}%` }}
              />
            </span>
            <span className="tabular-nums">
              {t('{a}/{b} bağlandı', { a: bitenHat, b: toplamHat })}
            </span>
          </div>
        )}

        <div className="flex-1" />

        {aiKilavuzu && (
          <button
            onClick={() => setGorunumModu((m) => (m === 'otomatik' ? 'statik' : 'otomatik'))}
            className="rounded border border-panel-border px-2 py-1 text-[11px] text-gray-300 hover:bg-panel-border"
            title={t('Cloud AI kılavuzu ile koddan anlık otomatik analiz arasında geçiş yap')}
          >
            {aiAktifMi ? t('Koddan otomatik görünüm') : t('AI kılavuzuna dön')}
          </button>
        )}

        <button
          onClick={aiIleOlustur}
          disabled={agent.calisiyor}
          title={t('Cloud AI kodu okuyup direnç, voltaj ve güvenlik uyarılarıyla eksiksiz bağlantı kılavuzu oluştursun')}
          className="rounded border border-accent/50 bg-accent/20 px-2.5 py-1 text-[11px] font-medium text-[#7cc4f0] transition-colors hover:enabled:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {agent.calisiyor ? t('AI hazırlıyor…') : aiKilavuzu ? t('AI ile Güncelle') : t('AI ile Oluştur')}
        </button>

        <button
          onClick={() => setBuyutulmus((b) => !b)}
          title={modalMi ? t('Kapat (Esc)') : t('Bağlantı kılavuzunu büyük pencerede aç')}
          className="rounded border border-panel-border px-2 py-1 text-[11px] text-gray-300 hover:bg-panel-border"
        >
          {modalMi ? t('Kapat (Esc)') : t('Büyüt')}
        </button>
      </div>

      {/* Gövde: sol şema + sağ uyarılar/bileşenler/kontrol listesi */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:overflow-hidden">
        <div className="min-h-0 md:overflow-y-auto md:pr-1">
          <KartSemasiSvg
            kilavuz={aktifKilavuz}
            vurguluBilesen={vurguluBilesen}
            vurguluHatId={vurguluHatId}
            tamamlananlar={tamamlananlar}
            onHatHover={setVurguluHatId}
            onHatToggle={hatDurumDegistir}
          />
          <p className="mt-1.5 text-[10.5px] text-gray-500">
            {t('İpucu: Şemadaki bir kablonun üzerine gelerek hattı vurgulayın; tıklayarak “Bağladım” işaretleyin.')}
          </p>
        </div>

        <div className="flex min-h-0 flex-col gap-2.5 md:overflow-y-auto md:pr-1">
          <p className="text-[11.5px] leading-relaxed text-gray-300">{aktifKilavuz.ozet}</p>

          {aktifKilavuz.uyarilar.length > 0 && (
            <div className="space-y-1.5">
              {aktifKilavuz.uyarilar.map((u, i) => (
                <div
                  key={i}
                  className={`rounded-md border-l-2 px-2.5 py-1.5 text-[11px] leading-relaxed ${
                    u.seviye === 'dikkat'
                      ? 'border-amber-400 bg-amber-500/10 text-amber-200'
                      : 'border-accent bg-accent/10 text-sky-200'
                  }`}
                >
                  <strong className="mr-1 font-semibold">{u.seviye === 'dikkat' ? t('Dikkat:') : t('Bilgi:')}</strong>
                  {u.mesaj}
                </div>
              ))}
            </div>
          )}

          {aktifKilavuz.bilesenler.length > 0 && (
            <div>
              <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-gray-500">
                {t('Bileşenler ve ek parçalar')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {aktifKilavuz.bilesenler.map((b) => {
                  const secili = vurguluBilesen === b.ad
                  return (
                    <button
                      key={b.ad}
                      type="button"
                      onMouseEnter={() => setVurguluBilesen(b.ad)}
                      onMouseLeave={() => setVurguluBilesen(null)}
                      onClick={() => setVurguluBilesen((onceki) => (onceki === b.ad ? null : b.ad))}
                      className={`rounded-md border px-2 py-1 text-left transition-colors ${
                        secili
                          ? 'border-accent bg-accent/15 text-white'
                          : 'border-panel-border bg-panel text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      <div className="text-[11px] font-medium">
                        {b.ad}
                        {b.voltaj && <span className="ml-1.5 font-mono text-[10px] text-[#7cc4f0]">{b.voltaj}</span>}
                      </div>
                      {b.ekParcalar && b.ekParcalar.length > 0 && (
                        <div className="text-[10px] text-amber-300/90">+ {b.ekParcalar.join(', ')}</div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {aktifKilavuz.baglantilar.length > 0 && (
            <div>
              <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-gray-500">
                {t('Kablolama adımları (Bağladım kontrol listesi)')}
              </div>
              <div className="divide-y divide-panel-border rounded-md border border-panel-border bg-panel">
                {aktifKilavuz.baglantilar.map((h) => {
                  const tamam = tamamlananlar.has(h.id)
                  const renk = KABLO_RENK_HEX[h.renk]
                  const vurgulu = vurguluHatId === h.id || vurguluBilesen === h.bilesen
                  return (
                    <div
                      key={h.id}
                      onMouseEnter={() => setVurguluHatId(h.id)}
                      onMouseLeave={() => setVurguluHatId(null)}
                      onClick={() => hatDurumDegistir(h.id)}
                      className={`flex cursor-pointer items-start gap-2 px-2.5 py-1.5 transition-colors ${
                        vurgulu ? 'bg-accent/15' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={tamam}
                        onChange={() => {}}
                        aria-label={`${h.bilesen} ${h.bilesenPini} -> ${h.kartPini} ${t('bağlandı')}`}
                        className="mt-0.5 cursor-pointer accent-[#0e7fc4]"
                      />
                      <span
                        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border border-black/30"
                        style={{ backgroundColor: renk?.hex ?? '#38bdf8' }}
                        title={`${renk?.ad ?? h.renk} ${t('kablo')}`}
                      />
                      <div className={`min-w-0 flex-1 ${tamam ? 'opacity-60' : ''}`}>
                        <div className={`flex flex-wrap items-center gap-1.5 text-[11.5px] ${tamam ? 'line-through' : ''}`}>
                          <span className="font-medium text-gray-100">{h.bilesen}</span>
                          <span className="font-mono text-[10.5px] text-gray-400">{h.bilesenPini}</span>
                          <span className="text-gray-500">→</span>
                          <span className="rounded bg-white/[0.06] px-1.5 py-px font-mono text-[10.5px] text-[#7cc4f0]">
                            {h.kartPini}
                          </span>
                        </div>
                        {h.not && <p className="mt-0.5 text-[10.5px] text-gray-400">{h.not}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {icerik(false)}
      {buyutulmus && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6"
          onClick={() => setBuyutulmus(false)}
        >
          <div
            className="flex h-[86vh] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-md border border-panel-border bg-panel-light shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {icerik(true)}
          </div>
        </div>
      )}
    </>
  )
}

export default BaglantiKilavuzuPanel
