/**
 * Yaygın USB-seri çevirici ve kart kimlikleri. Kart paketi kurulu değilken arduino-cli kartı tanıyamaz;
 * bu tablo yine de kullanıcıya "şu tür bir kart bağlandı" diyebilmek içindir.
 */

export interface UsbCipi {
  ad: string
  /** Kullanıcıya gösterilecek açıklama: bu çip hangi kartlarda bulunur ve ne yapılmalı */
  aciklama: string
}

const TABLO: Array<{ vid: string; pid?: string; cip: UsbCipi }> = [
  {
    vid: '1A86',
    cip: {
      ad: 'CH340 USB-seri çevirici',
      aciklama: 'NodeMCU, Nano klonu ve birçok ESP32 geliştirme kartında bulunur. Kartın adını kart seçiciden seçin; port görünmüyorsa CH340 sürücüsü gerekebilir.'
    }
  },
  {
    vid: '10C4',
    pid: 'EA60',
    cip: {
      ad: 'CP210x USB-seri çevirici',
      aciklama: 'ESP32 DevKit ve NodeMCU gibi kartlarda yaygındır. Kartın adını kart seçiciden seçin.'
    }
  },
  {
    vid: '0403',
    cip: { ad: 'FTDI USB-seri çevirici', aciklama: 'Eski Arduino Nano/Pro Mini ve FTDI adaptörlerinde bulunur. Kartın adını kart seçiciden seçin.' }
  },
  {
    vid: '303A',
    cip: {
      ad: 'Espressif yerleşik USB',
      aciklama: 'ESP32-S2/S3/C3 kartı doğrudan USB’den bağlı. Kart seçicide ilgili ESP32 modelini (ör. ESP32S3 Dev Module) seçin; yükleme için BOOT düğmesine basmanız gerekebilir.'
    }
  },
  { vid: '2E8A', cip: { ad: 'Raspberry Pi Pico', aciklama: 'Pico için “Raspberry Pi Pico/RP2040” kart paketi kurulu olmalı (Kart yöneticisi).' } },
  { vid: '2341', cip: { ad: 'Arduino', aciklama: 'Resmi bir Arduino kartı. İlgili kart paketi kuruluysa kart kendiliğinden tanınır.' } },
  { vid: '2A03', cip: { ad: 'Arduino (dog hunter)', aciklama: 'Arduino uyumlu kart. Kart seçiciden modelini seçin.' } },
  { vid: '1209', cip: { ad: 'Deneyap / açık donanım kartı', aciklama: 'Kart paketi kuruluysa kendiliğinden tanınır; değilse Kart yöneticisinden “Deneyap” paketini kurun.' } }
]

/** USB üretici/ürün kimliğinden (onaltılık, büyük/küçük harf fark etmez) çip bilgisini bulur. */
export function usbCipiBul(vendorId: string | undefined, productId: string | undefined): UsbCipi | null {
  if (!vendorId) return null
  const v = vendorId.replace(/^0x/i, '').toUpperCase().padStart(4, '0')
  const p = productId?.replace(/^0x/i, '').toUpperCase().padStart(4, '0')
  const eslesen = TABLO.find((t) => t.vid === v && (t.pid === undefined || t.pid === p))
  return eslesen?.cip ?? null
}
