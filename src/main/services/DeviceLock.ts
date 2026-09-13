import { SerialService } from './SerialService'

function beklet(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Derleme/yükleme işlemleri ile seri port erişimini koordine eden kilit
 * mekanizması. İki görevi var:
 *  1) Aynı anda yalnızca tek bir derleme/yükleme işlemine izin vermek.
 *  2) Yükleme sırasında seri portu güvenli biçimde kapatıp, yükleme
 *     bitince (başarılı/başarısız fark etmeksizin) kullanıcı açıksa
 *     otomatik olarak geri açmak.
 */
export class DeviceLock {
  private mesgul = false
  private uploadIcinGeciciKapatildi = false

  constructor(private readonly serial: SerialService) {}

  isBusy(): boolean {
    return this.mesgul
  }

  /** Seri port şu an yükleme yüzünden mi geçici olarak kapalı (UI göstergesi için) */
  isTemporarilyClosedForUpload(): boolean {
    return this.uploadIcinGeciciKapatildi
  }

  /**
   * Derleme ve yükleme gibi karşılıklı dışlamalı (mutually exclusive)
   * işlemleri sarmalar; aynı anda ikinci bir derleme/yükleme başlatılmaya
   * çalışılırsa hemen hata fırlatır.
   */
  async runExclusive<T>(gorev: () => Promise<T>): Promise<T> {
    if (this.mesgul) {
      throw new Error('Zaten devam eden bir derleme veya yükleme işlemi var')
    }
    this.mesgul = true
    try {
      return await gorev()
    } finally {
      this.mesgul = false
    }
  }

  /**
   * Yüklemeyi seri port kilidiyle koordine eder:
   * 1. Hedef port açıksa kapat ve serbest kaldığından emin olmak için 300ms bekle
   * 2. uploadFn'i çalıştır (gerçek `arduino-cli upload` çağrısı)
   * 3. Sonuç ne olursa olsun (başarılı/başarısız), portu kapatmışsak
   *    kartın (ör. ESP32) yeniden boot etmesi için 500ms bekleyip aynı
   *    baud hızıyla geri aç
   */
  async runUpload<T>(port: string, uploadFn: () => Promise<T>): Promise<T> {
    return this.runExclusive(async () => {
      const portAcikMiydi = this.serial.isOpen() && this.serial.aktifPort() === port
      // Port zaten açıksa gerçek baud'u kullan; kapalıysa geri açma adımı
      // hiç çalışmayacağı için bu değer kullanılmaz.
      const oncekiBaud = this.serial.aktifBaud() ?? 115200

      if (portAcikMiydi) {
        this.uploadIcinGeciciKapatildi = true
        await this.serial.close()
        await beklet(300)
      }

      try {
        return await uploadFn()
      } finally {
        if (portAcikMiydi) {
          await beklet(500)
          try {
            await this.serial.open(port, oncekiBaud)
          } catch {
            // Port geri açılamadı (ör. cihaz çıkarıldı). Yükleme sonucunu
            // etkilemesin diye burada yutuluyor; kullanıcı seri monitörden
            // "Bağlan" ile tekrar deneyebilir.
          } finally {
            this.uploadIcinGeciciKapatildi = false
          }
        }
      }
    })
  }
}
