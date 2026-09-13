import type { ReactElement } from 'react'
import { ARDUINO_CLI_DOWNLOAD_URL } from '@shared/types'
import { useAppState } from '../../state/AppStateContext'

/**
 * arduino-cli bulunamadığında tüm sekmelerde görünen kalıcı uyarı şeridi.
 * Uygulama bu durumda çökmemeli; kullanıcıya yolu seçmesi ya da resmi
 * siteden indirmesi için açık bir yönlendirme sunar.
 */
function CliStatusBanner(): ReactElement | null {
  const { state, browseForCliPath, yenidenDenearduinoCli } = useAppState()
  const durum = state.arduinoCli.status

  if (!durum || durum.found) return null

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-amber-800 bg-amber-950 px-3 py-1.5 text-xs text-amber-200">
      <span className="flex-1">⚠ {durum.message ?? 'arduino-cli bulunamadı.'}</span>
      <button
        onClick={() => void browseForCliPath()}
        className="rounded border border-amber-700 bg-amber-900 px-2 py-1 hover:bg-amber-800"
      >
        arduino-cli yolunu seç
      </button>
      <button
        onClick={() => void yenidenDenearduinoCli()}
        className="rounded border border-amber-700 bg-amber-900 px-2 py-1 hover:bg-amber-800"
      >
        Yeniden dene
      </button>
      <a
        href={ARDUINO_CLI_DOWNLOAD_URL}
        onClick={(e) => {
          e.preventDefault()
          window.open(ARDUINO_CLI_DOWNLOAD_URL)
        }}
        className="rounded border border-amber-700 bg-amber-900 px-2 py-1 hover:bg-amber-800"
      >
        İndirme sayfası
      </a>
    </div>
  )
}

export default CliStatusBanner
