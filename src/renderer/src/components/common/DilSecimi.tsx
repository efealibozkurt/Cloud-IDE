import type { ReactElement } from 'react'
import cloudIcon from '../../assets/icon.png'
import { DILLER, useI18n } from '../../i18n'

/**
 * İlk açılışta bir kez gösterilen dil seçimi. İki dilde birden yazılır, çünkü kullanıcı henüz hangi dili
 * seçeceğini söylemedi. Seçim kaydedilir; Ayarlar › Genel'den sonradan değiştirilebilir.
 */
function DilSecimi({ onSecildi }: { onSecildi: () => void }): ReactElement {
  const { setDil } = useI18n()
  return (
    <div role="dialog" aria-modal="true" aria-label="Language / Dil" className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a121b] px-6">
      <div className="w-full max-w-sm text-center">
        <img src={cloudIcon} alt="" className="mx-auto h-14 w-14 object-contain" />
        <h1 className="mt-5 text-lg font-semibold text-white">Cloud IDE</h1>
        <p className="mt-1 text-xs text-gray-400">Dilinizi seçin · Choose your language</p>
        <div className="mt-6 flex flex-col gap-2.5">
          {DILLER.map((d) => (
            <button
              key={d.id}
              autoFocus={d.id === 'tr'}
              onClick={() => {
                setDil(d.id)
                onSecildi()
              }}
              className="rounded-lg border border-white/15 bg-white/[0.05] px-4 py-3 text-sm font-medium text-gray-100 transition-colors hover:border-white/30 hover:bg-white/[0.08]"
            >
              {d.ad}
            </button>
          ))}
        </div>
        <p className="mt-5 text-[11px] text-gray-600">Ayarlar › Genel · Settings › General</p>
      </div>
    </div>
  )
}

export default DilSecimi
