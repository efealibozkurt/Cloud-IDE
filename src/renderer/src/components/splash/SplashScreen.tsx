import { useEffect, useState, type ReactElement } from 'react'
import { surumAdiBul } from '@shared/surumAdlari'
import beyazCloudIde from '../../assets/beyaz_cloud_ide.png'
import { useT } from '../../i18n'

/** Kapanış geçişi (ms) — aşağıdaki `duration-500` sınıfıyla eşleşmeli */
const KAPANIS_SURESI_MS = 500
/** Son adım işaretlendikten sonra, kapanış başlamadan önceki kısa bekleme */
const SON_BEKLEME_MS = 280
const ADIM_ARALIGI_MS = 380
const TIK_SAYISI = 28

interface SplashScreenProps {
  /** true olunca kalan adımlar tamamlanır ve ekran kapanmaya başlar */
  hazir: boolean
  onTamamlandi: () => void
  surum?: string
}

const ADIMLAR = [
  'Derleyici hazırlanıyor',
  'Kartlar ve portlar taranıyor',
  'Ayarlar ve proje geçmişi yükleniyor',
  'Arayüz başlatılıyor'
]

/**
 * Açılış ekranı. Uygulama penceresi açıldığı anda tam opak olarak görünür (arkadaki arayüz
 * hiçbir zaman görünmez); başlatma adımlarını bir kart önyükleme günlüğü gibi sırayla
 * işaretler, ince bir pin dizisiyle ilerlemeyi gösterir ve yükleme bitince kısa bir
 * geçişle kapanır.
 */
function SplashScreen({ hazir, onTamamlandi, surum }: SplashScreenProps): ReactElement {
  const t = useT()
  const [adim, setAdim] = useState(0)
  const [kapaniyor, setKapaniyor] = useState(false)

  // Adımlar sırayla ilerler; gerçek yükleme erken bitse bile hepsi görünür
  useEffect(() => {
    if (adim >= ADIMLAR.length) return
    const zamanlayici = setTimeout(() => setAdim((a) => a + 1), ADIM_ARALIGI_MS)
    return () => clearTimeout(zamanlayici)
  }, [adim])

  // Yükleme bitmişse kalan adımları hızlandır
  useEffect(() => {
    if (!hazir || adim >= ADIMLAR.length) return
    const zamanlayici = setTimeout(() => setAdim((a) => a + 1), 90)
    return () => clearTimeout(zamanlayici)
  }, [hazir, adim])

  useEffect(() => {
    if (!hazir || adim < ADIMLAR.length) return
    const baslat = setTimeout(() => setKapaniyor(true), SON_BEKLEME_MS)
    return () => clearTimeout(baslat)
  }, [hazir, adim])

  useEffect(() => {
    if (!kapaniyor) return
    const bitir = setTimeout(onTamamlandi, KAPANIS_SURESI_MS)
    return () => clearTimeout(bitir)
  }, [kapaniyor, onTamamlandi])

  const yanan = Math.round((Math.min(adim, ADIMLAR.length) / ADIMLAR.length) * TIK_SAYISI)

  return (
    <div
      role="status"
      aria-label={t('Cloud IDE başlatılıyor')}
      className={`fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-panel transition-opacity duration-500 ease-out ${
        kapaniyor ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Merkezde çok hafif bir aydınlık; tema mavisinden */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 50% 45% at 50% 48%, rgba(14,127,196,0.13), transparent 70%)' }}
      />

      <div className="relative w-[340px]">
        <img src={beyazCloudIde} alt="Cloud IDE" className="h-[60px] w-auto select-none object-contain" draggable={false} />

        <ul className="mt-9 space-y-2 font-mono text-[12px]" aria-live="polite">
          {ADIMLAR.map((metin, i) => {
            if (i > adim) return null
            const bitti = i < adim
            return (
              <li key={metin} className="flex items-center gap-2.5">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    bitti ? 'bg-[#3ddc84] shadow-[0_0_5px_#3ddc84]' : 'animate-pulse bg-accent motion-reduce:animate-none'
                  }`}
                  aria-hidden="true"
                />
                <span className={bitti ? 'text-gray-500' : 'text-gray-200'}>{t(metin)}</span>
                {bitti && <span className="ml-auto text-[10.5px] text-gray-600">{t('tamam')}</span>}
              </li>
            )
          })}
        </ul>

        {/* Pin dizisi biçiminde ilerleme çubuğu */}
        <div className="mt-6 flex gap-[3px]" aria-hidden="true">
          {Array.from({ length: TIK_SAYISI }).map((_, i) => (
            <span
              key={i}
              className={`h-3 flex-1 rounded-[1px] transition-colors duration-300 ${i < yanan ? 'bg-accent' : 'bg-white/[0.08]'}`}
            />
          ))}
        </div>
      </div>

      <p className="absolute bottom-7 text-[11.5px] text-gray-600">
        {t('Efe Ali Bozkurt tarafından geliştirildi')}
        {surum ? `, v${surum} ${surumAdiBul(surum).ad} (beta)` : ''}
      </p>
    </div>
  )
}

export default SplashScreen
