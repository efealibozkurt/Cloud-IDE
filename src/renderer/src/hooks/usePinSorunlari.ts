import { useEffect, useMemo, useState } from 'react'
import { pinleriDenetle, pinOzetiCikar, type PinKaynakDosya, type PinOzeti, type PinSorunu } from '@shared/pinCheck'
import { useAppState } from '../state/AppStateContext'
import { ayniDosyaMi } from '../utils/paths'

const KAYNAK_TURLERI = new Set(['ino', 'h', 'hpp', 'cpp', 'c'])

/**
 * Aktif projenin pin kullanımını seçili karta göre denetler. Açık sekmelerdeki (kaydedilmemiş)
 * içerik esas alınır; açık olmayan dosyalar diskten okunur. Yazarken yorulmamak için gecikmeli çalışır.
 */
export interface PinDenetimSonucu {
  sorunlar: PinSorunu[]
  ozet: PinOzeti
  /** En az bir kez denetim tamamlandı mı (ilk yüklemede "denetleniyor" göstermek için) */
  hazir: boolean
  /** Denetlenen dosya sayısı */
  dosyaSayisi: number
}

export function usePinSorunlari(): PinDenetimSonucu {
  const { state } = useAppState()
  const { info, workspaceSketches, activeSketchPath, tabs } = state.sketch
  const fqbn = state.arduinoCli.selectedFqbn
  const [sonuc, setSonuc] = useState<PinDenetimSonucu>({ sorunlar: [], ozet: { kartAdi: null, kullanimlar: [] }, hazir: false, dosyaSayisi: 0 })

  const aktif = useMemo(
    () => (activeSketchPath ? workspaceSketches.find((s) => ayniDosyaMi(s.folderPath, activeSketchPath)) : null) ?? info,
    [activeSketchPath, workspaceSketches, info]
  )

  // Sekme içeriklerinden türetilen kısa imza: yalnızca değişince yeniden denetle
  const imza = aktif
    ? tabs
        .filter((t) => t.sketchFolderPath && ayniDosyaMi(t.sketchFolderPath, aktif.folderPath))
        .map((t) => `${t.path}:${t.content.length}:${t.content.slice(0, 40)}:${t.content.slice(-40)}`)
        .join('|')
    : ''

  useEffect(() => {
    if (!aktif) {
      setSonuc({ sorunlar: [], ozet: { kartAdi: null, kullanimlar: [] }, hazir: true, dosyaSayisi: 0 })
      return
    }
    let iptal = false
    const zamanlayici = setTimeout(() => {
      void (async () => {
        const dosyalar: PinKaynakDosya[] = []
        for (const f of aktif.files) {
          if (!KAYNAK_TURLERI.has(f.kind)) continue
          const acik = tabs.find((t) => ayniDosyaMi(t.path, f.path))
          try {
            dosyalar.push({ dosya: f.path, icerik: acik ? acik.content : await window.api.sketch.readFile(f.path) })
          } catch {
            // okunamayan dosya denetime katılmaz
          }
        }
        if (!iptal) setSonuc({ sorunlar: pinleriDenetle(dosyalar, fqbn), ozet: pinOzetiCikar(dosyalar, fqbn), hazir: true, dosyaSayisi: dosyalar.length })
      })()
    }, 600)
    return () => {
      iptal = true
      clearTimeout(zamanlayici)
    }
    // tabs yerine imza kullanılır: her tuş vuruşunda değil, içerik gerçekten değişince çalışsın
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktif, fqbn, imza])

  return sonuc
}
