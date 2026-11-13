import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { temelFqbn } from '@shared/boardFqbn'
import { raporuBicimle, type RaporSecimleri } from '@shared/tanilama'
import type { TanilamaVerisi } from '@shared/types'
import { useAppState } from '../../state/AppStateContext'
import { useToast } from '../../state/ToastContext'
import { arayuzGunluguAl } from '../../utils/arayuzGunlugu'
import { Tus } from '../common/Tus'

const SECENEKLER: Array<{ id: keyof RaporSecimleri; ad: string; aciklama: string }> = [
  { id: 'sistem', ad: 'Sistem bilgisi', aciklama: 'Uygulama ve işletim sistemi sürümü, arduino-cli sürümü, temel ayarlar' },
  { id: 'kart', ad: 'Seçili kart ve kart ayarları', aciklama: 'Örn. arduino:avr:nano ve işlemci seçeneği' },
  { id: 'paketler', ad: 'Kurulu kart paketleri ve kütüphaneler', aciklama: 'Yalnızca ad ve sürüm listesi' },
  { id: 'derleme', ad: 'Son derleme sonucu', aciklama: 'Hata satırları ve çıktının son kısmı (uzun komut satırları ayıklanır)' },
  { id: 'gunluk', ad: 'Uygulama günlüğü', aciklama: 'Son uyarı ve hata satırları' },
  { id: 'kod', ad: 'Açık dosyanın kodu', aciklama: 'İlk 250 satır. Kodunuz özel ise kapalı bırakın' }
]

/**
 * "Sorun bildir": sistem, kart ve derleme bilgisinden okunur bir rapor hazırlar, kişisel bilgileri temizler,
 * paylaşmadan önce tamamını gösterir. Hiçbir şey kendiliğinden gönderilmez; kullanıcı kopyalar, kaydeder
 * ya da GitHub'da sorun açar.
 */
function SorunBildirModal({ onClose }: { onClose: () => void }): ReactElement {
  const { state } = useAppState()
  const { toastGoster } = useToast()
  const [aciklama, setAciklama] = useState('')
  const [secimler, setSecimler] = useState<RaporSecimleri>({ sistem: true, kart: true, paketler: true, derleme: true, gunluk: true, kod: false })
  const [veri, setVeri] = useState<TanilamaVerisi | null>(null)
  const [hata, setHata] = useState(false)
  const [mesgul, setMesgul] = useState(false)

  useEffect(() => {
    let iptal = false
    window.api.diagnostics
      .collect()
      .then((v) => !iptal && setVeri(v))
      .catch(() => !iptal && setHata(true))
    return () => {
      iptal = true
    }
  }, [])

  useEffect(() => {
    const tus = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', tus)
    return () => window.removeEventListener('keydown', tus)
  }, [onClose])

  const fqbn = state.arduinoCli.selectedFqbn
  const aktifSekme = state.sketch.tabs.find((t) => t.path === state.sketch.activeTabPath) ?? null
  const ayarlar = state.settings

  const rapor = useMemo(() => {
    if (!veri) return ''
    const hatalar = state.build.errors
    return raporuBicimle(
      {
        sistem: veri.sistem,
        aciklama,
        kart: fqbn ? { fqbn: temelFqbn(fqbn), secenekler: ayarlar?.boardOptions?.[temelFqbn(fqbn)] } : null,
        ayarlar: {
          'Yapay zekâ sağlayıcı': ayarlar?.selectedAiProvider,
          'Model': ayarlar?.selectedAiProvider ? ayarlar.selectedModelPerProvider?.[ayarlar.selectedAiProvider] : undefined,
          'Değişiklik izni': ayarlar?.agentPermissionMode,
          'Otomatik derleme': ayarlar?.agentAutoCompile,
          'Yerel araç biçimi': ayarlar?.localToolMode,
          'Baud': state.arduinoCli.selectedBaud,
          'Port': state.arduinoCli.selectedPort,
          'Seri port açık': state.serial.status.portlar.length
        },
        derleme: {
          basarili: state.build.boyut ? true : hatalar.some((h) => h.tur === 'error') ? false : null,
          hatalar: hatalar.map((h) => ({ dosya: h.dosya, satir: h.satir, tur: h.tur, mesaj: h.mesaj })),
          cikti: state.build.log
        },
        arayuzGunlugu: arayuzGunluguAl(),
        kod: aktifSekme ? { dosya: aktifSekme.path, icerik: aktifSekme.content } : null,
        secimler,
        zaman: new Date().toISOString()
      },
      veri.temizleme
    )
    // Rapor yalnızca pencere açıkken ve seçimler/açıklama değişince yeniden üretilir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veri, aciklama, secimler])

  const kopyala = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(rapor)
      toastGoster('Rapor panoya kopyalandı', 'basari')
    } catch {
      toastGoster('Panoya kopyalanamadı. Raporu dosya olarak kaydedin.', 'hata')
    }
  }

  const kaydet = async (): Promise<void> => {
    setMesgul(true)
    try {
      const yol = await window.api.diagnostics.saveReport(rapor)
      if (yol) toastGoster('Rapor kaydedildi', 'basari')
    } catch {
      toastGoster('Rapor kaydedilemedi', 'hata')
    } finally {
      setMesgul(false)
    }
  }

  const githubdaAc = async (): Promise<void> => {
    setMesgul(true)
    try {
      const baslik = aciklama.trim().split(/\r?\n/)[0].slice(0, 80) || 'Sorun bildirimi'
      await navigator.clipboard.writeText(rapor).catch(() => undefined)
      await window.api.diagnostics.openIssue(baslik, rapor)
      toastGoster('GitHub açıldı. Tam rapor panoda; sayfa kısaltılmış olabilir, eksikse yapıştırın.', 'bilgi')
    } catch {
      toastGoster('GitHub açılamadı', 'hata')
    } finally {
      setMesgul(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/55 p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Sorun bildir" className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[8px] border border-panel-border bg-panel-light shadow-2xl">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-panel-border px-5">
          <h2 className="text-sm font-semibold text-gray-100">Sorun bildir</h2>
          <button onClick={onClose} aria-label="Kapat" className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-white/[0.08] hover:text-gray-200">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-xs">
          <label className="block text-gray-300">
            Ne oldu? Ne bekliyordunuz?
            <textarea
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder={'Örn. ESP32\'ye yüklerken "Connecting..." yazıp duruyor.\nAdımlar: 1) kartı seçtim 2) Yükle\'ye bastım'}
              className="mt-1.5 block w-full resize-y rounded-[5px] border border-panel-border bg-panel px-2.5 py-2 text-xs leading-relaxed text-gray-100 outline-none placeholder:text-gray-600 focus:border-accent"
            />
          </label>

          <div className="mt-4">
            <p className="mb-1.5 font-medium text-gray-200">Rapora eklenecekler</p>
            <ul className="space-y-1.5">
              {SECENEKLER.map((o) => (
                <li key={o.id}>
                  <label className="flex cursor-pointer items-start gap-2 text-gray-300">
                    <input type="checkbox" checked={secimler[o.id]} onChange={(e) => setSecimler((s) => ({ ...s, [o.id]: e.target.checked }))} className="mt-0.5 accent-accent" />
                    <span>
                      {o.ad}
                      <span className="block text-[11px] text-gray-500">{o.aciklama}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 rounded-[6px] border-l-2 border-accent bg-accent/[0.08] px-3 py-2 leading-relaxed text-gray-300">
            Raporda API anahtarları, parolalar, e-posta, IP adresi ve kullanıcı adınız otomatik gizlenir. Hiçbir şey kendiliğinden gönderilmez: aşağıda tamamını görür, sonra kopyalar, kaydeder ya da GitHub'da sorun olarak açarsınız.
          </div>

          <details className="mt-4" open>
            <summary className="cursor-pointer text-gray-300">Raporun önizlemesi {rapor ? `(${rapor.length.toLocaleString('tr-TR')} karakter)` : ''}</summary>
            {hata ? (
              <p className="mt-2 text-red-300">Sistem bilgisi toplanamadı. Yine de açıklamanızı kopyalayabilirsiniz.</p>
            ) : (
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-[6px] border border-panel-border bg-panel p-3 font-mono text-[11px] leading-relaxed text-gray-400">{rapor || 'Hazırlanıyor…'}</pre>
            )}
          </details>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-panel-border px-5 py-3">
          <Tus onClick={() => void kopyala()} disabled={!rapor || mesgul}>
            Panoya kopyala
          </Tus>
          <Tus onClick={() => void kaydet()} disabled={!rapor || mesgul}>
            Dosya olarak kaydet
          </Tus>
          <Tus tur="birincil" onClick={() => void githubdaAc()} disabled={!rapor || mesgul}>
            GitHub'da sorun aç
          </Tus>
        </div>
      </div>
    </div>
  )
}

export default SorunBildirModal
