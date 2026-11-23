import { useEffect, type ReactElement, type ReactNode } from 'react'
import { Tus } from './Tus'
import { useT } from '../../i18n'

interface ConfirmModalProps {
  baslik: string
  children: ReactNode
  onayMetni: string
  tehlikeli?: boolean
  onOnay: () => void
  onVazgec: () => void
}

/** Native window.confirm yerine uygulamanın temasına uyan küçük onay penceresi. */
function ConfirmModal({ baslik, children, onayMetni, tehlikeli, onOnay, onVazgec }: ConfirmModalProps): ReactElement {
  const t = useT()
  useEffect(() => {
    const tus = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onVazgec()
    }
    window.addEventListener('keydown', tus)
    return () => window.removeEventListener('keydown', tus)
  }, [onVazgec])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onVazgec()
      }}
    >
      <div role="alertdialog" aria-modal="true" aria-label={baslik} className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-[8px] border border-panel-border bg-panel-light p-4 shadow-2xl">
        <h3 className="text-[13px] font-medium text-gray-100 [overflow-wrap:anywhere]">{baslik}</h3>
        <div className="mt-2 text-xs leading-relaxed text-gray-400 [overflow-wrap:anywhere]">{children}</div>
        <div className="mt-4 flex justify-end gap-2">
          <Tus onClick={onVazgec}>{t('Vazgeç')}</Tus>
          <Tus tur={tehlikeli ? 'tehlike' : 'birincil'} onClick={onOnay} autoFocus>
            {onayMetni}
          </Tus>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
