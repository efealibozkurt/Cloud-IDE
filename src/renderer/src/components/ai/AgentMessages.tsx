import { useState, type ReactElement } from 'react'
import type { AgentToolStep, ChatMessage } from '@shared/types'
import type { CanliAdim, CanliCalisma } from '../../state/AgentContext'
import { MarkdownRenderer } from './MarkdownRenderer'
import { useT } from '../../i18n'

const YAZMA_ARACLARI = new Set([
  'edit_file',
  'write_file',
  'create_sketch',
  'delete_file',
  'rename_file',
  'delete_sketch',
  'rename_sketch'
])

function Nokta({ durum }: { durum: 'calisiyor' | 'tamam' | 'hata' }): ReactElement {
  if (durum === 'calisiyor') {
    return <span className="h-3 w-3 shrink-0 animate-spin rounded-full border border-gray-500 border-t-transparent" />
  }
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${durum === 'tamam' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
}

function AdimSatiri({ label, durum, detail }: { label: string; durum: 'calisiyor' | 'tamam' | 'hata'; detail?: string }): ReactElement {
  return (
    <li className="flex min-w-0 items-center gap-2 py-0.5 text-gray-400">
      <span className="flex w-3 justify-center">
        <Nokta durum={durum} />
      </span>
      <span className={`min-w-0 flex-1 truncate ${durum === 'hata' ? 'text-rose-300' : ''}`} title={label}>
        {label}
      </span>
      {detail && <span className="shrink-0 text-gray-500">{detail}</span>}
    </li>
  )
}

/** Tamamlanmış bir yanıttaki araç adımlarını özetler; varsayılan olarak kapalıdır. */
function AdimOzeti({ adimlar }: { adimlar: AgentToolStep[] }): ReactElement | null {
  const t = useT()
  const [acik, setAcik] = useState(false)
  if (adimlar.length === 0) return null
  const yazma = adimlar.filter((a) => YAZMA_ARACLARI.has(a.name) && a.ok).length
  const hata = adimlar.filter((a) => !a.ok).length
  const ozet = [t('{n} adım', { n: adimlar.length }), yazma ? t('{n} dosya değişti', { n: yazma }) : null, hata ? t('{n} hata', { n: hata }) : null]
    .filter(Boolean)
    .join(', ')
  return (
    <div className="mb-2 text-xs">
      <button onClick={() => setAcik((a) => !a)} className="text-gray-500 hover:text-gray-300" aria-expanded={acik}>
        {acik ? t('Adımları gizle') : ozet}
      </button>
      {acik && (
        <ul className="mt-1">
          {adimlar.map((a) => (
            <AdimSatiri key={a.callId} label={a.label} durum={a.ok ? 'tamam' : 'hata'} detail={a.detail} />
          ))}
        </ul>
      )}
    </div>
  )
}

interface MesajProps {
  mesaj: ChatMessage
  onGeriAl: (mesajId: string) => void
  geriAlinabilir: boolean
}

export function MesajBaloncugu({ mesaj, onGeriAl, geriAlinabilir }: MesajProps): ReactElement {
  const t = useT()
  if (mesaj.rol === 'kullanici') {
    return (
      <div className="ml-6 min-w-0 rounded bg-white/[0.06] px-3 py-2 text-[12px] leading-relaxed text-gray-100 [overflow-wrap:anywhere]">
        <MarkdownRenderer content={mesaj.metin} />
      </div>
    )
  }

  return (
    <div className="min-w-0 text-[12px] [overflow-wrap:anywhere]">
      {mesaj.toolSteps && <AdimOzeti adimlar={mesaj.toolSteps} />}
      {mesaj.isCompactedSummary && <p className="mb-1 text-xs text-gray-500">{t('Önceki konuşmanın özeti')}</p>}
      <div className={mesaj.isError ? 'rounded border border-rose-500/40 bg-rose-500/5 px-3 py-2' : ''}>
        <MarkdownRenderer content={mesaj.metin} />
      </div>
      {mesaj.checkpointId && (
        <div className="mt-1.5 text-xs">
          {mesaj.undone ? (
            <span className="text-gray-500">{t('Değişiklikler geri alındı')}</span>
          ) : (
            <button
              onClick={() => onGeriAl(mesaj.id)}
              disabled={!geriAlinabilir}
              className="text-gray-400 hover:text-gray-100 hover:underline disabled:cursor-not-allowed disabled:text-gray-600 disabled:no-underline"
              title={t('Bu yanıttaki tüm dosya değişikliklerini geri al')}
            >
              {t('Değişiklikleri geri al')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Planlar({ plan }: { plan: CanliCalisma['plan'] }): ReactElement | null {
  if (plan.length === 0) return null
  return (
    <ul className="mb-2 rounded border border-panel-border px-3 py-2 text-xs">
      {plan.map((p, i) => (
        <li key={i} className={`flex min-w-0 items-start gap-2 py-0.5 ${p.done ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
          <span className="mt-0.5 shrink-0">{p.done ? '✓' : '○'}</span>
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{p.text}</span>
        </li>
      ))}
    </ul>
  )
}

/** Devam eden çalışmanın canlı görünümü: plan, adımlar, düşünce ve yazılmakta olan yanıt. */
export function CanliGorunum({ calisma }: { calisma: CanliCalisma }): ReactElement {
  const t = useT()
  const [dusunceAcik, setDusunceAcik] = useState(false)
  const adimlar: CanliAdim[] = calisma.adimlar
  // Uzun çalışmalarda yalnızca son adımları göster; tam liste yanıt bitince özetlenir
  const gorunenAdimlar = adimlar.slice(-6)

  return (
    <div className="min-w-0 text-[12px] [overflow-wrap:anywhere]">
      <Planlar plan={calisma.plan} />
      {gorunenAdimlar.length > 0 && (
        <ul className="mb-2 text-xs">
          {adimlar.length > gorunenAdimlar.length && (
            <li className="py-0.5 pl-5 text-gray-600">{t('{n} önceki adım', { n: adimlar.length - gorunenAdimlar.length })}</li>
          )}
          {gorunenAdimlar.map((a) => (
            <AdimSatiri key={a.callId} label={a.label} durum={a.durum} detail={a.detail} />
          ))}
        </ul>
      )}
      {calisma.dusunce && (
        <div className="mb-2 text-xs">
          <button onClick={() => setDusunceAcik((d) => !d)} className="text-gray-500 hover:text-gray-300" aria-expanded={dusunceAcik}>
            {dusunceAcik ? t('Düşünceyi gizle') : t('Düşünüyor…')}
          </button>
          {dusunceAcik && (
            <p className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap border-l border-panel-border pl-3 text-gray-500">
              {calisma.dusunce}
            </p>
          )}
        </div>
      )}
      {calisma.metin && <MarkdownRenderer content={calisma.metin} />}
      <p className={`mt-1 text-xs ${calisma.uyari ? 'text-amber-300' : 'text-gray-500'}`}>{calisma.durum}</p>
    </div>
  )
}
