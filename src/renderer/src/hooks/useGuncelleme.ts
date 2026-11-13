import { useEffect, useState } from 'react'
import type { UpdateStatus } from '@shared/types'

/** Uygulama güncelleme durumu (ana süreçten gelir). İlk değer sorgulanır, sonra olaylarla güncellenir. */
export function useGuncelleme(): UpdateStatus {
  const [durum, setDurum] = useState<UpdateStatus>({ durum: 'bosta' })

  useEffect(() => {
    let iptal = false
    window.api.updater
      .getStatus()
      .then((s) => !iptal && setDurum(s))
      .catch(() => undefined)
    const kaldir = window.api.updater.onStatus((s) => setDurum(s))
    return () => {
      iptal = true
      kaldir()
    }
  }, [])

  return durum
}
