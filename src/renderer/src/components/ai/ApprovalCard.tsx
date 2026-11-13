import { useMemo, useState, type ReactElement } from 'react'
import { baglamliFark, farkOzeti, satirFarki } from '../../utils/diff'
import type { BekleyenOnay } from '../../state/AgentContext'

interface ApprovalCardProps {
  onay: BekleyenOnay
  onCevap: (approved: boolean, answer?: string) => void
  /** Değişikliği editörde açmak için */
  onDosyaAc?: (filePath: string) => void
}

function dosyaAdi(yol: string): string {
  return yol.replace(/\\/g, '/').split('/').pop() ?? yol
}

/** Agent bir dosyayı değiştirmeden önce farkı gösterir ve onay ister; ya da kullanıcıya bir soru sorar. */
function ApprovalCard({ onay, onCevap, onDosyaAc }: ApprovalCardProps): ReactElement {
  if (onay.kind === 'question') return <SoruKarti onay={onay} onCevap={onCevap} />
  return <DegisiklikKarti onay={onay} onCevap={onCevap} onDosyaAc={onDosyaAc} />
}

function DegisiklikKarti({ onay, onCevap, onDosyaAc }: ApprovalCardProps): ReactElement {
  const diff = onay.diff
  const satirlar = useMemo(() => (diff ? satirFarki(diff.before, diff.after) : []), [diff])
  const ozet = useMemo(() => farkOzeti(satirlar), [satirlar])
  const gorunen = useMemo(() => baglamliFark(satirlar, 2), [satirlar])
  const [tamami, setTamami] = useState(false)

  const kisaltilmis = !tamami && gorunen.length > 80
  const liste = kisaltilmis ? gorunen.slice(0, 80) : gorunen

  return (
    <div className="rounded border border-amber-500/40 bg-panel-light text-xs">
      <div className="flex items-center justify-between gap-2 border-b border-panel-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-gray-100">
            {diff ? (diff.isNew ? 'Yeni dosya' : 'Dosya değişikliği') : 'Onay gerekiyor'}
            {diff && <span className="ml-1.5 font-normal text-gray-400">{dosyaAdi(diff.filePath)}</span>}
          </p>
          {!diff && <p className="mt-0.5 text-gray-400 [overflow-wrap:anywhere]">{onay.message}</p>}
        </div>
        {diff && (
          <span className="shrink-0 tabular-nums text-gray-400">
            <span className="text-emerald-400">+{ozet.eklenen}</span>{' '}
            <span className="text-rose-400">−{ozet.silinen}</span>
          </span>
        )}
      </div>

      {diff && (
        <div className="max-h-64 overflow-auto bg-panel font-mono text-[11px] leading-[1.45]">
          {liste.map((s, i) =>
            'atlanan' in s ? (
              <div key={i} className="px-3 py-0.5 text-gray-500">
                … {s.atlanan} satır değişmedi
              </div>
            ) : (
              <div
                key={i}
                className={`flex whitespace-pre px-3 ${
                  s.tur === 'eklendi'
                    ? 'bg-emerald-500/10 text-emerald-200'
                    : s.tur === 'silindi'
                    ? 'bg-rose-500/10 text-rose-200'
                    : 'text-gray-400'
                }`}
              >
                <span className="w-4 shrink-0 select-none text-gray-600">
                  {s.tur === 'eklendi' ? '+' : s.tur === 'silindi' ? '−' : ' '}
                </span>
                <span>{s.metin || ' '}</span>
              </div>
            )
          )}
          {kisaltilmis && (
            <button onClick={() => setTamami(true)} className="w-full px-3 py-1 text-left text-accent-hover hover:underline">
              Tamamını göster
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 px-3 py-2">
        {diff && onDosyaAc && !diff.isNew && (
          <button onClick={() => onDosyaAc(diff.filePath)} className="mr-auto text-gray-400 hover:text-gray-200 hover:underline">
            Dosyayı aç
          </button>
        )}
        <button
          onClick={() => onCevap(false)}
          className="rounded border border-panel-border px-3 py-1 text-gray-300 hover:bg-white/5"
        >
          Reddet
        </button>
        <button onClick={() => onCevap(true)} className="rounded bg-accent px-3 py-1 font-medium text-white hover:bg-accent-hover">
          Uygula
        </button>
      </div>
    </div>
  )
}

function SoruKarti({ onay, onCevap }: Pick<ApprovalCardProps, 'onay' | 'onCevap'>): ReactElement {
  const [metin, setMetin] = useState('')
  return (
    <div className="rounded border border-accent/50 bg-panel-light p-3 text-xs">
      <p className="whitespace-pre-wrap text-gray-100 [overflow-wrap:anywhere]">{onay.message}</p>
      {onay.options && onay.options.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {onay.options.map((o) => (
            <button
              key={o}
              onClick={() => onCevap(true, o)}
              className="rounded border border-panel-border px-2.5 py-1 text-gray-200 hover:bg-white/5"
            >
              {o}
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <input
          value={metin}
          onChange={(e) => setMetin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && metin.trim()) onCevap(true, metin.trim())
          }}
          placeholder="Yanıtınızı yazın"
          className="min-w-0 flex-1 rounded border border-panel-border bg-panel px-2 py-1 text-gray-100 outline-none focus:border-accent"
        />
        <button
          disabled={!metin.trim()}
          onClick={() => onCevap(true, metin.trim())}
          className="rounded bg-accent px-3 py-1 font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        >
          Gönder
        </button>
        <button onClick={() => onCevap(false)} className="rounded border border-panel-border px-3 py-1 text-gray-300 hover:bg-white/5">
          Atla
        </button>
      </div>
    </div>
  )
}

export default ApprovalCard
