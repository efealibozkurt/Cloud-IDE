import type { CompileResult } from '../../shared/types'
import { cekirdegiAyikla, kutuphaneleriAyikla } from './compileInfo'
import type { HistoryService } from './HistoryService'
import type { SettingsService } from './SettingsService'

/**
 * Başarılı bir derlemeyi sürüm geçmişine işler (kart, kütüphane/çekirdek sürümleri, bellek kullanımı).
 * Hem arayüzden hem Cloud AI'ın kendi derlemelerinden çağrılır. Hata derlemeyi etkilemez.
 */
export async function derlemeyiGecmiseIsle(
  history: HistoryService,
  settings: SettingsService,
  sketchPath: string,
  fqbn: string,
  sonuc: CompileResult
): Promise<void> {
  if (!sonuc.success) return
  try {
    const otomatik = settings.get('historyAutoSnapshot') !== false
    const kayit = await history.derlemeKaydet(
      sketchPath,
      {
        fqbn,
        zaman: Date.now(),
        boyut: sonuc.boyut,
        kutuphaneler: kutuphaneleriAyikla(sonuc.log),
        cekirdek: cekirdegiAyikla(sonuc.log)
      },
      otomatik
    )
    if (kayit && kayit.tur === 'derleme') await history.prune(sketchPath, settings.get('historyMaxAuto') ?? 50)
  } catch {
    // geçmiş yazılamadıysa derleme sonucu yine de kullanıcıya iletilir
  }
}
