import type { ReactElement } from 'react'
import { useAgent } from '../../state/AgentContext'
import cloudIcon from '../../assets/icon.png'
import { useT } from '../../i18n'

interface CloudAiDugmesiProps {
  aktif: boolean
  onClick: () => void
}

/**
 * Üst çubuktaki Cloud AI düğmesi. Etrafında dönen ışık halkası taşır; asistanın durumunu da yansıtır:
 * boşta sönük, panel açıkken parlak, çalışırken hızlı dönen halka ve zıplayan noktalar,
 * onay beklerken kehribar bir nokta.
 */
function CloudAiDugmesi({ aktif, onClick }: CloudAiDugmesiProps): ReactElement {
  const t = useT()
  const agent = useAgent()
  const calisiyor = agent.calisiyor
  const onayBekliyor = Boolean(agent.calisma?.onay)

  return (
    <div className="cloudai-halka ml-1" data-tur="cloudai" data-aktif={aktif} data-calisiyor={calisiyor && !onayBekliyor}>
      <button
        onClick={onClick}
        aria-pressed={aktif}
        title={onayBekliyor ? t('Cloud AI onayınızı bekliyor') : calisiyor ? t('Cloud AI çalışıyor — paneli aç/kapat') : t('Cloud AI asistanını aç/kapat')}
        className="cloudai-ic group relative flex h-[30px] items-center gap-2 pl-2 pr-3 text-[12.5px] font-semibold tracking-wide text-gray-100 outline-none transition-colors hover:text-white focus-visible:ring-1 focus-visible:ring-[#7cc4f0]"
      >
        <img
          src={cloudIcon}
          alt=""
          className={`h-[18px] w-[18px] shrink-0 object-contain ${
            calisiyor ? 'animate-pulse' : ''
          }`}
        />
        <span>Cloud AI</span>
        {onayBekliyor ? (
          <span className="flex items-center gap-1 text-[10.5px] font-medium text-amber-300" aria-label={t('Onay bekliyor')}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            {t('onay')}
          </span>
        ) : calisiyor ? (
          <span className="flex items-center gap-[3px]" aria-label={t('Çalışıyor')}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-[3px] w-[3px] rounded-full bg-[#7cc4f0]"
                style={{ animation: 'cloudai-nokta 1s ease-in-out infinite', animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        ) : (
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors ${aktif ? 'bg-[#3ddc84]' : 'bg-gray-600 group-hover:bg-[#7cc4f0]'}`}
            aria-hidden="true"
          />
        )}
      </button>
    </div>
  )
}

export default CloudAiDugmesi
