import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { ExampleGroup } from '@shared/types'
import { useAppState } from '../../state/AppStateContext'

interface ExamplesMenuProps {
  onClose: () => void
}

/**
 * "Derle"/"Yükle" düğmelerinin yanındaki "Örnekler" açılır menüsü.
 * Kurulu kütüphanelerin ve kurulu kart platformlarının (core) gömülü
 * kütüphanelerinin örnek sketch'lerini listeler; bir örneğe tıklanınca
 * doğrudan sketch olarak açılır (bkz. AppStateContext.openExample).
 */
function ExamplesMenu({ onClose }: ExamplesMenuProps): ReactElement {
  const { openExample } = useAppState()
  const [gruplar, setGruplar] = useState<ExampleGroup[] | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [arama, setArama] = useState('')

  useEffect(() => {
    let iptalEdildi = false
    window.api.arduinoCli
      .listExamples()
      .then((sonuc) => {
        if (!iptalEdildi) setGruplar(sonuc)
      })
      .catch((h) => {
        if (!iptalEdildi) setHata(h instanceof Error ? h.message : 'Örnekler yüklenemedi')
      })
    return () => {
      iptalEdildi = true
    }
  }, [])

  const filtrelenmis = useMemo(() => {
    if (!gruplar) return []
    const q = arama.trim().toLowerCase()
    if (!q) return gruplar
    return gruplar
      .map((g) => ({
        ...g,
        examples: g.examples.filter(
          (o) => o.name.toLowerCase().includes(q) || g.ownerName.toLowerCase().includes(q)
        )
      }))
      .filter((g) => g.examples.length > 0)
  }, [gruplar, arama])

  const kutuphaneGruplari = filtrelenmis.filter((g) => g.source === 'library')
  const cekirdekGruplari = filtrelenmis.filter((g) => g.source === 'core')
  const aramaAktif = arama.trim().length > 0

  const secildi = (folderPath: string, name: string): void => {
    void openExample(folderPath, name)
    onClose()
  }

  return (
    <div className="absolute left-0 top-full z-30 mt-1 w-80 rounded border border-panel-border bg-panel-light shadow-xl">
      <div className="border-b border-panel-border p-2">
        <input
          autoFocus
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Örnek ara..."
          className="w-full rounded border border-panel-border bg-panel px-2 py-1 text-xs text-gray-200 outline-none focus:border-accent"
        />
      </div>
      <div className="max-h-96 overflow-y-auto p-1 text-xs">
        {!gruplar && !hata && <div className="p-3 text-center text-gray-500">Yükleniyor...</div>}
        {hata && <div className="p-3 text-center text-red-400">{hata}</div>}
        {gruplar && filtrelenmis.length === 0 && (
          <div className="p-3 text-center text-gray-500">
            {aramaAktif ? 'Eşleşen örnek yok' : 'Kurulu kütüphane/kart örneği yok'}
          </div>
        )}
        {kutuphaneGruplari.length > 0 && (
          <div className="mb-1">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Kütüphanelerim
            </div>
            {kutuphaneGruplari.map((g) => (
              <ExampleGroupItem key={`library-${g.ownerName}`} grup={g} zorlaAcik={aramaAktif} onSelect={secildi} />
            ))}
          </div>
        )}
        {cekirdekGruplari.length > 0 && (
          <div>
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Kart Örnekleri
            </div>
            {cekirdekGruplari.map((g) => (
              <ExampleGroupItem
                key={`core-${g.coreName}-${g.ownerName}`}
                grup={g}
                zorlaAcik={aramaAktif}
                onSelect={secildi}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface ExampleGroupItemProps {
  grup: ExampleGroup
  /** Arama aktifken (sonuçlar zaten süzülmüş durumdayken) grup her zaman açık gösterilir */
  zorlaAcik: boolean
  onSelect: (folderPath: string, name: string) => void
}

function ExampleGroupItem({ grup, zorlaAcik, onSelect }: ExampleGroupItemProps): ReactElement {
  const [acik, setAcik] = useState(false)
  const gosterilecekAcik = zorlaAcik || acik

  return (
    <div>
      <button
        onClick={() => setAcik((a) => !a)}
        className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-gray-300 hover:bg-panel-border"
      >
        <span className={`inline-block transition-transform ${gosterilecekAcik ? 'rotate-90' : ''}`}>▸</span>
        <span className="truncate">{grup.ownerName}</span>
        {grup.source === 'core' && grup.coreName && (
          <span className="ml-auto shrink-0 truncate pl-1 text-[10px] text-gray-500">{grup.coreName}</span>
        )}
      </button>
      {gosterilecekAcik && (
        <div className="ml-4 border-l border-panel-border pl-2">
          {grup.examples.map((o) => (
            <button
              key={o.folderPath}
              onClick={() => onSelect(o.folderPath, o.name)}
              title={o.name}
              className="block w-full truncate rounded px-2 py-1 text-left text-gray-400 hover:bg-panel-border hover:text-gray-100"
            >
              {o.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ExamplesMenu
